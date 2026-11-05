-- The operator's DuitNow account, taken from the QR code their bank app shows,
-- so the platform can build a fixed-amount QR for each payment (SRS 4.2.5).
ALTER TABLE "BNPLConfig"
  ADD COLUMN "duitnowAccount" TEXT,
  ADD COLUMN "duitnowMerchantName" TEXT,
  ADD COLUMN "duitnowMerchantCity" TEXT,
  ADD COLUMN "duitnowMerchantCategory" TEXT;
