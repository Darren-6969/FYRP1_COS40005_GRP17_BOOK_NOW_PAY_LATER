import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import prisma from "../../src/config/db.js";

// Database guarantees the application relies on, checked against a real
// PostgreSQL (SRS 6.7.2): the role the app runs as, the unique constraints, the
// foreign keys and the per-listing lock. Run by CI as the application role,
// which is never a superuser. Locally they skip when no database is set up.

const hasDatabase = Boolean(process.env.DATABASE_URL);
const inCi = Boolean(process.env.CI);
// In CI a missing database is a failure, not a skip, so the suite cannot go green by not running.
const skip = !hasDatabase && !inCi && "DATABASE_URL is not set";

const run = `ci${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const created = { listings: [], branches: [], users: [], operators: [] };

async function rejectionOf(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  return null;
}

describe("database guarantees (application role, real PostgreSQL)", { skip }, () => {
  let operator;
  let user;

  before(async () => {
    assert.ok(hasDatabase, "DATABASE_URL must be set in CI");
    operator = await prisma.operator.create({
      data: { operatorCode: `T-${run}`, companyName: `Test operator ${run}`, email: `op-${run}@ci.invalid` },
    });
    created.operators.push(operator.id);
    user = await prisma.user.create({
      data: { userCode: `U-${run}`, name: "CI user", email: `user-${run}@ci.invalid`, password: "not-a-real-hash" },
    });
    created.users.push(user.id);
  });

  after(async () => {
    // Children before parents. Failures here must not hide the test result.
    const attempt = (work) => work.catch(() => {});
    await attempt(prisma.booking.deleteMany({ where: { operatorId: { in: created.operators } } }));
    await attempt(prisma.listing.deleteMany({ where: { id: { in: created.listings } } }));
    await attempt(prisma.branch.deleteMany({ where: { id: { in: created.branches } } }));
    await attempt(prisma.user.deleteMany({ where: { id: { in: created.users } } }));
    await attempt(prisma.operator.deleteMany({ where: { id: { in: created.operators } } }));
    await prisma.$disconnect();
  });

  describe("the connection", () => {
    test("is the application role and never a superuser", async () => {
      const [role] = await prisma.$queryRaw`
        SELECT current_user AS name, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
        FROM pg_roles WHERE rolname = current_user`;

      assert.equal(role.rolsuper, false, `${role.name} must not be a superuser`);
      assert.equal(role.rolbypassrls, false, `${role.name} must not bypass row-level security`);
      assert.equal(role.rolcreatedb, false, `${role.name} must not create databases`);
      assert.equal(role.rolcreaterole, false, `${role.name} must not create roles`);
      if (process.env.INTEGRATION_EXPECT_ROLE) {
        assert.equal(role.name, process.env.INTEGRATION_EXPECT_ROLE);
      }
    });

    test("cannot change the schema", async () => {
      const err = await rejectionOf(prisma.$executeRawUnsafe(`CREATE TABLE ci_probe_${run} (id int)`));
      assert.ok(err, "creating a table must be refused for the application role");
      assert.match(`${err.message} ${JSON.stringify(err.meta || {})}`, /permission denied|42501/i);
    });

    test("sees every migration applied and none failed", async () => {
      const migrationsDir = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));
      const onDisk = readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
      const [{ applied, unfinished }] = await prisma.$queryRaw`
        SELECT count(*) FILTER (WHERE finished_at IS NOT NULL)::int AS applied,
               count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished
        FROM _prisma_migrations`;

      assert.equal(unfinished, 0, "a migration started and did not finish");
      assert.equal(applied, onDisk, "the database is missing migrations that are in the repository");
    });

    test("can read and write every table it needs", async () => {
      const tables = await prisma.$queryRaw`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`;
      assert.ok(tables.length > 30, "expected the application's tables");

      for (const { table_name: table } of tables) {
        const [{ privileges }] = await prisma.$queryRawUnsafe(
          `SELECT concat_ws(',',
             CASE WHEN has_table_privilege(current_user, $1, 'SELECT') THEN 'S' END,
             CASE WHEN has_table_privilege(current_user, $1, 'INSERT') THEN 'I' END,
             CASE WHEN has_table_privilege(current_user, $1, 'UPDATE') THEN 'U' END,
             CASE WHEN has_table_privilege(current_user, $1, 'DELETE') THEN 'D' END) AS privileges`,
          `public."${table}"`
        );
        assert.equal(privileges, "S,I,U,D", `${table}: the application role needs select, insert, update and delete`);
      }
    });
  });

  describe("unique constraints", () => {
    test("two users cannot share an email", async () => {
      const err = await rejectionOf(
        prisma.user.create({
          data: { userCode: `U2-${run}`, name: "Second", email: user.email, password: "not-a-real-hash" },
        })
      );
      assert.equal(err?.code, "P2002");
      assert.deepEqual(err.meta.target, ["email"]);
    });

    test("two operators cannot share an email", async () => {
      const err = await rejectionOf(
        prisma.operator.create({
          data: { operatorCode: `T2-${run}`, companyName: "Second operator", email: operator.email },
        })
      );
      assert.equal(err?.code, "P2002");
    });

    test("two bookings cannot share a booking code", async () => {
      const data = {
        bookingCode: `BK-${run}`,
        customerId: user.id,
        operatorId: operator.id,
        serviceName: "CI booking",
        bookingDate: new Date(),
        totalAmount: "100.00",
      };
      await prisma.booking.create({ data });
      const err = await rejectionOf(prisma.booking.create({ data }));
      assert.equal(err?.code, "P2002");
    });
  });

  describe("foreign keys", () => {
    test("a booking needs a real customer and a real operator", async () => {
      const base = {
        serviceName: "CI booking",
        bookingDate: new Date(),
        totalAmount: "100.00",
      };

      const noCustomer = await rejectionOf(
        prisma.booking.create({
          data: { ...base, bookingCode: `BK-noc-${run}`, customerId: 2_000_000_000, operatorId: operator.id },
        })
      );
      assert.equal(noCustomer?.code, "P2003");

      const noOperator = await rejectionOf(
        prisma.booking.create({
          data: { ...base, bookingCode: `BK-noo-${run}`, customerId: user.id, operatorId: 2_000_000_000 },
        })
      );
      assert.equal(noOperator?.code, "P2003");
    });

    test("an operator with bookings cannot be deleted", async () => {
      const err = await rejectionOf(prisma.operator.delete({ where: { id: operator.id } }));
      // PostgreSQL's own refusal (restrict_violation, 23001); Prisma has no friendlier code for it.
      assert.ok(err, "the delete went through");
      assert.match(err.message, /23001|violates RESTRICT/i);
    });
  });

  describe("the per-listing lock", () => {
    test("one booking at a time works on a listing, and the lock is released afterwards", async () => {
      const branch = await prisma.branch.create({
        data: { operatorId: operator.id, name: `Branch ${run}`, address: "1 Test Road" },
      });
      created.branches.push(branch.id);
      const listing = await prisma.listing.create({
        data: {
          operatorId: operator.id,
          branchId: branch.id,
          category: "CAR_RENTAL",
          name: `Listing ${run}`,
          price: "200.00",
        },
      });
      created.listings.push(listing.id);

      let release;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      let markLocked;
      const locked = new Promise((resolve) => {
        markLocked = resolve;
      });

      // The booking flow locks the listing row first (booking_creation_orchestrator).
      const first = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listing.id} FOR UPDATE`;
          markLocked();
          await held;
        },
        { timeout: 15_000 }
      );
      await locked;

      // A second booking for the same listing has to wait. With a short wait limit it gives up.
      const second = await rejectionOf(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '300ms'`;
          await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listing.id} FOR UPDATE`;
        })
      );
      assert.ok(second, "a second transaction must not get the lock while the first holds it");
      assert.match(`${second.message} ${JSON.stringify(second.meta || {})}`, /55P03|lock timeout|could not obtain lock/i);

      release();
      await first;

      // The lock goes when the first transaction ends.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
        const rows = await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listing.id} FOR UPDATE`;
        assert.equal(rows.length, 1);
      });
    });
  });
});
