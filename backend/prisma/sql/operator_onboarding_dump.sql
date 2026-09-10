-- BNPL operator onboarding tables
-- Apply after the existing BNPL schema. This is also the SQL source for the
-- Prisma migration 20260910120000_operator_onboarding.

CREATE TYPE "OperatorApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED');
CREATE TYPE "OperatorDocumentStatus" AS ENUM ('UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

CREATE TABLE "PasswordSetupToken" (
  "id" SERIAL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PasswordSetupToken_userId_idx" ON "PasswordSetupToken"("userId");
CREATE INDEX "PasswordSetupToken_expiresAt_idx" ON "PasswordSetupToken"("expiresAt");

CREATE TABLE "OperatorApplication" (
  "id" SERIAL PRIMARY KEY,
  "operatorId" INTEGER NOT NULL UNIQUE REFERENCES "Operator"("id") ON DELETE CASCADE,
  "status" "OperatorApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "businessRegistrationNumber" TEXT NOT NULL,
  "businessAddress" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "OperatorApplication_status_idx" ON "OperatorApplication"("status");
CREATE INDEX "OperatorApplication_reviewedById_idx" ON "OperatorApplication"("reviewedById");

CREATE TABLE "OperatorDocument" (
  "id" SERIAL PRIMARY KEY,
  "operatorId" INTEGER NOT NULL REFERENCES "Operator"("id") ON DELETE CASCADE,
  "applicationId" INTEGER NOT NULL REFERENCES "OperatorApplication"("id") ON DELETE CASCADE,
  "documentType" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" "OperatorDocumentStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
  "expiresAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "OperatorDocument_operatorId_idx" ON "OperatorDocument"("operatorId");
CREATE INDEX "OperatorDocument_applicationId_idx" ON "OperatorDocument"("applicationId");
CREATE INDEX "OperatorDocument_status_idx" ON "OperatorDocument"("status");
CREATE INDEX "OperatorDocument_expiresAt_idx" ON "OperatorDocument"("expiresAt");

CREATE TABLE "OperatorApplicationReview" (
  "id" SERIAL PRIMARY KEY,
  "applicationId" INTEGER NOT NULL REFERENCES "OperatorApplication"("id") ON DELETE CASCADE,
  "reviewerId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "decision" "OperatorApplicationStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OperatorApplicationReview_applicationId_idx" ON "OperatorApplicationReview"("applicationId");
CREATE INDEX "OperatorApplicationReview_reviewerId_idx" ON "OperatorApplicationReview"("reviewerId");
