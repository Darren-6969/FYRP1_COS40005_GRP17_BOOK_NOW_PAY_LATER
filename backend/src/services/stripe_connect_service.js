import prisma from "../config/db.js";

export function getStripeAccountState(account = {}) {
  const requirements = account.requirements || {};
  const stripeRequirements = {
    currentlyDue: requirements.currently_due || [],
    pastDue: requirements.past_due || [],
    pendingVerification: requirements.pending_verification || [],
    errors: (requirements.errors || []).map((error) => ({
      code: error.code || null,
      reason: error.reason || null,
      requirement: error.requirement || null,
    })),
    disabledReason: requirements.disabled_reason || null,
  };

  let stripeOnboardingStatus = "IN_PROGRESS";
  if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
    stripeOnboardingStatus = "COMPLETE";
  } else if (stripeRequirements.currentlyDue.length || stripeRequirements.pastDue.length) {
    stripeOnboardingStatus = "ACTION_REQUIRED";
  } else if (account.details_submitted) {
    stripeOnboardingStatus = "PENDING_VERIFICATION";
  }

  return { stripeOnboardingStatus, stripeRequirements };
}

// Basic, non-sensitive details of a connected account for the operator's own
// settings page. Stripe only ever exposes the last 4 digits of the payout
// bank account, and that is all we pass on.
export function getStripeAccountSummary(account = {}) {
  const profile = account.business_profile || {};
  const individual = account.individual || {};
  const company = account.company || {};
  const personName = [individual.first_name, individual.last_name]
    .filter(Boolean)
    .join(" ");

  const bankAccounts = account.external_accounts?.data || [];
  const payoutAccount =
    bankAccounts.find((item) => item.default_for_currency) || bankAccounts[0] || null;

  const schedule = account.settings?.payouts?.schedule || null;

  return {
    displayName:
      account.settings?.dashboard?.display_name ||
      profile.name ||
      company.name ||
      personName ||
      null,
    email: account.email || null,
    country: account.country || null,
    defaultCurrency: account.default_currency
      ? account.default_currency.toUpperCase()
      : null,
    businessType: account.business_type || null,
    createdAt: account.created ? new Date(account.created * 1000).toISOString() : null,
    payoutAccount: payoutAccount
      ? {
          type: payoutAccount.object === "card" ? "card" : "bank_account",
          bankName: payoutAccount.bank_name || payoutAccount.brand || null,
          last4: payoutAccount.last4 || null,
          currency: payoutAccount.currency ? payoutAccount.currency.toUpperCase() : null,
        }
      : null,
    payoutSchedule: schedule
      ? {
          interval: schedule.interval || null,
          delayDays: Number.isInteger(schedule.delay_days) ? schedule.delay_days : null,
          weeklyAnchor: schedule.weekly_anchor || null,
          monthlyAnchor: schedule.monthly_anchor ?? null,
        }
      : null,
  };
}

export async function syncStripeAccountUpdated(account, database = prisma) {
  if (!account?.id) return { count: 0 };

  return database.operator.updateMany({
    where: { stripeAccountId: account.id },
    data: getStripeAccountState(account),
  });
}

export async function createExpressOnboardingLink({
  operator,
  stripe,
  frontendBase,
  country = "MY",
  database = prisma,
}) {
  let accountId = operator.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create(
      {
        type: "express",
        country,
        email: operator.email,
        metadata: { operatorId: String(operator.id) },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      },
      { idempotencyKey: `operator-connect-${operator.id}` }
    );
    accountId = account.id;
    await database.operator.update({
      where: { id: operator.id },
      data: {
        stripeAccountId: accountId,
        ...getStripeAccountState(account),
      },
    });
  } else {
    await stripe.accounts.update(accountId, {
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
  }

  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${frontendBase}/operator/settings?stripe=refresh`,
    return_url: `${frontendBase}/operator/settings?stripe=connected`,
    type: "account_onboarding",
  });
}