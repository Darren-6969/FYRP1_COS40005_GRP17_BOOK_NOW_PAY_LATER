import { apiRequest } from "./api";

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
