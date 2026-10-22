import prisma from "../config/db.js";
import { toSen } from "./car_pricing_service.js";
import { PUBLIC_LISTING_WHERE, VEHICLE_TYPE_LABEL } from "./public_car_service.js";

// BNPLB-108 (SRS 4.2.6): saved cars belong to the customer's account, so a
// save on one device shows on every device. A save holds the listing only,
// never dates. Saving is sign-in only; the routes are customer-role.

const SAVED_INCLUDE = {
  listing: {
    select: {
      id: true,
      name: true,
      vehicleMake: true,
      vehicleModel: true,
      modelYear: true,
      vehicleType: true,
      seats: true,
      transmission: true,
      price: true,
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { imageUrl: true } },
      operator: { select: { id: true, slug: true, companyName: true } },
      branch: { select: { name: true, city: true } },
    },
  },
};

function notFound() {
  const err = new Error("Listing not found");
  err.statusCode = 404;
  err.appCode = "LISTING_NOT_FOUND";
  return err;
}

// One saved car as the saved page shows it. `available` is false when the
// listing can no longer be booked (withdrawn, operator suspended, branch
// closed): the card stays, marked unavailable, rather than disappearing.
export function toSavedItem(row, availableIds) {
  const l = row.listing;
  const title = [l.vehicleMake, l.vehicleModel].filter(Boolean).join(" ") || l.name;
  return {
    listingId: l.id,
    savedAt: row.createdAt,
    available: availableIds.has(l.id),
    car: {
      title,
      modelYear: l.modelYear,
      vehicleType: VEHICLE_TYPE_LABEL[l.vehicleType] || "Car",
      seats: l.seats,
      transmission: l.transmission,
      imageUrl: l.images[0]?.imageUrl ?? null,
      dailyRateSen: toSen(l.price),
      operator: { id: l.operator.id, slug: l.operator.slug, companyName: l.operator.companyName },
      branch: { name: l.branch.name, city: l.branch.city },
    },
  };
}

export async function listSavedListings(customerId, db = prisma) {
  const rows = await db.savedListing.findMany({
    where: { customerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: SAVED_INCLUDE,
  });
  if (!rows.length) return [];
  // The public rule decides availability, so the saved page and search agree.
  const live = await db.listing.findMany({
    where: { id: { in: rows.map((r) => r.listingId) }, ...PUBLIC_LISTING_WHERE },
    select: { id: true },
  });
  const availableIds = new Set(live.map((l) => l.id));
  return rows.map((row) => toSavedItem(row, availableIds));
}

export async function listSavedListingIds(customerId, db = prisma) {
  const rows = await db.savedListing.findMany({ where: { customerId }, select: { listingId: true } });
  return rows.map((r) => r.listingId);
}

// Idempotent: saving a car that is already saved changes nothing, so a
// double tap is harmless. Only a car that can be booked now can be saved.
export async function saveListing(customerId, listingId, db = prisma) {
  const listing = await db.listing.findFirst({ where: { id: listingId, ...PUBLIC_LISTING_WHERE }, select: { id: true } });
  if (!listing) throw notFound();
  await db.savedListing.upsert({
    where: { customerId_listingId: { customerId, listingId } },
    create: { customerId, listingId },
    update: {},
  });
  return { listingId, saved: true };
}

// Removing works for any saved car, including one that is no longer available.
export async function unsaveListing(customerId, listingId, db = prisma) {
  await db.savedListing.deleteMany({ where: { customerId, listingId } });
  return { listingId, saved: false };
}
