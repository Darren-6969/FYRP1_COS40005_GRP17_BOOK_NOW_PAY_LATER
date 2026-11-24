// BNPLB-184: the sold-out alert. When a booking request (or an operator's
// offer of another car or dates) takes the last car of a listing on some
// dates, every operator user is told in-app and by email, and the alert opens
// that listing with the dates so they can raise the car count or move a car
// from another branch in one step (SRS 4.1.7).
//
// Sent after the booking commits: email is slow and can fail, and a failed
// alert must never turn a recorded booking into a failed request.

import { notifyOperatorUsersByBooking } from "./notification_email_service.js";
import { stockExhaustedTemplate } from "./email_templates.js";
import { frontendBase, stockAlertPath } from "../utils/frontendUrls.js";

function plainText(plain) {
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${plain}T00:00:00.000Z`)
  );
}

/**
 * "14 Dec", "14 to 16 Dec", or "14 Dec, 18 to 19 Dec": consecutive dates are
 * joined into ranges so a long rental reads as one line.
 */
export function describeDates(dates = []) {
  const sorted = [...new Set(dates)].sort();
  const ranges = [];
  for (const date of sorted) {
    const last = ranges[ranges.length - 1];
    const next = last && new Date(Date.parse(`${last.to}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    if (last && next === date) last.to = date;
    else ranges.push({ from: date, to: date });
  }
  return ranges
    .map(({ from, to }) => {
      if (from === to) return plainText(from);
      const sameMonth = from.slice(0, 7) === to.slice(0, 7);
      return `${sameMonth ? plainText(from).split(" ")[0] : plainText(from)} to ${plainText(to)}`;
    })
    .join(", ");
}

export async function notifyStockExhausted({ booking, listing, dates }) {
  if (!booking || !listing?.id || !dates?.length) return;
  const sorted = [...new Set(dates)].sort();
  const datesText = describeDates(sorted);
  const link = stockAlertPath(listing.id, sorted);
  const name = listing.name || "This listing";

  await notifyOperatorUsersByBooking({
    booking,
    title: "Fully booked",
    message:
      `${name} is fully booked on ${datesText}. ` +
      `Add a car or move one from another branch. Latest booking: ${booking.bookingCode}.`,
    type: "STOCK_EXHAUSTED",
    link,
    emailSubject: `Fully booked: ${name} - ${datesText}`,
    emailHtml: stockExhaustedTemplate({
      booking,
      listingName: name,
      datesText,
      alertUrl: `${frontendBase()}${link}`,
    }),
    notifyMaster: false,
  });
}
