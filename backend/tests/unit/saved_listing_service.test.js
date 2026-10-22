import test from "node:test";
import assert from "node:assert/strict";
import {
  listSavedListingIds,
  listSavedListings,
  saveListing,
  toSavedItem,
  unsaveListing,
} from "../../src/services/saved_listing_service.js";

function row(id, overrides = {}) {
  return {
    id,
    listingId: id,
    createdAt: new Date(`2026-10-${10 + id}T00:00:00Z`),
    listing: {
      id,
      name: "Listing name",
      vehicleMake: "Perodua",
      vehicleModel: "Myvi",
      modelYear: 2024,
      vehicleType: "HATCHBACK",
      seats: 5,
      transmission: "AUTOMATIC",
      price: "120.50",
      images: [{ imageUrl: `https://img/${id}.webp` }],
      operator: { id: 7, slug: "andaman", companyName: "Andaman Motors" },
      branch: { name: "Kuching Branch", city: "Kuching" },
      ...overrides,
    },
  };
}

// A stand-in for the two Prisma models the service touches.
function fakeDb({ saved = [], live = [] } = {}) {
  const calls = [];
  return {
    calls,
    savedListing: {
      findMany: async (args) => {
        calls.push(["savedListing.findMany", args]);
        return args.select ? saved.map((r) => ({ listingId: r.listingId })) : saved;
      },
      upsert: async (args) => calls.push(["savedListing.upsert", args]),
      deleteMany: async (args) => calls.push(["savedListing.deleteMany", args]),
    },
    listing: {
      findMany: async (args) => {
        calls.push(["listing.findMany", args]);
        return live.filter((id) => args.where.id.in.includes(id)).map((id) => ({ id }));
      },
      findFirst: async (args) => {
        calls.push(["listing.findFirst", args]);
        return live.includes(args.where.id) ? { id: args.where.id } : null;
      },
    },
  };
}

test("maps a saved row to the saved page card", () => {
  const item = toSavedItem(row(1), new Set([1]));
  assert.equal(item.listingId, 1);
  assert.equal(item.available, true);
  assert.equal(item.car.title, "Perodua Myvi");
  assert.equal(item.car.vehicleType, "Hatchback");
  assert.equal(item.car.dailyRateSen, 12050);
  assert.equal(item.car.imageUrl, "https://img/1.webp");
  assert.deepEqual(item.car.operator, { id: 7, slug: "andaman", companyName: "Andaman Motors" });
});

test("falls back to the listing name and no photo", () => {
  const item = toSavedItem(row(2, { vehicleMake: null, vehicleModel: null, images: [] }), new Set());
  assert.equal(item.car.title, "Listing name");
  assert.equal(item.car.imageUrl, null);
});

test("a listing that is no longer public stays on the list as unavailable", async () => {
  const db = fakeDb({ saved: [row(1), row(2)], live: [1] });
  const items = await listSavedListings(9, db);
  assert.deepEqual(items.map((i) => [i.listingId, i.available]), [[1, true], [2, false]]);
  const [, liveArgs] = db.calls.find(([name]) => name === "listing.findMany");
  assert.equal(liveArgs.where.status, "PUBLISHED");
  assert.deepEqual(liveArgs.where.operator, { status: "ACTIVE", subscriptionStatus: "ACTIVE" });
});

test("an empty saved list makes no availability query", async () => {
  const db = fakeDb();
  assert.deepEqual(await listSavedListings(9, db), []);
  assert.equal(db.calls.some(([name]) => name === "listing.findMany"), false);
});

test("returns just the ids for the hearts", async () => {
  const db = fakeDb({ saved: [row(3), row(4)] });
  assert.deepEqual(await listSavedListingIds(9, db), [3, 4]);
});

test("saving is idempotent and scoped to the customer", async () => {
  const db = fakeDb({ live: [5] });
  assert.deepEqual(await saveListing(9, 5, db), { listingId: 5, saved: true });
  const [, args] = db.calls.find(([name]) => name === "savedListing.upsert");
  assert.deepEqual(args.where, { customerId_listingId: { customerId: 9, listingId: 5 } });
  assert.deepEqual(args.update, {});
});

test("a car that cannot be booked cannot be saved", async () => {
  const db = fakeDb({ live: [] });
  await assert.rejects(saveListing(9, 5, db), (err) => err.statusCode === 404 && err.appCode === "LISTING_NOT_FOUND");
  assert.equal(db.calls.some(([name]) => name === "savedListing.upsert"), false);
});

test("removing works even when the listing is gone", async () => {
  const db = fakeDb({ live: [] });
  assert.deepEqual(await unsaveListing(9, 5, db), { listingId: 5, saved: false });
  const [, args] = db.calls.find(([name]) => name === "savedListing.deleteMany");
  assert.deepEqual(args.where, { customerId: 9, listingId: 5 });
});
