-- BNPLB-122 (Task 4): one setting decides when the operator is reminded
-- before an automatic rejection: operatorReminderBeforeAutoRejectMinutes.

-- An operator who changed only the duplicate setting keeps their timing.
UPDATE "BNPLConfig"
SET "operatorReminderBeforeAutoRejectMinutes" = "reminderBeforeAutoRejectMinutes"
WHERE "operatorReminderBeforeAutoRejectMinutes" = 30
  AND "reminderBeforeAutoRejectMinutes" <> 30;

-- AlterTable
ALTER TABLE "BNPLConfig" DROP COLUMN "reminderBeforeAutoRejectMinutes";
