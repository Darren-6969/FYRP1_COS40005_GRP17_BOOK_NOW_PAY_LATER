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