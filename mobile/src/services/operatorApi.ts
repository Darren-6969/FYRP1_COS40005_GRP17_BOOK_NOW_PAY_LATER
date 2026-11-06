import { File, Paths} from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

import { apiRequest, API_URL } from "./api";
import { getToken } from "./session";

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


export type OperatorNotification = {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export async function getOperatorNotifications(): Promise<{
  notifications: OperatorNotification[];
}> {
  return apiRequest("/operators/notifications", {
    method: "GET",
  });
}

export async function markOperatorNotificationRead(
  notificationId: number
): Promise<{ message: string }> {
  return apiRequest(
    `/operators/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
}

export async function markAllOperatorNotificationsRead():
  Promise<{ message: string }> {
  return apiRequest(
    "/operators/notifications/read-all",
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
}


export type OperatorListingImage = {
  id: number;
  imageUrl: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type OperatorListing = {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  status: string;

  price: number;
  hourlyRate?: number | null;
  weeklyRate?: number | null;
  monthlyRate?: number | null;
  quantity: number;

  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleType?: string | null;
  modelYear?: number | null;
  seats?: number | null;
  transmission?: string | null;

  luggageCapacity?: number | null;
  cdwDailyPrice?: number | null;
  pickupRules?: string | null;
  returnRules?: string | null;
  insuranceInfo?: string | null;
  refundPolicy?: string | null;
  termsAndConditions?: string | null;

  branchId: number;
  branch?: {
    id: number;
    name: string;
  } | null;

  images?: OperatorListingImage[];
};

export type OperatorListingSubscription = {
  plan: string;
  listingLimit: number;
  publishedCount: number;
  remaining: number;
};

export async function getOperatorListings(
  params: {
    status?: string;
    q?: string;
  } = {}
): Promise<{
  listings: OperatorListing[];
  subscription: OperatorListingSubscription | null;
}> {
  const query = new URLSearchParams();

  if (params.status && params.status !== "ALL") {
    query.set("status", params.status);
  }

  if (params.q?.trim()) {
    query.set("q", params.q.trim());
  }

  const suffix = query.toString();

  return apiRequest(
    `/operators/listings${suffix ? `?${suffix}` : ""}`,
    { method: "GET" }
  );
}

export async function getOperatorListingById(
  listingId: number
): Promise<{ listing: OperatorListing }> {
  return apiRequest(
    `/operators/listings/${listingId}`,
    { method: "GET" }
  );
}

export async function quickEditOperatorListing(
  listingId: number,
  data: {
    price?: number;
    quantity?: number;
  }
): Promise<{
  message: string;
  listing: OperatorListing;
}> {
  return apiRequest(
    `/operators/listings/${listingId}/quick-edit`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}



export type OperatorPickupPoint = {
  id: number;
  branchId: number;
  label: string;
  address?: string | null;
  note?: string | null;
  usage: "PICKUP" | "DROPOFF" | "BOTH";
  fee: number | string;
  dropoffFee: number | string;
  isActive: boolean;
  sortOrder: number;
};

export type OperatorBranch = {
  id: number;
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  country?: string;
  phone?: string | null;
  isActive: boolean;
  pickupPoints?: OperatorPickupPoint[];
};


export async function getOperatorBranches(): Promise<{
  branches: OperatorBranch[];
}> {
  return apiRequest("/operators/branches", {
    method: "GET",
  });
}

export type OperatorListingFormPayload = {
  branchId: number;
  category: "CAR_RENTAL";
  name: string;
  description: string | null;

  vehicleMake: string;
  vehicleModel: string;
  vehicleType: string;
  transmission: string;

  modelYear: number | null;
  seats: number | null;
  luggageCapacity: number | null;
  quantity: number;

  price: string;
  hourlyRate: string | null;
  weeklyRate: string | null;
  monthlyRate: string | null;
  cdwDailyPrice: string | null;

  pickupRules: string | null;
  returnRules: string | null;
  insuranceInfo: string | null;
  refundPolicy: string | null;
  termsAndConditions: string | null;
};

export async function createOperatorListing(
  payload: OperatorListingFormPayload
): Promise<{
  message: string;
  listing: OperatorListing;
}> {
  return apiRequest("/operators/listings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOperatorListing(
  listingId: number,
  payload: OperatorListingFormPayload
): Promise<{
  message: string;
  listing: OperatorListing;
}> {
  return apiRequest(
    `/operators/listings/${listingId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}



export async function uploadOperatorListingImage(
  asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
  }
): Promise<{
  url: string;
  pathname?: string;
}> {
  const token = await getToken();

  if (!token) {
    throw new Error("Please log in again.");
  }

  // Expo SDK 58: use a real File object.
  const file = new File(asset.uri);

  const formData = new FormData();

  // Backend Multer expects the field name "image".
  formData.append("image", file as unknown as Blob);

  const response = await expoFetch(
    `${API_URL}/uploads/listing-image`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Image upload failed (${response.status})`
    );
  }

  if (!data?.url) {
    throw new Error(
      "Upload succeeded but no image URL was returned."
    );
  }

  return {
    url: data.url,
    pathname: data.pathname,
  };
}


export async function attachOperatorListingImage(
  listingId: number,
  imageUrl: string
): Promise<{
  message: string;
  listing: OperatorListing;
}> {
  return apiRequest(
    `/operators/listings/${listingId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        carsxeImageUrl: imageUrl,
      }),
    }
  );
}

export async function deleteOperatorListingImage(
  listingId: number,
  imageId: number
): Promise<{
  message: string;
  listing: OperatorListing;
}> {
  return apiRequest(
    `/operators/listings/${listingId}/images/${imageId}`,
    { method: "DELETE" }
  );
}

export async function reorderOperatorListingImages(
  listingId: number,
  imageIds: number[]
): Promise<{
  message: string;
  listing: OperatorListing;
}> {
  return apiRequest(
    `/operators/listings/${listingId}/images/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify({
        images: imageIds.map((id) => ({ id })),
      }),
    }
  );
}

export async function publishOperatorListing(
  listingId: number
): Promise<{ message: string; listing: OperatorListing }> {
  return apiRequest(
    `/operators/listings/${listingId}/publish`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
}

export async function withdrawOperatorListing(
  listingId: number
): Promise<{ message: string; listing: OperatorListing }> {
  return apiRequest(
    `/operators/listings/${listingId}/withdraw`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
}


export type OperatorBranchPayload = {
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  country: string;
  phone: string | null;
};

export async function createOperatorBranch(
  payload: OperatorBranchPayload
): Promise<{
  message: string;
  branch: OperatorBranch;
}> {
  return apiRequest("/operators/branches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOperatorBranch(
  branchId: number,
  payload: Partial<
    OperatorBranchPayload & { isActive: boolean }
  >
): Promise<{
  message: string;
  branch: OperatorBranch;
}> {
  return apiRequest(
    `/operators/branches/${branchId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}


export type OperatorPointPayload = {
  label: string;
  address: string | null;
  note: string | null;
  usage: "PICKUP" | "DROPOFF" | "BOTH";
  pickupFee: number;
  dropoffFee: number;
};

export async function createOperatorBranchPoint(
  branchId: number,
  payload: OperatorPointPayload
): Promise<{
  message: string;
  point: OperatorPickupPoint;
}> {
  return apiRequest(
    `/operators/branches/${branchId}/points`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function updateOperatorBranchPoint(
  branchId: number,
  pointId: number,
  payload: Partial<
    OperatorPointPayload & { isActive: boolean }
  >
): Promise<{
  message: string;
  point: OperatorPickupPoint;
}> {
  return apiRequest(
    `/operators/branches/${branchId}/points/${pointId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}


export type OperatorLicenceDocument = {
  id: number;
  customerId: number;
  bookingId: number | null;
  originalName: string;
  mimeType: string;
  status: string;
  submittedAt: string;
  reviewDueAt: string;

  customer?: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
  };

  booking?: {
    id: number;
    bookingCode: string;
    paymentDeadline?: string | null;
  } | null;

  sla?: {
    overdue: boolean;
    hoursRemaining: number;
  };
};

export type OperatorLicenceQueue = {
  documents: OperatorLicenceDocument[];
  queueDepth: number;
  oldestSubmittedAt: string | null;
  oldestItemAgeHours: number;
};

export async function getOperatorLicenceQueue():
  Promise<OperatorLicenceQueue> {
  return apiRequest("/licence-verification/queue", {
    method: "GET",
  });
}


export async function downloadOperatorLicenceDocument(
  documentId: number
): Promise<{
  file: File;
  mimeType: string;
}> {
  if (!Number.isInteger(documentId) || documentId <= 0) {
    throw new Error("Invalid licence document ID.");
  }

  const token = await getToken();

  if (!token) {
    throw new Error("Please log in again.");
  }

  const response = await expoFetch(
    `${API_URL}/licence-verification/queue/${documentId}/document`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/pdf, image/png, image/jpeg",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      response.status === 403 || response.status === 404
        ? "This licence document is unavailable or you do not have access."
        : `Unable to open licence (${response.status}).`
    );
  }

  const mimeType = (
    response.headers.get("Content-Type") || ""
  )
    .split(";")[0]
    .trim()
    .toLowerCase();

  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
  };

  const extension = extensions[mimeType];

  if (!extension) {
    throw new Error("Unsupported licence document format.");
  }

  const bytes = await response.bytes();

  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) {
    throw new Error("Invalid licence document size.");
  }

  // Store a temporary copy only inside the app's cache.
  const file = new File(
    Paths.cache,
    `licence-review-${documentId}-${Date.now()}.${extension}`
  );

  await file.write(bytes);

  return { file, mimeType };
}


export type LicenceReviewDecision = "APPROVED" | "REJECTED";

export type LicenceRejectionReason =
  | "EXPIRED"
  | "UNREADABLE"
  | "NOT_A_LICENCE";

export async function reviewOperatorLicence(
  documentId: number,
  decision: LicenceReviewDecision,
  reason?: LicenceRejectionReason
): Promise<{
  message: string;
  document: {
    id: number;
    status: string;
    rejectionReason?: string | null;
    reviewedAt?: string | null;
  };
}> {
  if (!Number.isInteger(documentId) || documentId <= 0) {
    throw new Error("Invalid licence document ID.");
  }

  if (decision === "REJECTED" && !reason) {
    throw new Error("Please select a rejection reason.");
  }

  return apiRequest(
    `/licence-verification/queue/${documentId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({
        decision,
        ...(decision === "REJECTED" ? { reason } : {}),
      }),
    }
  );
}




