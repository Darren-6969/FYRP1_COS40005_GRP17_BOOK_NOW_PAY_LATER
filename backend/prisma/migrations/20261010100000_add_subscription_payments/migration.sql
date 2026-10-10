-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Operator"
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "subscriptionPaidUntil" TIMESTAMP(3),
  ADD COLUMN "subscriptionSuspendedAt" TIMESTAMP(3),
  ADD COLUMN "subscriptionSuspensionReason" TEXT;

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" SERIAL NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "paidUntil" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionPayment_operatorId_paidOn_idx" ON "SubscriptionPayment"("operatorId", "paidOn");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_createdAt_idx" ON "SubscriptionPayment"("createdAt");

-- Speeds up the scheduled check for lapsed paid periods.
CREATE INDEX "Operator_subscriptionStatus_subscriptionPaidUntil_idx" ON "Operator"("subscriptionStatus", "subscriptionPaidUntil");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
