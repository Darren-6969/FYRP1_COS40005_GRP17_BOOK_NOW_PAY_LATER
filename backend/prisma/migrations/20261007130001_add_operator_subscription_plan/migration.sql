-- Safe to run on a database that already has the type and the column
-- (it was emptied in f6974f0, which broke migrate deploy on a fresh database).

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'PREMIUM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN IF NOT EXISTS "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE';
