ALTER TABLE "BNPLConfig"
DROP CONSTRAINT IF EXISTS "BNPLConfig_downPaymentPercent_check";

ALTER TABLE "BNPLConfig"
ADD CONSTRAINT "BNPLConfig_downPaymentPercent_check"
CHECK ("downPaymentPercent" BETWEEN 0 AND 100);