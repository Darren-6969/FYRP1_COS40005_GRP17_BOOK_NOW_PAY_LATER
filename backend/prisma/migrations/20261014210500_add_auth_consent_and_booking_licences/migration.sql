ALTER TABLE "User"
  ADD COLUMN "privacyPolicyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyAcceptedIp" TEXT,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsAcceptedIp" TEXT;

ALTER TABLE "CustomerLicenceDocument"
  ADD COLUMN "bookingId" INTEGER,
  ADD COLUMN "storageKey" TEXT;

CREATE UNIQUE INDEX "CustomerLicenceDocument_storageKey_key"
  ON "CustomerLicenceDocument"("storageKey");
CREATE INDEX "CustomerLicenceDocument_bookingId_idx"
  ON "CustomerLicenceDocument"("bookingId");
ALTER TABLE "CustomerLicenceDocument"
  ADD CONSTRAINT "CustomerLicenceDocument_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
