import multer from "multer";
import {validateSecureDocument,} from "../utils/secure_upload.js";
import prisma from "../config/db.js";
import { transitionBookingStatus } from "../services/booking_status_service.js";
import { createInAppNotification, notifyOperatorUsersByBooking, } from "../services/notification_email_service.js";
import { sendEmail } from "../services/email_service.js";
import { escapeHtml } from "../utils/escapeHTML.js";
import { getPlatformSettings } from "../services/platform_settings_service.js";
import { createAuditLog } from "../services/log_service.js";

const SLA_HOURS = 48;
const REJECTION_REASONS = new Set(["EXPIRED", "UNREADABLE", "NOT_A_LICENCE"]);

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

    const latest = await prisma.customerLicenceDocument.findFirst({
      where: { customerId: req.user.id },
      orderBy: { submittedAt: "desc" },
    });
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

    const document = await prisma.customerLicenceDocument.create({
      data: {
        customerId: req.user.id,
        originalName: file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120),
        mimeType: validatedDocument.mime,
        sizeBytes: validatedDocument.size,
        content: validatedDocument.buffer,
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

    /*
 * Notify operators that currently have an
 * active booking with this customer.
 */
const activeBookings =
  await prisma.booking.findMany({
    where: {
      customerId: req.user.id,

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
    },

    select: {
      id: true,
      bookingCode: true,
      operatorId: true,
    },
  });

/*
 * A customer may have several bookings
 * under the same operator.
 *
 * Only send one notification per operator.
 */
const notifiedOperators =
  new Set();

for (const booking of activeBookings) {
  if (
    notifiedOperators.has(
      booking.operatorId
    )
  ) {
    continue;
  }

  notifiedOperators.add(
    booking.operatorId
  );

  await notifyOperatorUsersByBooking({
    booking,

    title:
      "Driving licence awaiting review",

    message:
      `${req.user.name} submitted a driving licence for verification.`,

    type:
      "LICENCE_REVIEW_REQUIRED",

    /*
     * Licence verification is now handled
     * by the relevant operator.
     */
    notifyMaster: false,
  });
}

    res.status(201).json({ message: "Licence submitted for preliminary review.", document: publicDocument(document) });
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

          /*
           * NORMAL_SELLER:
           * Only show customers who
           * have an active booking
           * with this operator.
           *
           * MASTER_SELLER:
           * Can see all licences.
           */
          ...(operatorId
            ? {
                customer: {
                  bookings: {
                    some:
                      licenceBookingScope(
                        operatorId
                      ),
                  },
                },
              }
            : {}),
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
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,

              bookings: {
                where: {
                  ...licenceBookingScope(
                    operatorId
                  ),

                  paymentDeadline: {
                    not: null,
                  },
                },

                orderBy: [
                  {
                    paymentDeadline:
                      "asc",
                  },
                  {
                    createdAt:
                      "asc",
                  },
                ],

                take: 1,

                select: {
                  id: true,
                  bookingCode:
                    true,
                  paymentDeadline:
                    true,
                  operatorId:
                    true,
                },
              },
            },
          },
        },
      });

    const now =
      Date.now();

    const queue =
      documents.map(
        (document) => {
          const {
            bookings,
            ...customer
          } =
            document.customer;

          const booking =
            bookings[0] ||
            null;

          return {
            ...publicDocument({
              ...document,
              customer,
            }),

            booking,

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
           * customers who have a
           * booking with their company.
           */
          ...(operatorId
            ? {
                customer: {
                  bookings: {
                    some:
                      licenceBookingScope(
                        operatorId
                      ),
                  },
                },
              }
            : {}),
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
            "Choose expired, unreadable, or not a licence as the rejection reason.",
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

          ...(operatorId
            ? {
                customer: {
                  bookings: {
                    some:
                      licenceBookingScope(
                        operatorId
                      ),
                  },
                },
              }
            : {}),
        },

        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
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

    const updated =
      await prisma.customerLicenceDocument.update({
        where: {
          id:
            documentId,
        },

        data: {
          status:
            decision ===
            "APPROVED"
              ? "APPROVED"
              : "REUPLOAD_REQUIRED",

          rejectionReason:
            decision ===
            "REJECTED"
              ? reason
              : null,

          reviewedAt:
            new Date(),

          reviewedById:
            req.user.id,
        },
      });

    /*
     * If approved, only move bookings
     * belonging to this operator.
     *
     * Master Seller retains the existing
     * platform-wide behaviour.
     */
    if (
      decision ===
      "APPROVED"
    ) {
      await prisma.$transaction(
        async (tx) => {
          const readyBookings =
            await tx.booking.findMany({
              where: {
                customerId:
                  document.customerId,

                status:
                  "PAID",

                payment: {
                  is: {
                    status:
                      "PAID",
                  },
                },

                ...(operatorId
                  ? {
                      operatorId,
                    }
                  : {}),
              },

              select: {
                id: true,
              },
            });

          for (
            const booking of
            readyBookings
          ) {
            await transitionBookingStatus({
              bookingId:
                booking.id,

              newStatus:
                "READY_FOR_PICKUP",

              actorId:
                req.user.id,

              remark:
                "Driving licence verified after balance payment.",

              database:
                tx,
            });
          }
        }
      );
    }

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
      const message =
        `Your driving licence needs to be re-uploaded. Preliminary review result: ${
          reason
            .toLowerCase()
            .replaceAll(
              "_",
              " "
            )
        }. Please submit a clearer, current licence image.`;

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
