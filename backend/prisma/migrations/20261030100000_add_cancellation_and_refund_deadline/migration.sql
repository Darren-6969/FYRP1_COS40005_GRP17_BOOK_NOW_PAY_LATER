-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "cancelledBy" TEXT,
ADD COLUMN "cancellationReasonCode" TEXT,
ADD COLUMN "cancellationNote" TEXT,
ADD COLUMN "cancellationFault" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN "dueAt" TIMESTAMP(3),
ADD COLUMN "lastReminderAt" TIMESTAMP(3),
ADD COLUMN "escalatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "refundDeadlineBusinessDays" INTEGER NOT NULL DEFAULT 3;

-- CreateIndex
CREATE INDEX "Refund_status_dueAt_idx" ON "Refund"("status", "dueAt");
