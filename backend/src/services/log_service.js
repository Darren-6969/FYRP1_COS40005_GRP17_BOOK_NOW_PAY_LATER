import prisma from "../config/db.js";

export async function createAuditLog(
  { req, userId, action, entityType, entityId, before, after, ipAddress, details } = {},
  tx = prisma
) {
  return tx.auditLog.create({
    data: {
      userId: req?.user?.id ?? userId ?? null,
      actorId: req?.user?.id ?? userId ?? null,
      actorType: req?.user || userId != null ? "USER" : "SYSTEM",
      ...(req?.requestId ? { requestId: req.requestId } : {}),
      action,
      entityType,
      entityId: entityId === null || entityId === undefined ? null : String(entityId),
      before,
      after,
      ipAddress: ipAddress || req?.ip || req?.socket?.remoteAddress || null,
      details: details || undefined,
    },
  });
}
