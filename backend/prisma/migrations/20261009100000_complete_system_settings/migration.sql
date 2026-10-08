-- SRS V2.11 platform defaults: commission 10%, licence re-upload window 24 hours.
-- Only the column defaults change. An existing settings row keeps the value an
-- administrator last saved.
ALTER TABLE "PlatformSettings"
  ALTER COLUMN "commissionRate" SET DEFAULT 10.00,
  ALTER COLUMN "licenceReuploadWindowHours" SET DEFAULT 24;

ALTER TABLE "PlatformSettings"
  ADD COLUMN "reminderTiming" JSONB NOT NULL DEFAULT '{"paymentFirstHours":24,"paymentFinalHours":6,"licenceReminderHours":24}'::jsonb,
  ADD COLUMN "downPaymentFloorPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "subscriptionTiers" JSONB NOT NULL DEFAULT '{"FREE":{"label":"Starter","listingLimit":5,"monthlyPriceRm":0,"termDays":90},"BASIC":{"label":"Standard","listingLimit":10,"monthlyPriceRm":20,"termDays":null},"PREMIUM":{"label":"Premium","listingLimit":20,"monthlyPriceRm":null,"termDays":null}}'::jsonb;

ALTER TABLE "PlatformSettings"
  ADD CONSTRAINT "PlatformSettings_downPaymentFloorPercent_check"
  CHECK ("downPaymentFloorPercent" BETWEEN 0 AND 100);
