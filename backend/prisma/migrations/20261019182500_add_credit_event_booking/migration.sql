ALTER TABLE "CreditProfileEvent" ADD COLUMN "bookingId" INTEGER;

CREATE INDEX "CreditProfileEvent_bookingId_idx" ON "CreditProfileEvent"("bookingId");

ALTER TABLE "CreditProfileEvent"
ADD CONSTRAINT "CreditProfileEvent_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
