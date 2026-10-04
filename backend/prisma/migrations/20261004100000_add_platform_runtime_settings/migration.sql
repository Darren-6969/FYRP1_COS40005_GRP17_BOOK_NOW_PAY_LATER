CREATE TABLE "PlatformSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "defaultPaymentDeadlineDays" INTEGER NOT NULL DEFAULT 3,
    "creditTierThresholds" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "exposureLimits" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "licenceReuploadWindowHours" INTEGER NOT NULL DEFAULT 48,
    "featureFlags" JSONB NOT NULL DEFAULT '{"allowReceiptUpload":true,"automaticOverdueHandling":true}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);