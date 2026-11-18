-- CreateTable
CREATE TABLE "CustomerPermitDocument" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "bookingId" INTEGER,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "status" "LicenceVerificationStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "permitExpiryDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPermitDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerPermitDocument_customerId_idx" ON "CustomerPermitDocument"("customerId");

-- CreateIndex
CREATE INDEX "CustomerPermitDocument_bookingId_idx" ON "CustomerPermitDocument"("bookingId");

-- CreateIndex
CREATE INDEX "CustomerPermitDocument_status_idx" ON "CustomerPermitDocument"("status");

-- AddForeignKey
ALTER TABLE "CustomerPermitDocument" ADD CONSTRAINT "CustomerPermitDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPermitDocument" ADD CONSTRAINT "CustomerPermitDocument_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPermitDocument" ADD CONSTRAINT "CustomerPermitDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
