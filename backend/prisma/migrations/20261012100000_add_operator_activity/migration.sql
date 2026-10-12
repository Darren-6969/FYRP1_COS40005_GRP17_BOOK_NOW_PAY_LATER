-- CreateEnum
CREATE TYPE "SubscriptionSuspensionCause" AS ENUM ('NON_PAYMENT', 'INACTIVITY');

-- AlterTable
-- lastActivityAt defaults to now, so every existing operator's 90-day window
-- starts when this migration runs and nobody is warned for past quiet periods.
ALTER TABLE "Operator"
  ADD COLUMN "subscriptionSuspensionCause" "SubscriptionSuspensionCause",
  ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "inactivityGraceStartedAt" TIMESTAMP(3);

-- Operators already suspended were suspended for an unpaid period.
UPDATE "Operator"
SET "subscriptionSuspensionCause" = 'NON_PAYMENT'
WHERE "subscriptionStatus" = 'SUSPENDED';

-- CreateIndex
CREATE INDEX "Operator_status_lastActivityAt_idx" ON "Operator"("status", "lastActivityAt");
