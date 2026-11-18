
import prisma from "../config/db.js";
import { validateSecureDocument } from "../utils/secure_upload.js";
import {
  promoteToReadyForPickup,
} from "../services/booking_status_service.js";

const MAX_BYTES = 5 * 1024 * 1024;

const INVALID_BOOKING_STATUSES = [
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
  "EXPIRED",
  "NO_SHOW",
  "NO_SHOW_UNPAID",
];

const REJECTION_REASONS = new Set([
  "EXPIRED",
  "UNREADABLE",
  "NOT_A_PERMIT",
  "DETAILS_MISMATCH",
]);

function safeDocument(document) {
  if (!document) return null;
  const { content, ...safe } = document;
  return safe;
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function permitExpiry(value) {
  if (typeof value !== "string") return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

function isExpired(date) {
  return (
    date.toISOString().slice(0, 10) <
    new Date().toISOString().slice(0, 10)
  );
}

function reviewerScope(req) {
  if (req.user.role === "MASTER_SELLER") {
    return {};
  }

  const operatorId = validId(req.user.operatorId);

  if (!operatorId) {
    const error = new Error(
      "Operator account is not linked to a company."
    );
    error.statusCode = 403;
    throw error;
  }

  return {
    booking: {
      operatorId,
    },
  };
}

async function customerBooking(req, bookingId) {
  if (!bookingId) return null;

  return prisma.booking.findFirst({
    where: {
      id: bookingId,
      customerId: req.user.id,
      serviceType: "CAR_RENTAL",
      status: {
        notIn: INVALID_BOOKING_STATUSES,
      },
    },
    select: {
      id: true,
      customerId: true,
      operatorId: true,
      returnDate: true,
    },
  });
}

// GET /api/licence-verification/permit/me
export async function getMyPermit(req, res, next) {
  try {
    const bookingId = req.query.bookingId
      ? validId(req.query.bookingId)
      : null;

    if (req.query.bookingId && !bookingId) {
      return res.status(400).json({
        message: "Invalid booking ID.",
      });
    }

    if (bookingId) {
      const owned = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          customerId: req.user.id,
        },
        select: { id: true },
      });

      if (!owned) {
        return res.status(404).json({
          message: "Booking not found.",
        });
      }
    }

    const document =
      await prisma.customerPermitDocument.findFirst({
        where: {
          customerId: req.user.id,
          ...(bookingId ? { bookingId } : {}),
        },
        orderBy: {
          submittedAt: "desc",
        },
      });

    return res.json({
      document: safeDocument(document),
      canReupload: document?.status !== "UNDER_REVIEW",
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/licence-verification/permit/me
export async function uploadPermit(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "An international permit file is required.",
      });
    }

    const bookingId = validId(
      req.params.bookingId ?? req.body.bookingId
    );

    if (!bookingId) {
      return res.status(400).json({
        message: "A valid booking ID is required.",
      });
    }

    const booking = await customerBooking(req, bookingId);

    if (!booking) {
      return res.status(404).json({
        message: "Active car booking not found.",
      });
    }

    const expiry = permitExpiry(
      req.body.permitExpiryDate
    );

    if (!expiry || isExpired(expiry)) {
      return res.status(400).json({
        message: "Enter a valid, unexpired permit expiry date.",
      });
    }

    if (
      booking.returnDate &&
      expiry.toISOString().slice(0, 10) <
        new Date(booking.returnDate).toISOString().slice(0, 10)
    ) {
      return res.status(400).json({
        message:
          "The permit must remain valid through the rental return date.",
      });
    }

    const file = await validateSecureDocument(
      req.file.buffer,
      {
        allowedTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
        ],
        maxBytes: MAX_BYTES,
      }
    );

    const latest =
      await prisma.customerPermitDocument.findFirst({
        where: {
          customerId: req.user.id,
          bookingId,
        },
        orderBy: {
          submittedAt: "desc",
        },
      });

    if (latest?.status === "UNDER_REVIEW") {
      return res.status(409).json({
        message: "Your permit is already under review.",
      });
    }

    const originalName = req.file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-120) || "permit";

    const document =
      await prisma.customerPermitDocument.create({
        data: {
          customerId: req.user.id,
          bookingId,
          originalName,
          mimeType: file.mime,
          sizeBytes: file.size,
          content: file.buffer,
          permitExpiryDate: expiry,
          status: "UNDER_REVIEW",
        },
      });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "CUSTOMER_PERMIT_SUBMITTED",
        entityType: "CustomerPermitDocument",
        entityId: String(document.id),
      },
    });

    return res.status(201).json({
      message: "International permit submitted for review.",
      document: safeDocument(document),
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/licence-verification/permit/queue
export async function getPermitQueue(req, res, next) {
  try {
    const documents =
      await prisma.customerPermitDocument.findMany({
        where: {
          status: "UNDER_REVIEW",
          booking: {
            ...reviewerScope(req).booking,
            status: {
              notIn: INVALID_BOOKING_STATUSES,
            },
          },
        },
        select: {
          id: true,
          customerId: true,
          bookingId: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          status: true,
          submittedAt: true,
          permitExpiryDate: true,
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingCode: true,
              operatorId: true,
            },
          },
        },
        orderBy: {
          submittedAt: "asc",
        },
        take: 100,
      });

    return res.json({ documents });
  } catch (error) {
    next(error);
  }
}

// GET /api/licence-verification/permit/queue/:id/document
export async function downloadPermit(req, res, next) {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "Invalid document ID.",
      });
    }

    const document =
      await prisma.customerPermitDocument.findFirst({
        where: {
          id,
          ...reviewerScope(req),
        },
      });

    if (!document) {
      return res.status(404).json({
        message: "Permit not found.",
      });
    }

    res.set({
      "Content-Type": document.mimeType,
      "Content-Disposition": "inline",
      "Content-Length": String(document.sizeBytes),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    });

    return res.send(Buffer.from(document.content));
  } catch (error) {
    next(error);
  }
}

// PATCH /api/licence-verification/permit/queue/:id/review
export async function reviewPermit(req, res, next) {
  try {
    const id = validId(req.params.id);
    const decision = String(
      req.body.decision ?? ""
    ).toUpperCase();
    const reason = String(
      req.body.reason ?? ""
    ).toUpperCase();

    if (
      !id ||
      !["APPROVED", "REJECTED"].includes(decision)
    ) {
      return res.status(400).json({
        message: "Invalid permit review decision.",
      });
    }

    if (
      decision === "REJECTED" &&
      !REJECTION_REASONS.has(reason)
    ) {
      return res.status(400).json({
        message: "A valid rejection reason is required.",
      });
    }

    const document =
      await prisma.customerPermitDocument.findFirst({
        where: {
          id,
          status: "UNDER_REVIEW",
          ...reviewerScope(req),
          booking: {
            ...reviewerScope(req).booking,
            status: {
              notIn: INVALID_BOOKING_STATUSES,
            },
          },
        },
      });

    if (!document) {
      return res.status(404).json({
        message: "Permit is not in your review queue.",
      });
    }

    if (
      decision === "APPROVED" &&
      (!document.permitExpiryDate ||
        isExpired(document.permitExpiryDate))
    ) {
      return res.status(400).json({
        message: "Expired permits cannot be approved.",
      });
    }

    
const updated = await prisma.$transaction(async (tx) => {
  // Lock the related booking so a requirement
  // update and permit approval cannot race.
  await tx.$queryRaw`
    SELECT id FROM "Booking"
    WHERE id = ${document.bookingId}
    FOR UPDATE
  `;

  const booking = await tx.booking.findUnique({
    where: { id: document.bookingId },
    select: {
      id: true,
      customerId: true,
      returnDate: true,
      status: true,
    },
  });

  if (
    !booking ||
    booking.customerId !== document.customerId ||
    [
      "CANCELLED",
      "REJECTED",
      "COMPLETED",
      "EXPIRED",
      "NO_SHOW",
      "NO_SHOW_UNPAID",
    ].includes(booking.status)
  ) {
    const error = new Error(
      "The related booking is no longer eligible for permit review."
    );
    error.statusCode = 409;
    throw error;
  }

  if (decision === "APPROVED") {
    const expiryDay =
      document.permitExpiryDate?.toISOString().slice(0, 10);

    const requiredDay = booking.returnDate
      ? booking.returnDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    if (!expiryDay || expiryDay < requiredDay) {
      const error = new Error(
        "Permit must remain valid through the rental return date."
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const result = await tx.customerPermitDocument.update({
    where: {
      id: document.id,
      status: "UNDER_REVIEW",
    },
    data: {
      status:
        decision === "APPROVED"
          ? "APPROVED"
          : "REUPLOAD_REQUIRED",
      rejectionReason:
        decision === "REJECTED" ? reason : null,
      reviewedAt: new Date(),
      reviewedById: req.user.id,
    },
  });

  // If payment and all required documents are
  // approved, move PAID -> READY_FOR_PICKUP.
  if (decision === "APPROVED") {
    await promoteToReadyForPickup({
      bookingId: document.bookingId,
      actorId: req.user.id,
      remark:
        "International Driving Permit verified after payment.",
      database: tx,
    });
  }

  await tx.auditLog.create({
    data: {
      userId: req.user.id,
      action: `CUSTOMER_PERMIT_${decision}`,
      entityType: "CustomerPermitDocument",
      entityId: String(document.id),
      details: {
        reason: decision === "REJECTED" ? reason : null,
      },
    },
  });

  return result;
});


    return res.json({
      message: `Permit ${decision.toLowerCase()}.`,
      document: safeDocument(updated),
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(409).json({
        message: "This permit has already been reviewed.",
      });
    }
    next(error);
  }
}
