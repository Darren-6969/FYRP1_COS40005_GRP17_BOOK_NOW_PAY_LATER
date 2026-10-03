ALTER TYPE "BookingStatus" ADD VALUE 'NO_SHOW';

CREATE TYPE "OperatorPayoutStatus" AS ENUM ('PENDING', 'TRANSFERRED', 'CANCELLED');

ALTER TABLE "Booking"
ADD COLUMN "serviceResolvedAt" TIMESTAMP(3);

UPDATE "Booking"
SET "serviceResolvedAt" = "updatedAt"
WHERE "status" = 'COMPLETED' AND "serviceResolvedAt" IS NULL;

CREATE TABLE "OperatorPayout" (
    "id" SERIAL NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "destinationAccountId" TEXT NOT NULL,
    "amountSen" INTEGER NOT NULL,
    "status" "OperatorPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "stripeTransferId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferredAt" TIMESTAMP(3),

    CONSTRAINT "OperatorPayout_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CommissionLedgerEntry"
ADD COLUMN "payoutId" INTEGER;

CREATE UNIQUE INDEX "OperatorPayout_idempotencyKey_key"
ON "OperatorPayout"("idempotencyKey");

CREATE UNIQUE INDEX "OperatorPayout_stripeTransferId_key"
ON "OperatorPayout"("stripeTransferId");

CREATE INDEX "OperatorPayout_operatorId_status_createdAt_idx"
ON "OperatorPayout"("operatorId", "status", "createdAt");

CREATE UNIQUE INDEX "CommissionLedgerEntry_payoutId_key"
ON "CommissionLedgerEntry"("payoutId");

ALTER TABLE "OperatorPayout"
ADD CONSTRAINT "OperatorPayout_operatorId_fkey"
FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommissionLedgerEntry"
ADD CONSTRAINT "CommissionLedgerEntry_payoutId_fkey"
FOREIGN KEY ("payoutId") REFERENCES "OperatorPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;