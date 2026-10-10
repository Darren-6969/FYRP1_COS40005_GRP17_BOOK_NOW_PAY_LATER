-- CreateEnum
CREATE TYPE "SubscriptionNoticeKind" AS ENUM ('STARTER_ENDING', 'STARTER_ENDED', 'PAYMENT_DUE_SOON');

-- CreateTable
CREATE TABLE "SubscriptionNotice" (
    "id" SERIAL NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "kind" "SubscriptionNoticeKind" NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionNotice_operatorId_kind_periodEnd_key" ON "SubscriptionNotice"("operatorId", "kind", "periodEnd");

-- CreateIndex
CREATE INDEX "SubscriptionNotice_sentAt_idx" ON "SubscriptionNotice"("sentAt");

-- AddForeignKey
ALTER TABLE "SubscriptionNotice" ADD CONSTRAINT "SubscriptionNotice_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reminder timing gains the two subscription keys. Only the column default
-- changes; a saved settings row falls back to these values for missing keys.
ALTER TABLE "PlatformSettings"
  ALTER COLUMN "reminderTiming"
  SET DEFAULT '{"paymentFirstHours":24,"paymentFinalHours":6,"licenceReminderHours":24,"subscriptionTermReminderDays":7,"subscriptionPaymentReminderDays":3}'::jsonb;
