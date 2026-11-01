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

export async function createStripeCheckoutSession(
  bookingId: number | string,
  paymentType:
    | "DOWN_PAYMENT"
    | "FINAL_PAYMENT"
    | "FULL_PAYMENT"
) {
  const idempotencyKey =
    `stripe-${bookingId}-${paymentType}-${Date.now()}`;

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
      dateOfBirth: string;
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
  input: CreateCarBookingInput
) {
  const idempotencyKey =
    `mobile-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}`;

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