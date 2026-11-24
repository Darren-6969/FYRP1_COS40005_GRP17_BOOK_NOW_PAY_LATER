// Data retention rules (Privacy Policy, "How long we keep it"; PDPA s.10,
// the Retention Principle). Kept free of database access so they can be
// unit tested; data_retention_service.js runs them.

export const AUDIT_LOG_RETENTION_MONTHS = 24;
export const CHAT_RETENTION_MONTHS = 12;

// A hand-off that a person still has to deal with keeps its conversation.
export const UNFINISHED_ESCALATION_STATUSES = ["OPEN", "ANSWERED"];

/**
 * The moment `months` calendar months before `now`. The day is clamped to
 * the end of a shorter month (31 March minus 1 month is 28 or 29 February),
 * so the cutoff never lands in the following month.
 */
export function cutoffBefore(now, months) {
  const base = new Date(now);
  const target = new Date(base);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(base.getUTCDate(), lastDay));
  return target;
}

/** Audit log rows old enough to delete. */
export function auditLogWhere(now) {
  return { createdAt: { lt: cutoffBefore(now, AUDIT_LOG_RETENTION_MONTHS) } };
}

/** Chat conversations old enough to delete, leaving any still being handled by a person. */
export function chatConversationWhere(now) {
  return {
    lastMessageAt: { lt: cutoffBefore(now, CHAT_RETENTION_MONTHS) },
    escalations: { none: { status: { in: UNFINISHED_ESCALATION_STATUSES } } },
  };
}

export const DELETE_BATCH_SIZE = 500;

// Deletes the rows matching `where` from `model`, a batch of ids at a time.
// Messages and escalations of a conversation go with it (onDelete: Cascade).
async function deleteInBatches(model, where, batchSize) {
  let deleted = 0;
  for (;;) {
    const rows = await model.findMany({ where, select: { id: true }, orderBy: { id: "asc" }, take: batchSize });
    if (!rows.length) return deleted;
    const { count } = await model.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    deleted += count;
    if (rows.length < batchSize) return deleted;
  }
}

/** One retention run: { auditLogsDeleted, chatConversationsDeleted, deleted }. */
export async function purgeExpiredData({ db, now = new Date(), batchSize = DELETE_BATCH_SIZE } = {}) {
  const auditLogsDeleted = await deleteInBatches(db.auditLog, auditLogWhere(now), batchSize);
  const chatConversationsDeleted = await deleteInBatches(db.chatConversation, chatConversationWhere(now), batchSize);
  return { auditLogsDeleted, chatConversationsDeleted, deleted: auditLogsDeleted + chatConversationsDeleted };
}
