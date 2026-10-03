ALTER TABLE "Operator"
ADD COLUMN "stripeOnboardingStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "stripeRequirements" JSONB;