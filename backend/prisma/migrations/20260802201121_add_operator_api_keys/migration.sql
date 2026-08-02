/*
  Warnings:

  - A unique constraint covering the columns `[apiKeyHash]` on the table `Operator` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "apiKeyHash" TEXT,
ADD COLUMN     "apiKeyPrefix" TEXT,
ADD COLUMN     "apiKeyRotatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Operator_apiKeyHash_key" ON "Operator"("apiKeyHash");
