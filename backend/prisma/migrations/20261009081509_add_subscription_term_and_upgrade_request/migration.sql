-- CreateEnum
CREATE TYPE "SubscriptionUpgradeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "subscriptionEndsAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SubscriptionUpgradeRequest" (
    "id" SERIAL NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "currentPlan" "SubscriptionPlan" NOT NULL,
    "requestedPlan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionUpgradeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionUpgradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionUpgradeRequest_operatorId_idx" ON "SubscriptionUpgradeRequest"("operatorId");

-- CreateIndex
CREATE INDEX "SubscriptionUpgradeRequest_operatorId_status_idx" ON "SubscriptionUpgradeRequest"("operatorId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionUpgradeRequest_createdAt_idx" ON "SubscriptionUpgradeRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "SubscriptionUpgradeRequest" ADD CONSTRAINT "SubscriptionUpgradeRequest_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
