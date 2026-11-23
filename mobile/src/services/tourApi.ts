import { apiRequest } from "./api";

// Tours (operator types plan, Phase 3): charter tours by car rental
// operators (priced per car) and private packages by licensed guides
// (priced per package). Never per person. The server prices every tour;
// requests carry choices only. Same endpoints as the website.

export type TourPoint = { id: string; label: string; address?: string | null; note?: string | null; feeSen: number };

export type Tour = {
  id: number;
  kind: "CHARTER" | "GUIDED";
  kindLabel: string;
  name: string;
  description: string;
  images: { id: number; url: string }[];
  priceSen: number;
  priceUnit: "PER_CAR" | "PER_PACKAGE";
  priceUnitLabel: string;
  depositPct: number;
  depositSen: number;
  maxPassengers: number | null;
  durationDays: number;
  pickupTimes: string[];
  highlights: string[];
  itinerary: string[];
  inclusions: string[];
  exclusions: string[];
  meetingPoint: string | null;
  vehicle: { name: string | null; type: string | null; seats: number | null } | null;
  pickupPoints: TourPoint[];
  branch: { name: string; city: string | null; address: string };
  policies: { cancellation: string | null; refund: string | null; terms: string | null };
  operator: { id: number; slug: string; name: string; logoUrl: string | null; verified: boolean };
  availability?: { from: string; days: number; unavailableDates: string[] };
};

export type TourSelection = {
  date: string;
  pickupTime: string;
  passengers: number;
  pickupPointId?: string | null;
};

export type TourQuote = {
  quote: {
    rentalSen: number;
    pickupFeeSen: number;
    depositPct: number;
    depositSen: number;
    balanceSen: number;
    totalSen: number;
    priceUnit: "PER_CAR" | "PER_PACKAGE";
    pickupPoint: TourPoint | null;
    pickupAt: string | null;
    endAt: string | null;
  };
  available: boolean | null;
  problems: { code: string; message: string }[];
};

export function getTours(params: { q?: string; kind?: string; date?: string; passengers?: number } = {}): Promise<{
  items: Tour[];
  total: number;
}> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const qs = query.toString();
  return apiRequest(`/public/tours${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export function getTour(id: number | string): Promise<Tour> {
  return apiRequest(`/public/tours/${id}`, { method: "GET" });
}

export function quoteTour(id: number | string, sel: TourSelection): Promise<TourQuote> {
  return apiRequest(`/public/tours/${id}/quote`, {
    method: "POST",
    body: JSON.stringify({ ...sel, pickupPointId: sel.pickupPointId || null }),
  });
}

export type CreateTourBookingInput = TourSelection & {
  listingId: number;
  bookingDetails: {
    contact: { fullName: string; email?: string | null; phone: string };
    note?: string | null;
    agreements: { termsOfServiceAcceptedAt: string; tourTermsAcceptedAt: string; forfeitureAcceptedAt: string };
  };
};

/** From useIdempotentAttempt: fixed per attempt, reused on retry. */
export function createTourBooking(input: CreateTourBookingInput, idempotencyKey: string): Promise<{
  id: number;
  bookingCode: string;
  status: string;
}> {
  return apiRequest("/customer/tour-bookings", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ ...input, pickupPointId: input.pickupPointId || null }),
  });
}

/** "1 day", "3 days". */
export function durationText(days: number) {
  return days === 1 ? "1 day" : `${days} days`;
}
