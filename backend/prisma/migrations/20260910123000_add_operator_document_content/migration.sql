ALTER TABLE "OperatorDocument"
ADD COLUMN "content" BYTEA;

UPDATE "OperatorDocument"
SET "content" = decode('', 'hex')
WHERE "content" IS NULL;

ALTER TABLE "OperatorDocument"
ALTER COLUMN "content" SET NOT NULL;
