// Data retention (Privacy Policy, "How long we keep it"; PDPA s.10, the
// Retention Principle). Audit logs are kept for 2 years and chat
// conversations for 12 months after their last message, then deleted.
//
// Booking, payment, refund and invoice records are not touched here: they
// are kept for 7 years under Malaysian tax and accounting law, and account
// deletion (account_deletion_service.js) handles what goes when a customer
// leaves.
//
// The rules and the batched delete live in data_retention_rules.js.
// Deletes run in batches so one run never holds a large lock, and running
// the job twice is safe: the second run finds nothing older than the cutoff.

import prisma from "../config/db.js";
import { purgeExpiredData as purge } from "./data_retention_rules.js";

/** One retention run against the database: { auditLogsDeleted, chatConversationsDeleted, deleted }. */
export function purgeExpiredData(options = {}) {
  return purge({ db: prisma, ...options });
}
