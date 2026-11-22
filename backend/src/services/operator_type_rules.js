// Operator types decide which listing categories an operator can create.
// Pure rules, no database access, so they can be unit tested on their own.
//
// CAR_RENTAL  rental company: car rental listings and charter tours
// TOUR_GUIDE  licensed independent guide: tour packages only
// DRIVER      licensed independent driver: driver service, not listable
//             until Phase 4 of the operator types plan
//
// MISCELLANEOUS is the TEST-ITEM-MISC test listing and stays with car rental
// operators, as it was before operator types existed.

export const OPERATOR_TYPES = ["CAR_RENTAL", "TOUR_GUIDE", "DRIVER"];

const ALLOWED_CATEGORIES = {
  CAR_RENTAL: ["CAR_RENTAL", "TOUR", "MISCELLANEOUS"],
  TOUR_GUIDE: ["TOUR"],
  DRIVER: [],
};

const TYPE_LABELS = {
  CAR_RENTAL: "car rental",
  TOUR_GUIDE: "tour guide",
  DRIVER: "driver",
};

const MAX_PICKUP_TIMES = 12;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function fail(statusCode, message, appCode, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.appCode = appCode;
  if (details !== undefined) error.details = details;
  return error;
}

export function isOperatorType(value) {
  return OPERATOR_TYPES.includes(value);
}

// Operators created before operator types existed count as car rental.
function typeOrDefault(operatorType) {
  return operatorType || "CAR_RENTAL";
}

export function allowedCategoriesFor(operatorType) {
  return ALLOWED_CATEGORIES[typeOrDefault(operatorType)] || [];
}

export function isCategoryAllowed(operatorType, category) {
  return allowedCategoriesFor(operatorType).includes(category);
}

export function assertCategoryAllowed(operatorType, category) {
  if (isCategoryAllowed(operatorType, category)) return;
  const type = typeOrDefault(operatorType);
  throw fail(
    403,
    `A ${TYPE_LABELS[type] || "this"} operator cannot create this kind of listing.`,
    "LISTING_CATEGORY_NOT_ALLOWED",
    { operatorType: type, category, allowed: allowedCategoriesFor(type) }
  );
}

// Tours are charged per car when a car rental operator runs them and per
// package when a guide does. Never per person. Set by the server only.
export function tourPriceUnitFor(operatorType) {
  return typeOrDefault(operatorType) === "TOUR_GUIDE" ? "PER_PACKAGE" : "PER_CAR";
}

// Departure times for a tour, "HH:mm" in Malaysia time. Accepts an array or a
// comma separated string; returns them unique and sorted. Empty is allowed
// (the operator arranges the time with the customer).
export function normalisePickupTimes(value) {
  if (value === undefined || value === null || value === "") return [];

  const list = Array.isArray(value) ? value : String(value).split(",");
  const times = list.map((item) => String(item ?? "").trim()).filter(Boolean);

  const invalid = times.filter((time) => !TIME_PATTERN.test(time));
  if (invalid.length) {
    throw fail(400, "Pickup times must be in HH:mm format, for example 08:30.", "INVALID_PICKUP_TIMES", { invalid });
  }

  const unique = [...new Set(times)].sort();
  if (unique.length > MAX_PICKUP_TIMES) {
    throw fail(400, `A tour can have at most ${MAX_PICKUP_TIMES} pickup times.`, "INVALID_PICKUP_TIMES");
  }

  return unique;
}

// ── Operator applications ─────────────────────────────────────────────
// What each type of applicant sends. Car rental keeps the documents it had
// before operator types existed. Guides and drivers are often individuals,
// so a business registration number is optional for them.

export const DOCUMENT_LABELS = {
  BUSINESS_REGISTRATION: "Business registration (SSM)",
  BUSINESS_LICENSE: "Business licence",
  OWNER_IDENTITY: "Identity card or passport",
  TOURIST_GUIDE_LICENCE: "Tourist guide licence (MOTAC)",
  DRIVING_LICENCE: "Driving licence",
  PSV_LICENCE: "PSV licence",
};

export const APPLICATION_RULES = {
  CAR_RENTAL: {
    businessRegistrationNumberRequired: true,
    documents: [
      { type: "BUSINESS_REGISTRATION", required: true },
      { type: "BUSINESS_LICENSE", required: false },
      { type: "OWNER_IDENTITY", required: true },
    ],
    // Checked before approval (FR-COMP-002): unchanged from before.
    approvalRequires: ["BUSINESS_LICENSE"],
  },
  TOUR_GUIDE: {
    businessRegistrationNumberRequired: false,
    documents: [
      { type: "TOURIST_GUIDE_LICENCE", required: true },
      { type: "BUSINESS_REGISTRATION", required: false },
      { type: "OWNER_IDENTITY", required: true },
    ],
    approvalRequires: ["TOURIST_GUIDE_LICENCE"],
  },
  DRIVER: {
    businessRegistrationNumberRequired: false,
    documents: [
      { type: "DRIVING_LICENCE", required: true },
      { type: "PSV_LICENCE", required: true },
      { type: "OWNER_IDENTITY", required: true },
    ],
    approvalRequires: ["DRIVING_LICENCE", "PSV_LICENCE"],
  },
};

// Documents behind the Verified badge: everything except the owner's ID.
export const VERIFICATION_DOCUMENT_TYPES = [
  "BUSINESS_REGISTRATION",
  "BUSINESS_LICENSE",
  "TOURIST_GUIDE_LICENCE",
  "DRIVING_LICENCE",
  "PSV_LICENCE",
];

function documentList(types) {
  return types.map((type) => DOCUMENT_LABELS[type] || type).join(", ");
}

// The type an applicant picked. Empty means car rental, which keeps older
// clients (and the mobile app, if it ever submits) working.
export function parseOperatorType(value) {
  const type = String(value ?? "").trim().toUpperCase();
  if (!type) return "CAR_RENTAL";
  if (!isOperatorType(type)) {
    throw fail(400, "Choose car rental, tour guide or driver.", "INVALID_OPERATOR_TYPE");
  }
  return type;
}

export function applicationRulesFor(operatorType) {
  return APPLICATION_RULES[typeOrDefault(operatorType)];
}

// Refuses documents this type does not send and lists required ones that
// are missing. documentTypes are the upload field types, e.g. OWNER_IDENTITY.
export function checkApplicationDocuments(operatorType, documentTypes) {
  const rules = applicationRulesFor(operatorType);
  const accepted = new Set(rules.documents.map((doc) => doc.type));
  const sent = new Set(documentTypes);

  const notAccepted = [...sent].filter((type) => !accepted.has(type));
  if (notAccepted.length) {
    throw fail(400, "Some uploaded documents are not part of this application.", "APPLICATION_DOCUMENT_NOT_ACCEPTED", {
      notAccepted,
    });
  }

  const missing = rules.documents.filter((doc) => doc.required && !sent.has(doc.type)).map((doc) => doc.type);
  if (missing.length) {
    throw fail(400, `Please upload: ${documentList(missing)}.`, "APPLICATION_DOCUMENT_MISSING", { missing });
  }
}

// Documents that must be on file before an administrator can approve.
export function missingApprovalDocuments(operatorType, documentTypes) {
  const sent = new Set(documentTypes);
  return applicationRulesFor(operatorType).approvalRequires.filter((type) => !sent.has(type));
}

export function approvalDocumentsMessage(missing) {
  return `${documentList(missing)} must be submitted and checked before approval.`;
}
