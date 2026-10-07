CREATE TYPE "PaymentScheduleEntryType" AS ENUM ('PAYMENT', 'LICENCE');
CREATE TYPE "PaymentScheduleEntryStatus" AS ENUM ('DUE', 'PAID', 'EXPIRED', 'VOID');

CREATE TABLE "PaymentScheduleEntry" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "type" "PaymentScheduleEntryType" NOT NULL,
    "paymentPart" TEXT,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "PaymentScheduleEntryStatus" NOT NULL DEFAULT 'DUE',
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentScheduleEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentScheduleEntry_bookingId_status_dueAt_idx"
ON "PaymentScheduleEntry"("bookingId", "status", "dueAt");
CREATE INDEX "PaymentScheduleEntry_type_status_dueAt_idx"
ON "PaymentScheduleEntry"("type", "status", "dueAt");

ALTER TABLE "PaymentScheduleEntry"
ADD CONSTRAINT "PaymentScheduleEntry_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
