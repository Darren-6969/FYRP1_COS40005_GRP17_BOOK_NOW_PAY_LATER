import prisma from "../config/db.js";
import {
  buildDynamicQr,
  buildStaticQr,
  describeAccount,
  parseDuitNowQr,
  staticQrFrom,
} from "../services/duitnow_qr.js";
import { createAuditLog } from "../services/log_service.js";

// The operator's own DuitNow account, taken from the QR code their bank app
// shows. It is what the platform builds each customer's fixed-amount QR around
// (SRS 4.2.5, dynamic DuitNow QR).

function operatorIdOf(req) {
  return req.user?.operatorId || null;
}

async function latestConfig(operatorId) {
  return prisma.bNPLConfig.findFirst({
    where: { operatorId },
    orderBy: { createdAt: "desc" },
  });
}

function storedAccount(config) {
  if (!config?.duitnowAccount) return null;
  return {
    account: config.duitnowAccount,
    merchantName: config.duitnowMerchantName,
    merchantCity: config.duitnowMerchantCity,
    merchantCategory: config.duitnowMerchantCategory,
  };
}

// A RM 1.00 QR the operator can scan with their own bank app to see exactly
// what a customer will see, before any customer pays.
function accountResponse(config, operator) {
  const stored = storedAccount(config);
  if (!stored) return { configured: false, account: null, samplePayload: null };
  return {
    configured: true,
    account: describeAccount(stored),
    samplePayload: buildDynamicQr({
      account: { ...stored, merchantName: stored.merchantName || operator?.companyName },
      amount: 1,
      reference: "TEST-SCAN",
    }),
  };
}

export async function getDuitnowAccount(req, res, next) {
  try {
    const operatorId = operatorIdOf(req);
    if (!operatorId) return res.status(400).json({ message: "No operator profile is linked to this account." });
    const [config, operator] = await Promise.all([
      latestConfig(operatorId),
      prisma.operator.findUnique({ where: { id: operatorId }, select: { companyName: true } }),
    ]);
    res.json(accountResponse(config, operator));
  } catch (err) {
    next(err);
  }
}

export async function saveDuitnowAccount(req, res, next) {
  try {
    const operatorId = operatorIdOf(req);
    if (!operatorId) return res.status(400).json({ message: "No operator profile is linked to this account." });

    const parsed = parseDuitNowQr(req.body?.payload);
    const data = {
      duitnowAccount: parsed.account,
      duitnowMerchantName: parsed.merchantName,
      duitnowMerchantCity: parsed.merchantCity,
      duitnowMerchantCategory: parsed.merchantCategory,
      duitnowStaticQr: staticQrFrom(req.body.payload),
    };

    const existing = await latestConfig(operatorId);
    const config = existing
      ? await prisma.bNPLConfig.update({ where: { id: existing.id }, data })
      : await prisma.bNPLConfig.create({ data: { operatorId, ...data } });
    const operator = await prisma.operator.findUnique({ where: { id: operatorId }, select: { companyName: true } });

    await createAuditLog({
      req,
      action: "OPERATOR_DUITNOW_ACCOUNT_SET",
      entityType: "Operator",
      entityId: operatorId,
      before: { configured: Boolean(existing?.duitnowAccount) },
      after: { configured: true },
      details: { acquirerId: parsed.acquirerId },
    });

    res.json(accountResponse(config, operator));
  } catch (err) {
    next(err);
  }
}

export async function clearDuitnowAccount(req, res, next) {
  try {
    const operatorId = operatorIdOf(req);
    if (!operatorId) return res.status(400).json({ message: "No operator profile is linked to this account." });

    const existing = await latestConfig(operatorId);
    if (existing?.duitnowAccount) {
      await prisma.bNPLConfig.update({
        where: { id: existing.id },
        data: {
          duitnowAccount: null,
          duitnowMerchantName: null,
          duitnowMerchantCity: null,
          duitnowMerchantCategory: null,
          duitnowStaticQr: null,
        },
      });
      await createAuditLog({
        req,
        action: "OPERATOR_DUITNOW_ACCOUNT_REMOVED",
        entityType: "Operator",
        entityId: operatorId,
        before: { configured: true },
        after: { configured: false },
      });
    }

    res.json({ configured: false, account: null, samplePayload: null });
  } catch (err) {
    next(err);
  }
}

// The operator's own static QR (no amount), for banking apps that cannot read
// the fixed-amount QR. Operators saved before the original text was kept get
// one rebuilt from their saved account.
export function staticQrFor(config, operator) {
  if (config?.duitnowStaticQr) return config.duitnowStaticQr;
  const stored = storedAccount(config);
  if (!stored) return null;
  try {
    return buildStaticQr({
      account: { ...stored, merchantName: stored.merchantName || operator?.companyName },
    });
  } catch (err) {
    console.warn(`[DuitNow QR] could not build a static QR: ${err.message}`);
    return null;
  }
}

// The fixed-amount QR for each part a customer can pay now. Null when the
// operator has not set up a DuitNow account (the page then shows no QR).
export function dynamicQrFor(config, operator, { amount, reference }) {
  const stored = storedAccount(config);
  if (!stored) return null;
  try {
    return buildDynamicQr({
      account: { ...stored, merchantName: stored.merchantName || operator?.companyName },
      amount,
      reference,
    });
  } catch (err) {
    // A QR that cannot be built must not stop the customer reaching the receipt page.
    console.warn(`[DuitNow QR] could not build a QR: ${err.message}`);
    return null;
  }
}
