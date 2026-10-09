-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "lateReturnCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lateReturnHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateReturnPaidAt" TIMESTAMP(3);
