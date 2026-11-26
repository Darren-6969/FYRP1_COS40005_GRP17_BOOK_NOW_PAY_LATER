import test from "node:test";
import assert from "node:assert/strict";
import { buildLogWhere, readLogFilters } from "../../src/services/audit_log_query_service.js";

test("no filters reads as page 1 of 25 with an empty where clause", () => {
  const filters = readLogFilters({});
  assert.equal(filters.page, 1);
  assert.equal(filters.pageSize, 25);
  assert.deepEqual(buildLogWhere(filters), {});
});

test("date range covers whole Malaysia days, to date inclusive", () => {
  const filters = readLogFilters({ from: "2026-11-27", to: "2026-11-27" });
  // 27 Nov 00:00 in Kuala Lumpur is 26 Nov 16:00 UTC.
  assert.equal(filters.fromAt.toISOString(), "2026-11-26T16:00:00.000Z");
  assert.equal(filters.toBefore.toISOString(), "2026-11-27T16:00:00.000Z");
  const [range] = buildLogWhere(filters).AND;
  assert.deepEqual(range, { createdAt: { gte: filters.fromAt, lt: filters.toBefore } });
});

test("a from date after the to date is refused", () => {
  assert.throws(() => readLogFilters({ from: "2026-11-28", to: "2026-11-27" }), (err) => {
    assert.equal(err.statusCode, 400);
    assert.equal(err.appCode, "LOG_FILTER_INVALID");
    return true;
  });
});

test("malformed dates, pages, page sizes and actors are refused", () => {
  for (const query of [
    { from: "27/11/2026" },
    { to: "2026-11-27x" },
    { to: "2026-02-31" },
    { page: "0" },
    { page: "abc" },
    { pageSize: "500" },
    { actor: "HACKER" },
  ]) {
    assert.throws(() => readLogFilters(query), { statusCode: 400 }, JSON.stringify(query));
  }
});

test("system actor means rows with no user; a role filters on the user's role", () => {
  assert.deepEqual(buildLogWhere(readLogFilters({ actor: "system" })), { AND: [{ userId: null }] });
  assert.deepEqual(buildLogWhere(readLogFilters({ actor: "NORMAL_SELLER" })), {
    AND: [{ user: { role: "NORMAL_SELLER" } }],
  });
});

test("search looks at action, entity, ids and the user's name and email, ignoring case", () => {
  const where = buildLogWhere(readLogFilters({ q: "  darren  " }));
  const [{ OR }] = where.AND;
  const contains = { contains: "darren", mode: "insensitive" };
  assert.deepEqual(OR, [
    { action: contains },
    { entityType: contains },
    { entityId: contains },
    { requestId: contains },
    { user: { name: contains } },
    { user: { email: contains } },
  ]);
});

test("action and entity filters match exactly and combine with others", () => {
  const where = buildLogWhere(readLogFilters({ action: "USER_LOGIN", entityType: "User", actor: "CUSTOMER" }));
  assert.deepEqual(where.AND, [
    { action: "USER_LOGIN" },
    { entityType: "User" },
    { user: { role: "CUSTOMER" } },
  ]);
});
