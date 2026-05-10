-- AlterTable
ALTER TABLE "BNPLConfig" ADD COLUMN     "acceptedPaymentMethods" JSONB,
ADD COLUMN     "autoRejectInactiveBooking" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bookingResponseDeadlineMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "enableOperatorReminderAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "operatorReminderBeforeAutoRejectMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "reminderBeforeAutoRejectMinutes" INTEGER NOT NULL DEFAULT 30;
