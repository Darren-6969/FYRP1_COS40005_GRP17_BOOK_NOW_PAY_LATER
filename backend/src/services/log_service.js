import prisma from "../config/db.js";

export async function createAuditLog({ userId, action, entityType, entityId, details } = {}, tx = prisma) {
  return tx.auditLog.create({
    data: {
      userId: userId || null,
      action,
      entityType,
      entityId: entityId || null,
      details: details || undefined,
    },
  });
}
