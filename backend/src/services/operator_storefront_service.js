// Operator seller page (SRS 4.2.7, FR-CUST-007). The page is the operator's
// own shop front: a short link they share on WhatsApp and social media, with
// their profile, every published car grouped by branch, branch contact
// details and the terms every booking with them follows.

import { Prisma } from "@prisma/client";
import prisma from "../config/db.js";
import { BALANCE_DUE_HOURS_BEFORE_PICKUP, DEPOSIT_WINDOW_HOURS, klPlainDate } from "./car_pricing_service.js";
import { horizonAvailability } from "./car_availability_service.js";
import { LISTING_INCLUDE, PUBLIC_LISTING_WHERE, loadOperatorFacts, refundRuleFor, toCarDto } from "./public_car_service.js";

const DEFAULT_DOWN_PAYMENT_PCT = 30;
const MOST_BOOKED_WINDOW_DAYS = 90;
const MOST_BOOKED_MIN_BOOKINGS = 3;
const MOST_BOOKED_LIMIT = 3;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/;
const RESERVED_SLUGS = new Set(["new", "edit", "admin", "api", "operator", "operators", "settings"]);

function fail(statusCode, appCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.appCode = appCode;
  return err;
}

// ── Slugs ────────────────────────────────────────────────────────────

// "Borneo Wheels Sdn. Bhd." -> "borneo-wheels". Same rule as the backfill
// in migration 20261006090000_operator_storefront.
export function slugify(companyName) {
  return String(companyName || "")
    .replace(/\s*(sdn\.?\s*bhd\.?|bhd\.?|enterprise)\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

// A free slug for a new operator; appends -2, -3 ... on a clash.
export async function uniqueOperatorSlug(companyName, db = prisma) {
  const stem = slugify(companyName) || "operator";
  for (let n = 1; n < 50; n += 1) {
    const candidate = n === 1 ? stem : `${stem}-${n}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const taken = await db.operator.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${stem}-${Date.now().toString(36)}`;
}

// ── Opening hours ────────────────────────────────────────────────────

// Seven entries, Monday first. Falls back to the single daily pair.
export function weekFor(branch) {
  if (Array.isArray(branch.weeklyHours) && branch.weeklyHours.length === 7) {
    return branch.weeklyHours.map((d, i) => ({
      day: DAYS[i],
      closed: Boolean(d?.closed),
      open: d?.closed ? null : d?.open ?? null,
      close: d?.closed ? null : d?.close ?? null,
    }));
  }
  const known = branch.openTime && branch.closeTime;
  return DAYS.map((day) => ({
    day,
    closed: false,
    open: known ? branch.openTime : null,
    close: known ? branch.closeTime : null,
  }));
}

export function validateWeeklyHours(value) {
  // Clearing per-day hours falls back to the branch's single daily pair.
  if (value === null) return Prisma.DbNull;
  if (!Array.isArray(value) || value.length !== 7) {
    throw fail(400, "HOURS_INVALID", "Opening hours need one entry for each day, Monday first");
  }
  return value.map((d, i) => {
    if (d?.closed) return { closed: true };
    if (!HHMM.test(d?.open || "") || !HHMM.test(d?.close || "") || d.open >= d.close) {
      throw fail(400, "HOURS_INVALID", `${DAYS[i]}: enter an opening time before the closing time, or mark it closed`);
    }
    return { closed: false, open: d.open, close: d.close };
  });
}

// ── Public page ──────────────────────────────────────────────────────

function pointDto(p) {
  return {
    id: String(p.id),
    label: p.label,
    address: p.address || "",
    usage: p.usage,
    pickupFeeSen: Math.round(Number(p.fee || 0) * 100),
    dropoffFeeSen: Math.round(Number(p.dropoffFee || 0) * 100),
  };
}

function branchDto(branch, carCount) {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    phone: branch.phone || null,
    hours: weekFor(branch),
    hoursKnown: Boolean(branch.weeklyHours || (branch.openTime && branch.closeTime)),
    pickupPoints: branch.pickupPoints.map(pointDto),
    carCount,
  };
}

function termsFor(config) {
  const methods = config?.acceptedPaymentMethods || { stripe: true, duitnow: true };
  return {
    downPaymentPct: config?.downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PCT,
    depositWindowHours: DEPOSIT_WINDOW_HOURS,
    balanceDueHoursBeforePickup: BALANCE_DUE_HOURS_BEFORE_PICKUP,
    refundRule: refundRuleFor(config),
    responseWindowHours: config ? Math.max(1, Math.round(config.bookingResponseDeadlineMinutes / 60)) : 2,
    autoRejectOnTimeout: config?.autoRejectInactiveBooking ?? true,
    paymentMethods: {
      card: Boolean(methods.stripe),
      duitnow: Boolean(methods.duitnow),
    },
  };
}

// Cars with enough recent completed bookings to call them popular. Below
// the threshold the section is left out rather than showing a weak list.
async function mostBookedIds(operatorId, listingIds) {
  if (!listingIds.length) return [];
  const since = new Date(Date.now() - MOST_BOOKED_WINDOW_DAYS * 86400000);
  const rows = await prisma.booking.groupBy({
    by: ["listingId"],
    where: {
      operatorId,
      listingId: { in: listingIds },
      status: "COMPLETED",
      pickupDate: { gte: since },
    },
    _count: { _all: true },
  });
  return rows
    .filter((r) => r._count._all >= MOST_BOOKED_MIN_BOOKINGS)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, MOST_BOOKED_LIMIT)
    .map((r) => r.listingId);
}

async function findOperator(handle) {
  const raw = String(handle || "").trim().toLowerCase();
  const where = /^\d+$/.test(raw) ? { id: Number(raw) } : { slug: raw };
  return prisma.operator.findFirst({
    where,
    select: {
      id: true,
      slug: true,
      companyName: true,
      logoUrl: true,
      coverImageUrl: true,
      about: true,
      establishedYear: true,
      languages: true,
      status: true,
      subscriptionStatus: true,
      createdAt: true,
      branches: {
        where: { isActive: true },
        orderBy: [{ id: "asc" }],
        include: { pickupPoints: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      },
    },
  });
}

/**
 * Everything the seller page shows. Accepts the slug or the numeric id, so
 * the old /operators/:id links keep working; the page redirects to the slug.
 */
export async function getStorefront(handle) {
  const operator = await findOperator(handle);
  // Pending and rejected applicants have no public page at all.
  if (!operator || !["ACTIVE", "SUSPENDED"].includes(operator.status)) {
    throw fail(404, "OPERATOR_NOT_FOUND", "Operator not found");
  }

  const suspended = operator.status === "SUSPENDED" || operator.subscriptionStatus === "SUSPENDED";
  const listings = suspended
    ? []
    : await prisma.listing.findMany({
        where: { ...PUBLIC_LISTING_WHERE, operatorId: operator.id },
        include: LISTING_INCLUDE,
        orderBy: { createdAt: "desc" },
      });

  const [factsMap, availability, popular] = await Promise.all([
    loadOperatorFacts([operator.id]),
    horizonAvailability(listings),
    mostBookedIds(
      operator.id,
      listings.map((l) => l.id)
    ),
  ]);
  const facts = factsMap.get(operator.id);
  const cars = listings.map((l) => toCarDto(l, facts, availability.get(l.id)));
  const carCount = (branchId) => cars.filter((c) => c.branch.id === branchId).length;

  return {
    operator: {
      id: operator.id,
      slug: operator.slug,
      companyName: operator.companyName,
      logoUrl: operator.logoUrl,
      coverImageUrl: operator.coverImageUrl,
      about: operator.about,
      establishedYear: operator.establishedYear,
      languages: operator.languages,
      verified: facts.verified,
      activeSince: klPlainDate(operator.createdAt),
      completedBookings: facts.completedBookings,
      branchCount: facts.branchCount,
      responseTimeMins: facts.responseTimeMins,
      acceptanceRate: facts.acceptanceRate,
      takingBookings: !suspended,
    },
    branches: operator.branches.map((b) => branchDto(b, carCount(b.id))),
    terms: termsFor(facts.config),
    mostBookedIds: popular,
    cars,
  };
}

// Operator cards for the landing page band, newest activity first.
export async function listFeaturedOperators({ city, limit = 6 } = {}) {
  const where = { ...PUBLIC_LISTING_WHERE };
  if (city) where.branch = { ...where.branch, city: { equals: city, mode: "insensitive" } };
  const grouped = await prisma.listing.groupBy({ by: ["operatorId"], where, _count: { _all: true } });
  if (!grouped.length) return [];

  const ids = grouped.map((g) => g.operatorId);
  const [operators, facts] = await Promise.all([
    prisma.operator.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        slug: true,
        companyName: true,
        logoUrl: true,
        coverImageUrl: true,
        branches: { where: { isActive: true }, select: { city: true } },
      },
    }),
    loadOperatorFacts(ids),
  ]);

  return operators
    .map((o) => {
      const f = facts.get(o.id);
      return {
        id: o.id,
        slug: o.slug,
        companyName: o.companyName,
        logoUrl: o.logoUrl,
        coverImageUrl: o.coverImageUrl,
        cities: [...new Set(o.branches.map((b) => b.city).filter(Boolean))],
        carCount: grouped.find((g) => g.operatorId === o.id)?._count._all ?? 0,
        verified: f.verified,
        completedBookings: f.completedBookings,
      };
    })
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.completedBookings - a.completedBookings || b.carCount - a.carCount)
    .slice(0, Math.min(Math.max(Number(limit) || 6, 1), 12));
}

// ── Operator-side editing ────────────────────────────────────────────

export async function getOwnStorefront(operatorId) {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      id: true,
      slug: true,
      companyName: true,
      about: true,
      coverImageUrl: true,
      establishedYear: true,
      languages: true,
      branches: {
        orderBy: { id: "asc" },
        select: { id: true, name: true, phone: true, openTime: true, closeTime: true, weeklyHours: true, isActive: true },
      },
    },
  });
  if (!operator) throw fail(404, "OPERATOR_NOT_FOUND", "Operator not found");
  return {
    ...operator,
    branches: operator.branches.map((b) => ({ ...b, hours: weekFor(b) })),
  };
}

/**
 * Update the seller page profile and branch hours. Only fields that are
 * sent change. body: { slug, about, coverImageUrl, establishedYear,
 * languages, branches: [{ id, phone, weeklyHours }] }
 */
export async function updateOwnStorefront(operatorId, body) {
  const data = {};

  if (body.slug !== undefined) {
    const slug = String(body.slug).trim().toLowerCase();
    if (!SLUG.test(slug) || RESERVED_SLUGS.has(slug)) {
      throw fail(400, "SLUG_INVALID", "Use 3 to 50 lowercase letters, numbers and dashes, starting and ending with a letter or number");
    }
    const taken = await prisma.operator.findFirst({ where: { slug, NOT: { id: operatorId } }, select: { id: true } });
    if (taken) throw fail(409, "SLUG_TAKEN", "Another operator already uses that link");
    data.slug = slug;
  }
  if (body.about !== undefined) {
    const about = body.about ? String(body.about).trim() : null;
    if (about && about.length > 2000) throw fail(400, "ABOUT_TOO_LONG", "Keep the description under 2,000 characters");
    data.about = about;
  }
  if (body.coverImageUrl !== undefined) {
    const url = body.coverImageUrl ? String(body.coverImageUrl).trim() : null;
    if (url && !/^https:\/\//i.test(url)) throw fail(400, "COVER_INVALID", "The cover image must be an https link");
    data.coverImageUrl = url;
  }
  if (body.establishedYear !== undefined) {
    const year = body.establishedYear === null || body.establishedYear === "" ? null : Number(body.establishedYear);
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) {
      throw fail(400, "YEAR_INVALID", "Enter the year the business started");
    }
    data.establishedYear = year;
  }
  if (body.languages !== undefined) {
    if (!Array.isArray(body.languages)) throw fail(400, "LANGUAGES_INVALID", "Languages must be a list");
    data.languages = [...new Set(body.languages.map((l) => String(l).trim()).filter(Boolean))].slice(0, 8);
  }

  const branchUpdates = Array.isArray(body.branches) ? body.branches : [];
  const owned = branchUpdates.length
    ? await prisma.branch.findMany({ where: { operatorId, id: { in: branchUpdates.map((b) => Number(b.id)) } }, select: { id: true } })
    : [];
  const ownedIds = new Set(owned.map((b) => b.id));
  const branchWrites = branchUpdates.map((b) => {
    if (!ownedIds.has(Number(b.id))) throw fail(404, "BRANCH_NOT_FOUND", "Branch not found");
    const patch = {};
    if (b.phone !== undefined) patch.phone = b.phone ? String(b.phone).trim().slice(0, 30) : null;
    if (b.weeklyHours !== undefined) patch.weeklyHours = validateWeeklyHours(b.weeklyHours);
    return prisma.branch.update({ where: { id: Number(b.id) }, data: patch });
  });

  await prisma.$transaction([prisma.operator.update({ where: { id: operatorId }, data }), ...branchWrites]);
  return getOwnStorefront(operatorId);
}
