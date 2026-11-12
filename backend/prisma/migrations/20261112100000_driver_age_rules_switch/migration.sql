-- Driver age rules become an operator switch, off by default (Task 2).

-- AlterTable
ALTER TABLE "BNPLConfig" ADD COLUMN "driverAgeRulesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Operators who already set their own rules keep them: the switch starts on
-- for anyone with the surcharge on or a minimum age other than the default.
UPDATE "BNPLConfig"
SET "driverAgeRulesEnabled" = true
WHERE "youngDriverSurchargeEnabled" = true OR "minDriverAge" <> 21;

-- The listing-level copies were never read: pricing uses the operator's
-- shop settings. Drop their checks first, then the columns.
ALTER TABLE "Listing" DROP CONSTRAINT IF EXISTS "Listing_youngDriver_check";
ALTER TABLE "Listing" DROP CONSTRAINT IF EXISTS "Listing_minDriverAge_check";
ALTER TABLE "Listing" DROP COLUMN "minDriverAge",
DROP COLUMN "youngDriverMaxAge",
DROP COLUMN "youngDriverSurcharge";
