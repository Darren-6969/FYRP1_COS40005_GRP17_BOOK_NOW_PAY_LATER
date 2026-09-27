-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'HATCHBACK', 'COMPACT', 'SUV', 'MPV', 'PICKUP', 'VAN');

-- CreateEnum
CREATE TYPE "Powertrain" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'EV');

-- CreateEnum
CREATE TYPE "Drivetrain" AS ENUM ('TWO_WD', 'FOUR_WD', 'AWD');

-- CreateEnum
CREATE TYPE "FuelPolicy" AS ENUM ('FULL_TO_FULL', 'SAME_TO_SAME');

-- CreateEnum
CREATE TYPE "MileagePolicy" AS ENUM ('UNLIMITED', 'LIMITED');

-- CreateEnum
CREATE TYPE "AddonUnit" AS ENUM ('PER_DAY', 'PER_BOOKING');

-- CreateEnum
CREATE TYPE "BookingChannel" AS ENUM ('WEB', 'HOST_EMBED', 'MOBILE', 'WHATSAPP');

-- AlterTable
ALTER TABLE "BNPLConfig" ADD COLUMN     "downPaymentPercent" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "partialRefundElected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partialRefundPercent" INTEGER;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "addonsAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "bookingDetails" JSONB,
ADD COLUMN     "channel" "BookingChannel" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "feesAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "listingId" INTEGER,
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "pickupPointId" INTEGER,
ADD COLUMN     "pricingSnapshot" JSONB,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rentalAmount" DECIMAL(10,2),
ADD COLUMN     "returnedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "closeTime" TEXT,
ADD COLUMN     "openTime" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "drivetrain" "Drivetrain",
ADD COLUMN     "fuelPolicy" "FuelPolicy",
ADD COLUMN     "mileageExcessRate" DECIMAL(10,2),
ADD COLUMN     "mileageLimitKm" INTEGER,
ADD COLUMN     "mileagePolicy" "MileagePolicy" NOT NULL DEFAULT 'UNLIMITED',
ADD COLUMN     "minDriverAge" INTEGER NOT NULL DEFAULT 21,
ADD COLUMN     "peakPrice" DECIMAL(10,2),
ADD COLUMN     "powertrain" "Powertrain",
ADD COLUMN     "travelArea" TEXT,
ADD COLUMN     "vehicleType" "VehicleType",
ADD COLUMN     "weekendPrice" DECIMAL(10,2),
ADD COLUMN     "youngDriverMaxAge" INTEGER,
ADD COLUMN     "youngDriverSurcharge" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "ListingAddon" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "unit" "AddonUnit" NOT NULL DEFAULT 'PER_DAY',
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAddon" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "listingAddonId" INTEGER,
    "name" TEXT NOT NULL,
    "unit" "AddonUnit" NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupPoint" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingAllocation" (
    "listingId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "quantity" INTEGER,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingAllocation_pkey" PRIMARY KEY ("listingId","date")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingAddon_listingId_isActive_idx" ON "ListingAddon"("listingId", "isActive");

-- CreateIndex
CREATE INDEX "BookingAddon_bookingId_idx" ON "BookingAddon"("bookingId");

-- CreateIndex
CREATE INDEX "PickupPoint_branchId_isActive_idx" ON "PickupPoint"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "ListingAllocation_date_idx" ON "ListingAllocation"("date");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_userId_endpoint_key_key" ON "IdempotencyKey"("userId", "endpoint", "key");

-- CreateIndex
CREATE INDEX "Booking_listingId_status_idx" ON "Booking"("listingId", "status");

-- CreateIndex
CREATE INDEX "Booking_pickupDate_returnDate_idx" ON "Booking"("pickupDate", "returnDate");

-- CreateIndex
CREATE INDEX "Listing_vehicleType_idx" ON "Listing"("vehicleType");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingAddon" ADD CONSTRAINT "ListingAddon_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_listingAddonId_fkey" FOREIGN KEY ("listingAddonId") REFERENCES "ListingAddon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPoint" ADD CONSTRAINT "PickupPoint_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingAllocation" ADD CONSTRAINT "ListingAllocation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Added by hand below this line. Prisma cannot express these in schema.prisma.
-- =============================================================================

-- Phase 1 bookings came in through the host embed, not the public site.
UPDATE "Booking" SET "channel" = 'HOST_EMBED' WHERE "hostBookingRef" IS NOT NULL;

ALTER TABLE "BNPLConfig"
  ADD CONSTRAINT "BNPLConfig_downPaymentPercent_check"
    CHECK ("downPaymentPercent" BETWEEN 1 AND 99),
  ADD CONSTRAINT "BNPLConfig_partialRefund_check"
    CHECK ("partialRefundPercent" IS NULL OR "partialRefundPercent" BETWEEN 1 AND 99),
  ADD CONSTRAINT "BNPLConfig_partialRefund_elected_check"
    CHECK ("partialRefundElected" = false OR "partialRefundPercent" IS NOT NULL);

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_prices_check"
    CHECK ("price" >= 0
       AND ("weekendPrice" IS NULL OR "weekendPrice" >= 0)
       AND ("peakPrice" IS NULL OR "peakPrice" >= 0)),
  ADD CONSTRAINT "Listing_minDriverAge_check"
    CHECK ("minDriverAge" BETWEEN 18 AND 99),
  ADD CONSTRAINT "Listing_youngDriver_check"
    CHECK ("youngDriverMaxAge" IS NULL OR "youngDriverMaxAge" >= "minDriverAge"),
  ADD CONSTRAINT "Listing_mileage_check"
    CHECK ("mileagePolicy" = 'UNLIMITED'
        OR ("mileageLimitKm" IS NOT NULL AND "mileageLimitKm" > 0));

ALTER TABLE "Branch"
  ADD CONSTRAINT "Branch_hours_check"
    CHECK (("openTime" IS NULL AND "closeTime" IS NULL)
        OR ("openTime" IS NOT NULL AND "closeTime" IS NOT NULL
        AND "openTime"  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "closeTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "openTime" < "closeTime"));

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_quantity_check" CHECK ("quantity" >= 1);

ALTER TABLE "ListingAddon"
  ADD CONSTRAINT "ListingAddon_values_check" CHECK ("price" >= 0 AND "maxQuantity" >= 1);

ALTER TABLE "BookingAddon"
  ADD CONSTRAINT "BookingAddon_values_check" CHECK ("quantity" >= 1 AND "unitPrice" >= 0 AND "totalPrice" >= 0);

ALTER TABLE "PickupPoint"
  ADD CONSTRAINT "PickupPoint_fee_check" CHECK ("fee" >= 0);

ALTER TABLE "ListingAllocation"
  ADD CONSTRAINT "ListingAllocation_quantity_check" CHECK ("quantity" IS NULL OR "quantity" >= 0);
