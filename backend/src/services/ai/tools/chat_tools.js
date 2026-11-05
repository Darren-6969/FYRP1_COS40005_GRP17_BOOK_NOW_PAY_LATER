// The chatbot's read-only tools (chatbot design, "Layer 2: AI with read-only
// tools"; development plan Step 7). The AI reaches platform data only through
// these. Each tool checks its input with zod, calls the same service the
// public pages use, and returns a small result (tool_results.js).
//
// The services are passed in, so the tools can be unit tested without a
// database; ai_service.js wires in the real ones.
//
// The customer always comes from the session (ctx.customerId), never from
// the AI: get_my_bookings has no customer input at all, so no wording can
// reach another customer's booking (acceptance tests 3 and 4).
//
// hand_off writes a record, so it comes with Step 9.

import {
  dropNulls,
  getCarSchema,
  getMyBookingsSchema,
  getOperatorSchema,
  getPolicySchema,
  issuesText,
  makeBookingLinkSchema,
  quotePriceSchema,
  searchCarsSchema,
  toParameters,
} from "./tool_schemas.js";
import {
  DEFAULT_TIME,
  bookingHref,
  bookingSummary,
  carDetail,
  operatorSummary,
  quoteSummary,
  searchQueryFrom,
  searchResult,
} from "./tool_results.js";

/** A result the AI reads as a failed lookup, with the reason. */
export class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolInputError";
  }
}

function notPast(date, today, field) {
  if (date && date < today) throw new ToolInputError(`${field} ${date} is in the past. Today is ${today}.`);
}

function carId(input, ctx) {
  const id = input.listing_id ?? ctx.carInViewId;
  if (!id) throw new ToolInputError("No listing_id, and the customer is not looking at a car. Search first, or ask which car.");
  return Number(id);
}

function selection(input) {
  return {
    from: input.pickup_date,
    to: input.return_date,
    ft: input.pickup_time || DEFAULT_TIME,
    tt: input.return_time || DEFAULT_TIME,
    ...(input.pickup_point_id ? { pickupPointId: input.pickup_point_id } : {}),
    ...(input.dropoff_point_id ? { dropoffPointId: input.dropoff_point_id } : {}),
    ...(input.cdw ? { cdw: true } : {}),
  };
}

const TOOLS = [
  {
    name: "search_cars",
    description:
      "Search the cars listed on the platform, with the same filters and order as the results page. Returns up to 5 cars with prices, how many match in total, and a link to the full results. Give pickup and return dates whenever the customer mentions a time, so prices and availability are for those dates.",
    schema: searchCarsSchema,
    async run(input, ctx, deps) {
      notPast(input.pickup_date, ctx.today, "pickup_date");
      const query = searchQueryFrom(input);
      const found = await deps.searchPublicCars(deps.parseCarSearchQuery(query));
      deps.trackEvent?.({
        name: "search_performed",
        properties: {
          input_mode: "conversational",
          filters_applied: Object.keys(query),
          result_count: found.total,
          category: "CAR_RENTAL",
        },
      });
      return searchResult(found, query);
    },
  },
  {
    name: "get_car",
    description:
      "Details of one car: rates per hour, day, week and month, deposit percentage, refund rule, pickup and drop-off points with their charges, add-ons, mileage and fuel policy. Use it for questions about a specific car and for comparisons.",
    schema: getCarSchema,
    async run(input, ctx, deps) {
      return carDetail(await deps.getPublicCar(carId(input, ctx)));
    },
  },
  {
    name: "quote_price",
    description:
      "The exact price of one car for given dates and times: rental, charges, total, the deposit payable now, the balance and its deadline, and whether the car is free. Use it whenever the customer asks what a specific car costs for their dates.",
    schema: quotePriceSchema,
    async run(input, ctx, deps) {
      notPast(input.pickup_date, ctx.today, "pickup_date");
      const id = carId(input, ctx);
      const sel = selection(input);
      return quoteSummary(id, await deps.quotePublicCar(id, { ...sel, addOns: {}, cdw: Boolean(sel.cdw) }, ctx.customerId), sel);
    },
  },
  {
    name: "get_operator",
    description:
      "One rental operator: branches, opening hours, phone numbers, pickup and drop-off points with their charges, deposit percentage, refund rule and mileage policy.",
    schema: getOperatorSchema,
    async run(input, ctx, deps) {
      return operatorSummary(await deps.getStorefront(String(input.operator_id)));
    },
  },
  {
    name: "get_my_bookings",
    description:
      "The signed-in customer's own current bookings: status, amounts paid and due, deadlines and licence check. Only ever returns this customer's bookings. Pass a booking code to look at one booking.",
    schema: getMyBookingsSchema,
    async run(input, ctx, deps) {
      if (!ctx.customerId) {
        return { signed_in: false, message: "The customer is not signed in. Ask them to sign in to see their bookings." };
      }
      if (input.booking_code) {
        const booking = await deps.customerBookingByCode(ctx.customerId, input.booking_code);
        // Someone else's code and a mistyped one get the same answer.
        if (!booking) return { found: false, message: `No booking ${input.booking_code} on this customer's account.` };
        return { found: true, booking: bookingSummary(booking) };
      }
      const bookings = await deps.upcomingBookings(ctx.customerId);
      return { current_bookings: bookings.length, bookings: bookings.map(bookingSummary), all_bookings_link: "/customer/bookings" };
    },
  },
  {
    name: "get_policy",
    description:
      "The platform's current published wording on a rule: terms, refund rules, deposits and balance, licence checks, DuitNow receipts, pickup and drop-off, late returns, privacy. Use it for any rule question; never answer a rule from memory.",
    schema: getPolicySchema,
    async run(input, ctx, deps) {
      const [document, section] = input.key.split(".");
      const found = (await deps.getPublishedSections(document)).find((s) => s.key === section);
      if (!found) return { found: false, message: "That section is not published at the moment." };
      return { key: input.key, title: found.title, text: found.body, version: found.version };
    },
  },
  {
    name: "make_booking_link",
    description:
      "A link to the booking form for one car, prefilled with dates and points. It books nothing: the customer checks and sends the request on the form. Offer it when the customer wants to go ahead.",
    schema: makeBookingLinkSchema,
    async run(input, ctx, deps) {
      notPast(input.pickup_date, ctx.today, "pickup_date");
      const id = carId(input, ctx);
      await deps.getPublicCar(id); // a 404 here means the car is not bookable
      return { booking_link: bookingHref(id, selection(input)), note: "The customer confirms everything on the form." };
    },
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export const TOOL_NAMES = TOOLS.map((t) => t.name);

/** The tools as the adapters send them: [{ name, description, parameters }]. */
export const TOOL_DEFINITIONS = TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: toParameters(t.schema) }));

function errorOutput(err) {
  if (err instanceof ToolInputError) return err.message;
  if (err?.statusCode === 404) return "Not found, or no longer listed.";
  return "The lookup failed. Try again, or suggest the Find a car steps.";
}

/**
 * deps: { searchPublicCars, parseCarSearchQuery, getPublicCar, quotePublicCar,
 *         getStorefront, upcomingBookings, customerBookingByCode,
 *         getPublishedSections, trackEvent?, log? }
 * Returns runTool(call, ctx) → { id, name, output, isError }, which never
 * throws: a failure goes back to the AI as an error result.
 * ctx: { customerId (session) or null, carInViewId or null, today YYYY-MM-DD }
 */
export function createToolRunner(deps) {
  return async function runTool(call, ctx) {
    const tool = BY_NAME.get(call.name);
    if (!tool) return { id: call.id, name: call.name, output: `There is no tool called ${call.name}.`, isError: true };

    const parsed = tool.schema.safeParse(dropNulls(call.input ?? {}));
    if (!parsed.success) {
      return { id: call.id, name: call.name, output: `Input not accepted: ${issuesText(parsed.error)}`, isError: true };
    }
    try {
      return { id: call.id, name: call.name, input: parsed.data, output: await tool.run(parsed.data, ctx, deps), isError: false };
    } catch (err) {
      if (!(err instanceof ToolInputError) && err?.statusCode !== 404) deps.log?.(`[chat-ai] tool ${call.name} failed: ${err?.message}`);
      return { id: call.id, name: call.name, input: parsed.data, output: errorOutput(err), isError: true };
    }
  };
}
