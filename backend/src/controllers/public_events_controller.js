import { trackEvent } from "../services/analytics_service.js";

// FR-ANL-002: events only the browser can know about. The fleet is filtered on
// the page, so the server cannot see what was searched or how many cars matched,
// and it cannot tell the detail page from the booking form; the page reports it here. Only the events below are accepted, and every value
// goes through the same allow-list as server-side events, so the endpoint cannot
// be used to store anything else.

const INPUT_MODES = new Set(["interface", "conversational"]);

function wholeNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 100000 ? number : null;
}

const CLIENT_EVENTS = {
  search_performed(body) {
    const filters = Array.isArray(body.filters_applied)
      ? body.filters_applied.filter((name) => typeof name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name))
      : [];
    return {
      input_mode: INPUT_MODES.has(body.input_mode) ? body.input_mode : "interface",
      filters_applied: filters,
      result_count: wholeNumber(body.result_count),
      category: "CAR_RENTAL",
    };
  },

  // The booking form loads the same car as the detail page, so the server cannot
  // tell a view from the start of a booking. The detail page reports its own view.
  listing_viewed(body) {
    return { listing_id: wholeNumber(body.listing_id) || null, category: "CAR_RENTAL" };
  },

  booking_started(body) {
    return { listing_id: wholeNumber(body.listing_id) || null, rental_days: wholeNumber(body.rental_days) };
  },
};

// The properties for an event the page may report, or null for any other name.
export function clientEventProperties(name, body = {}) {
  return Object.hasOwn(CLIENT_EVENTS, name) ? CLIENT_EVENTS[name](body || {}) : null;
}

// POST /api/public/events
export function reportClientEvent(req, res) {
  const name = req.body?.name;
  const properties = clientEventProperties(name, req.body?.properties);

  if (!properties) {
    return res.status(400).json({ message: "This event cannot be reported from the page." });
  }

  trackEvent({ name, properties });
  // Accepted for later recording; the page never waits on the outcome.
  res.status(202).json({ accepted: true });
}
