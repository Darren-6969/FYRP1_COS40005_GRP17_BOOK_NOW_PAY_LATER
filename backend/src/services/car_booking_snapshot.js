// What a priced car selection turns into on a Booking row: the pricing
// snapshot, the amount columns, the add-on rows and the location text. Shared
// by the booking orchestrator (new requests) and the re-quote service
// (suggested alternatives), so both write exactly the same shape.

import { fromSen, rateCardFor } from "./car_pricing_service.js";

/**
 * @param listing  the listing the price is for
 * @param pricing  priceSelection(...).priced plus { dates, refundRule, point,
 *                 dropoff, requestedLocation, driverAge? }
 */
export function buildCarPricingSnapshot(listing, pricing) {
  return {
    version: 2,
    currency: "MYR",
    unit: "sen",
    rateCard: rateCardFor(listing),
    hours: pricing.hours,
    days: pricing.days,
    rateLines: pricing.rateLines,
    rentalSen: pricing.rentalSen,
    nightHandovers: pricing.nightHandovers,
    overtimeSen: pricing.overtimeSen,
    driverAge: pricing.driverAge ?? null,
    youngDriverDailySurchargeSen: pricing.youngDriverDailySurchargeSen || 0,
    youngDriverSurchargeSen: pricing.youngDriverSurchargeSen || 0,
    depositPct: pricing.depositPct,
    depositSen: pricing.depositSen,
    addOnLines: pricing.addOnLines,
    pickupFeeSen: pricing.pickupFeeSen,
    dropoffFeeSen: pricing.dropoffFeeSen,
    balanceSen: pricing.balanceSen,
    totalSen: pricing.totalSen,
    refundRule: pricing.refundRule,
    pickupPoint: pricing.point,
    dropoffPoint: pricing.dropoff,
    requestedLocation: pricing.requestedLocation || null,
  };
}

// The Booking amount columns for a priced selection.
export function carBookingAmounts(pricing) {
  return {
    rentalAmount: fromSen(pricing.rentalSen),
    addonsAmount: fromSen(pricing.addOnsSen),
    feesAmount: fromSen(
      pricing.overtimeSen +
        (pricing.youngDriverSurchargeSen || 0) +
        pricing.pickupFeeSen +
        pricing.dropoffFeeSen
    ),
    discountAmount: "0.00",
    totalAmount: fromSen(pricing.totalSen),
  };
}

// BookingAddon rows for the chosen add-ons. CDW has no listingAddonId.
export function carBookingAddonRows(pricing, cdwId) {
  return pricing.addOnLines.map((line) => ({
    listingAddonId: String(line.id) === String(cdwId) ? null : Number(line.id),
    name: line.label,
    unit: line.unit === "per_day" ? "PER_DAY" : "PER_BOOKING",
    unitPrice: fromSen(line.unitPriceSen),
    quantity: line.qty,
    totalPrice: fromSen(line.amountSen),
  }));
}

// Pickup and point ids as stored on the booking ("branch" and a requested
// location have no row).
export function storedPointId(point) {
  return point && /^\d+$/.test(String(point.id)) ? Number(point.id) : null;
}

// The location text shown on the booking, as the booking form writes it.
export function bookingLocationText(listing, { requestedLocation, point, dropoff }) {
  const pointText = (pt) =>
    pt.id === "branch" ? `${listing.branch.name}, ${listing.branch.address}` : pt.label;
  if (requestedLocation) return `Requested: ${requestedLocation}`;
  return dropoff.id === point.id ? pointText(point) : `${pointText(point)} → ${pointText(dropoff)}`;
}
