ALTER TABLE "Booking"
ADD COLUMN "creditTier" TEXT;

CREATE INDEX "Booking_createdAt_status_idx" ON "Booking"("createdAt", "status");
CREATE INDEX "CommissionLedgerEntry_createdAt_idx" ON "CommissionLedgerEntry"("createdAt");
CREATE INDEX "OperatorPayout_transferredAt_idx" ON "OperatorPayout"("transferredAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");