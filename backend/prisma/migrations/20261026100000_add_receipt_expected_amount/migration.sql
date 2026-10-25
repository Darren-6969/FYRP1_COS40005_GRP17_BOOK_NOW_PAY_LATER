-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN "expectedAmount" DECIMAL(10,2),
ADD COLUMN "paymentType" TEXT;
