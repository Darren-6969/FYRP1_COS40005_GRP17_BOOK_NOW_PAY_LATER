-- Operator types (car rental, tour guide, driver) and tour listing fields.
-- Additive only: existing operators become CAR_RENTAL, existing listings keep
-- their category.

-- CreateEnum
CREATE TYPE "OperatorType" AS ENUM ('CAR_RENTAL', 'TOUR_GUIDE', 'DRIVER');

-- CreateEnum
CREATE TYPE "TourPriceUnit" AS ENUM ('PER_CAR', 'PER_PACKAGE');

-- AlterEnum
ALTER TYPE "ListingCategory" ADD VALUE IF NOT EXISTS 'DRIVER_SERVICE';

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN "operatorType" "OperatorType" NOT NULL DEFAULT 'CAR_RENTAL';

-- AlterTable
ALTER TABLE "Listing"
  ADD COLUMN "pickupTimes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "priceUnit"   "TourPriceUnit";

-- Existing tour listings all belong to car rental operators.
UPDATE "Listing" SET "priceUnit" = 'PER_CAR' WHERE "category" = 'TOUR' AND "priceUnit" IS NULL;

-- CreateIndex
CREATE INDEX "Operator_operatorType_idx" ON "Operator"("operatorType");
