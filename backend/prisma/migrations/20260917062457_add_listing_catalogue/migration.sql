-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('CAR_RENTAL', 'TOUR');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TransmissionType" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Malaysia',
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" SERIAL NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "category" "ListingCategory" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,
    "modelYear" INTEGER,
    "seats" INTEGER,
    "transmission" "TransmissionType",
    "luggageCapacity" INTEGER,
    "pickupRules" TEXT,
    "returnRules" TEXT,
    "insuranceInfo" TEXT,
    "durationDays" INTEGER,
    "highlights" JSONB,
    "itinerary" JSONB,
    "inclusions" JSONB,
    "exclusions" JSONB,
    "cancellationPolicy" TEXT,
    "meetingPoint" TEXT,
    "maxGroupSize" INTEGER,
    "refundPolicy" TEXT,
    "termsAndConditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingImage" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_operatorId_idx" ON "Branch"("operatorId");

-- CreateIndex
CREATE INDEX "Branch_isActive_idx" ON "Branch"("isActive");

-- CreateIndex
CREATE INDEX "Listing_operatorId_idx" ON "Listing"("operatorId");

-- CreateIndex
CREATE INDEX "Listing_branchId_idx" ON "Listing"("branchId");

-- CreateIndex
CREATE INDEX "Listing_category_idx" ON "Listing"("category");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_vehicleMake_idx" ON "Listing"("vehicleMake");

-- CreateIndex
CREATE INDEX "Listing_vehicleModel_idx" ON "Listing"("vehicleModel");

-- CreateIndex
CREATE INDEX "Listing_transmission_idx" ON "Listing"("transmission");

-- CreateIndex
CREATE INDEX "ListingImage_listingId_idx" ON "ListingImage"("listingId");

-- CreateIndex
CREATE INDEX "ListingImage_sortOrder_idx" ON "ListingImage"("sortOrder");

-- CreateIndex
CREATE INDEX "ListingImage_isPrimary_idx" ON "ListingImage"("isPrimary");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
