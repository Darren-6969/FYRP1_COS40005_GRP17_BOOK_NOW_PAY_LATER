// TEST-ITEM-MISC: the bookable fixed-price test item.
//
// DELETE THIS WHOLE FILE when testing is finished, together with
// routes/test_item_routes.js and its two lines in app.js (search for
// TEST-ITEM-MISC). See backend/TEST_ITEM_MISCELLANEOUS.md.
//
// A customer books a published Miscellaneous listing at its fixed price. The
// booking is an ordinary request from there on: the operator accepts it, a
// payment schedule is created, the customer pays by Stripe or DuitNow, and the
// cancellation and refund flows apply. It has no dates, no car, no licence and
// no stock, so it is not linked to the listing (listingId stays empty, which
// keeps it out of the car booking views).
import prisma from "../config/db.js";
import { assertOperatorTakingBookings } from "../services/subscription_admin_service.js";
import { getPlatformSettings, isCreditTierPolicyEnabled } from "../services/platform_settings_service.js";
import { assignCreditTier } from "../services/credit_tier_service.js";
import { formatBookingCode, tempBookingCode } from "../utils/bookingCode.js";
import { notifyCustomerByBooking, notifyOperatorUsersByBooking } from "../services/notification_email_service.js";
import { bookingRequestReceivedTemplate, bookingSubmittedTemplate } from "../services/email_templates.js";

export const TEST_ITEM_SERVICE_TYPE = "TEST_ITEM";

const frontend = () => process.env.FRONTEND_URL || "http://localhost:5173";

function mapTestItem(listing) {
  const image = listing.images?.find((item) => item.isPrimary) || listing.images?.[0] || null;
  return {
    id: listing.id,
    name: listing.name,
    description: listing.description || "",
    price: Number(listing.price),
    imageUrl: image?.imageUrl || null,
    operatorName: listing.operator?.companyName || null,
  };
}

const publishedItemsWhere = {
  category: "MISCELLANEOUS",
  status: "PUBLISHED",
  operator: { status: "ACTIVE" },
};

const itemInclude = {
  operator: { select: { id: true, companyName: true } },
  images: { orderBy: { sortOrder: "asc" } },
};

export async function listTestItems(_req, res, next) {
  try {
    const listings = await prisma.listing.findMany({
      where: publishedItemsWhere,
      include: itemInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({ items: listings.map(mapTestItem) });
  } catch (err) {
    next(err);
  }
}

export async function createTestItemBooking(req, res, next) {
  try {
    const listingId = Number(req.body?.listingId);
    if (!Number.isInteger(listingId) || listingId <= 0) {
      return res.status(400).json({ message: "Choose an item to book." });
    }

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, ...publishedItemsWhere },
      include: itemInclude,
    });
    if (!listing) return res.status(404).json({ message: "This item is not available." });

    // A suspended operator takes no new booking requests.
    await assertOperatorTakingBookings(listing.operatorId);

    const price = Number(listing.price);
    const booking = await prisma.$transaction(async (tx) => {
      const platformSettings = await getPlatformSettings(tx);
      const tierPolicyOn = await isCreditTierPolicyEnabled(platformSettings, listing.operatorId);

      const created = await tx.booking.create({
        data: {
          bookingCode: tempBookingCode(),
          customerId: req.user.id,
          operatorId: listing.operatorId,
          channel: "WEB",
          serviceName: listing.name,
          serviceType: TEST_ITEM_SERVICE_TYPE,
          bookingDate: new Date(),
          quantity: 1,
          rentalAmount: price.toFixed(2),
          addonsAmount: "0.00",
          feesAmount: "0.00",
          discountAmount: "0.00",
          totalAmount: price.toFixed(2),
          creditTier: assignCreditTier(price, tierPolicyOn ? platformSettings.creditTierThresholds : {}),
          status: "PENDING",
          bookingDetails: { testItemListingId: listing.id },
        },
      });

      const withCode = await tx.booking.update({
        where: { id: created.id },
        data: { bookingCode: formatBookingCode(created.id) },
        include: {
          customer: { select: { id: true, userCode: true, name: true, email: true } },
          operator: true,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          actorId: req.user.id,
          oldStatus: null,
          newStatus: "PENDING",
          remark: "Test item booked by customer.",
        },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CUSTOMER_BOOKING_CREATED",
          entityType: "Booking",
          entityId: String(created.id),
          details: { bookingCode: withCode.bookingCode, source: "test_item", listingId: listing.id },
        },
      });
      return withCode;
    });

    // Both sides are told, as for any booking request.
    Promise.allSettled([
      notifyCustomerByBooking({
        booking,
        title: "Booking request sent",
        message: `Your booking request for ${listing.name} has been submitted.`,
        type: "BOOKING_REQUEST_RECEIVED",
        emailSubject: `Booking Request Sent - ${booking.bookingCode}`,
        emailHtml: bookingRequestReceivedTemplate({
          booking,
          customerUrl: `${frontend()}/customer/bookings/${booking.id}`,
        }),
      }),
      notifyOperatorUsersByBooking({
        booking,
        title: "New booking request",
        message: `${booking.bookingCode} (test item) requires operator review.`,
        type: "BOOKING_SUBMITTED",
        emailSubject: `New Booking Request - ${booking.bookingCode}`,
        emailHtml: bookingSubmittedTemplate({ booking, operatorUrl: `${frontend()}/operator/bookings/${booking.id}` }),
      }),
    ]).then((results) =>
      results
        .filter((result) => result.status === "rejected")
        .forEach((result) => console.error("[test-item] notification failed:", result.reason?.message))
    );

    res.status(201).json({ id: booking.id, bookingCode: booking.bookingCode });
  } catch (err) {
    next(err);
  }
}
