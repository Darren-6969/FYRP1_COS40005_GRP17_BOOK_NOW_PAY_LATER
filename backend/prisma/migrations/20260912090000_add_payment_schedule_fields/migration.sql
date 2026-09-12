-- CreateEnum
CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PENDING_VERIFICATION', 'DOWN_PAYMENT_PENDING_VERIFICATION', 'PARTIALLY_PAID', 'FINAL_PAYMENT_PENDING_VERIFICATION', 'PAID', 'FAILED', 'OVERDUE');

-- AlterEnum
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'UNPAID';
DROP TYPE "PaymentStatus";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";

-- AlterTable
ALTER TABLE "Payment"
  ADD COLUMN "downPaymentAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "finalPaymentAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "downPaymentDueDate" TIMESTAMP(3),
  ADD COLUMN "finalPaymentDueDate" TIMESTAMP(3),
  ADD COLUMN "downPaymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "finalPaymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "downPaymentPaidAt" TIMESTAMP(3),
  ADD COLUMN "finalPaymentPaidAt" TIMESTAMP(3),
  ADD COLUMN "downPaymentTransactionId" TEXT,
  ADD COLUMN "finalPaymentTransactionId" TEXT;

-- Backfill existing records as fully payable legacy payments.
UPDATE "Payment" p
SET "downPaymentAmount" = ROUND((b."totalAmount" * 0.10)::numeric, 2),
    "finalPaymentAmount" = ROUND((b."totalAmount" * 0.90)::numeric, 2),
    "downPaymentDueDate" = COALESCE(b."paymentDeadline", NOW() + INTERVAL '1 day'),
    "finalPaymentDueDate" = COALESCE(b."pickupDate" - INTERVAL '1 day', b."paymentDeadline"),
    "downPaymentStatus" = CASE WHEN p."status" = 'PAID' THEN 'PAID'::"PaymentStatus" ELSE 'UNPAID'::"PaymentStatus" END,
    "finalPaymentStatus" = CASE WHEN p."status" = 'PAID' THEN 'PAID'::"PaymentStatus" ELSE 'UNPAID'::"PaymentStatus" END
FROM "Booking" b
WHERE p."bookingId" = b."id";
