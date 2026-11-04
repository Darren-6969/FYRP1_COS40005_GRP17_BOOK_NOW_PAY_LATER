
import { apiRequest } from "./api";

export type OperatorDashboard = {
  summary: {
    totalBookings: number;
    pendingRequests: number;
    paymentPending: number;
    paidBookings: number;
    expiredBookings: number;
    totalRevenue: number;
  };

  recentBookings: {
    id: number;
    bookingCode?: string;
    customerName?: string;
    serviceName?: string;
    status?: string;
    totalAmount?: number;
    createdAt?: string;
  }[];

  notifications: {
    id: number;
    title: string;
    message: string;
    isRead: boolean;
  }[];

  subscription?: {
    plan?: string;
    status?: string;
  } | null;
};

export async function getOperatorDashboard():
  Promise<OperatorDashboard> {
  return apiRequest("/operators/dashboard", {
    method: "GET",
  });
}



export type OperatorBooking = {
  id: number;
  bookingCode?: string;
  status: string;

  serviceName?: string;
  location?: string;
  totalAmount?: number;

  createdAt?: string;
  bookingDate?: string;
  pickupDate?: string;
  returnDate?: string;

  // Vehicle handover and return tracking
  pickedUpAt?: string | null;
  returnedAt?: string | null;

  // Late return charges
  lateReturnHours?: number;
  lateReturnCharge?: number;

  // Customer information
  customer?: {
    name?: string;
    email?: string;
    licenceStatus?: string;
    licenceSubmittedAt?: string | null;
    licenceVerifiedAt?: string | null;
  } | null;

  // Payment information
  payment?: {
    status?: string;
    amount?: number;
    downPaymentAmount?: number;
    finalPaymentAmount?: number;
    downPaymentStatus?: string;
    finalPaymentStatus?: string;
  } | null;

  pricingSnapshot?: {
  rateCard?: {
    hourlySen?: number;
  };
} | null;

listing?: {
  hourlyRate?: number | string | null;
} | null;

lateReturnPaidAt?: string | null;
};


export async function getOperatorBookings(
  status = "ALL"
): Promise<{ bookings: OperatorBooking[] }> {
  return apiRequest(
    `/operators/bookings?status=${encodeURIComponent(status)}`,
    { method: "GET" }
  );
}

export async function acceptOperatorBooking(
  bookingId: number
) {
  return apiRequest(
    `/operators/bookings/${bookingId}/accept`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
}

export async function rejectOperatorBooking(
  bookingId: number,
  reason: string
) {
  return apiRequest(
    `/operators/bookings/${bookingId}/reject`,
    {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }
  );
}

export async function getOperatorBookingById(
  bookingId: number
): Promise<{ booking: OperatorBooking }> {
  return apiRequest(
    `/operators/bookings/${bookingId}`,
    {
      method: "GET",
    }
  );
}

export async function handoverOperatorBooking(
  bookingId: number
) {
  return apiRequest(
    `/operators/bookings/${bookingId}/handover`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
}


export type OperatorReturnSummary = {
  scheduledReturnAt: string;
  actualReturnedAt: string;
  late: boolean;
  lateReturnHours: number;
  hourlyRate: number;
  lateReturnCharge: number;
  paymentMethod: string | null;
  counterPaymentReceived: boolean | null;
};

export async function returnOperatorBooking(
  bookingId: number,
  input: {
    actualReturnedAt: string;
    counterPaymentReceived: boolean;
  }
): Promise<{
  message: string;
  booking: OperatorBooking;
  returnSummary: OperatorReturnSummary;
}> {
  return apiRequest(
    `/operators/bookings/${bookingId}/return`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}


export type OperatorPayment = {
  id: number;
  bookingId: number;
  amount: number;
  method?: string;
  status: string;
  downPaymentAmount?: number;
  finalPaymentAmount?: number;
  downPaymentStatus?: string;
  finalPaymentStatus?: string;
  updatedAt?: string;

  booking?: OperatorBooking & {
    receipt?: {
      id: number;
      imageUrl: string;
      status: string;
      paymentType?: string | null;
      expectedAmount?: number | string | null;
      remarks?: string | null;
      uploadedAt?: string;
    } | null;
  };
};

export async function getOperatorPayments():
  Promise<{ payments: OperatorPayment[] }> {
  return apiRequest("/operators/payments", {
    method: "GET",
  });
}

export async function approveOperatorPayment(
  paymentId: number
) {
  return apiRequest(
    `/operators/payments/${paymentId}/approve`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
}

export async function rejectOperatorPayment(
  paymentId: number,
  remarks: string
) {
  return apiRequest(
    `/operators/payments/${paymentId}/reject`,
    {
      method: "PATCH",
      body: JSON.stringify({ remarks }),
    }
  );
}



