-- Tour guides and drivers often apply as individuals without a business
-- registration number. Existing applications keep theirs.

-- AlterTable
ALTER TABLE "OperatorApplication" ALTER COLUMN "businessRegistrationNumber" DROP NOT NULL;
