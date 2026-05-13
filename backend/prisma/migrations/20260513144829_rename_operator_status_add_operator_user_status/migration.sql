/*
  Warnings:

  - The `status` column on the `Operator` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "OperatorUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Operator" DROP COLUMN "status",
ADD COLUMN     "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "operatorUserStatus" "OperatorUserStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropEnum
DROP TYPE "OperatorStatus";

-- CreateIndex
CREATE INDEX "Operator_status_idx" ON "Operator"("status");

-- CreateIndex
CREATE INDEX "User_operatorUserStatus_idx" ON "User"("operatorUserStatus");
