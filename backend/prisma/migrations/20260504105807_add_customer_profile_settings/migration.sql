-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyBookingUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyInvoices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPaymentReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPromotions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profileImageUrl" TEXT;
