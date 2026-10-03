import cron from "node-cron";
import Stripe from "stripe";
import prisma from "../config/db.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";
import {
  getPayoutEligibilityCutoff,
  isSettleableLedgerEntry,
} from "../services/settlement_payout_service.js";

const DEFAULT_APPEAL_WINDOW_DAYS = 7;
const LEDGER_INCLUDE = {
  payment: { select: { status: true } },
  booking: {
    select: {
      id: true,
      status: true,
      serviceResolvedAt: true,
      operatorId: true,
      operator: { select: { stripeAccountId: true } },
    },
  },
};

function getAppealWindowDays(value = process.env.PAYOUT_APPEAL_WINDOW_DAYS) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 0 ? days : DEFAULT_APPEAL_WINDOW_DAYS;
}

async function createPendingPayout(database, entry, cutoff) {
  const destinationAccountId =
    entry.booking.operator?.stripeAccountId || process.env.STRIPE_CONNECTED_ACCOUNT_ID;
  if (!destinationAccountId || entry.operatorPayoutAmountSen <= 0) return null;

  try {
    return await database.$transaction(async (tx) => {
      const payout = await tx.operatorPayout.create({
        data: {
          operatorId: entry.booking.operatorId,
          destinationAccountId,
          amountSen: entry.operatorPayoutAmountSen,
          idempotencyKey: `operator-ledger-payout-${entry.id}`,
        },
      });

      const claim = await tx.commissionLedgerEntry.updateMany({
        where: {
          id: entry.id,
          payoutId: null,
          payment: { is: { status: "PAID" } },
          booking: {
            is: {
              operatorId: entry.booking.operatorId,
              status: { in: ["COMPLETED", "NO_SHOW"] },
              serviceResolvedAt: { lte: cutoff },
            },
          },
        },
        data: { payoutId: payout.id },
      });

      if (claim.count !== 1) {
        await tx.operatorPayout.delete({ where: { id: payout.id } });
        return null;
      }

      return payout;
    });
  } catch (error) {
    if (error.code === "P2002") return null;
    throw error;
  }
}

async function transferPendingPayouts({
  database,
  StripeClient,
  now,
  appealWindowDays,
}) {
  const pendingPayouts = await database.operatorPayout.findMany({
    where: { status: "PENDING" },
    include: { ledgerEntry: { include: LEDGER_INCLUDE } },
    orderBy: { createdAt: "asc" },
  });
  const result = { transferredCount: 0, cancelledCount: 0, failures: [] };
  if (!pendingPayouts.length) return result;

  const stripe = new StripeClient(process.env.STRIPE_SECRET_KEY);
  for (const payout of pendingPayouts) {
    if (
      !isSettleableLedgerEntry(payout.ledgerEntry, {
        now,
        appealWindowDays,
        payoutId: payout.id,
      })
    ) {
      await database.operatorPayout.update({
        where: { id: payout.id },
        data: {
          status: "CANCELLED",
          lastError: "Ledger entry is no longer settleable",
        },
      });
      result.cancelledCount += 1;
      continue;
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: payout.amountSen,
          currency: "myr",
          destination: payout.destinationAccountId,
          transfer_group: `commission_ledger_${payout.ledgerEntry.id}`,
          metadata: {
            payoutId: String(payout.id),
            ledgerEntryId: String(payout.ledgerEntry.id),
            bookingId: String(payout.ledgerEntry.booking.id),
          },
        },
        { idempotencyKey: payout.idempotencyKey }
      );

      await database.operatorPayout.update({
        where: { id: payout.id },
        data: {
          status: "TRANSFERRED",
          stripeTransferId: transfer.id,
          transferredAt: now,
          lastError: null,
        },
      });
      result.transferredCount += 1;
    } catch (error) {
      await database.operatorPayout.update({
        where: { id: payout.id },
        data: { lastError: error.message },
      });
      result.failures.push({ payoutId: payout.id, error: error.message });
    }
  }

  return result;
}

export async function runSettleablePayouts({
  database = prisma,
  StripeClient = Stripe,
  now = new Date(),
  appealWindowDays = getAppealWindowDays(),
} = {}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const payoutAppealWindowDays = getAppealWindowDays(appealWindowDays);
  const cutoff = getPayoutEligibilityCutoff(now, payoutAppealWindowDays);
  const entries = await database.commissionLedgerEntry.findMany({
    where: {
      payoutId: null,
      payment: { is: { status: "PAID" } },
      booking: {
        is: {
          status: { in: ["COMPLETED", "NO_SHOW"] },
          serviceResolvedAt: { lte: cutoff },
          operator: {
            is: process.env.STRIPE_CONNECTED_ACCOUNT_ID
              ? {}
              : { stripeAccountId: { not: null } },
          },
        },
      },
    },
    include: LEDGER_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

  for (const entry of entries) {
    if (
      !isSettleableLedgerEntry(entry, {
        now,
        appealWindowDays: payoutAppealWindowDays,
      })
    ) {
      continue;
    }

    await createPendingPayout(database, entry, cutoff);
  }

  return transferPendingPayouts({
    database,
    StripeClient,
    now,
    appealWindowDays: payoutAppealWindowDays,
  });
}

export function runOperatorPayoutJob(options = {}) {
  const { runLogged = true, lockDatabase = prisma } = options;
  const run = () => runSettleablePayouts(options);
  return runLogged
    ? runLoggedCronJob("OPERATOR_PAYOUT", run, { database: lockDatabase })
    : run();
}

export function startOperatorPayoutJob() {
  cron.schedule("15 * * * *", async () => {
    try {
      await runOperatorPayoutJob();
    } catch (error) {
      console.error("[OperatorPayout] Job failed:", error.message);
    }
  });
  console.log("[OperatorPayout] Scheduler started — hourly settlement check");
}