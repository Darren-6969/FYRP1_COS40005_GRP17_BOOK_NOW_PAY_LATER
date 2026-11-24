-- BNPLB-180, BNPLB-181: details on each driving licence, and a link from a
-- licence reused for a booking back to the licence it was copied from.
-- BNPLB-184: an optional in-app link on notifications. Additive only.

ALTER TABLE "CustomerLicenceDocument"
  ADD COLUMN "holderName"     TEXT,
  ADD COLUMN "expiresAt"      DATE,
  ADD COLUMN "issuingCountry" TEXT,
  ADD COLUMN "reusedFromId"   INTEGER;

ALTER TABLE "CustomerLicenceDocument"
  ADD CONSTRAINT "CustomerLicenceDocument_reusedFromId_fkey"
  FOREIGN KEY ("reusedFromId") REFERENCES "CustomerLicenceDocument"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CustomerLicenceDocument_reusedFromId_idx" ON "CustomerLicenceDocument"("reusedFromId");

ALTER TABLE "Notification" ADD COLUMN "link" TEXT;
