CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'OPERATOR_LOGIN');

ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Operator"
ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OtpChallenge" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OtpChallenge_userId_purpose_key"
ON "OtpChallenge"("userId", "purpose");

CREATE INDEX "OtpChallenge_expiresAt_idx"
ON "OtpChallenge"("expiresAt");

ALTER TABLE "OtpChallenge"
ADD CONSTRAINT "OtpChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
