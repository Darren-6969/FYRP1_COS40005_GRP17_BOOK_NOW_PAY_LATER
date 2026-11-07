-- The operator's own static DuitNow QR (no amount), kept so the customer can
-- scan it when their banking app cannot read the fixed-amount QR.
-- AlterTable
ALTER TABLE "BNPLConfig" ADD COLUMN "duitnowStaticQr" TEXT;
