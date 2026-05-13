-- CreateEnum
CREATE TYPE "OperatorAccessLevel" AS ENUM ('OWNER', 'STAFF');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "operatorAccessLevel" "OperatorAccessLevel";
