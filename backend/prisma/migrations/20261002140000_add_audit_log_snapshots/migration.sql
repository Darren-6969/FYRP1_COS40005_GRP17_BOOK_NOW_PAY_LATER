ALTER TABLE "AuditLog"
ADD COLUMN "before" JSONB,
ADD COLUMN "after" JSONB,
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "actorId" INTEGER,
ADD COLUMN "actorType" TEXT;

UPDATE "AuditLog"
SET "actorId" = "userId",
	"actorType" = CASE WHEN "userId" IS NULL THEN 'SYSTEM' ELSE 'USER' END;

ALTER TABLE "StripeWebhookEvent"
ADD COLUMN "requestIp" TEXT;