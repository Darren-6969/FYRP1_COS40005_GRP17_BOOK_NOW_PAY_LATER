ALTER TABLE "AuditLog"
ADD COLUMN "requestId" TEXT;

CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");