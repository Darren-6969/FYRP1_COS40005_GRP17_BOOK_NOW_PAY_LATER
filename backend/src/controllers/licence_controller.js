import multer from "multer";
import {validateSecureDocument,} from "../utils/secure_upload.js";
import prisma from "../config/db.js";
import { promoteToReadyForPickup } from "../services/booking_status_service.js";
import { createInAppNotification, notifyOperatorUsersByBooking, } from "../services/notification_email_service.js";
import { sendEmail } from "../services/email_service.js";
import { escapeHtml } from "../utils/escapeHTML.js";
import { getPlatformSettings } from "../services/platform_settings_service.js";
import { createAuditLog } from "../services/log_service.js";
import { storePrivateDocument } from "../services/private_document_storage.js";
import {
  bookingDriverName,
  bookingReturnDay,
  checkLicenceReuse,
  plainDateOf,
  readLicenceDetails,
} from "../services/licence_check_service.js";

const SLA_HOURS = 48;
// SRS 4.8.3: the four clear-cut reasons an operator may reject a licence for.
// DIFFERENT_DRIVER (BNPLB-182) applies to one booking only: the same licence
// can still be attached to a booking where it does name the driver.
const REJECTION_REASONS = new Set(["EXPIRED", "UNREADABLE", "DIFFERENT_DRIVER", "NOT_A_LICENCE"]);
const REJECTION_REASON_TEXT = {
  EXPIRED: "the licence has expired or runs out before the return date",
  UNREADABLE: "the image could not be read",
  DIFFERENT_DRIVER: "the name on the licence is not the driver named on this booking",
  NOT_A_LICENCE: "the document is not a driving licence",
};
const OPEN_BOOKING_EXCLUDED = ["REJECTED", "CANCELLED", "COMPLETED", "EXPIRED", "NO_SHOW", "NO_SHOW_UNPAID"];

// What a booking needs for the licence rules: the driver and the return day.
const LICENCE_BOOKING_SELECT = {
  id: true,
  bookingCode: true,
  status: true,
  serviceType: true,
  customerId: true,
  operatorId: true,
  returnDate: true,
  alternativeReturnDate: true,
  alternativeUsed: true,
  bookingDetails: true,
};

function klDateTimeText(date) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

function getReviewerOperatorId(req) {
  /*
   * Master Seller can review all licences.
   */
  if (
    req.user?.role ===
    "MASTER_SELLER"
  ) {
    return null;
  }

  /*
   * Normal Seller must belong
   * to a valid operator/company.
   */
  const rawOperatorId =
    req.user?.operatorId;

  if (
    rawOperatorId === null ||
    rawOperatorId === undefined
  ) {
    const error =
      new Error(
        "Operator account is not linked to a company."
      );

    error.statusCode = 403;
    throw error;
  }

  const operatorId =
    Number(rawOperatorId);

  if (
    !Number.isInteger(operatorId) ||
    operatorId <= 0
  ) {
    const error =
      new Error(
        "Operator account is not linked to a company."
      );

    error.statusCode = 403;
    throw error;
  }

  return operatorId;
}

function licenceBookingScope(
  operatorId
) {
  return {
    ...(operatorId
      ? {
          operatorId,
        }
      : {}),

    status: {
      notIn: [
        "REJECTED",
        "CANCELLED",
        "COMPLETED",
        "EXPIRED",
        "NO_SHOW",
        "NO_SHOW_UNPAID",
      ],
    },
  };
}

export const licenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.mimetype)) {
      cb(new Error("Licence documents must be PDF, PNG, or JPEG files."));
      return;
    }
    cb(null, true);
  },
});

function publicDocument(document) {
  if (!document) return null;
  const safe = { ...document };
  delete safe.content;
  return safe;
}

export async function getMyLicenceDocument(req, res, next) {
  try {
    const document = await prisma.customerLicenceDocument.findFirst({
      where: { customerId: req.user.id },
      orderBy: { submittedAt: "desc" },
    });
    const settings = await getPlatformSettings();
    const reuploadWindowEndsAt = document?.reviewedAt
      ? new Date(document.reviewedAt.getTime() + settings.licenceReuploadWindowHours * 60 * 60 * 1000)
      : null;
    const canReupload =
      !document ||
      document.status === "APPROVED" ||
      (
        ["REJECTED", "REUPLOAD_REQUIRED"].includes(document.status) &&
        (
          !reuploadWindowEndsAt ||
          reuploadWindowEndsAt.getTime() >= Date.now()
        )
      );
    res.json({
      document: publicDocument(document),
      canReupload,
      reuploadWindowEndsAt,
    });
  } catch (err) {
    next(err);
  }

}

export async function getBookingLicenceDocument(req, res, next) {
  try {
    const bookingId = Number(req.params.bookingId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, customerId: req.user.id }, select: { id: true } });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const document = await prisma.customerLicenceDocument.findFirst({
      where: { bookingId, customerId: req.user.id },
      orderBy: { submittedAt: "desc" },
    });
    res.json({ document: publicDocument(document) });
  } catch (err) {
    next(err);
  }
}

// The licences on the customer's account that could serve this booking: the
// latest version of each original (a reused copy counts as its original), so
// a licence rejected for good on any booking is not offered again.
async function reuseCandidates(customerId, bookingId) {
  const rows = await prisma.customerLicenceDocument.findMany({
    where: { customerId, OR: [{ bookingId: null }, { bookingId: { not: bookingId } }] },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      status: true,
      rejectionReason: true,
      holderName: true,
      expiresAt: true,
      issuingCountry: true,
      originalName: true,
      submittedAt: true,
      reviewedAt: true,
      reusedFromId: true,
    },
  });
  // A licence already rejected on this booking (for example as a different
  // driver) is not offered to it again; it stays usable elsewhere.
  const rejectedHere = await prisma.customerLicenceDocument.findMany({
    where: { customerId, bookingId, status: { in: ["REJECTED", "REUPLOAD_REQUIRED"] } },
    select: { id: true, reusedFromId: true },
  });
  const refusedOriginals = new Set(rejectedHere.map((row) => row.reusedFromId ?? row.id));

  const latestByOriginal = new Map();
  for (const row of rows) {
    const key = row.reusedFromId ?? row.id;
    if (refusedOriginals.has(key)) continue;
    if (!latestByOriginal.has(key)) latestByOriginal.set(key, { ...row, originalId: key });
  }
  return [...latestByOriginal.values()].filter(
    (row) =>
      ["APPROVED", "UNDER_REVIEW"].includes(row.status) ||
      (row.status === "REUPLOAD_REQUIRED" && row.rejectionReason === "DIFFERENT_DRIVER")
  );
}

function openCarBooking(booking) {
  return booking.serviceType === "CAR_RENTAL" && !OPEN_BOOKING_EXCLUDED.includes(booking.status);
}

/**
 * BNPLB-181. GET /licence-verification/bookings/:bookingId/reusable
 * The customer's licences that can be attached to this booking.
 */
export async function getReusableLicences(req, res, next) {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "Invalid booking id." });
    }
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, customerId: req.user.id },
      select: LICENCE_BOOKING_SELECT,
    });
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    const candidates = openCarBooking(booking) ? await reuseCandidates(req.user.id, bookingId) : [];
    const licences = candidates
      .map((licence) => ({
        id: licence.id,
        holderName: licence.holderName,
        expiresAt: plainDateOf(licence.expiresAt),
        issuingCountry: licence.issuingCountry,
        status: licence.status,
        originalName: licence.originalName,
        submittedAt: licence.submittedAt,
        reviewedAt: licence.reviewedAt,
        ...checkLicenceReuse(licence, booking),
      }))
      // Only licences the customer can actually attach are offered. Refused
      // ones (no details on record, expired, another driver) only crowd out
      // the upload box.
      .filter((licence) => licence.eligible);

    res.json({
      driverName: bookingDriverName(booking),
      returnDate: bookingReturnDay(booking),
      licences,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * BNPLB-181. POST /licence-verification/bookings/:bookingId/attach
 * Attaches a licence already on the account to this booking, without a new
 * upload. The rule is checked again here, so a forced request is refused.
 * Reuse saves the upload, not the review: this booking's operator still
 * reviews the licence against their own driver and dates.
 */
export async function attachLicenceToBooking(req, res, next) {
  try {
    const bookingId = Number(req.params.bookingId);
    const licenceId = Number(req.body?.licenceId);
    if (!Number.isInteger(bookingId) || bookingId <= 0 || !Number.isInteger(licenceId) || licenceId <= 0) {
      return res.status(400).json({ message: "Choose a licence to attach." });
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, customerId: req.user.id },
      select: { ...LICENCE_BOOKING_SELECT, operator: { select: { email: true } } },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (!openCarBooking(booking)) {
      return res.status(409).json({ code: "BOOKING_CLOSED", message: "This booking no longer needs a licence." });
    }

    const current = await prisma.customerLicenceDocument.findFirst({
      where: { customerId: req.user.id, bookingId },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    });
    if (current && ["UNDER_REVIEW", "APPROVED"].includes(current.status)) {
      return res.status(409).json({
        code: "LICENCE_ALREADY_ATTACHED",
        message: "This booking already has a licence attached.",
      });
    }
    const platformSettings = await getPlatformSettings();
    if (
      current?.reviewedAt &&
      ["REJECTED", "REUPLOAD_REQUIRED"].includes(current.status) &&
      Date.now() > current.reviewedAt.getTime() + platformSettings.licenceReuploadWindowHours * 60 * 60 * 1000
    ) {
      return res.status(409).json({ message: "The licence re-upload window has closed. Please contact support." });
    }

    const candidates = await reuseCandidates(req.user.id, bookingId);
    const source = candidates.find((licence) => licence.id === licenceId);
    if (!source) {
      return res.status(404).json({ code: "LICENCE_NOT_FOUND", message: "That licence is not on your account." });
    }
    const check = checkLicenceReuse(source, booking);
    if (!check.eligible) {
      return res.status(409).json({ code: "LICENCE_NOT_REUSABLE", message: check.reason });
    }

    const file = await prisma.customerLicenceDocument.findUnique({
      where: { id: source.id },
      select: { originalName: true, mimeType: true, sizeBytes: true, content: true },
    });
    const document = await prisma.customerLicenceDocument.create({
      data: {
        customerId: req.user.id,
        bookingId,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        content: file.content,
        holderName: source.holderName,
        expiresAt: source.expiresAt,
        issuingCountry: source.issuingCountry,
        reusedFromId: source.originalId,
        reviewDueAt: new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000),
      },
    });

    await createAuditLog({
      req,
      action: "CUSTOMER_LICENCE_ATTACHED",
      entityType: "CustomerLicenceDocument",
      entityId: document.id,
      details: { bookingId, reusedFromId: source.originalId },
    });

    await notifyOperatorUsersByBooking({
      booking,
      title: "Driving licence awaiting review",
      message: `${req.user.name} attached a driving licence to ${booking.bookingCode}.`,
      type: "LICENCE_REVIEW_REQUIRED",
      notifyMaster: false,
    });

    res.status(201).json({
      message: "Licence attached. The operator checks it before pickup.",
      document: publicDocument(document),
    });
  } catch (err) {
    next(err);
  }
}

export async function submitLicenceDocument(req, res, next) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "A licence document is required." });

    const validatedDocument =
      await validateSecureDocument(
        file.buffer,
        {
          allowedTypes: [
            "application/pdf",
            "image/png",
            "image/jpeg",
          ],

          maxBytes:
            5 * 1024 * 1024,
        }
      );

    const bookingId = req.params.bookingId ? Number(req.params.bookingId) : null;
    let booking = null;
    if (req.params.bookingId) {
      booking = await prisma.booking.findFirst({
        where: { id: bookingId, customerId: req.user.id },
        select: LICENCE_BOOKING_SELECT,
      });
      if (!booking) return res.status(404).json({ message: "Booking not found." });
    }

    // BNPLB-180: holder name, expiry and issuing country come with every
    // upload. A licence that has expired, or that runs out before this
    // booking's return date, is refused here rather than by the operator.
    const details = readLicenceDetails(req.body, { returnDay: bookingReturnDay(booking) });
    // The review rules apply to a booking's licence. A licence saved to the
    // account is never reviewed on its own, so it can always be replaced.
    const latest = bookingId
      ? await prisma.customerLicenceDocument.findFirst({
          where: { customerId: req.user.id, bookingId },
          orderBy: { submittedAt: "desc" },
        })
      : null;
    if (latest?.status === "UNDER_REVIEW") {
      return res.status(409).json({ message: "Your latest licence is already waiting for review." });
    }
    const platformSettings = await getPlatformSettings();
    if (
      latest?.reviewedAt &&
      ["REJECTED", "REUPLOAD_REQUIRED"].includes(latest.status) &&
      Date.now() > latest.reviewedAt.getTime() + platformSettings.licenceReuploadWindowHours * 60 * 60 * 1000
    ) {
      return res.status(409).json({ message: "The licence re-upload window has closed. Please contact support." });
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const storageKey = await storePrivateDocument({
      customerId: req.user.id,
      bookingId,
      originalName: safeName,
      buffer: validatedDocument.buffer,
    });
    const document = await prisma.customerLicenceDocument.create({
      data: {
        customerId: req.user.id,
        bookingId,
        originalName: safeName,
        mimeType: validatedDocument.mime,
        sizeBytes: validatedDocument.size,
        content: validatedDocument.buffer,
        storageKey,
        holderName: details.holderName,
        expiresAt: new Date(`${details.expiresAt}T00:00:00.000Z`),
        issuingCountry: details.issuingCountry,
        reviewDueAt: new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "CUSTOMER_LICENCE_SUBMITTED",
        entityType: "CustomerLicenceDocument",
        entityId: String(document.id),
      },
    });

    // The licence check belongs to the booking (BNPLB-181), so only that
    // booking's operator is asked to review. A licence saved to the account
    // alone waits until the customer attaches it to a booking.
    if (booking) {
      await notifyOperatorUsersByBooking({
        booking,
        title: "Driving licence awaiting review",
        message: `${req.user.name} uploaded a driving licence for ${booking.bookingCode}.`,
        type: "LICENCE_REVIEW_REQUIRED",
        notifyMaster: false,
      });
    }

    res.status(201).json({
      message: booking
        ? "Licence submitted for preliminary review."
        : "Licence saved to your account. Attach it to a booking from the booking page.",
      document: publicDocument(document),
    });
  } catch (err) {
    next(err);
  }
}

export async function getLicenceQueue(
  req,
  res,
  next
) {
  try {
    const operatorId =
      getReviewerOperatorId(req);

    const documents =
      await prisma.customerLicenceDocument.findMany({
        where: {
          status:
            "UNDER_REVIEW",
          booking: {
            ...licenceBookingScope(operatorId),
          },
        },

        orderBy: [
          {
            submittedAt:
              "asc",
          },
          {
            id:
              "asc",
          },
        ],

        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          booking: {
            select: {
              id: true,
              bookingCode: true,
              paymentDeadline: true,
              operatorId: true,
              // The driver and return date the licence is checked against.
              returnDate: true,
              alternativeReturnDate: true,
              alternativeUsed: true,
              bookingDetails: true,
            },
          },
        },
      });

    const now =
      Date.now();

    const queue =
      documents.map(
        (document) => {
          return {
            ...publicDocument({
              ...document,
            }),

            expiresAt: plainDateOf(document.expiresAt),

            booking: {
              id: document.booking.id,
              bookingCode: document.booking.bookingCode,
              paymentDeadline: document.booking.paymentDeadline,
              operatorId: document.booking.operatorId,
              driverName: bookingDriverName(document.booking),
              returnDate: bookingReturnDay(document.booking),
            },

            sla: {
              overdue:
                document
                  .reviewDueAt
                  .getTime() <
                now,

              hoursRemaining:
                Math.ceil(
                  (
                    document
                      .reviewDueAt
                      .getTime() -
                    now
                  ) /
                    (
                      60 *
                      60 *
                      1000
                    )
                ),
            },
          };
        }
      );

    res.json({
      documents:
        queue,

      queueDepth:
        queue.length,

      oldestSubmittedAt:
        queue[0]
          ?.submittedAt ||
        null,

      oldestItemAgeHours:
        queue.length
          ? Math.floor(
              (
                now -
                new Date(
                  queue[0]
                    .submittedAt
                ).getTime()
              ) /
                (
                  60 *
                  60 *
                  1000
                )
            )
          : 0,
    });
  } catch (err) {
    next(err);
  }
}

export async function downloadLicenceDocument(
  req,
  res,
  next
) {
  try {
    const documentId =
      Number(
        req.params.id
      );

    if (
      !Number.isInteger(
        documentId
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid licence document id.",
        });
    }

    const operatorId =
      getReviewerOperatorId(
        req
      );

    const document =
      await prisma.customerLicenceDocument.findFirst({
        where: {
          id:
            documentId,

          /*
           * Operator can only open
           * licences belonging to
           * customers who have an active
           * booking with their company.
           *
           * The licence is held on the customer account and a valid one
           * is reused, so an approved licence may be linked to another
           * booking. It stays viewable while the customer still has an
           * active booking with this operator.
           */
          OR: [
            { booking: { ...licenceBookingScope(operatorId) } },
            {
              customer: {
                bookings: {
                  some: licenceBookingScope(operatorId),
                },
              },
            },
          ],
        },
      });

    /*
     * Return 404 instead of 403 so
     * another operator cannot discover
     * whether the document exists.
     */
    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Licence document not found.",
        });
    }

    // SRS 4.8.2, BNPLB-183: every view of a driving licence is logged.
    await createAuditLog({
      req,
      action: "CUSTOMER_LICENCE_VIEWED",
      entityType: "CustomerLicenceDocument",
      entityId: document.id,
      details: {
        customerId: document.customerId,
        bookingId: document.bookingId,
        reusedFromId: document.reusedFromId ?? null,
        operatorId: operatorId || null,
        viewerRole: req.user.role,
      },
    });

    res.set({
      "Content-Type":
        document.mimeType,

      "Content-Disposition":
        `inline; filename="${document.originalName}"`,

      "Content-Length":
        String(
          document.sizeBytes
        ),
    });

    res.send(
      Buffer.from(
        document.content
      )
    );
  } catch (err) {
    next(err);
  }
}

export async function reviewLicenceDocument(
  req,
  res,
  next
) {
  try {
    const documentId =
      Number(
        req.params.id
      );

    const decision =
      String(
        req.body.decision ||
          ""
      ).toUpperCase();

    const reason =
      String(
        req.body.reason ||
          ""
      ).toUpperCase();

    if (
      !Number.isInteger(
        documentId
      ) ||
      ![
        "APPROVED",
        "REJECTED",
      ].includes(
        decision
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "A valid licence review decision is required.",
        });
    }

    if (
      decision ===
        "REJECTED" &&
      !REJECTION_REASONS.has(
        reason
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Choose expired, unreadable, different driver, or not a licence as the rejection reason.",
        });
    }

    const operatorId =
      getReviewerOperatorId(
        req
      );

    /*
     * MASTER_SELLER:
     * Can review any document.
     *
     * NORMAL_SELLER:
     * Can only review documents
     * belonging to customers who have
     * an active booking with their
     * operator/company.
     */
    const document =
      await prisma.customerLicenceDocument.findFirst({
        where: {
          id:
            documentId,

          status:
            "UNDER_REVIEW",

          booking: { ...licenceBookingScope(operatorId) },
        },

        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          booking: { select: { bookingCode: true } },
        },
      });

    if (!document) {
      return res
        .status(404)
        .json({
          message:
            "Licence is no longer in the review queue.",
        });
    }

    // The review and any move to ready-for-pickup commit together, so an
    // approved licence can never leave a paid booking stuck at PAID.
    const updated = await prisma.$transaction(async (tx) => {
      const reviewed = await tx.customerLicenceDocument.update({
        where: { id: documentId },
        data: {
          status: decision === "APPROVED" ? "APPROVED" : "REUPLOAD_REQUIRED",
          rejectionReason: decision === "REJECTED" ? reason : null,
          reviewedAt: new Date(),
          reviewedById: req.user.id,
        },
      });

      if (decision === "APPROVED") {
        // The review query only finds documents linked to a booking, so the
        // booking whose licence this is moves on if its balance is paid.
        await promoteToReadyForPickup({
          bookingId: document.bookingId,
          actorId: req.user.id,
          remark: "Driving licence verified after balance payment.",
          database: tx,
        });
      }

      return reviewed;
    });
    await prisma.auditLog.create({
      data: {
        userId:
          req.user.id,

        action:
          `CUSTOMER_LICENCE_${decision}`,

        entityType:
          "CustomerLicenceDocument",

        entityId:
          String(
            documentId
          ),

        details: {
          reason:
            decision ===
            "REJECTED"
              ? reason
              : null,

          reviewerRole:
            req.user.role,

          operatorId:
            operatorId ||
            null,
        },
      },
    });

    if (
      decision ===
      "REJECTED"
    ) {
      // BNPLB-182: tell the customer why and by when, and that the decision
      // is about this booking only.
      const { licenceReuploadWindowHours } = await getPlatformSettings();
      const reuploadBy = new Date(
        updated.reviewedAt.getTime() + Number(licenceReuploadWindowHours ?? 24) * 60 * 60 * 1000
      );
      const bookingCode = document.booking?.bookingCode;
      const message =
        `Your driving licence${bookingCode ? ` for ${bookingCode}` : ""} was not accepted because ` +
        `${REJECTION_REASON_TEXT[reason] || reason.toLowerCase().replaceAll("_", " ")}. ` +
        `Upload or attach a licence by ${klDateTimeText(reuploadBy)}.` +
        (reason === "DIFFERENT_DRIVER"
          ? " The licence itself stays on your account for bookings where you are the driver."
          : "");

      await createInAppNotification({
        userId:
          document.customerId,

        title:
          "Licence re-upload required",

        message,

        type:
          "LICENCE_REUPLOAD_REQUIRED",
      });

      if (
        document.customer
          .email
      ) {
        await sendEmail({
          to:
            document.customer
              .email,

          subject:
            "Driving licence re-upload required",

          type:
            "LICENCE_REUPLOAD_REQUIRED",

          relatedEntityType:
            "CustomerLicenceDocument",

          relatedEntityId:
            documentId,

          userId:
            document.customerId,

          text:
            message,

          html:
            `<p>Hello ${escapeHtml(
              document
                .customer
                .name
            )},</p><p>${escapeHtml(
              message
            )}</p>`,
        });
      }
    }

    res.json({
      message:
        `Licence ${decision.toLowerCase()}.`,

      document:
        publicDocument(
          updated
        ),
    });
  } catch (err) {
    next(err);
  }
}
export async function getPeakDates(req, res, next) {
  try {
    const dates = await prisma.platformPeakDate.findMany({ orderBy: { peakDate: "asc" } });
    res.json(dates);
  } catch (err) {
    next(err);
  }
}

export async function createPeakDate(req, res, next) {
  try {
    const peakDate = new Date(`${String(req.body.date || "")}T00:00:00.000Z`);
    const label = String(req.body.label || "Peak period").trim();
    if (Number.isNaN(peakDate.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date || "")) || !label) {
      return res.status(400).json({ message: "A valid date and label are required." });
    }
    const date = await prisma.$transaction(async (tx) => {
      const created = await tx.platformPeakDate.create({ data: { peakDate, label } });
      await createAuditLog({
        req,
        action: "PLATFORM_PEAK_DATE_CREATED",
        entityType: "PlatformPeakDate",
        entityId: created.id,
        before: null,
        after: { peakDate: created.peakDate, label: created.label },
      }, tx);
      return created;
    });
    res.status(201).json(date);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ message: "That peak date already exists." });
    next(err);
  }
}

export async function deletePeakDate(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.platformPeakDate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Peak date not found." });
    await prisma.$transaction(async (tx) => {
      await tx.platformPeakDate.delete({ where: { id } });
      await createAuditLog({
        req,
        action: "PLATFORM_PEAK_DATE_DELETED",
        entityType: "PlatformPeakDate",
        entityId: id,
        before: { peakDate: existing.peakDate, label: existing.label },
        after: null,
      }, tx);
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
