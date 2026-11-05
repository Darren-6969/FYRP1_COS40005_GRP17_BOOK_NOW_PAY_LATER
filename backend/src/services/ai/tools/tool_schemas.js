// Input schemas for the chatbot's read-only tools (chatbot design, "Layer 2:
// AI with read-only tools"). Each schema does two jobs: z.toJSONSchema turns
// it into the parameters the AI sees, and the same schema checks what the AI
// sends before a tool runs. Kept free of database access so it can be tested.
//
// Optional fields stay plain .optional() rather than .nullish(), because
// Gemini's schema support is narrower than OpenAI's. Models still send null
// for fields they leave out, so the runner drops nulls before checking.

import { z } from "zod";

const plainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM, 24-hour");
const listingId = z.coerce.number().int().min(1).max(1_000_000_000);
const ringgitAmount = z.coerce.number().min(0).max(100000);

const DATE_NOTE = "YYYY-MM-DD in Malaysia time. Work out relative dates such as 'next Friday' from today's date in the instructions.";

// The policy library's sections, as "document.section". Checked against the
// seed in the unit tests, so a renamed section can't drift silently.
export const POLICY_KEYS = [
  "terms.who-you-rent-from",
  "terms.sending-a-request",
  "terms.paying",
  "terms.driving-licence",
  "terms.missed-deadlines",
  "terms.at-the-counter",
  "privacy.what-we-collect",
  "privacy.why-we-use-it",
  "privacy.who-can-see-it",
  "privacy.your-rights",
  "refund-rules.before-acceptance",
  "refund-rules.missed-deadline",
  "refund-rules.if-you-cancel",
  "refund-rules.if-the-operator-cancels",
  "refund-rules.how-refunds-are-paid",
  "refund-rules.listing-withdrawn",
  "help.deposits-and-balance",
  "help.cancellations-and-refunds",
  "help.licence-checks",
  "help.duitnow-receipts",
  "help.pickup-and-dropoff",
  "help.late-returns",
  "car-faqs.international-permit",
  "car-faqs.when-is-balance-due",
  "car-faqs.late-pickup",
];

function bothDatesOrNeither(v, ctx) {
  const a = v.pickup_date ?? v.from;
  const b = v.return_date ?? v.to;
  if (Boolean(a) !== Boolean(b)) ctx.addIssue({ code: "custom", message: "Give both pickup_date and return_date, or neither" });
  else if (a && b && b < a) ctx.addIssue({ code: "custom", message: "return_date is before pickup_date" });
}

export const searchCarsSchema = z
  .object({
    city: z.string().trim().max(60).optional().describe("Pickup city, e.g. Kuching or Miri."),
    pickup_date: plainDate.optional().describe(`Pickup date, ${DATE_NOTE}`),
    return_date: plainDate.optional().describe(`Return date, ${DATE_NOTE}`),
    pickup_time: hhmm.optional().describe("Pickup time, HH:MM 24-hour. Default 10:00."),
    return_time: hhmm.optional().describe("Return time, HH:MM 24-hour. Default 10:00."),
    brands: z.array(z.string().trim().min(1).max(40)).max(5).optional().describe("Car brands, e.g. Toyota, Perodua, Proton."),
    models: z.array(z.string().trim().min(1).max(40)).max(5).optional().describe("Exact model names, e.g. Bezza, Vios, Alza."),
    vehicle_types: z.array(z.enum(["Compact", "Sedan", "SUV", "MPV", "Pickup"])).max(5).optional(),
    min_seats: z.coerce.number().int().min(1).max(15).optional().describe("Seats needed. Cars with at least this many seats match."),
    transmission: z.enum(["AUTOMATIC", "MANUAL"]).optional(),
    powertrain: z.array(z.enum(["Petrol", "Diesel", "Hybrid", "Electric"])).max(4).optional(),
    drivetrain: z.enum(["2WD", "4WD"]).optional().describe("4WD also covers AWD."),
    refund: z.enum(["partial", "none"]).optional().describe("partial: some of the deposit is refundable; none: the deposit is not refundable."),
    operator_ids: z.array(listingId).max(5).optional().describe("Only these operators, by operator_id from earlier results."),
    min_price_per_day: ringgitAmount.optional().describe("Lowest price per day, whole RM."),
    max_price_per_day: ringgitAmount.optional().describe("Highest price per day, whole RM."),
    min_pay_now: ringgitAmount.optional().describe("Lowest amount payable now (the deposit), whole RM. Needs dates."),
    max_pay_now: ringgitAmount.optional().describe("Highest amount payable now (the deposit), whole RM. Needs dates."),
    sort: z
      .enum(["recommended", "daily", "payable", "seats", "recent"])
      .optional()
      .describe("recommended (default), daily: cheapest per day, payable: lowest deposit, seats: smallest car that fits, recent: newest listings."),
  })
  .superRefine(bothDatesOrNeither);

export const getCarSchema = z.object({
  listing_id: listingId.optional().describe("The car's listing_id. Leave out for the car the customer is looking at."),
});

export const quotePriceSchema = z
  .object({
    listing_id: listingId.optional().describe("The car's listing_id. Leave out for the car the customer is looking at."),
    pickup_date: plainDate.describe(`Pickup date, ${DATE_NOTE}`),
    return_date: plainDate.describe(`Return date, ${DATE_NOTE}`),
    pickup_time: hhmm.optional().describe("Pickup time, HH:MM 24-hour. Default 10:00."),
    return_time: hhmm.optional().describe("Return time, HH:MM 24-hour. Default 10:00."),
    pickup_point_id: z.string().trim().max(40).optional().describe("A point_id from get_car. Default: the first pickup point."),
    dropoff_point_id: z.string().trim().max(40).optional().describe("A point_id from get_car. Default: the pickup point."),
    cdw: z.boolean().optional().describe("Add the Collision Damage Waiver."),
  })
  .superRefine(bothDatesOrNeither);

export const getOperatorSchema = z.object({
  operator_id: listingId.describe("The operator_id from search_cars or get_car."),
});

export const getMyBookingsSchema = z.object({
  booking_code: z.string().trim().max(40).optional().describe("One booking code, e.g. BK-1234. Leave out for all current bookings."),
});

export const getPolicySchema = z.object({
  key: z.enum(POLICY_KEYS).describe("The policy section to read."),
});

export const makeBookingLinkSchema = z
  .object({
    listing_id: listingId.optional().describe("The car's listing_id. Leave out for the car the customer is looking at."),
    pickup_date: plainDate.describe(`Pickup date, ${DATE_NOTE}`),
    return_date: plainDate.describe(`Return date, ${DATE_NOTE}`),
    pickup_time: hhmm.optional(),
    return_time: hhmm.optional(),
    pickup_point_id: z.string().trim().max(40).optional(),
    dropoff_point_id: z.string().trim().max(40).optional(),
  })
  .superRefine(bothDatesOrNeither);

/** The JSON schema the AI sees for a zod schema. */
export function toParameters(schema) {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  delete json.$schema;
  return json;
}

/** Drops nulls (models send them for fields they leave out), recursively. */
export function dropNulls(value) {
  if (Array.isArray(value)) return value.filter((v) => v !== null).map(dropNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, dropNulls(v)]));
  }
  return value;
}

/** "field: problem; field: problem", short enough to send back to the AI. */
export function issuesText(error) {
  return error.issues
    .slice(0, 5)
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}
