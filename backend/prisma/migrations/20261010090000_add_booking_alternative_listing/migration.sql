-- Module 3: a suggested alternative car is a real listing, priced by the server.
ALTER TABLE "Booking" ADD COLUMN "alternativeListingId" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "alternativePricingSnapshot" JSONB;

CREATE INDEX "Booking_alternativeListingId_status_idx" ON "Booking"("alternativeListingId", "status");

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_alternativeListingId_fkey" FOREIGN KEY ("alternativeListingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
