CREATE TYPE "DiscountFundingSource" AS ENUM ('OPERATOR', 'PLATFORM');

ALTER TABLE "Booking"
ADD COLUMN "discountFundedBy" "DiscountFundingSource" NOT NULL DEFAULT 'OPERATOR';

CREATE TABLE "CommissionLedgerEntry" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "transactionId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "grossAmountSen" INTEGER NOT NULL,
    "netAmountSen" INTEGER NOT NULL,
    "discountAmountSen" INTEGER NOT NULL,
    "feeRateBps" INTEGER NOT NULL,
    "fundedBy" "DiscountFundingSource" NOT NULL,
    "feeAmountSen" INTEGER NOT NULL,
    "stripeFeeAmountSen" INTEGER NOT NULL DEFAULT 0,
    "operatorPayoutAmountSen" INTEGER NOT NULL,
    "platformMarginSen" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommissionLedgerEntry_transactionId_key"
ON "CommissionLedgerEntry"("transactionId");

CREATE INDEX "CommissionLedgerEntry_bookingId_createdAt_idx"
ON "CommissionLedgerEntry"("bookingId", "createdAt");

CREATE INDEX "CommissionLedgerEntry_paymentId_idx"
ON "CommissionLedgerEntry"("paymentId");

ALTER TABLE "CommissionLedgerEntry"
ADD CONSTRAINT "CommissionLedgerEntry_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommissionLedgerEntry"
ADD CONSTRAINT "CommissionLedgerEntry_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;