import cron from "node-cron";
import Stripe from "stripe";
import prisma from "../config/db.js";
import { applyPaidState } from "../routes/stripe_routes.js";
import { PAYMENT_TYPES } from "./payment_schedule_service.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
  notifyMasterUsers,
} from "./notification_email_service.js";
import {
  bookingStatusTemplate,
  autoRejectedBookingTemplate,
  autoRejectReminderTemplate,
} from "./email_templates.js";
import { transitionBookingStatus } from "./booking_status_service.js";
import { operatorBookingUrl } from "../utils/frontendUrls.js";
import { escapeHtml } from "../utils/escapeHTML.js";
import { withDbRetry, ensureDbConnection } from "../utils/dbRetry.js"; // <-- add
import { runLoggedCronJob } from "./cron_job_service.js";
import { runPaymentExpiryJob } from "../jobs/paymentExpiry_job.js";
import { getPlatformSettings, isFeatureEnabled, normalizeReminderTiming } from "./platform_settings_service.js";
import { recordCreditEvent } from "./customer_credit_service.js";
import { trackBookingEvent } from "./analytics_service.js";
import { runJobQueue } from "../jobs/jobQueue_worker.js";

let lastOverdueRun = null;
let lastOverdueResult = null;

let lastCompletionRun = null;
let lastCompletionResult = null;

let lastReminderRun = null;
let lastReminderResult = null;

let lastNoResponseRun = null;
let lastNoResponseResult = null;

let cronStarted = false;

async function createCronRun({ jobType, triggeredByUserId = null, triggerSource = "MANUAL" }) {
  return withDbRetry(
    () =>
      prisma.cronJobRun.create({
        data: {
          jobType,
          status: "RUNNING",
          triggeredByUserId,
          triggerSource,
          startedAt: new Date(),
        },
      }),
    { label: `createCronRun:${jobType}` }
  );
}

async function finishCronRunSuccess(cronRunId, { affectedCount = 0, result = null } = {}) {
  if (!cronRunId) return null;

  return prisma.cronJobRun.update({
    where: { id: cronRunId },
    data: {
      status: "SUCCESS",
      finishedAt: new Date(),
      affectedCount,
      result,
    },
  });
}

async function finishCronRunFailed(cronRunId, err) {
  if (!cronRunId) return null;

  return prisma.cronJobRun.update({
    where: { id: cronRunId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      error: err?.message || "Cron job failed",
    },
  });
}

export async function getCronRunHistory({ jobType, status, limit = 30 } = {}) {
  const where = {};

  if (jobType && jobType !== "ALL") {
    where.jobType = jobType;
  }

  if (status && status !== "ALL") {
    where.status = status;
  }

  return prisma.cronJobRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: Math.min(Number(limit) || 30, 100),
  });
}

function includeBookingRelations() {
  return {
    customer: {
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        role: true,
      },
    },
    operator: true,
    payment: true,
    receipt: true,
    invoice: true,
  };
}

function getServiceEndDate(booking) {
  return booking.returnDate || booking.pickupDate || booking.bookingDate;
}

function frontendBookingUrl(bookingId) {
  return `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/bookings/${bookingId}`;
}

function frontendCheckoutUrl(bookingId) {
  return `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/checkout/${bookingId}`;
}

async function performPaymentReconciliationCheck({
  now = new Date(),
  database = prisma,
  StripeClient = Stripe,
  paidStateHandler = applyPaidState,
} = {}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const candidates = await database.payment.findMany({
    where: {
      method: "STRIPE",
      booking: {
        is: { status: { in: ["ACCEPTED", "PENDING_PAYMENT"] } },
      },
      OR: [
        {
          downPaymentStatus: { in: ["UNPAID", "PENDING_VERIFICATION"] },
          downPaymentDueDate: { gt: now, lte: next24Hours },
          downPaymentTransactionId: { not: null },
        },
        {
          finalPaymentStatus: { in: ["UNPAID", "PENDING_VERIFICATION"] },
          finalPaymentDueDate: { gt: now, lte: next24Hours },
          finalPaymentTransactionId: { not: null },
        },
      ],
    },
    include: { booking: true },
  });

  const stripe = new StripeClient(process.env.STRIPE_SECRET_KEY);
  const result = {
    checkedAt: now,
    checkedCount: 0,
    reconciledCount: 0,
    failedCount: 0,
    reconciledPayments: [],
    failures: [],
  };

  for (const payment of candidates) {
    const sharedReference =
      payment.downPaymentTransactionId &&
      payment.downPaymentTransactionId === payment.finalPaymentTransactionId;
    const references = sharedReference && payment.finalPaymentDueDate > now &&
      payment.finalPaymentDueDate <= next24Hours
      ? [
          {
            transactionId: payment.downPaymentTransactionId,
            paymentType: PAYMENT_TYPES.FULL_PAYMENT,
          },
        ]
      : sharedReference
        ? []
        : [
          ...(payment.downPaymentStatus !== "PAID" && payment.downPaymentDueDate > now &&
          payment.downPaymentDueDate <= next24Hours && payment.downPaymentTransactionId
            ? [{
                transactionId: payment.downPaymentTransactionId,
                paymentType: PAYMENT_TYPES.DOWN_PAYMENT,
              }]
            : []),
          ...(payment.finalPaymentStatus !== "PAID" && payment.finalPaymentDueDate > now &&
          payment.finalPaymentDueDate <= next24Hours && payment.finalPaymentTransactionId
            ? [{
                transactionId: payment.finalPaymentTransactionId,
                paymentType: PAYMENT_TYPES.FINAL_PAYMENT,
              }]
            : []),
        ];

    for (const reference of references) {
      result.checkedCount += 1;
      try {
        let paymentType = reference.paymentType;
        let paymentIntentId = reference.transactionId;
        let sessionId = null;
        let gatewayPaid = false;
        let ledgerMetadata = {};

        if (reference.transactionId.startsWith("cs_")) {
          const session = await stripe.checkout.sessions.retrieve(reference.transactionId);
          if (Number(session.metadata?.bookingId) !== payment.bookingId) {
            throw new Error("Stripe Checkout Session booking metadata did not match");
          }
          gatewayPaid = session.payment_status === "paid";
          paymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
          sessionId = session.id;
          paymentType = session.metadata?.paymentType || paymentType;
          ledgerMetadata = {
            feeRateBps: Number(session.metadata?.feeRateBps),
            fundedBy: session.metadata?.fundedBy,
          };
        } else if (reference.transactionId.startsWith("pi_")) {
          const intent = await stripe.paymentIntents.retrieve(reference.transactionId);
          if (intent.metadata?.bookingId && Number(intent.metadata.bookingId) !== payment.bookingId) {
            throw new Error("Stripe PaymentIntent booking metadata did not match");
          }
          gatewayPaid = intent.status === "succeeded";
          paymentType = intent.metadata?.paymentType || paymentType;
          ledgerMetadata = {
            feeRateBps: Number(intent.metadata?.feeRateBps),
            fundedBy: intent.metadata?.fundedBy,
          };
        } else {
          continue;
        }

        if (!gatewayPaid || !paymentIntentId) continue;

        const correction = await paidStateHandler(
          payment.bookingId,
          paymentIntentId,
          sessionId,
          paymentType,
          "STRIPE_PAYMENT_RECONCILED",
          ledgerMetadata
        );
        if (correction && !correction.alreadyPaid && !correction.skippedTerminal) {
          result.reconciledCount += 1;
          result.reconciledPayments.push({
            bookingId: payment.bookingId,
            paymentType,
            paymentIntentId,
          });
        }
      } catch (err) {
        result.failedCount += 1;
        result.failures.push({
          bookingId: payment.bookingId,
          transactionId: reference.transactionId,
          error: err.message,
        });
        console.error(
          `[PaymentReconciliation] Booking ${payment.bookingId} failed:`,
          err.message
        );
      }
    }
  }

  return result;
}

export function runPaymentReconciliationCheck(options = {}) {
  const { runLogged = true, lockDatabase = prisma } = options;
  const run = () => performPaymentReconciliationCheck(options);
  return runLogged
    ? runLoggedCronJob("PAYMENT_RECONCILIATION", run, { database: lockDatabase })
    : run();
}

function hoursUntil(date, now = new Date()) {
  return (new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60);
}

async function hasAuditLog(bookingId, action) {
  const existing = await prisma.auditLog.findFirst({
    where: {
      entityType: "Booking",
      entityId: String(bookingId),
      action,
    },
  });

  return Boolean(existing);
}

/**
 * 1. Payment overdue check
 * ACCEPTED/PENDING_PAYMENT + deadline passed + unpaid/unverified payment
 * → OVERDUE
 */
async function performOverdueBookingCheck({
  triggeredByUserId = null,
  triggerSource = "MANUAL",
  saveHistory = true,
} = {}) {
  let cronRun = null;

  try {
    if (saveHistory) {
      cronRun = await createCronRun({
        jobType: "OVERDUE_CHECK",
        triggeredByUserId,
        triggerSource,
      });
    }

    const now = new Date();

    const platformSettings = await getPlatformSettings();
    const overdueCandidates = await isFeatureEnabled(platformSettings, "automaticOverdueHandling")
      ? await prisma.booking.findMany({
      where: {
        paymentDeadline: {
          lt: now,
        },
        status: {
          in: ["ACCEPTED", "PENDING_PAYMENT"],
        },
        OR: [
          {
            payment: null,
          },
          {
            payment: {
              is: {
                status: {
                  in: ["UNPAID", "PENDING_VERIFICATION", "OVERDUE"],
                },
              },
            },
          },
        ],
        operator: {
          configs: {
            some: {
              autoCancelOverdue: true,
            },
          },
        },
      },
      include: includeBookingRelations(),
      })
      : [];

    const expired = [];

    for (const booking of overdueCandidates) {
      const updatedBooking = await prisma.booking.update({
        where: {
          id: booking.id,
        },
        data: {
          status: "OVERDUE",
        },
        include: includeBookingRelations(),
      });

      if (booking.payment) {
        await prisma.payment.update({
          where: {
            bookingId: booking.id,
          },
          data: {
            status: "OVERDUE",
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: triggeredByUserId,
          action: "BOOKING_MARKED_OVERDUE",
          entityType: "Booking",
          entityId: String(booking.id),
          details: {
            bookingCode: booking.bookingCode,
            paymentDeadline: booking.paymentDeadline,
            cronRunId: cronRun?.id || null,
          },
        },
      });

      await recordCreditEvent({
        customerId: booking.customerId,
        bookingId: booking.id,
        eventKey: `expiry:${booking.id}`,
        eventType: "EXPIRED_BOOKING",
        reason: "Payment deadline expired.",
      });

      // Notify customer that their payment deadline passed and booking is now overdue
      await notifyCustomerByBooking({
        booking: updatedBooking,
        title: "Payment overdue",
        message: `Your payment for booking ${
          updatedBooking.bookingCode || updatedBooking.id
        } was not received before the payment deadline and has been marked as overdue.`,
        type: "PAYMENT_OVERDUE",
        emailSubject: `Payment Overdue - ${
          updatedBooking.bookingCode || updatedBooking.id
        }`,
        emailHtml: bookingStatusTemplate({
          booking: updatedBooking,
          status: "OVERDUE",
          customerUrl: frontendBookingUrl(booking.id),
        }),
      });

      expired.push(updatedBooking);
    }

    lastOverdueRun = new Date();
    lastOverdueResult = {
      checkedAt: lastOverdueRun,
      expiredCount: expired.length,
      expiredBookings: expired.map((booking) => ({
        id: booking.id,
        bookingCode: booking.bookingCode,
        customerName: booking.customer?.name,
        operatorName: booking.operator?.companyName,
        paymentDeadline: booking.paymentDeadline,
      })),
    };

    await finishCronRunSuccess(cronRun?.id, {
      affectedCount: expired.length,
      result: lastOverdueResult,
    });

    return lastOverdueResult;
  } catch (err) {
    await finishCronRunFailed(cronRun?.id, err);
    throw err;
  }
}

export function runOverdueBookingCheck(_options = {}) {
  return runPaymentExpiryJob().then((result) => ({
    ...result,
    expiredCount: result.processedCount || 0,
    expiredBookings: [],
  }));
}

void performOverdueBookingCheck;

/**
 * 2. Auto-completion check
 * PAID + payment PAID + service end date passed
 * → COMPLETED
 */
async function performCompletedBookingCheck({
  triggeredByUserId = null,
  triggerSource = "MANUAL",
  saveHistory = true,
} = {}) {
  let cronRun = null;

  try {
    if (saveHistory) {
      cronRun = await createCronRun({
        jobType: "COMPLETION_CHECK",
        triggeredByUserId,
        triggerSource,
      });
    }

    const now = new Date();

    const completionCandidates = await prisma.booking.findMany({
      where: {
        status: "PAID",
        payment: {
          is: {
            status: "PAID",
          },
        },
        OR: [
          {
            returnDate: {
              lt: now,
            },
          },
          {
            AND: [
              {
                returnDate: null,
              },
              {
                pickupDate: {
                  lt: now,
                },
              },
            ],
          },
          {
            AND: [
              {
                returnDate: null,
              },
              {
                pickupDate: null,
              },
              {
                bookingDate: {
                  lt: now,
                },
              },
            ],
          },
        ],
      },
      include: includeBookingRelations(),
    });

    const completed = [];

    for (const booking of completionCandidates) {
      const serviceEndDate = getServiceEndDate(booking);

      if (!serviceEndDate || serviceEndDate > now) {
        continue;
      }

      const updatedBooking = await prisma.booking.update({
        where: {
          id: booking.id,
        },
        data: {
          status: "COMPLETED",
          serviceResolvedAt: now,
        },
        include: includeBookingRelations(),
      });

      // FR-ANL-002: this path writes the status directly, so it raises the event itself.
      trackBookingEvent("booking_completed", booking.id, { verifyStatus: "COMPLETED" });

      await prisma.auditLog.create({
        data: {
          userId: triggeredByUserId,
          action: "BOOKING_MARKED_COMPLETED",
          entityType: "Booking",
          entityId: String(booking.id),
          details: {
            bookingCode: booking.bookingCode,
            serviceEndDate,
            previousStatus: booking.status,
            paymentStatus: booking.payment?.status,
            cronRunId: cronRun?.id || null,
          },
        },
      });

      await notifyCustomerByBooking({
        booking: updatedBooking,
        title: "Booking completed",
        message: `Booking ${
          updatedBooking.bookingCode || updatedBooking.id
        } has been marked as completed because the service period has ended.`,
        type: "BOOKING_COMPLETED",
        emailSubject: `Booking Completed - ${
          updatedBooking.bookingCode || updatedBooking.id
        }`,
        emailHtml: bookingStatusTemplate({
          booking: updatedBooking,
          status: "COMPLETED",
          customerUrl: frontendBookingUrl(booking.id),
        }),
      });

      await notifyOperatorUsersByBooking({
        booking: updatedBooking,
        title: "Booking completed",
        message: `Booking ${
          updatedBooking.bookingCode || updatedBooking.id
        } has been automatically marked as completed.`,
        type: "BOOKING_COMPLETED",
      });

      completed.push(updatedBooking);
    }

    lastCompletionRun = new Date();
    lastCompletionResult = {
      checkedAt: lastCompletionRun,
      completedCount: completed.length,
      completedBookings: completed.map((booking) => ({
        id: booking.id,
        bookingCode: booking.bookingCode,
        customerName: booking.customer?.name,
        operatorName: booking.operator?.companyName,
        serviceEndDate: getServiceEndDate(booking),
      })),
    };

    await finishCronRunSuccess(cronRun?.id, {
      affectedCount: completed.length,
      result: lastCompletionResult,
    });

    return lastCompletionResult;
  } catch (err) {
    await finishCronRunFailed(cronRun?.id, err);
    throw err;
  }
}

export function runCompletedBookingCheck(options = {}) {
  return runLoggedCronJob(
    "COMPLETION_CHECK",
    () => performCompletedBookingCheck(options)
  );
}

/**
 * 3. Payment reminder check
 * Reminder strategy (timing is set in system settings, defaulting to 24 and 6):
 * - first reminder when the deadline is within the first-reminder window
 * - final reminder when the deadline is within the final-reminder window
 *
 * Uses audit logs to prevent duplicate reminders.
 */
async function performPaymentReminderCheck({
  triggeredByUserId = null,
  triggerSource = "MANUAL",
  saveHistory = true,
} = {}) {
  let cronRun = null;

  try {
    if (saveHistory) {
      cronRun = await createCronRun({
        jobType: "PAYMENT_REMINDER_CHECK",
        triggeredByUserId,
        triggerSource,
      });
    }

    const now = new Date();
    const { paymentFirstHours, paymentFinalHours } = normalizeReminderTiming(
      (await getPlatformSettings()).reminderTiming
    );
    const firstReminderWindowEnd = new Date(now.getTime() + paymentFirstHours * 60 * 60 * 1000);

    const reminderCandidates = await prisma.booking.findMany({
      where: {
        paymentDeadline: {
          gt: now,
          lte: firstReminderWindowEnd,
        },
        status: {
          in: ["ACCEPTED", "PENDING_PAYMENT"],
        },
        OR: [
          {
            payment: null,
          },
          {
            payment: {
              is: {
                status: {
                  in: ["UNPAID", "PENDING_VERIFICATION"],
                },
              },
            },
          },
        ],
      },
      include: includeBookingRelations(),
    });

    const reminded = [];

    for (const booking of reminderCandidates) {
      const remainingHours = hoursUntil(booking.paymentDeadline, now);

      const isFinalReminder = remainingHours <= paymentFinalHours;
      const action = isFinalReminder
        ? "FINAL_PAYMENT_REMINDER_SENT"
        : "PAYMENT_REMINDER_SENT";

      const alreadySent = await hasAuditLog(booking.id, action);

      if (alreadySent) {
        continue;
      }

      const checkoutUrl = frontendCheckoutUrl(booking.id);
      const roundedHours = Math.max(Math.ceil(remainingHours), 1);

      await prisma.auditLog.create({
        data: {
          userId: triggeredByUserId,
          action,
          entityType: "Booking",
          entityId: String(booking.id),
          details: {
            bookingCode: booking.bookingCode,
            paymentDeadline: booking.paymentDeadline,
            remainingHours: roundedHours,
            cronRunId: cronRun?.id || null,
          },
        },
      });

      await notifyCustomerByBooking({
        booking,
        title: isFinalReminder
          ? "Final payment reminder"
          : "Payment reminder",
        message: `Please complete payment for booking ${
          booking.bookingCode || booking.id
        }. Payment deadline is in about ${roundedHours} hour(s).`,
        type: isFinalReminder
          ? "FINAL_PAYMENT_REMINDER"
          : "PAYMENT_REMINDER",
        emailSubject: isFinalReminder
          ? `Final Payment Reminder - ${booking.bookingCode || booking.id}`
          : `Payment Reminder - ${booking.bookingCode || booking.id}`,
        emailHtml: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;">
            <h2>${isFinalReminder ? "Final Payment Reminder" : "Payment Reminder"}</h2>
            <p>Hello ${escapeHtml(booking.customer?.name || "Customer")},</p>
            <p>Please complete payment for booking <strong>${
              booking.bookingCode || booking.id
            }</strong>.</p>
            <p><strong>Payment deadline:</strong> ${new Date(
              booking.paymentDeadline
            ).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}</p>
            <p>
              <a href="${checkoutUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
                Pay Now
              </a>
            </p>
          </div>
        `,
      });

      reminded.push({
        id: booking.id,
        bookingCode: booking.bookingCode,
        remainingHours: roundedHours,
        reminderType: action,
      });
    }

    lastReminderRun = new Date();
    lastReminderResult = {
      checkedAt: lastReminderRun,
      remindedCount: reminded.length,
      remindedBookings: reminded,
    };

    await finishCronRunSuccess(cronRun?.id, {
      affectedCount: reminded.length,
      result: lastReminderResult,
    });

    return lastReminderResult;
  } catch (err) {
    await finishCronRunFailed(cronRun?.id, err);
    throw err;
  }
}

export function runPaymentReminderCheck(options = {}) {
  return runLoggedCronJob(
    "PAYMENT_REMINDER_CHECK",
    () => performPaymentReminderCheck(options)
  );
}

/**
 * 4. No merchant response after 2 days
 * Option A:
 * PENDING for more than 2 days
 * → REJECTED
 * → notify customer, operator, and master
 */
// FR-OP-002: an operator with automatic rejection on must answer a booking
// request within their response deadline, counted from when it was sent.
function responseDeadlineFor(booking, config) {
  const minutes = config.bookingResponseDeadlineMinutes || 120;
  return {
    minutes,
    deadline: new Date(new Date(booking.createdAt).getTime() + minutes * 60 * 1000),
  };
}

// The newest settings row, as the shop settings page and the booking form use.
function latestOperatorConfig(operatorId) {
  return prisma.bNPLConfig.findFirst({
    where: { operatorId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * BNPLB-122 (FR-OP-002, FR-OP-005): remind the operator once, at the time they
 * chose in Shop settings (operatorReminderBeforeAutoRejectMinutes), before an
 * unanswered request is automatically rejected. Only operators with automatic
 * rejection and reminder alerts both on are reminded. Runs before the
 * rejection pass, every 5 minutes.
 */
async function performOperatorResponseReminderCheck({
  triggeredByUserId = null,
  triggerSource = "MANUAL",
  saveHistory = true,
} = {}) {
  let cronRun = null;

  try {
    // saveHistory: true records every run; "whenActive" (the 5-minute
    // schedule) records only a run that reminded someone, so the admin's
    // scheduled task history is not filled with empty runs.
    if (saveHistory === true) {
      cronRun = await createCronRun({
        jobType: "OPERATOR_RESPONSE_REMINDER",
        triggeredByUserId,
        triggerSource,
      });
    }

    const now = new Date();

    const candidates = await prisma.booking.findMany({
      where: {
        status: "PENDING",
        operator: {
          configs: {
            some: {
              autoRejectInactiveBooking: true,
              enableOperatorReminderAlerts: true,
            },
          },
        },
      },
      include: includeBookingRelations(),
    });

    const reminded = [];

    for (const booking of candidates) {
      const config = await latestOperatorConfig(booking.operatorId);

      if (!config?.autoRejectInactiveBooking || !config.enableOperatorReminderAlerts) {
        continue;
      }

      const { deadline } = responseDeadlineFor(booking, config);
      const reminderMinutes = config.operatorReminderBeforeAutoRejectMinutes || 30;
      const remindFrom = new Date(deadline.getTime() - reminderMinutes * 60 * 1000);

      // Inside the reminder window only: not yet due, or already past the
      // deadline (the rejection pass takes it from there).
      if (now < remindFrom || now >= deadline) {
        continue;
      }

      if (await hasAuditLog(booking.id, "BOOKING_AUTO_REJECT_REMINDER_SENT")) {
        continue;
      }

      const minutesLeft = Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / 60000));
      const code = booking.bookingCode || booking.id;

      await notifyOperatorUsersByBooking({
        booking,
        title: "Booking request about to expire",
        message: `Booking ${code} will be rejected automatically in about ${minutesLeft} minutes unless you accept, reject or make an offer.`,
        type: "BOOKING_AUTO_REJECT_REMINDER",
        emailSubject: `Action needed - Booking ${code} expires soon`,
        emailHtml: autoRejectReminderTemplate({
          booking,
          operatorUrl: operatorBookingUrl(booking.id),
          responseDeadline: deadline,
          minutesLeft,
        }),
        // The reminder is the operator's to act on; platform admins are not
        // notified.
        notifyMaster: false,
      });

      // Recorded after sending, so a failed send is retried on the next run.
      await prisma.auditLog.create({
        data: {
          userId: triggeredByUserId,
          action: "BOOKING_AUTO_REJECT_REMINDER_SENT",
          entityType: "Booking",
          entityId: String(booking.id),
          details: {
            bookingCode: booking.bookingCode,
            responseDeadline: deadline,
            reminderMinutes,
            minutesLeft,
            cronRunId: cronRun?.id || null,
          },
        },
      });

      reminded.push({ id: booking.id, bookingCode: booking.bookingCode, responseDeadline: deadline });
    }

    const result = {
      checkedAt: now,
      remindedCount: reminded.length,
      remindedBookings: reminded,
    };

    if (!cronRun && saveHistory === "whenActive" && reminded.length) {
      cronRun = await createCronRun({
        jobType: "OPERATOR_RESPONSE_REMINDER",
        triggeredByUserId,
        triggerSource,
      });
    }

    await finishCronRunSuccess(cronRun?.id, {
      affectedCount: reminded.length,
      result,
    });

    return result;
  } catch (err) {
    await finishCronRunFailed(cronRun?.id, err);
    throw err;
  }
}

export function runOperatorResponseReminderCheck(options = {}) {
  return runLoggedCronJob(
    "OPERATOR_RESPONSE_REMINDER",
    () => performOperatorResponseReminderCheck(options)
  );
}

async function performNoMerchantResponseCheck({
  triggeredByUserId = null,
  triggerSource = "MANUAL",
  saveHistory = true,
} = {}) {
  let cronRun = null;

  try {
    // See the reminder check for saveHistory: "whenActive".
    if (saveHistory === true) {
      cronRun = await createCronRun({
        jobType: "NO_RESPONSE_CHECK",
        triggeredByUserId,
        triggerSource,
      });
    }

    const now = new Date();

    const noResponseCandidates = await prisma.booking.findMany({
      where: {
        status: "PENDING",
        operator: {
          configs: {
            some: {
              autoRejectInactiveBooking: true,
            },
          },
        },
      },
      include: includeBookingRelations(),
    });

    const rejected = [];

    for (const booking of noResponseCandidates) {
      const config = await latestOperatorConfig(booking.operatorId);

      if (!config?.autoRejectInactiveBooking) {
        continue;
      }

      const {
        minutes: responseDeadlineMinutes,
        deadline: responseDeadline,
      } = responseDeadlineFor(booking, config);

      if (responseDeadline > now) {
        continue;
      }

      const alreadyRejected = await hasAuditLog(
        booking.id,
        "BOOKING_AUTO_REJECTED_NO_MERCHANT_RESPONSE"
      );

      if (alreadyRejected) {
        continue;
      }

      // The operator may have answered since the list was read. Re-check
      // inside the transaction so an accepted booking is never rejected, and
      // move the status through transitionBookingStatus so the rejection is
      // checked and written to the status history.
      const updatedBooking = await prisma.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: booking.id },
          select: { status: true },
        });
        if (current?.status !== "PENDING") return null;

        await transitionBookingStatus({
          bookingId: booking.id,
          newStatus: "REJECTED",
          actorId: triggeredByUserId,
          remark: `Rejected automatically: the operator did not respond within ${responseDeadlineMinutes} minutes.`,
          database: tx,
        });

        await tx.auditLog.create({
          data: {
            userId: triggeredByUserId,
            action: "BOOKING_AUTO_REJECTED_NO_MERCHANT_RESPONSE",
            entityType: "Booking",
            entityId: String(booking.id),
            details: {
              bookingCode: booking.bookingCode,
              createdAt: booking.createdAt,
              responseDeadline,
              responseDeadlineMinutes,
              reason:
                "Merchant/operator did not respond before the configured booking response deadline.",
              cronRunId: cronRun?.id || null,
            },
          },
        });

        return tx.booking.findUnique({
          where: { id: booking.id },
          include: includeBookingRelations(),
        });
      });

      if (!updatedBooking) {
        continue;
      }

      await notifyCustomerByBooking({
        booking: updatedBooking,
        title: "Booking request expired",
        message: `Booking ${
          updatedBooking.bookingCode || updatedBooking.id
        } was cancelled because the operator did not respond in time. Nothing was charged.`,
        type: "BOOKING_AUTO_REJECTED_NO_RESPONSE",
        emailSubject: `Booking Request Expired - ${
          updatedBooking.bookingCode || updatedBooking.id
        }`,
        emailHtml: autoRejectedBookingTemplate({
          booking: updatedBooking,
          customerUrl: frontendBookingUrl(booking.id),
          autoRejectedEmailText:
            "The operator did not respond to your request before the response deadline, so it was cancelled. Nothing was charged. You can search again for other cars on the same dates.",
        }),
      });

      await notifyOperatorUsersByBooking({
        booking: updatedBooking,
        title: "Booking auto-rejected",
        message: `Booking ${
          updatedBooking.bookingCode || updatedBooking.id
        } was automatically rejected because there was no merchant response before the configured response deadline.`,
        type: "BOOKING_AUTO_REJECTED_NO_RESPONSE",
      });

      await notifyMasterUsers({
        title: "Booking auto-rejected",
        message: `Booking ${
          updatedBooking.bookingCode || updatedBooking.id
        } was rejected due to no merchant response before the configured response deadline.`,
        type: "BOOKING_AUTO_REJECTED_NO_RESPONSE",
        relatedEntityType: "Booking",
        relatedEntityId: updatedBooking.id,
      });

      rejected.push(updatedBooking);
    }

    if (!cronRun && saveHistory === "whenActive" && rejected.length) {
      cronRun = await createCronRun({
        jobType: "NO_RESPONSE_CHECK",
        triggeredByUserId,
        triggerSource,
      });
    }

    lastNoResponseRun = new Date();
    lastNoResponseResult = {
      checkedAt: lastNoResponseRun,
      rejectedCount: rejected.length,
      rejectedBookings: rejected.map((booking) => ({
        id: booking.id,
        bookingCode: booking.bookingCode,
        customerName: booking.customer?.name,
        operatorName: booking.operator?.companyName,
        createdAt: booking.createdAt,
      })),
    };

    await finishCronRunSuccess(cronRun?.id, {
      affectedCount: rejected.length,
      result: lastNoResponseResult,
    });

    return lastNoResponseResult;
  } catch (err) {
    await finishCronRunFailed(cronRun?.id, err);
    throw err;
  }
}

export function runNoMerchantResponseCheck(options = {}) {
  return runLoggedCronJob(
    "NO_RESPONSE_CHECK",
    () => performNoMerchantResponseCheck(options)
  );
}

async function performBookingMaintenanceChecks({
  triggeredByUserId = null,
  triggerSource = "MANUAL",
} = {}) {
  let cronRun = null;

  try {
    // Wake a suspended (scale-to-zero) database compute before doing any work,
    // so the first write below doesn't fail on a cold start.
    await ensureDbConnection();

    cronRun = await createCronRun({
      jobType: "MAINTENANCE_CHECK",
      triggeredByUserId,
      triggerSource,
    });

    // Remind first, then reject: a request in its last minutes gets its
    // reminder before the rejection pass looks at it.
    const responseReminderResult = await runOperatorResponseReminderCheck({
      triggeredByUserId,
      triggerSource,
      saveHistory: false,
    });

    const noResponseResult = await runNoMerchantResponseCheck({
      triggeredByUserId,
      triggerSource,
      saveHistory: false,
    });

    let reconciliationResult;
    try {
      reconciliationResult = await runPaymentReconciliationCheck();
    } catch (error) {
      reconciliationResult = {
        checkedAt: new Date(),
        reconciledCount: 0,
        failedCount: 1,
        failures: [{ error: error.message }],
      };
    }

    const reminderResult = await runPaymentReminderCheck({
      triggeredByUserId,
      triggerSource,
      saveHistory: false,
    });

    const overdueResult = await runOverdueBookingCheck({
      triggeredByUserId,
      triggerSource,
      saveHistory: false,
    });

    const completionResult = await runCompletedBookingCheck({
      triggeredByUserId,
      triggerSource,
      saveHistory: false,
    });

    const result = {
      checkedAt: new Date(),
      responseReminders: responseReminderResult,
      noResponse: noResponseResult,
      paymentReconciliation: reconciliationResult,
      reminders: reminderResult,
      overdue: overdueResult,
      completed: completionResult,
    };

    const affectedCount =
      Number(responseReminderResult?.remindedCount || 0) +
      Number(noResponseResult?.rejectedCount || 0) +
      Number(reconciliationResult?.reconciledCount || 0) +
      Number(reminderResult?.remindedCount || 0) +
      Number(overdueResult?.expiredCount || 0) +
      Number(completionResult?.completedCount || 0);

    await finishCronRunSuccess(cronRun?.id, {
      affectedCount,
      result,
    });

    return result;
  } catch (err) {
    await finishCronRunFailed(cronRun?.id, err);
    throw err;
  }
}

export function getCronStatus() {
  return {
    cronStarted,

    lastNoResponseRun,
    lastNoResponseResult,

    lastReminderRun,
    lastReminderResult,

    lastOverdueRun,
    lastOverdueResult,

    lastCompletionRun,
    lastCompletionResult,

    schedule:
      "Operator response reminders and automatic rejections every 5 minutes; other booking maintenance every 30 minutes (cron-job.org or the server's own schedule).",
  };
}

export function startOverdueBookingCron() {
  if (cronStarted) return;

  cron.schedule("*/30 * * * *", async () => {
    try {
      console.log("[CRON] Running booking maintenance checks...");
      await runBookingMaintenanceChecks({
        triggerSource: "LOCAL_CRON",
});
    } catch (err) {
      console.error("[CRON] Booking maintenance check failed:", err.message);
    }
  });

  // BNPLB-122: reminders and automatic rejections run every 5 minutes, so
  // each lands within 5 minutes of its time. The 30-minute maintenance run
  // still calls both as a fallback; they share the same advisory locks, so
  // the two schedules never run a job twice at once.
  cron.schedule("*/5 * * * *", async () => {
    try {
      await runOperatorResponseReminderCheck({ triggerSource: "LOCAL_CRON", saveHistory: "whenActive" });
      await runNoMerchantResponseCheck({ triggerSource: "LOCAL_CRON", saveHistory: "whenActive" });
    } catch (err) {
      console.error("[CRON] Response reminder / auto-reject check failed:", err.message);
    }
  });

  cronStarted = true;
  console.log("[CRON] Booking maintenance cron started.");
}

export function runBookingMaintenanceChecks(options = {}) {
  return runLoggedCronJob(
    "BOOKING_MAINTENANCE",
    () => performBookingMaintenanceChecks(options),
    {
      summarize: (result) => ({
        processedCount:
          Number(result?.responseReminders?.remindedCount || 0) +
          Number(result?.noResponse?.rejectedCount || 0) +
          Number(result?.paymentReconciliation?.reconciledCount || 0) +
          Number(result?.reminders?.remindedCount || 0) +
          Number(result?.overdue?.expiredCount || 0) +
          Number(result?.completed?.completedCount || 0),
        failureCount: Number(result?.paymentReconciliation?.failedCount || 0),
        errors: result?.paymentReconciliation?.failures || [],
      }),
    }
  );
}

export function runDailyRecoverySweep() {
  return runLoggedCronJob("DAILY_RECOVERY_SWEEP", async () => {
    await ensureDbConnection();
    let reconciliation;
    try {
      reconciliation = await runPaymentReconciliationCheck();
    } catch (error) {
      reconciliation = {
        reconciledCount: 0,
        failedCount: 1,
        failures: [{ error: error.message }],
      };
    }
    const overdue = await runOverdueBookingCheck({
      triggerSource: "DAILY_RECOVERY_SWEEP",
    });

    // Where no long-running worker exists (a serverless deployment) this is
    // what records queued product events and retries any that failed.
    let jobQueue;
    try {
      jobQueue = await runJobQueue();
    } catch (error) {
      jobQueue = { error: error.message };
    }

    return {
      jobQueue,
      checkedAt: new Date(),
      reconciliation,
      overdue,
      processedCount:
        Number(reconciliation?.reconciledCount || 0) +
        Number(overdue?.expiredCount || 0),
      failureCount:
        Number(reconciliation?.failedCount || 0) +
        Number(overdue?.failureCount || 0),
      errors: reconciliation?.failures || [],
    };
  });
}