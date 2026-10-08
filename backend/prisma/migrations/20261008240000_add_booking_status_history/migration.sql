ALTER TYPE "BookingStatus" ADD VALUE 'READY_FOR_PICKUP';

CREATE TABLE "BookingStatusHistory" (
  "id" SERIAL NOT NULL,
  "bookingId" INTEGER NOT NULL,
  "actorId" INTEGER,
  "oldStatus" "BookingStatus",
  "newStatus" "BookingStatus" NOT NULL,
  "remark" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingStatusHistory_bookingId_createdAt_idx"
  ON "BookingStatusHistory"("bookingId", "createdAt");
CREATE INDEX "BookingStatusHistory_actorId_createdAt_idx"
  ON "BookingStatusHistory"("actorId", "createdAt");
ALTER TABLE "BookingStatusHistory"
  ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingStatusHistory"
  ADD CONSTRAINT "BookingStatusHistory_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
