-- CreateTable
CREATE TABLE "HostBookingIntent" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "operatorCode" TEXT NOT NULL,
    "hostBookingRef" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "serviceType" TEXT,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "pickupDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "location" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "claimedByUserId" INTEGER,
    "claimedBookingId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostBookingIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HostBookingIntent_token_key" ON "HostBookingIntent"("token");

-- CreateIndex
CREATE INDEX "HostBookingIntent_token_idx" ON "HostBookingIntent"("token");

-- CreateIndex
CREATE INDEX "HostBookingIntent_hostBookingRef_idx" ON "HostBookingIntent"("hostBookingRef");

-- CreateIndex
CREATE INDEX "HostBookingIntent_customerEmail_idx" ON "HostBookingIntent"("customerEmail");

-- CreateIndex
CREATE INDEX "HostBookingIntent_status_idx" ON "HostBookingIntent"("status");

-- CreateIndex
CREATE INDEX "HostBookingIntent_expiresAt_idx" ON "HostBookingIntent"("expiresAt");
