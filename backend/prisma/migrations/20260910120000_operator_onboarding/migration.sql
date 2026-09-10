CREATE TYPE "OperatorApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED');
CREATE TYPE "OperatorDocumentStatus" AS ENUM ('UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

CREATE TABLE "PasswordSetupToken" (
  "id" SERIAL NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordSetupToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordSetupToken_tokenHash_key" ON "PasswordSetupToken"("tokenHash");
CREATE INDEX "PasswordSetupToken_userId_idx" ON "PasswordSetupToken"("userId");
CREATE INDEX "PasswordSetupToken_expiresAt_idx" ON "PasswordSetupToken"("expiresAt");
ALTER TABLE "PasswordSetupToken" ADD CONSTRAINT "PasswordSetupToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OperatorApplication" (
  "id" SERIAL NOT NULL,
  "operatorId" INTEGER NOT NULL,
  "status" "OperatorApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "businessRegistrationNumber" TEXT NOT NULL,
  "businessAddress" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" INTEGER,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperatorApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperatorApplication_operatorId_key" ON "OperatorApplication"("operatorId");
CREATE INDEX "OperatorApplication_status_idx" ON "OperatorApplication"("status");
CREATE INDEX "OperatorApplication_reviewedById_idx" ON "OperatorApplication"("reviewedById");
ALTER TABLE "OperatorApplication" ADD CONSTRAINT "OperatorApplication_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperatorApplication" ADD CONSTRAINT "OperatorApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OperatorDocument" (
  "id" SERIAL NOT NULL,
  "operatorId" INTEGER NOT NULL,
  "applicationId" INTEGER NOT NULL,
  "documentType" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" "OperatorDocumentStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
  "expiresAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperatorDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperatorDocument_storageKey_key" ON "OperatorDocument"("storageKey");
CREATE INDEX "OperatorDocument_operatorId_idx" ON "OperatorDocument"("operatorId");
CREATE INDEX "OperatorDocument_applicationId_idx" ON "OperatorDocument"("applicationId");
CREATE INDEX "OperatorDocument_status_idx" ON "OperatorDocument"("status");
CREATE INDEX "OperatorDocument_expiresAt_idx" ON "OperatorDocument"("expiresAt");
ALTER TABLE "OperatorDocument" ADD CONSTRAINT "OperatorDocument_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperatorDocument" ADD CONSTRAINT "OperatorDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OperatorApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperatorDocument" ADD CONSTRAINT "OperatorDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OperatorApplicationReview" (
  "id" SERIAL NOT NULL,
  "applicationId" INTEGER NOT NULL,
  "reviewerId" INTEGER NOT NULL,
  "decision" "OperatorApplicationStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperatorApplicationReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperatorApplicationReview_applicationId_idx" ON "OperatorApplicationReview"("applicationId");
CREATE INDEX "OperatorApplicationReview_reviewerId_idx" ON "OperatorApplicationReview"("reviewerId");
ALTER TABLE "OperatorApplicationReview" ADD CONSTRAINT "OperatorApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OperatorApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperatorApplicationReview" ADD CONSTRAINT "OperatorApplicationReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
