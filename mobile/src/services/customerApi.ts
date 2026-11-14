import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

import { UPLOAD_TIMEOUT_MS, apiRequest, authorizedFetch, errorFromResponse } from "./api";
import { APP_SCHEME } from "@/utils/stripe-payment";

export async function getCustomerBookings() {
  return apiRequest("/customer/bookings", {
    method: "GET",
  });
}

export async function getCustomerBookingById(
  id: number | string
) {
  return apiRequest(`/customer/bookings/${id}`, {
    method: "GET",
  });
}

export async function getCustomerNotifications() {
  return apiRequest("/customer/notifications", {
    method: "GET",
  });
}

// F2: asks the server to check the Stripe session and record the payment
// (same call the website makes). One key per session: a retry replays the
// stored result, and a "not paid yet" answer releases the key.
export async function confirmStripeCheckoutSession(
  sessionId: string
) {
  return apiRequest(
    "/stripe/confirm-session",
    {
      method: "POST",

      headers: {
        "Idempotency-Key":
          `stripe-confirm-${sessionId}`,
      },

      body: JSON.stringify({
        sessionId,
      }),
    }
  );
}

export async function createStripeCheckoutSession(
  bookingId: number | string,
  paymentType:
    | "DOWN_PAYMENT"
    | "FINAL_PAYMENT"
    | "FULL_PAYMENT",
  // From useIdempotentAttempt: fixed per attempt, reused on retry (F1).
  idempotencyKey: string
) {

  return apiRequest(
    "/stripe/checkout",
    {
      method: "POST",

      headers: {
        "Idempotency-Key":
          idempotencyKey,
      },

      body: JSON.stringify({
        bookingId:
          Number(bookingId),

        paymentType,

        source: "mobile",

        // F15: Stripe returns to this scheme. Older builds don't send it
        // and the backend falls back to "mobile".
        returnScheme: APP_SCHEME,
      }),
    }
  );
}

export type ManualPaymentType =
  | "DOWN_PAYMENT"
  | "FINAL_PAYMENT"
  | "FULL_PAYMENT";

export type ManualPaymentMethod =
  | "DUITNOW"
  | "SPAY"
  | "BANK_TRANSFER";

export async function getManualPaymentOptions(
  bookingId: number | string
) {
  return apiRequest(
    `/customer/bookings/${bookingId}/manual-payment`,
    {
      method: "GET",
    }
  );
}

export async function getCustomerPayments() {
  return apiRequest(
    "/customer/payments",
    {
      method: "GET",
    }
  );
}

export async function uploadCustomerReceipt(
  bookingId: number | string,
  input: {
    imageUrl: string;
    remarks?: string;
    method: ManualPaymentMethod;
    paymentType: ManualPaymentType;
  },
  // From useIdempotentAttempt: fixed per attempt, reused on retry (F1).
  idempotencyKey: string
) {

  return apiRequest(
    `/customer/bookings/${bookingId}/receipt`,
    {
      method: "POST",

      headers: {
        "Idempotency-Key":
          idempotencyKey,
      },

      body: JSON.stringify({
        imageUrl:
          input.imageUrl,

        remarks:
          input.remarks || "",

        method:
          input.method,

        paymentType:
          input.paymentType,
      }),
    }
  );
}

/**
 * F13: the receipt photo as a file. The backend checks its real type,
 * strips metadata and stores it privately; responses carry a short-lived
 * signed link in receipt.imageUrl. Throws ApiError with code
 * PRIVATE_STORAGE_UNAVAILABLE (or a 404 from an older backend) when the
 * server can't take files; the caller then falls back to uploadCustomerReceipt.
 */
export async function uploadCustomerReceiptFile(
  bookingId: number | string,
  input: {
    uri: string;
    remarks?: string;
    method: ManualPaymentMethod;
    paymentType: ManualPaymentType;
  },
  // From useIdempotentAttempt: fixed per attempt, reused on retry (F1).
  idempotencyKey: string
) {
  const formData = new FormData();
  formData.append("receipt", new File(input.uri) as unknown as Blob);
  formData.append("remarks", input.remarks || "");
  formData.append("method", input.method);
  formData.append("paymentType", input.paymentType);

  // No Content-Type: fetch sets the multipart boundary itself.
  const response = await authorizedFetch(
    `/customer/bookings/${bookingId}/receipt-file`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: formData,
    },
    { fetcher: expoFetch, timeoutMs: UPLOAD_TIMEOUT_MS }
  );

  if (!response.ok) {
    throw await errorFromResponse(response, `Receipt upload failed (${response.status})`);
  }
  return response.json().catch(() => null);
}

export async function markCustomerNotificationRead(
  id: number | string
) {
  return apiRequest(
    `/customer/notifications/${id}/read`,
    {
      method: "PATCH",
    }
  );
}

export async function markAllCustomerNotificationsRead() {
  return apiRequest(
    "/customer/notifications/read-all",
    {
      method: "PATCH",
    }
  );
}

export type CreateCarBookingInput = {
  listingId: number;

  pickupAt: string;
  returnAt: string;

  pickupPointId?: string | number | null;
  dropoffPointId?: string | number | null;

  requestedLocation?: string | null;
  requestedDropoffLocation?: string | null;

  returnToRequested?: boolean | null;

  cdw?: boolean;

  addOns?: {
    id: string | number;
    quantity: number;
  }[];

  bookingDetails: {
    contact: {
      fullName: string;
      email?: string | null;
      phone: string;
    };

    driver: {
      isBooker: boolean;
      fullName: string;
      // Only when the operator has driver age rules on.
      dateOfBirth?: string;
      licenceIssuedIn: string;
    };

    chauffeur: {
      requested: boolean;
      note?: string | null;
    };

    agreements: {
      termsOfServiceAcceptedAt: string;
      rentalTermsAcceptedAt: string;
      forfeitureAcceptedAt: string;
    };
  };
};

export async function createCarBooking(
  input: CreateCarBookingInput,
  // From useIdempotentAttempt: fixed per attempt, reused on retry (F1).
  idempotencyKey: string
) {

  return apiRequest(
    "/customer/car-bookings",
    {
      method: "POST",

      headers: {
        "Idempotency-Key":
          idempotencyKey,
      },

      body: JSON.stringify(input),
    }
  );
}

export async function getSavedListingIds() {
  return apiRequest(
    "/customer/saved/ids",
    {
      method: "GET",
    }
  );
}

export async function getSavedListings() {
  return apiRequest(
    "/customer/saved",
    {
      method: "GET",
    }
  );
}

export async function saveListing(
  listingId: number | string
) {
  return apiRequest(
    `/customer/saved/${listingId}`,
    {
      method: "PUT",
    }
  );
}

export async function removeSavedListing(
  listingId: number | string
) {
  return apiRequest(
    `/customer/saved/${listingId}`,
    {
      method: "DELETE",
    }
  );
}


export type CustomerCancellationReason =
  | "PLANS_CHANGED"
  | "FOUND_ANOTHER_CAR"
  | "PRICE"
  | "OTHER";

export type CustomerCancellationQuote = {
  bookingId: number;
  bookingCode?: string | null;

  totalPaid: number;
  depositPaid: number;
  balancePaid: number;

  depositKept: number;
  depositRefund: number;
  depositRefundPercent: number;
  balanceRefund: number;
  totalRefund: number;

  explanation?: string;
  refundVia?: "CARD" | "OPERATOR_TRANSFER" | null;
  refundDeadline?: string | null;
};

export async function getCustomerCancellationQuote(
  bookingId: number | string
): Promise<CustomerCancellationQuote> {
  return apiRequest(
    `/customer/bookings/${bookingId}/cancellation-quote`,
    { method: "GET" }
  );
}

export async function cancelCustomerBooking(
  bookingId: number | string,
  reasonCode?: CustomerCancellationReason
) {
  return apiRequest(
    `/customer/bookings/${bookingId}/cancel`,
    {
      method: "PATCH",
      body: JSON.stringify({
        reasonCode: reasonCode || null,
      }),
    }
  );
}

// F5: the customer's answer to an operator's suggested alternative (another
// car, new dates or a location charge). Accepting re-quotes the offer on the
// server; it answers 409 ALTERNATIVE_PRICE_CHANGED (with the new price saved
// on the booking) or LISTING_UNAVAILABLE instead of charging a stale price.
// Returns the updated booking.
export async function acceptAlternative(
  bookingId: number | string
) {
  return apiRequest(
    `/customer/bookings/${bookingId}/accept-alternative`,
    { method: "PATCH" }
  );
}

// Declining closes the booking (status REJECTED).
export async function rejectAlternative(
  bookingId: number | string
) {
  return apiRequest(
    `/customer/bookings/${bookingId}/reject-alternative`,
    { method: "PATCH" }
  );
}

// ---- F19: driving licence ---------------------------------------------------
// Routes: backend/src/routes/licence_routes.js (/api/licence-verification).

export type LicenceStatus = "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "REUPLOAD_REQUIRED";

export type LicenceDocument = {
  id: number;
  bookingId: number | null;
  originalName: string;
  mimeType: string;
  status: LicenceStatus;
  /** EXPIRED, UNREADABLE or NOT_A_LICENCE when rejected. */
  rejectionReason: string | null;
  submittedAt: string;
  reviewDueAt: string | null;
  reviewedAt: string | null;
};

export type MyLicenceResponse = {
  /** The latest licence on the account, any booking. Null if none yet. */
  document: LicenceDocument | null;
  canReupload: boolean;
  reuploadWindowEndsAt: string | null;
};

export async function getMyLicence(): Promise<MyLicenceResponse> {
  return apiRequest("/licence-verification/me", { method: "GET" });
}

/**
 * Sends a licence photo (JPEG or PNG, at most 5 MB) as a file. With a
 * bookingId it is linked to that booking, which is what puts it in that
 * operator's review queue; without one it goes on the account only.
 * The server answers 409 if a licence is already waiting for review, so a
 * repeat can't create a second document.
 */
export async function uploadLicenceFile(input: {
  uri: string;
  bookingId?: number | string | null;
}): Promise<{ message: string; document: LicenceDocument }> {
  const formData = new FormData();
  formData.append("licence", new File(input.uri) as unknown as Blob);

  const path = input.bookingId
    ? `/licence-verification/bookings/${input.bookingId}`
    : "/licence-verification/me";

  // No Content-Type: fetch sets the multipart boundary itself.
  const response = await authorizedFetch(
    path,
    { method: "POST", body: formData },
    { fetcher: expoFetch, timeoutMs: UPLOAD_TIMEOUT_MS }
  );

  if (!response.ok) {
    throw await errorFromResponse(response, `Licence upload failed (${response.status})`);
  }
  return response.json();
}
