import prisma from "../config/db.js";
import { parseId } from "../utils/parseId.js";
import { getPlatformDeadlinePolicy, isPlatformPeakDate, validatePublishedDeadline } from "../services/platform_policy_service.js";
import { createAuditLog } from "../services/log_service.js";
import {
  DEFAULT_PLATFORM_FEATURE_FLAGS,
  getPlatformSettings as loadPlatformSettings,
  normalizeReminderTiming,
  normalizeSubscriptionTiers,
} from "../services/platform_settings_service.js";
import { clearFeatureFlagCache, setFeatureFlag } from "../services/feature_flag_service.js";

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
  const platformSettings = await loadPlatformSettings();

  return prisma.bNPLConfig.create({
    data: {
      operatorId,
      paymentDeadlineDays: platformSettings.defaultPaymentDeadlineDays,
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
      noShowWindowHours:
        req.body.noShowWindowHours === undefined
          ? existing.noShowWindowHours
          : Number(req.body.noShowWindowHours),
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

    if (!Number.isInteger(data.noShowWindowHours) || data.noShowWindowHours < 0) {
      return res.status(400).json({ message: "noShowWindowHours must be a non-negative integer." });
    }

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

    const config = await prisma.$transaction(async (tx) => {
      const updated = await tx.bNPLConfig.update({
        where: { id: existing.id },
        data,
        include: { operator: true },
      });
      await createAuditLog({
        req,
        action: "BNPL_CONFIG_UPDATED",
        entityType: "BNPLConfig",
        entityId: updated.id,
        before: Object.fromEntries(Object.keys(data).map((key) => [key, existing[key]])),
        after: Object.fromEntries(Object.keys(data).map((key) => [key, updated[key]])),
        details: { operatorId },
      }, tx);
      return updated;
    });

    await setFeatureFlag({
      key: "allowReceiptUpload",
      enabled: config.allowReceiptUpload,
      operatorId,
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
    const settings = await loadPlatformSettings();
    if (!tiers.includes(settings.defaultPaymentDeadlineDays)) {
      return res.status(400).json({
        message: "Published tiers must include the current default payment deadline.",
      });
    }
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.platformDeadlinePolicy.update({
        where: { id: 1 },
        data: { publishedTiers: tiers, mostLenientDays },
      });
      await createAuditLog({
        req,
        action: "PLATFORM_DEADLINE_POLICY_UPDATED",
        entityType: "PlatformDeadlinePolicy",
        entityId: "1",
        before: { publishedTiers: before.publishedTiers, mostLenientDays: before.mostLenientDays },
        after: { publishedTiers: updated.publishedTiers, mostLenientDays: updated.mostLenientDays },
      }, tx);
      return updated;
    });
    res.json(after);
  } catch (err) {
    next(err);
  }
}

export async function getPlatformSettings(req, res, next) {
  try {
    res.json(await loadPlatformSettings());
  } catch (err) {
    next(err);
  }
}

export async function updatePlatformSettings(req, res, next) {
  try {
    const existing = await loadPlatformSettings();
    const commissionRate = Number(req.body.commissionRate ?? existing.commissionRate);
    const defaultPaymentDeadlineDays = Number(
      req.body.defaultPaymentDeadlineDays ?? existing.defaultPaymentDeadlineDays
    );
    const licenceReuploadWindowHours = Number(
      req.body.licenceReuploadWindowHours ?? existing.licenceReuploadWindowHours
    );
    const deadlinePolicy = await getPlatformDeadlinePolicy();

    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({ message: "Commission rate must be between 0 and 100 percent." });
    }
    if (!validatePublishedDeadline(deadlinePolicy, defaultPaymentDeadlineDays)) {
      return res.status(400).json({
        message: `Default payment deadline must be one of the published tiers: ${deadlinePolicy.publishedTiers.join(", ")} days.`,
      });
    }
    if (!Number.isInteger(licenceReuploadWindowHours) || licenceReuploadWindowHours < 1 || licenceReuploadWindowHours > 720) {
      return res.status(400).json({ message: "Licence re-upload window must be between 1 and 720 hours." });
    }

    const normalizeNumericMap = (value, current, fieldName) => {
      if (value === undefined) return current;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${fieldName} must be a JSON object of named numeric values.`);
      }
      const entries = Object.entries(value);
      if (entries.some(([key, amount]) => !key.trim() || !Number.isFinite(Number(amount)) || Number(amount) < 0)) {
        throw new Error(`${fieldName} values must be named non-negative numbers.`);
      }
      return Object.fromEntries(entries.map(([key, amount]) => [key, Number(amount)]));
    };

    let creditTierThresholds;
    let exposureLimits;
    try {
      creditTierThresholds = normalizeNumericMap(
        req.body.creditTierThresholds,
        existing.creditTierThresholds,
        "Credit tier thresholds"
      );
      exposureLimits = normalizeNumericMap(
        req.body.exposureLimits,
        existing.exposureLimits,
        "Exposure limits"
      );
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    let downPaymentFloorPercent = existing.downPaymentFloorPercent;
    if (req.body.downPaymentFloorPercent !== undefined) {
      downPaymentFloorPercent = Number(req.body.downPaymentFloorPercent);
      if (!Number.isInteger(downPaymentFloorPercent) || downPaymentFloorPercent < 0 || downPaymentFloorPercent > 100) {
        return res.status(400).json({ message: "Down payment floor must be a whole percentage between 0 and 100." });
      }
    }

    let reminderTiming;
    let subscriptionTiers;
    try {
      reminderTiming = normalizeReminderTiming(req.body.reminderTiming, existing.reminderTiming);
      subscriptionTiers = normalizeSubscriptionTiers(req.body.subscriptionTiers, existing.subscriptionTiers);
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    let featureFlags = existing.featureFlags;
    if (req.body.featureFlags !== undefined) {
      const submittedFlags = req.body.featureFlags;
      if (!submittedFlags || typeof submittedFlags !== "object" || Array.isArray(submittedFlags)) {
        return res.status(400).json({ message: "Feature flags must be a JSON object." });
      }
      featureFlags = { ...existing.featureFlags };
      for (const [key, enabled] of Object.entries(submittedFlags)) {
        if (!Object.hasOwn(DEFAULT_PLATFORM_FEATURE_FLAGS, key) || typeof enabled !== "boolean") {
          return res.status(400).json({ message: `Invalid platform feature flag: ${key}` });
        }
        featureFlags[key] = enabled;
      }
    }

    const data = {
      commissionRate,
      defaultPaymentDeadlineDays,
      creditTierThresholds,
      exposureLimits,
      licenceReuploadWindowHours,
      featureFlags,
      reminderTiming,
      downPaymentFloorPercent,
      subscriptionTiers,
    };
    const before = {
      ...existing,
      commissionRate: Number(existing.commissionRate),
    };

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.platformSettings.update({
        where: { id: 1 },
        data,
      });
      let updatedDefaultConfigs = 0;
      if (existing.defaultPaymentDeadlineDays !== defaultPaymentDeadlineDays) {
        const updateResult = await tx.bNPLConfig.updateMany({
          where: { paymentDeadlineDays: existing.defaultPaymentDeadlineDays },
          data: { paymentDeadlineDays: defaultPaymentDeadlineDays },
        });
        updatedDefaultConfigs = updateResult.count;
      }
      // Global flag rows are written in the same transaction as the settings
      // row, so the two stores cannot disagree if either write fails.
      if (req.body.featureFlags !== undefined) {
        for (const [key, enabled] of Object.entries(featureFlags)) {
          await setFeatureFlag({ key, enabled }, tx);
        }
      }
      const after = {
        ...updated,
        commissionRate: Number(updated.commissionRate),
      };
      await createAuditLog({
        req,
        action: "PLATFORM_SETTINGS_UPDATED",
        entityType: "PlatformSettings",
        entityId: "1",
        before,
        after,
        details: { updatedDefaultConfigs },
      }, tx);
      return { settings: updated, updatedDefaultConfigs };
    });

    clearFeatureFlagCache();
    res.json(result);
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