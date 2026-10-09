import { formatMoney } from "../../utils/customerUtils";
import { durationText, rateLineLabel } from "../../utils/carPricing";

// Shared pieces of the car booking detail pages (customer and operator).
// Everything comes from the booking's pricing snapshot, which is stored in
// integer sen; nothing is recalculated here.

export const formatSen = (n) => formatMoney((n || 0) / 100);

// The charge lines that make up the total, in the order the customer saw them
// when booking. Returns [{ label, amountSen }].
export function priceBreakdownRows(pricing) {
  if (!pricing) return [];
  const days = pricing.days || 0;
  // Older snapshots called the young driver surcharge "surchargeSen".
  const youngDriverSen = pricing.youngDriverSurchargeSen || pricing.surchargeSen || 0;

  return [
    ...(pricing.rateLines || []).map((l) => ({
      label: `Rental ${rateLineLabel(l, (n) => formatMoney(n / 100))}`,
      amountSen: l.amountSen,
    })),
    ...(pricing.overtimeSen ? [{ label: "Night handover charge", amountSen: pricing.overtimeSen }] : []),
    ...(pricing.addOnLines || []).map((a) => ({
      label: `${a.label}${a.qty > 1 ? ` × ${a.qty}` : ""}${
        a.unit === "per_day" ? `, ${days} ${days === 1 ? "day" : "days"}` : ""
      }`,
      amountSen: a.amountSen,
    })),
    ...(youngDriverSen ? [{ label: "Young driver surcharge", amountSen: youngDriverSen }] : []),
    ...(pricing.pickupFeeSen
      ? [{ label: `Pickup at ${pricing.pickupPoint?.label || "pickup point"}`, amountSen: pricing.pickupFeeSen }]
      : []),
    ...(pricing.dropoffFeeSen
      ? [{ label: `Drop-off at ${pricing.dropoffPoint?.label || "drop-off point"}`, amountSen: pricing.dropoffFeeSen }]
      : []),
  ];
}

// "Deposit (30% of the rental)" / "Paid in full on acceptance" / "Deposit".
export function depositLabel(pricing) {
  if (!pricing) return "Deposit";
  if (Number(pricing.depositPct) >= 100) return "Paid in full on acceptance";
  return pricing.depositSen ? `Deposit (${pricing.depositPct}% of the rental)` : "Deposit";
}

export function rentalDurationText(pricing) {
  return pricing?.hours ? durationText(pricing.hours) : "-";
}

// "Toyota Vios 2023", falling back to the listing name.
export function carTitle(listing) {
  if (!listing) return null;
  const name = [listing.make, listing.model, listing.modelYear].filter(Boolean).join(" ");
  return name || listing.name || null;
}

export function timeLeft(iso, now) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "any moment now";
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins} min left`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours} h ${rest} min left` : `${hours} h left`;
}

// Where the driver said their licence was issued, from the booking form.
export function licenceIssuedInLabel(code) {
  if (!code) return null;
  if (code === "MY") return "Malaysia";
  if (code === "OTHER") return "Another country (international driving permit needed)";
  return code;
}