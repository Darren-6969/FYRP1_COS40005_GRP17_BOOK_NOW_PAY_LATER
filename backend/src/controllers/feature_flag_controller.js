import prisma from "../config/db.js";
import {
  clearFeatureFlagCache,
  getFeatureFlags,
  removeFeatureFlag,
  setFeatureFlag,
} from "../services/feature_flag_service.js";
import { createAuditLog } from "../services/log_service.js";
import { parseId } from "../utils/parseId.js";

export async function getEffectiveFeatureFlags(req, res, next) {
  try {
    let operatorId = req.query.operatorId
      ? parseId(req.query.operatorId, "operator id")
      : req.user.operatorId || null;

    if (req.user.role === "CUSTOMER" && operatorId !== null) {
      const booking = await prisma.booking.findFirst({
        where: { customerId: req.user.id, operatorId },
        select: { id: true },
      });
      if (!booking) {
        return res.status(403).json({ message: "You do not have access to this operator's flags." });
      }
    }

    if (req.user.role === "NORMAL_SELLER") {
      operatorId = req.user.operatorId;
    }

    res.json({ environment: process.env.NODE_ENV || "development", flags: await getFeatureFlags(operatorId) });
  } catch (err) {
    next(err);
  }
}

export async function getManagedFeatureFlags(_req, res, next) {
  try {
    const rows = await prisma.featureFlag.findMany({
      where: { environment: process.env.NODE_ENV || "development" },
      orderBy: [{ key: "asc" }, { operatorId: "asc" }],
      include: { operator: { select: { id: true, companyName: true, operatorCode: true } } },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

const FLAG_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{1,80}$/;

function flagScope(source) {
  return source.operatorId == null || source.operatorId === ""
    ? null
    : parseId(source.operatorId, "operator id");
}

async function assertOperatorExists(operatorId, database = prisma) {
  if (operatorId === null) return;
  const operator = await database.operator.findUnique({ where: { id: operatorId }, select: { id: true } });
  if (!operator) {
    const error = new Error("Operator not found.");
    error.statusCode = 404;
    throw error;
  }
}

function auditedFlagState(row, key, operatorId) {
  return row ? { key, operatorId, enabled: row.enabled } : null;
}

export async function updateFeatureFlag(req, res, next) {
  try {
    const { key, enabled } = req.body;
    if (typeof key !== "string" || !FLAG_KEY_PATTERN.test(key) || typeof enabled !== "boolean") {
      return res.status(400).json({ message: "key and boolean enabled are required." });
    }
    const operatorId = flagScope(req.body);
    await assertOperatorExists(operatorId);
    const environment = process.env.NODE_ENV || "development";

    const flag = await prisma.$transaction(async (tx) => {
      const before = await tx.featureFlag.findFirst({ where: { key, environment, operatorId } });
      const saved = await setFeatureFlag({ key, enabled, operatorId }, tx);
      await createAuditLog({
        req,
        action: "FEATURE_FLAG_UPDATED",
        entityType: "FeatureFlag",
        entityId: saved.id,
        before: auditedFlagState(before, key, operatorId),
        after: auditedFlagState(saved, key, operatorId),
        details: { environment, scope: operatorId === null ? "global" : "operator" },
      }, tx);
      return saved;
    });
    // setFeatureFlag clears the cache before the transaction commits; clear it
    // again so a read made in between cannot keep serving the old value.
    clearFeatureFlagCache();
    res.json(flag);
  } catch (err) {
    next(err);
  }
}

// Removing an operator override returns that operator to the global value.
export async function deleteFeatureFlagOverride(req, res, next) {
  try {
    const key = req.query.key;
    const operatorId = flagScope(req.query);
    if (typeof key !== "string" || !FLAG_KEY_PATTERN.test(key) || operatorId === null) {
      return res.status(400).json({ message: "key and operatorId are required to remove an operator override." });
    }
    const environment = process.env.NODE_ENV || "development";

    const removed = await prisma.$transaction(async (tx) => {
      const existing = await removeFeatureFlag({ key, operatorId }, tx);
      if (existing) {
        await createAuditLog({
          req,
          action: "FEATURE_FLAG_OVERRIDE_REMOVED",
          entityType: "FeatureFlag",
          entityId: existing.id,
          before: auditedFlagState(existing, key, operatorId),
          after: null,
          details: { environment, scope: "operator" },
        }, tx);
      }
      return existing;
    });
    clearFeatureFlagCache();
    if (!removed) return res.status(404).json({ message: "No override exists for that operator." });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
