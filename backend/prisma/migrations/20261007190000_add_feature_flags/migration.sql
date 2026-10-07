CREATE TABLE "FeatureFlag" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "operatorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureFlag_key_environment_operatorId_key"
ON "FeatureFlag"("key", "environment", "operatorId");

CREATE INDEX "FeatureFlag_environment_key_idx"
ON "FeatureFlag"("environment", "key");

CREATE INDEX "FeatureFlag_operatorId_environment_key_idx"
ON "FeatureFlag"("operatorId", "environment", "key");

ALTER TABLE "FeatureFlag"
ADD CONSTRAINT "FeatureFlag_operatorId_fkey"
FOREIGN KEY ("operatorId") REFERENCES "Operator"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
