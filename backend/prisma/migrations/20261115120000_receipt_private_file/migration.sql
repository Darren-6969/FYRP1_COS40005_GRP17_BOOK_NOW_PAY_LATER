-- Receipt photos uploaded as files are stored privately on the VPS volume;
-- this is their storage key. Nullable: older receipts keep imageUrl only.
ALTER TABLE "Receipt" ADD COLUMN "storageKey" TEXT;
