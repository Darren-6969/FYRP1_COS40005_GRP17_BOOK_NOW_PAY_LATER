-- SRS V2.9 (client meeting 1 Oct 2026): duration-based pricing, overtime,
-- night handover blocking, CDW, and pickup/drop-off points with separate
-- charges. Additive only; weekendPrice and peakPrice stay until unused.

CREATE TYPE "PointUsage" AS ENUM ('PICKUP', 'DROPOFF', 'BOTH');

ALTER TABLE "Listing"
  ADD COLUMN "hourlyRate"         DECIMAL(10,2),
  ADD COLUMN "weeklyRate"         DECIMAL(10,2),
  ADD COLUMN "monthlyRate"        DECIMAL(10,2),
  ADD COLUMN "overtimeFee"        DECIMAL(10,2),
  ADD COLUMN "blockNightHandover" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cdwDailyPrice"      DECIMAL(10,2);

ALTER TABLE "PickupPoint"
  ADD COLUMN "address"    TEXT,
  ADD COLUMN "usage"      "PointUsage" NOT NULL DEFAULT 'BOTH',
  ADD COLUMN "dropoffFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "Booking"
  ADD COLUMN "dropoffPointId"    INTEGER,
  ADD COLUMN "requestedLocation" TEXT;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_dropoffPointId_fkey"
  FOREIGN KEY ("dropoffPointId") REFERENCES "PickupPoint"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Booking_dropoffPointId_idx" ON "Booking"("dropoffPointId");
