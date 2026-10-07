import prisma from "../config/db.js";
import { getFeatureFlags, setFeatureFlag } from "../services/feature_flag_service.js";
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

export async function updateFeatureFlag(req, res, next) {
  try {
    const { key, enabled } = req.body;
    if (typeof key !== "string" || !/^[A-Za-z][A-Za-z0-9_.-]{1,80}$/.test(key) || typeof enabled !== "boolean") {
      return res.status(400).json({ message: "key and boolean enabled are required." });
    }
    const operatorId = req.body.operatorId == null || req.body.operatorId === ""
      ? null
      : parseId(req.body.operatorId, "operator id");
    const flag = await setFeatureFlag({ key, enabled, operatorId });
    res.json(flag);
  } catch (err) {
    next(err);
  }
}
