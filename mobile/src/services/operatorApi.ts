import { File, Paths} from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

import {
  apiRequest,
  authorizedFetch,
  errorFromResponse,
  UPLOAD_TIMEOUT_MS,
} from "./api";

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

  bookingDetails?: {
  internationalPermitRequired?: boolean;
  driver?: {
    internationalPermitRequired?: boolean;
  };
  counterVerification?: CounterVerification | null;
  } | null;

  // Late return charges
  lateReturnHours?: number;
  lateReturnCharge?: number;

  // Customer information
  customer?: {
    name?: string;
    email?: string;
    phone?: string | null;
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

  serviceType?: string;
  alternativeUsed?: boolean;
  alternativeSuggestedAt?: string | null;
  alternativeServiceName?: string | null;
  alternativeReason?: string | null;
  noShowRemark?: string | null;

  /** Car bookings: the same car view the customer sees (car_booking_view.js). */
  car?: {
    listing?: {
      id: number;
      name?: string | null;
      make?: string | null;
      model?: string | null;
      seats?: number | null;
      transmission?: string | null;
      imageUrl?: string | null;
      branch?: { name?: string | null } | null;
    } | null;
    pickupPoint?: { label?: string | null } | null;
    dropoffPoint?: { label?: string | null } | null;
    requestedLocation?: string | null;
    requestedDropoffLocation?: string | null;
    driver?: { name?: string | null; phone?: string | null } | null;
    /** When the operator should answer a pending request. */
    responseDueAt?: string | null;
    autoRejectOnTimeout?: boolean;
  } | null;
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


export type CounterVerification = {
  identityMatched: boolean;
  licenceSighted: boolean;
  permitSighted: boolean;
  permitRequired: boolean;
  verifiedById: number;
  verifiedAt: string;
};

export async function verifyOperatorBookingAtCounter(
  bookingId: number,
  payload: {
    identityMatched: boolean;
    licenceSighted: boolean;
    permitSighted: boolean;
  }
): Promise<{
  message: string;
  counterVerification: CounterVerification;
}> {
  return apiRequest(
    `/operators/bookings/${bookingId}/counter-verification`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
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


export type DailyStockAllocationPayload = {
  fromDate: string;
  toDate: string;
  quantity: number | null;
};

export type DailyStockAllocationResult = {
  message: string;
  listingId: number;
  listingName: string;
  defaultQuantity: number;
  dailyQuantity: number | null;
  resetToDefault: boolean;
  fromDate: string;
  toDate: string;
  updatedDates: string[];
};

export async function updateOperatorDailyStock(
  listingId: number,
  payload: DailyStockAllocationPayload
): Promise<DailyStockAllocationResult> {
  return apiRequest(
    `/operators/listings/${listingId}/daily-allocation`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}


export type OperatorDailyAllocation = {
  listingId: number;
  date: string;
  quantity: number | null;
  blockedQuantity: number;
  isBlocked: boolean;
  note?: string | null;
};

export async function getOperatorDailyAllocations(
  listingId: number,
  fromDate: string,
  toDate: string
): Promise<{
  allocations: OperatorDailyAllocation[];
}> {
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
  });

  return apiRequest(
    `/operators/listings/${listingId}/allocations?${params}`,
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


export type BranchStockTransferPayload = {
  sourceListingId: number;
  destinationListingId: number;
  quantity: number;
  reason: string;
  operatorId?: number;
};

export type BranchStockTransfer = {
  id: number;
  operatorId: number;
  sourceListingId: number;
  destinationListingId: number;
  sourceBranchId: number;
  destinationBranchId: number;
  sourceBranchName: string;
  destinationBranchName: string;
  vehicleName: string;
  quantity: number;
  beforeSourceQuantity: number;
  afterSourceQuantity: number;
  beforeDestinationQuantity: number;
  afterDestinationQuantity: number;
  reason: string;
  transferredById: number;
  transferredAt: string;
};

export async function transferOperatorBranchStock(
  payload: BranchStockTransferPayload
): Promise<{
  message: string;
  transfer: BranchStockTransfer;
}> {
  return apiRequest(
    "/operators/branches/transfers",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function getOperatorBranchTransfers(
  operatorId?: number
): Promise<{
  transfers: BranchStockTransfer[];
}> {
  const query = operatorId
    ? `?operatorId=${operatorId}`
    : "";

  return apiRequest(
    `/operators/branches/transfers${query}`,
    { method: "GET" }
  );
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
  // Expo SDK 58: use a real File object.
  const file = new File(asset.uri);

  const formData = new FormData();

  // Backend Multer expects the field name "image".
  formData.append("image", file as unknown as Blob);

  // No Content-Type here: fetch sets the multipart boundary itself.
  const response = await authorizedFetch(
    "/uploads/listing-image",
    {
      method: "POST",
      body: formData,
    },
    { fetcher: expoFetch, timeoutMs: UPLOAD_TIMEOUT_MS }
  );

  if (!response.ok) {
    throw await errorFromResponse(
      response,
      `Image upload failed (${response.status})`
    );
  }

  const data = await response.json().catch(() => null);

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

  const response = await authorizedFetch(
    `/licence-verification/queue/${documentId}/document`,
    {
      method: "GET",
      headers: {
        Accept: "application/pdf, image/png, image/jpeg",
      },
    },
    { fetcher: expoFetch, timeoutMs: UPLOAD_TIMEOUT_MS }
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


/**
 * Operator International Permit Verification
 */

export type OperatorPermitDocument = {
  id: number;
  customerId: number;
  bookingId: number | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  submittedAt: string;
  permitExpiryDate: string | null;
  customer?: {
    id: number;
    name: string;
    email?: string | null;
  } | null;
  booking?: {
    id: number;
    bookingCode: string;
  } | null;
};

export type OperatorPermitQueue = {
  documents: OperatorPermitDocument[];
};

export type PermitRejectionReason =
  | "EXPIRED"
  | "UNREADABLE"
  | "NOT_A_PERMIT"
  | "DETAILS_MISMATCH";

export async function getOperatorPermitQueue():
  Promise<OperatorPermitQueue> {
  return apiRequest(
    "/licence-verification/permit/queue",
    { method: "GET" }
  );
}

export async function downloadOperatorPermitDocument(
  documentId: number
): Promise<{
  file: File;
  mimeType: string;
}> {
  if (!Number.isInteger(documentId) || documentId <= 0) {
    throw new Error("Invalid permit document ID.");
  }

  const response = await authorizedFetch(
    `/licence-verification/permit/queue/${documentId}/document`,
    {
      method: "GET",
      headers: {
        Accept: "application/pdf, image/png, image/jpeg",
      },
    },
    {
      fetcher: expoFetch,
      timeoutMs: UPLOAD_TIMEOUT_MS,
    }
  );

  if (!response.ok) {
    throw await errorFromResponse(
      response,
      `Failed to download permit (${response.status}).`
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
    throw new Error("Unsupported permit document format.");
  }

  const bytes = await response.bytes();

  if (
    bytes.length === 0 ||
    bytes.length > 5 * 1024 * 1024
  ) {
    throw new Error("Invalid permit document size.");
  }

  const file = new File(
    Paths.cache,
    `permit-review-${documentId}-${Date.now()}.${extension}`
  );

  await file.write(bytes);

  return {
    file,
    mimeType,
  };
}

export async function reviewOperatorPermit(
  documentId: number,
  decision: "APPROVED" | "REJECTED",
  reason?: PermitRejectionReason
): Promise<{
  message: string;
  document: {
    id: number;
    status: string;
  };
}> {
  if (!Number.isInteger(documentId) || documentId <= 0) {
    throw new Error("Invalid permit document ID.");
  }

  if (decision === "REJECTED" && !reason) {
    throw new Error("Please select a rejection reason.");
  }

  return apiRequest(
    `/licence-verification/permit/queue/${documentId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({
        decision,
        ...(decision === "REJECTED" ? { reason } : {}),
      }),
    }
  );
}

// ---- F6: suggest another car, mark a no-show --------------------------------
// Routes: backend/src/routes/operator_routes.js. Every price is the server's.

export type AlternativeOption = {
  id: number;
  name: string;
  make?: string | null;
  model?: string | null;
  seats?: number | null;
  transmission?: string | null;
  branchName?: string | null;
  sameBranch?: boolean;
  imageUrl?: string | null;
  /** Integer sen. */
  dailyRateSen?: number | null;
  /** Free for the booked dates; null when the dates can't be checked. */
  available: boolean | null;
  unavailableDates?: string[];
};

export type AlternativeQuote = {
  listing: { id: number; name: string } | null;
  pricing: {
    /** Integer sen. */
    totalSen: number;
    depositSen?: number;
    balanceSen?: number;
  } | null;
  kind: string | null;
  problems: { code: string; message: string }[];
  pointsChanged: boolean;
  droppedAddons: string[];
};

/** The operator's other published cars, each marked free or not for the booked dates. */
export async function getAlternativeOptions(bookingId: number): Promise<{ options: AlternativeOption[] }> {
  return apiRequest(`/operators/bookings/${bookingId}/alternative/options`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Prices the chosen car for the booked dates. Writes nothing. */
export async function previewAlternativeQuote(
  bookingId: number,
  alternativeListingId: number
): Promise<{ quote: AlternativeQuote }> {
  return apiRequest(`/operators/bookings/${bookingId}/alternative/quote`, {
    method: "POST",
    body: JSON.stringify({ alternativeListingId }),
  });
}

/**
 * Sends the offer. The server quotes again with the car locked and answers
 * 409 with the problem's code if the car is no longer free.
 */
export async function suggestAlternativeCar(
  bookingId: number,
  input: { alternativeListingId: number; reason: string }
): Promise<{ booking: OperatorBooking }> {
  return apiRequest(`/operators/bookings/${bookingId}/suggest-alternative`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/**
 * Only between pick-up time and the operator's no-show window, and only for
 * a booking with the down payment or the full amount paid (server rules).
 */
export async function markOperatorBookingNoShow(
  bookingId: number,
  remark: string
): Promise<{ booking: OperatorBooking }> {
  return apiRequest(`/operators/bookings/${bookingId}/no-show`, {
    method: "PATCH",
    body: JSON.stringify({ remark }),
  });
}
