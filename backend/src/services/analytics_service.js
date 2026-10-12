import { AsyncLocalStorage } from "node:async_hooks";
import prisma from "../config/db.js";
import { enqueueJob, requestDrain } from "./job_queue_service.js";
import { getPlatformSettings, isCreditTierPolicyEnabled } from "./platform_settings_service.js";

// FR-ANL-002: product event instrumentation.
//
// Events are written to analytics_events by a job-queue handler, so emitting
// one never makes a request wait for the database write and a failure to record
// a metric can never fail the business operation ("losing a metric must not
// lose a booking"). Nothing here throws to its caller.
//
// The property bag holds reference identifiers, counts and categories only.
// Each event has an allow-list of property names, so personal data cannot be
// stored even by a careless call.

export const ANALYTICS_JOB_TYPE = "analytics_event";

// Every event in FR-ANL-002 and the properties it may carry.
export const EVENT_PROPERTIES = {
  // Discovery
  search_performed: ["input_mode", "filters_applied", "result_count", "category"],
  listing_viewed: ["listing_id", "category"],
  seller_page_viewed: [],
  // Booking
  booking_started: ["listing_id", "rental_days"],
  booking_created: [
    "listing_id",
    "channel",
    "down_payment_percentage",
    "days_before_service_start",
    "credit_tier",
    "tier_policy_enabled",
  ],
  booking_completed: ["listing_id", "credit_tier"],
  booking_cancelled: ["from_status", "credit_tier"],
  // Payment
  down_payment_succeeded: ["amount_sen", "payment_method", "on_time"],
  balance_succeeded: ["amount_sen", "payment_method", "on_time"],
  payment_expired: ["down_payment_percentage", "hours_past_deadline", "credit_tier", "tier_policy_enabled"],
  balance_expired: ["down_payment_percentage", "hours_past_deadline", "credit_tier", "tier_policy_enabled"],
  down_payment_forfeited: ["amount_sen", "cause"],
  // Fleet operations
  return_confirmed: ["hours_late", "charge_recorded", "another_booking_within_day"],
  return_hold_extended: [],
  return_hold_conflict: [],
  // Risk
  no_show_marked: ["down_payment_percentage", "balance_paid", "credit_tier", "tier_policy_enabled"],
  exposure_blocked: ["credit_tier", "limit", "open_unpaid_count"],
  // Commercial and support
  payout_settled: ["payout_id", "amount_sen"],
  chat_escalated: ["conversation_id"],
};

export const EVENT_NAMES = Object.keys(EVENT_PROPERTIES);

export const KNOWN_CREDIT_TIERS = ["Normal", "Trusted", "Caution", "High Risk"];

const MAX_STRING_LENGTH = 64;
const MAX_LIST_LENGTH = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

function looksPersonal(text) {
  // An email address or a long run of digits (a phone or ID number) has no
  // place in a property bag whatever its key.
  return /@/.test(text) || /\d{8,}/.test(text.replace(/[\s-]/g, ""));
}

function cleanScalar(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || text.length > MAX_STRING_LENGTH || looksPersonal(text)) return undefined;
    return text;
  }
  return undefined;
}

// Keeps only allow-listed keys with plain, short, non-personal values.
export function sanitizeProperties(name, properties = {}) {
  const allowed = EVENT_PROPERTIES[name] || [];
  const clean = {};

  for (const key of allowed) {
    const value = properties?.[key];
    if (Array.isArray(value)) {
      const list = value.map(cleanScalar).filter((item) => item !== undefined).slice(0, MAX_LIST_LENGTH);
      if (list.length || value.length === 0) clean[key] = list;
      continue;
    }
    const scalar = cleanScalar(value);
    if (scalar !== undefined) clean[key] = scalar;
  }

  return clean;
}

export function buildAnalyticsEvent({ name, userId, operatorId, bookingId, properties, occurredAt = new Date() }) {
  if (!Object.hasOwn(EVENT_PROPERTIES, name)) {
    throw new Error(`Unknown analytics event "${name}".`);
  }

  const id = (value) => (Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null);

  return {
    name,
    userId: id(userId),
    operatorId: id(operatorId),
    bookingId: id(bookingId),
    properties: sanitizeProperties(name, properties),
    occurredAt: new Date(occurredAt).toISOString(),
  };
}

// ── Never blocking a request ────────────────────────────────────────────────

const requestContext = new AsyncLocalStorage();

// Remembers the current request, so an event raised anywhere beneath it can be
// held back until the response has gone out, and can pick up who is signed in.
export function analyticsContextMiddleware(req, res, next) {
  requestContext.run({ req, res }, next);
}

function logFailure(name, error) {
  console.error(`[Analytics] Could not record "${name}":`, error?.message || error);
}

// Runs `task` after the response has been sent when called inside a request,
// otherwise on the next turn of the event loop. The caller never waits for it.
function runAfterResponse(task, { delayMs = 0 } = {}) {
  const context = requestContext.getStore();
  const res = context?.res;

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    setTimeout(task, delayMs);
  };

  if (res && !res.writableFinished && !res.destroyed) {
    res.once("finish", start);
    res.once("close", start);
  } else {
    start();
  }
}

// Writes one event to the job queue. The queue row is the durable record: the
// worker turns it into an analytics_events row.
export async function recordEventJob(event, { enqueue = enqueueJob, drain = requestDrain } = {}) {
  const payload = buildAnalyticsEvent(event);
  await enqueue({ jobType: ANALYTICS_JOB_TYPE, payload });
  drain();
  return payload;
}

// Emits an event without blocking and without ever throwing.
export function trackEvent(event, { delayMs = 0, record = recordEventJob, schedule = runAfterResponse } = {}) {
  try {
    const context = requestContext.getStore();

    schedule(
      async () => {
        try {
          await record({
            ...event,
            // Whoever is signed in when the request finishes, unless the caller named a user.
            userId: event.userId ?? context?.req?.user?.id ?? context?.req?.analyticsUserId ?? null,
            operatorId: event.operatorId ?? context?.req?.user?.operatorId ?? null,
          });
        } catch (error) {
          logFailure(event?.name, error);
        }
      },
      { delayMs }
    );
  } catch (error) {
    logFailure(event?.name, error);
  }
}

// ── Booking events ──────────────────────────────────────────────────────────

const BOOKING_SNAPSHOT = {
  id: true,
  customerId: true,
  operatorId: true,
  listingId: true,
  channel: true,
  status: true,
  creditTier: true,
  pickupDate: true,
  createdAt: true,
  lateReturnHours: true,
  lateReturnCharge: true,
  payment: {
    select: {
      amount: true,
      method: true,
      downPaymentAmount: true,
      finalPaymentAmount: true,
      downPaymentStatus: true,
      finalPaymentStatus: true,
      downPaymentPaidAt: true,
      finalPaymentPaidAt: true,
      downPaymentDueDate: true,
      finalPaymentDueDate: true,
    },
  },
};

export function toSen(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

// The share of the total the operator asked for up front, as it stands on the
// payment row. Null when there is no payment to measure.
export function downPaymentPercentage(payment) {
  const total = Number(payment?.amount);
  if (!payment || !(total > 0)) return null;
  return Math.round((Number(payment.downPaymentAmount || 0) / total) * 100);
}

export function daysBeforeServiceStart(booking, from = booking?.createdAt) {
  if (!booking?.pickupDate || !from) return null;
  return Math.max(0, Math.floor((new Date(booking.pickupDate).getTime() - new Date(from).getTime()) / DAY_MS));
}

// The credit tier recorded on the booking, so a later change to the customer's
// tier does not rewrite what they were offered. Older bookings without a usable
// value fall back to the customer's current tier.
async function creditContext(booking, database) {
  let tier = KNOWN_CREDIT_TIERS.includes(booking.creditTier) ? booking.creditTier : null;
  if (!tier) {
    const profile = await database.customerCreditProfile.findUnique({
      where: { customerId: booking.customerId },
      select: { tier: true },
    });
    tier = KNOWN_CREDIT_TIERS.includes(profile?.tier) ? profile.tier : "Normal";
  }

  // Where the conditional tier policy is not in force the tier is still recorded,
  // and this flag lets the comparison be limited to bookings it applied to.
  const settings = await getPlatformSettings(database);
  const policyOn = await isCreditTierPolicyEnabled(settings, booking.operatorId, database);

  return { credit_tier: tier, tier_policy_enabled: Boolean(policyOn) };
}

function bookingEventProperties(name, booking, credit, extra) {
  const base = { listing_id: booking.listingId };

  switch (name) {
    case "booking_created":
      return {
        ...base,
        channel: booking.channel,
        down_payment_percentage: downPaymentPercentage(booking.payment),
        days_before_service_start: daysBeforeServiceStart(booking),
        ...credit,
        ...extra,
      };
    case "booking_completed":
      return { ...base, credit_tier: credit.credit_tier, ...extra };
    case "booking_cancelled":
      return { credit_tier: credit.credit_tier, ...extra };
    case "payment_expired":
    case "balance_expired":
      return { down_payment_percentage: downPaymentPercentage(booking.payment), ...credit, ...extra };
    case "down_payment_forfeited":
      // The amount the customer paid up front and will not get back.
      return { amount_sen: toSen(booking.payment?.downPaymentAmount), ...extra };
    case "no_show_marked":
      return {
        down_payment_percentage: downPaymentPercentage(booking.payment),
        balance_paid: booking.payment?.finalPaymentStatus === "PAID",
        ...credit,
        ...extra,
      };
    default:
      return { ...base, ...extra };
  }
}

// Emits an event about a booking. The booking is read after the response has
// gone out, so the extra queries never slow a request down. `verifyStatus`
// guards events raised inside a transaction: if the booking is not in that
// status when the event is built, the change did not commit and no event is
// recorded.
export function trackBookingEvent(
  name,
  bookingId,
  { extra = {}, verifyStatus = null, delayMs = 0, database = prisma, schedule = runAfterResponse, record = recordEventJob } = {}
) {
  try {
    schedule(
      async () => {
        try {
          const booking = await database.booking.findUnique({ where: { id: bookingId }, select: BOOKING_SNAPSHOT });
          if (!booking) return;
          if (verifyStatus && booking.status !== verifyStatus) return;
          // Nothing is forfeited unless a down payment was actually paid.
          if (name === "down_payment_forfeited" && booking.payment?.downPaymentStatus !== "PAID") return;

          const credit = await creditContext(booking, database);
          await record({
            name,
            userId: booking.customerId,
            operatorId: booking.operatorId,
            bookingId: booking.id,
            properties: bookingEventProperties(name, booking, credit, extra),
          });
        } catch (error) {
          logFailure(name, error);
        }
      },
      { delayMs }
    );
  } catch (error) {
    logFailure(name, error);
  }
}

// A part of the payment has just been paid: the down payment, the balance, or
// both for a full payment. Called after the payment is saved.
export function trackPaymentSuccess({ bookingId, payment, previousPayment = null }, options = {}) {
  const parts = [
    ["down_payment_succeeded", payment?.downPaymentStatus, previousPayment?.downPaymentStatus, "downPayment"],
    ["balance_succeeded", payment?.finalPaymentStatus, previousPayment?.finalPaymentStatus, "finalPayment"],
  ];

  for (const [name, status, previousStatus, part] of parts) {
    if (status !== "PAID" || previousStatus === "PAID") continue;

    const paidAt = payment[`${part}PaidAt`];
    const dueAt = payment[`${part}DueDate`];

    trackBookingEvent(
      name,
      bookingId,
      {
        ...options,
        extra: {
          amount_sen: toSen(payment[`${part}Amount`]),
          payment_method: payment.method,
          on_time: paidAt && dueAt ? new Date(paidAt).getTime() <= new Date(dueAt).getTime() : null,
        },
      }
    );
  }
}

// ── The queue handler ───────────────────────────────────────────────────────

// Idempotent: the job id is unique on the table, so a job that runs twice after
// a lease expiry records its event once.
export async function handleAnalyticsEvent(payload, job, database = prisma) {
  const event = buildAnalyticsEvent({ ...payload, occurredAt: payload.occurredAt });

  await database.analyticsEvent.createMany({
    data: [
      {
        name: event.name,
        userId: event.userId,
        operatorId: event.operatorId,
        bookingId: event.bookingId,
        properties: event.properties,
        jobId: job.id,
        createdAt: new Date(event.occurredAt),
      },
    ],
    skipDuplicates: true,
  });
}
