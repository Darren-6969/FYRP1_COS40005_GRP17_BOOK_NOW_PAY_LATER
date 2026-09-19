-- CreateEnum
CREATE TYPE "LicenceVerificationStatus" AS ENUM ('UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REUPLOAD_REQUIRED');

-- CreateTable
CREATE TABLE "CustomerLicenceDocument" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "status" "LicenceVerificationStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewDueAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerLicenceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPeakDate" (
    "id" SERIAL NOT NULL,
    "peakDate" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformPeakDate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformPeakDate_peakDate_key" ON "PlatformPeakDate"("peakDate");
CREATE INDEX "CustomerLicenceDocument_status_idx" ON "CustomerLicenceDocument"("status");
CREATE INDEX "CustomerLicenceDocument_reviewDueAt_idx" ON "CustomerLicenceDocument"("reviewDueAt");
CREATE INDEX "CustomerLicenceDocument_customerId_idx" ON "CustomerLicenceDocument"("customerId");
CREATE INDEX "PlatformPeakDate_peakDate_idx" ON "PlatformPeakDate"("peakDate");

ALTER TABLE "CustomerLicenceDocument" ADD CONSTRAINT "CustomerLicenceDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerLicenceDocument" ADD CONSTRAINT "CustomerLicenceDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
