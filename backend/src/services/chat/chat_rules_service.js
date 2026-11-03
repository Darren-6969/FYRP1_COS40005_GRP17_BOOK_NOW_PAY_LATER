// Layer 1: fixed answers from the policy library's chat templates, filled
// with live numbers, with no AI call. Wording is edited on the admin
// Policies & Answers page; numbers come from operator settings and the
// customer's own bookings (chat_booking_summary_service).

import prisma from "../../config/db.js";
import { fillTemplate, matchTemplate, ringgit } from "../../utils/chat_text.js";
import { PUBLIC_LISTING_WHERE } from "../public_car_service.js";
import {
  bookingCards,
  bookingLines,
  licenceLines,
  paymentLines,
  upcomingBookings,
} from "./chat_booking_summary_service.js";

const CACHE_MS = 60 * 1000;
const CAR_WORDS_MS = 10 * 60 * 1000;

let templateCache = null; // { at, list, byKey }
let carWordsCache = null; // { at, words }

export const FIND_CAR_ACTION = { key: "find-car", label: "Find a car" };

// Templates that list the customer's own bookings, and the line builder and
// card focus for each.
const BOOKING_TEMPLATES = {
  "booking-status": { placeholder: "booking_lines", lines: bookingLines, focus: "status" },
  "payments-due": { placeholder: "payment_lines", lines: paymentLines, focus: "payments" },
  "licence-status": { placeholder: "licence_lines", lines: licenceLines, focus: "licence" },
};

/** Current version of every template, in admin order. */
export async function loadTemplates() {
  if (templateCache && Date.now() - templateCache.at < CACHE_MS) return templateCache;
  const rows = await prisma.chatAnswerTemplate.findMany({ orderBy: [{ key: "asc" }, { version: "desc" }] });
  const byKey = new Map();
  for (const row of rows) if (!byKey.has(row.key)) byKey.set(row.key, row);
  const list = [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  templateCache = { at: Date.now(), list, byKey };
  return templateCache;
}

// Called after an admin publishes a template, so the next answer uses it.
export function clearTemplateCache() {
  templateCache = null;
}

/** Makes and models on the platform: naming one makes a message specific. */
async function carWords() {
  if (carWordsCache && Date.now() - carWordsCache.at < CAR_WORDS_MS) return carWordsCache.words;
  const rows = await prisma.listing.findMany({
    where: PUBLIC_LISTING_WHERE,
    select: { vehicleMake: true, vehicleModel: true },
  });
  const words = new Set();
  rows.forEach((r) => {
    if (r.vehicleMake) words.add(r.vehicleMake.toLowerCase());
    if (r.vehicleModel) {
      words.add(r.vehicleModel.toLowerCase());
      // "Bezza 1.3 AV" is usually typed as just "Bezza".
      const first = r.vehicleModel.split(/\s+/)[0];
      if (first && first.length > 2) words.add(first.toLowerCase());
    }
  });
  carWordsCache = { at: Date.now(), words: [...words] };
  return carWordsCache.words;
}

/** Buttons shown under the welcome message and after fallbacks. */
export async function quickActions({ signedIn }) {
  const { list } = await loadTemplates();
  const fromTemplates = list
    .filter((t) => t.quickActionLabel && (signedIn || !t.signedInOnly))
    .map((t) => ({ key: t.key, label: t.quickActionLabel }));
  return [FIND_CAR_ACTION, ...fromTemplates];
}

/** The template key for a typed message, or null if Layer 1 can't answer it. */
export async function matchMessage(text) {
  const [{ list }, words] = await Promise.all([loadTemplates(), carWords()]);
  return matchTemplate(text, list, { carWords: words });
}

// ── Filling ─────────────────────────────────────────────────────────

/** Placeholder values for the car on screen, from its public DTO. */
export function carValues(listing) {
  if (!listing) return {};
  const refund = listing.booking.refundRule;
  const hourlySen = listing.booking.rateCard?.hourlySen;
  return {
    car_name: `${listing.vehicleMake} ${listing.vehicleModel}`.trim(),
    deposit_percent: listing.booking.downPaymentPct,
    refund_rule:
      refund?.type === "PARTIAL"
        ? `${refund.refundPct}% of the deposit is returned if you cancel before pickup.`
        : "the operator keeps the deposit if you cancel.",
    late_hourly_rate: hourlySen ? ringgit(hourlySen) : null,
  };
}

function text(body) {
  return { kind: "text", text: body };
}

/**
 * The fixed answer for a template key, as a chat message payload, or null
 * when the template doesn't exist.
 *   listing: the public DTO of the car on screen, if any
 *   customerId: the signed-in customer, from the session only
 */
export async function ruleAnswer(key, { listing = null, customerId = null } = {}) {
  const { byKey } = await loadTemplates();

  const booking = BOOKING_TEMPLATES[key];
  if (booking) {
    if (!customerId) {
      const signIn = byKey.get("sign-in-needed");
      return {
        kind: "text",
        text: signIn?.body || "Sign in to see your bookings.",
        links: [{ label: "Sign in", href: "/login?redirect=%2Fassistant" }],
        templateKey: "sign-in-needed",
      };
    }
    const template = byKey.get(key);
    if (!template) return null;
    const bookings = await upcomingBookings(customerId);
    if (!bookings.length) {
      return {
        kind: "text",
        text: "You have no upcoming car bookings. I can help you find a car.",
        links: [{ label: "My bookings", href: "/customer/bookings" }],
        templateKey: key,
      };
    }
    const filled = fillTemplate(template.body, { [booking.placeholder]: booking.lines(bookings) }) || template.body;
    const intro = template.body.split(`{${booking.placeholder}}`)[0].trim();
    return { kind: "bookings", text: filled, intro, bookings: bookingCards(bookings, booking.focus), templateKey: key };
  }

  // A car on screen gets the ".car" version when every number is known.
  if (listing) {
    const carTemplate = byKey.get(`${key}.car`);
    const filled = carTemplate && fillTemplate(carTemplate.body, carValues(listing));
    if (filled) return { ...text(filled), templateKey: `${key}.car` };
  }

  const template = byKey.get(key);
  if (!template) return null;
  const filled = fillTemplate(template.body, {});
  return filled ? { ...text(filled), templateKey: key } : null;
}

/** The welcome message with its quick actions. */
export async function welcomeMessage({ signedIn }) {
  const { byKey } = await loadTemplates();
  return {
    kind: "text",
    text: byKey.get("welcome")?.body || "Hi! I can help you find a car, or explain deposits, refunds and other rules.",
    templateKey: "welcome",
    actions: await quickActions({ signedIn }),
  };
}
