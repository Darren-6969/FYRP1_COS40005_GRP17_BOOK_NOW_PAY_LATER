// Read-only view of a public platform car booking (SRS 4.2.6), shared by the
// customer and operator booking detail endpoints so both sides read the same
// pricing snapshot and booking details in the same shape.
//
// The booking passed in must be loaded with carBookingInclude() (or a superset
// of it) and with the operator's latest BNPL config as operator.configs[0].

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

// Relations mapCarBooking reads, for use inside a Prisma include.
export function carListingSelect() {
  return {
    id: true,
    name: true,
    vehicleMake: true,
    vehicleModel: true,
    modelYear: true,
    transmission: true,
    seats: true,
    images: {
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      take: 1,
      select: { imageUrl: true },
    },
    branch: {
      select: { name: true, address: true, phone: true, openTime: true, closeTime: true },
    },
  };
}

// The operator settings the response deadline needs.
export function operatorResponseConfigSelect() {
  return {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      bookingResponseDeadlineMinutes: true,
      autoRejectInactiveBooking: true,
    },
  };
}

// Time by which the operator should answer a request (4.2.4). Each operator
// chooses the response time and whether an unanswered request is rejected
// automatically when it passes; the auto-reject job reads the same settings.
export function responseDueAt(booking) {
  if (!["PENDING"].includes(booking.status)) return null;
  const minutes = booking.operator?.configs?.[0]?.bookingResponseDeadlineMinutes ?? 120;
  return new Date(new Date(booking.createdAt).getTime() + minutes * 60000);
}

export function autoRejectsOnTimeout(booking) {
  return booking.operator?.configs?.[0]?.autoRejectInactiveBooking ?? true;
}

export function mapCarBooking(booking) {
  const listing = booking.listing;
  const details = booking.bookingDetails || {};
  return {
    listing: listing
      ? {
          id: listing.id,
          name: listing.name,
          make: listing.vehicleMake ?? null,
          model: listing.vehicleModel ?? null,
          modelYear: listing.modelYear ?? null,
          transmission: listing.transmission ?? null,
          seats: listing.seats ?? null,
          imageUrl: listing.images?.[0]?.imageUrl ?? null,
          branch: listing.branch ?? null,
        }
      : null,
    pickupPoint: booking.pickupPoint ?? null,
    dropoffPoint: booking.dropoffPoint ?? null,
    requestedLocation: booking.requestedLocation ?? null,
    addons: (booking.addons || []).map((a) => ({
      ...a,
      unitPrice: toNumber(a.unitPrice),
      totalPrice: toNumber(a.totalPrice),
    })),
    pricing: booking.pricingSnapshot ?? null,
    driver: details.driver ?? null,
    contact: details.contact ?? null,
    chauffeur: details.chauffeur ?? null,
    responseDueAt: responseDueAt(booking),
    autoRejectOnTimeout: autoRejectsOnTimeout(booking),
  };
}