/*
  Warnings:

  - You are about to drop the column `rejectEmailCustomText` on the `BNPLConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BNPLConfig" DROP COLUMN "rejectEmailCustomText",
ADD COLUMN     "autoRejectedEmailText" TEXT,
ADD COLUMN     "bookingRejectedEmailText" TEXT;
