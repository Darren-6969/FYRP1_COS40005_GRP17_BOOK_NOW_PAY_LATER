/*
  Warnings:

  - A unique constraint covering the columns `[handoffTokenHash]` on the table `HostBookingIntent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "HostBookingIntent" ADD COLUMN     "handoffExpiresAt" TIMESTAMP(3),
ADD COLUMN     "handoffTokenHash" TEXT,
ADD COLUMN     "handoffUsedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpCodeHash" TEXT,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "provisionedVia" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HostBookingIntent_handoffTokenHash_key" ON "HostBookingIntent"("handoffTokenHash");
