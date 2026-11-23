-- Phase 4: independent drivers. Additive only.

-- Driver profile fields on the listing, and the car operator's consent.
ALTER TABLE "Listing"
  ADD COLUMN "languages"               TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "serviceAreas"            TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "yearsDriving"            INTEGER,
  ADD COLUMN "allowIndependentDrivers" BOOLEAN NOT NULL DEFAULT false;

-- A driver booking points at the car booking it serves.
ALTER TABLE "Booking" ADD COLUMN "linkedBookingId" INTEGER;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_linkedBookingId_fkey"
  FOREIGN KEY ("linkedBookingId") REFERENCES "Booking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Booking_linkedBookingId_idx" ON "Booking"("linkedBookingId");
