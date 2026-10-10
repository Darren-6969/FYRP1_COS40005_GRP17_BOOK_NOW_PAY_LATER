-- A customer can request a drop-off place that is not on the operator's
-- list, separately from the pickup place (FR-LIST-004). Additive only.
ALTER TABLE "Booking" ADD COLUMN "requestedDropoffLocation" TEXT;
