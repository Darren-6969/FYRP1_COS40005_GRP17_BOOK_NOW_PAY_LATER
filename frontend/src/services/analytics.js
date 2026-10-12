import api from "./api";

// FR-ANL-002: events only the page can know about (what was searched and how
// many cars matched, a car being viewed, a booking form being opened).
//
// Fire and forget: the visitor never waits for this and an analytics failure
// never reaches them. Send reference identifiers and counts only, never names,
// contact details or anything typed into a form. The server keeps only the
// values it allows for each event.
export function reportClientEvent(name, properties = {}) {
  api.post("/public/events", { name, properties }).catch(() => {});
}
