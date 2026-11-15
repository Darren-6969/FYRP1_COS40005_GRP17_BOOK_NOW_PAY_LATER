/**
 * Display helpers for operator bookings. Dates are compared as Malaysia
 * calendar days (F7); nothing here does money arithmetic (F16).
 */

import type { OperatorBooking } from "@/services/operatorApi";
import { formatMYT } from "@/utils/datetime";

export function operatorBookingRef(booking: OperatorBooking) {
  return booking.bookingCode || `#${booking.id}`;
}

export function operatorBookingTitle(booking: OperatorBooking) {
  const listing = booking.car?.listing;
  return listing?.name || [listing?.make, listing?.model].filter(Boolean).join(" ") || booking.serviceName || "Car rental";
}

export function customerName(booking: OperatorBooking) {
  return booking.customer?.name || "Customer";
}

/** "AR" for Aisyah Rahman. */
export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/** "14 to 16 Nov" style trip line, Malaysia time. */
export function tripLine(booking: OperatorBooking) {
  const from = booking.pickupDate ? formatMYT(booking.pickupDate, "dayDateTime") : null;
  const to = booking.returnDate ? formatMYT(booking.returnDate, "dayDateTime") : null;
  if (from && to) return `${from} to ${to}`;
  return from || to || "";
}

/** Where the customer collects the car: a listed point, the place they asked for, or the branch. */
export function pickupPlace(booking: OperatorBooking) {
  return booking.car?.pickupPoint?.label || booking.car?.requestedLocation || booking.location || booking.car?.listing?.branch?.name || null;
}

function sameMytDay(value: string | null | undefined, day: string) {
  return !!value && formatMYT(value, "iso") === day;
}

/** Statuses where the car is still to be collected. */
const BEFORE_PICKUP = new Set(["ACCEPTED", "PENDING_PAYMENT", "CONFIRMED", "PAID", "READY_FOR_PICKUP"]);
/** Statuses where the car is out. */
const ON_TRIP = new Set(["IN_PROGRESS"]);

/** Counts for the dashboard's Today card, from the operator's bookings list. */
export function todayCounts(bookings: OperatorBooking[], now = new Date()) {
  const today = formatMYT(now, "iso");
  return {
    pickups: bookings.filter((b) => BEFORE_PICKUP.has(b.status) && sameMytDay(b.pickupDate, today)).length,
    returns: bookings.filter((b) => ON_TRIP.has(b.status) && sameMytDay(b.returnDate, today)).length,
  };
}

/** The pending request whose reply is due first, or null. */
export function nextReplyDue(bookings: OperatorBooking[]) {
  const due = bookings
    .filter((b) => b.status === "PENDING" && b.car?.responseDueAt)
    .sort((a, b) => new Date(a.car!.responseDueAt!).getTime() - new Date(b.car!.responseDueAt!).getTime());
  return due[0] ?? null;
}

/** "Reply by 9:00 pm today" or "Reply by Sat, 14 Nov, 9:00 pm". */
export function replyByText(dueAt: string | null | undefined, now = new Date()) {
  if (!dueAt) return null;
  const late = new Date(dueAt).getTime() < now.getTime();
  const sameDay = formatMYT(dueAt, "iso") === formatMYT(now, "iso");
  const when = sameDay ? `${formatMYT(dueAt, "time")} today` : formatMYT(dueAt, "dayDateTime");
  return late ? `Reply was due ${when}` : `Reply by ${when}`;
}

/**
 * Whether to offer Mark no-show. The server has the final say (its no-show
 * window and payment checks); this only hides the button where it can't apply.
 */
export function mayMarkNoShow(booking: OperatorBooking, now = new Date()) {
  // The statuses TRANSITIONS (booking_status_service.js) lets go to NO_SHOW,
  // except IN_PROGRESS: a car that was handed over wasn't a no-show.
  if (!["CONFIRMED", "PAID", "READY_FOR_PICKUP"].includes(booking.status)) return false;
  if (!booking.pickupDate || new Date(booking.pickupDate).getTime() > now.getTime()) return false;
  const p = booking.payment;
  return p?.status === "PAID" || p?.downPaymentStatus === "PAID";
}
