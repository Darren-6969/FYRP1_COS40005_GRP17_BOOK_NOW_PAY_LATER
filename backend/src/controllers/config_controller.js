import prisma from "../config/db.js";
import { parseId } from "../utils/parseId.js";
import { getPlatformDeadlinePolicy, isPlatformPeakDate, validatePublishedDeadline } from "../services/platform_policy_service.js";

function canManageOperator(req, operatorId) {
  if (req.user.role === "MASTER_SELLER") return true;
  return req.user.operatorId === operatorId;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return String(value) === "true";
}

async function ensureConfig(operatorId) {
  const existing = await prisma.bNPLConfig.findFirst({
    where: { operatorId },
    include: {
      operator: true,
    },
  });

  if (existing) return existing;

  return prisma.bNPLConfig.create({
    data: {
      operatorId,
      paymentDeadlineDays: 3,
      allowReceiptUpload: true,
      autoCancelOverdue: true,
      invoiceFooterText: "Thank you for using Book Now Pay Later.",
      manualPaymentNote: "Please upload your DuitNow/SPay receipt after payment.",
    },
    include: {
      operator: true,
    },
  });
}

export async function getBNPLConfigs(req, res, next) {
  try {
    if (req.user.role === "MASTER_SELLER") {
      const operators = await prisma.operator.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          configs: true,
        },
      });

      const configs = [];

      for (const operator of operators) {
        const config =
          operator.configs?.[0] || (await ensureConfig(operator.id));

        configs.push({
          ...config,
          operator,
        });
      }

      return res.json({
        configs,
      });
    }

    if (!req.user.operatorId) {
      return res.status(403).json({
        message: "No operator account linked to this user",
      });
    }

    const config = await ensureConfig(req.user.operatorId);

    res.json({
      configs: [config],
    });
  } catch (err) {
    next(err);
  }
}

export async function getBNPLConfig(req, res, next) {
  try {
    const operatorId = req.params.operatorId
      ? parseId(req.params.operatorId, "operator id")
      : req.user.operatorId;

    if (!operatorId) {
      return res.status(400).json({
        message: "operatorId is required",
      });
    }

    if (!canManageOperator(req, operatorId)) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    const config = await ensureConfig(operatorId);

    res.json(config);
  } catch (err) {
    next(err);
  }
}

export async function updateBNPLConfig(req, res, next) {
  try {
    const operatorId = req.params.operatorId
      ? parseId(req.params.operatorId, "operator id")
      : req.user.operatorId;

    if (!operatorId) {
      return res.status(400).json({
        message: "operatorId is required",
      });
    }

    if (!canManageOperator(req, operatorId)) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    const existing = await ensureConfig(operatorId);
    const deadlinePolicy = await getPlatformDeadlinePolicy();

    const data = {
      paymentDeadlineDays:
        req.body.paymentDeadlineDays === undefined
          ? existing.paymentDeadlineDays
          : Number(req.body.paymentDeadlineDays),
      allowReceiptUpload: normalizeBoolean(
        req.body.allowReceiptUpload,
        existing.allowReceiptUpload
      ),
      autoCancelOverdue: normalizeBoolean(
        req.body.autoCancelOverdue,
        existing.autoCancelOverdue
      ),
      invoiceLogoUrl:
        req.body.invoiceLogoUrl === undefined
          ? existing.invoiceLogoUrl
          : req.body.invoiceLogoUrl || null,
      invoiceFooterText:
        req.body.invoiceFooterText === undefined
          ? existing.invoiceFooterText
          : req.body.invoiceFooterText || null,
      manualPaymentNote:
        req.body.manualPaymentNote === undefined
          ? existing.manualPaymentNote
          : req.body.manualPaymentNote || null,
    };

    if (!validatePublishedDeadline(deadlinePolicy, data.paymentDeadlineDays)) {
      return res.status(400).json({
        message: `Payment deadline must be one of the published tiers: ${deadlinePolicy.publishedTiers.join(", ")} days.`,
      });
    }

    if (!Number.isInteger(data.paymentDeadlineDays) || data.paymentDeadlineDays < 1) {
      return res.status(400).json({
        message: "paymentDeadlineDays must be at least 1",
      });
    }

    const config = await prisma.bNPLConfig.update({
      where: { id: existing.id },
      data,
      include: {
        operator: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "BNPL_CONFIG_UPDATED",
        entityType: "BNPLConfig",
        entityId: String(config.id),
        details: {
          operatorId,
          before: { paymentDeadlineDays: existing.paymentDeadlineDays },
          after: { paymentDeadlineDays: config.paymentDeadlineDays },
          ...data,
        },
      },
    });

    res.json(config);
  } catch (err) {
    next(err);
  }
}

export async function getPlatformDeadlineSettings(req, res, next) {
  try {
    res.json(await getPlatformDeadlinePolicy());
  } catch (err) {
    next(err);
  }
}

export async function updatePlatformDeadlineSettings(req, res, next) {
  try {
    const tiers = [...new Set((Array.isArray(req.body.publishedTiers) ? req.body.publishedTiers : []).map(Number))]
      .filter((value) => Number.isInteger(value) && value > 0)
      .sort((a, b) => a - b);
    const mostLenientDays = Number(req.body.mostLenientDays);
    if (!tiers.length || !Number.isInteger(mostLenientDays) || !tiers.includes(mostLenientDays) || Math.max(...tiers) !== mostLenientDays) {
      return res.status(400).json({ message: "Published tiers must be positive integers, and mostLenientDays must be the largest published tier." });
    }

    const before = await getPlatformDeadlinePolicy();
    const after = await prisma.platformDeadlinePolicy.update({
      where: { id: 1 },
      data: { publishedTiers: tiers, mostLenientDays },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "PLATFORM_DEADLINE_POLICY_UPDATED",
        entityType: "PlatformDeadlinePolicy",
        entityId: "1",
        details: {
          before: { publishedTiers: before.publishedTiers, mostLenientDays: before.mostLenientDays },
          after: { publishedTiers: after.publishedTiers, mostLenientDays: after.mostLenientDays },
        },
      },
    });
    res.json(after);
  } catch (err) {
    next(err);
  }
}

export async function getPartialRefundEligibility(req, res, next) {
  try {
    const date = String(req.query.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "A valid date is required." });
    }
    const peak = await isPlatformPeakDate(`${date}T00:00:00.000Z`);
    res.json({ date, available: !peak, reason: peak ? "Partial refund election is unavailable on platform peak dates." : null });
  } catch (err) {
    next(err);
  }
}