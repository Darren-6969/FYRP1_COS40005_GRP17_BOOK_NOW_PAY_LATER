-- BNPLB-108: saved cars move from browser storage to the customer's account.
CREATE TABLE "SavedListing" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "listingId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedListing_customerId_listingId_key" ON "SavedListing"("customerId", "listingId");
CREATE INDEX "SavedListing_customerId_createdAt_idx" ON "SavedListing"("customerId", "createdAt");
CREATE INDEX "SavedListing_listingId_idx" ON "SavedListing"("listingId");

ALTER TABLE "SavedListing"
ADD CONSTRAINT "SavedListing_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedListing"
ADD CONSTRAINT "SavedListing_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
