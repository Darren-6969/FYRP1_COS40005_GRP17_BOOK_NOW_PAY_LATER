-- AlterTable
ALTER TABLE "BNPLConfig" ADD COLUMN     "minDriverAge" INTEGER NOT NULL DEFAULT 21,
ADD COLUMN     "youngDriverMaxAge" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "youngDriverSurcharge" DECIMAL(10,2),
ADD COLUMN     "youngDriverSurchargeEnabled" BOOLEAN NOT NULL DEFAULT false;
