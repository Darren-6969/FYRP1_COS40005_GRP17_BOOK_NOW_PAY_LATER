-- AlterTable
ALTER TABLE "BNPLConfig" ADD COLUMN     "alternativeSuggestedEmailText" TEXT,
ADD COLUMN     "bookingCancelledEmailText" TEXT,
ADD COLUMN     "bookingCompletedEmailText" TEXT,
ADD COLUMN     "emailFooterText" TEXT,
ADD COLUMN     "paymentRequestEmailText" TEXT;
