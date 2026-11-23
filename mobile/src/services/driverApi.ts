import { File, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

import { apiRequest, authorizedFetch, errorFromResponse, UPLOAD_TIMEOUT_MS } from "./api";

// Independent drivers (operator types plan, Phase 4): the same endpoints the
// website uses. A driver's job is its own booking, linked to the car
// booking it serves; the server prices every job.

/** A driver offered for a car booking, with the server's quote in sen. */
export type DriverOption = {
  id: number;
  name: string;
  photoUrl: string | null;
  languages: string[];
  serviceAreas: string[];
  yearsDriving: number | null;
  hourlySen: number | null;
  dailySen: number;
  licensed: boolean;
  quote?: { hours: number; totalSen: number; depositSen: number; balanceSen: number; depositPct: number };
};

export type DriverOptions = {
  canAdd: boolean;
  /** True while the car still waits for its operator: the choice is saved. */
  sendsOnAcceptance?: boolean;
  reason: string | null;
  drivers: DriverOption[];
};

/** A linked booking as the booking views show it (car_booking_view.js). */
export type LinkedBookingSummary = {
  id: number;
  bookingCode: string;
  status: string;
  name: string;
  photoUrl: string | null;
  languages: string[];
  yearsDriving: number | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  totalAmount: number | null;
  operator: { id: number; name: string; phone: string | null } | null;
};

/** On a car booking: the independent driver, chosen or booked. */
export type CarDriverInfo = {
  allowed: boolean;
  requested: { listingId: number; name: string; outcome?: string; reason?: string } | null;
  current: LinkedBookingSummary | null;
  past: LinkedBookingSummary[];
  licenceCheck: { status: "APPROVED" | "REJECTED"; reviewedAt?: string; note?: string | null } | null;
};

/** Driver bookings that accepted the job: the car operator then checks
 *  the driver's licence instead of the customer's. */
const ACCEPTED = new Set(["PENDING_PAYMENT", "CONFIRMED", "PAID", "READY_FOR_PICKUP", "IN_PROGRESS"]);

export function hasAcceptedDriver(info: CarDriverInfo | null | undefined) {
  return Boolean(info?.current && ACCEPTED.has(info.current.status));
}

// ---- Customer -----------------------------------------------------------

export function getBookingDriverOptions(bookingId: number | string): Promise<DriverOptions> {
  return apiRequest(`/customer/bookings/${bookingId}/drivers`, { method: "GET" });
}

/** From useIdempotentAttempt: the same key on every retry of one choice. */
export function addBookingDriver(
  bookingId: number | string,
  driverListingId: number,
  idempotencyKey: string
): Promise<{ saved: boolean; message: string; booking?: { id: number; bookingCode: string; status: string } }> {
  return apiRequest(`/customer/bookings/${bookingId}/driver`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ driverListingId }),
  });
}

// ---- Car operator -------------------------------------------------------

export type DriverDocumentKind = "licence" | "psv";

/** Downloads the accepted driver's licence or PSV permit to the app cache. */
export async function downloadDriverDocument(
  bookingId: number,
  kind: DriverDocumentKind
): Promise<{ file: File; mimeType: string }> {
  const response = await authorizedFetch(
    `/operators/bookings/${bookingId}/driver-licence/${kind}`,
    { method: "GET", headers: { Accept: "application/pdf, image/png, image/jpeg" } },
    { fetcher: expoFetch, timeoutMs: UPLOAD_TIMEOUT_MS }
  );
  if (!response.ok) throw await errorFromResponse(response as any);

  const mimeType = (response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const extension = ({ "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } as Record<string, string>)[
    mimeType
  ];
  if (!extension) throw new Error("This document is in a format the app can't open.");

  const bytes = await response.bytes();
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) throw new Error("This document could not be opened.");

  const file = new File(Paths.cache, `driver-${kind}-${bookingId}-${Date.now()}.${extension}`);
  await file.write(bytes);
  return { file, mimeType };
}

export function reviewDriverLicence(bookingId: number, decision: "APPROVED" | "REJECTED", note = "") {
  return apiRequest<{ message: string; readyForPickup: boolean }>(`/operators/bookings/${bookingId}/driver-licence`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
}

/** Drivers the car booking form can offer for these times and this place. */
export function getDriversForCar(
  listingId: number | string,
  { pickupAt, returnAt, location }: { pickupAt: string; returnAt: string; location?: string | null }
): Promise<{ allowed: boolean; drivers: DriverOption[] }> {
  const query = new URLSearchParams({ pickupAt, returnAt, location: location || "" });
  return apiRequest(`/public/cars/${listingId}/drivers?${query.toString()}`, { method: "GET" });
}
