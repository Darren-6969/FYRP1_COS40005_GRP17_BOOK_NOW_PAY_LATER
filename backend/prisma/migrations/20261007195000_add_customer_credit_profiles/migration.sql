CREATE TABLE "CustomerCreditProfile" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "successfulOnTimePayments" INTEGER NOT NULL DEFAULT 0,
    "expiredBookings" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'Normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerCreditProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditProfileEvent" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditProfileEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerCreditProfile_customerId_key" ON "CustomerCreditProfile"("customerId");
CREATE UNIQUE INDEX "CreditProfileEvent_customerId_eventKey_key" ON "CreditProfileEvent"("customerId", "eventKey");
CREATE INDEX "CreditProfileEvent_customerId_eventType_idx" ON "CreditProfileEvent"("customerId", "eventType");

ALTER TABLE "CustomerCreditProfile"
ADD CONSTRAINT "CustomerCreditProfile_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditProfileEvent"
ADD CONSTRAINT "CreditProfileEvent_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "CustomerCreditProfile"("customerId") ON DELETE CASCADE ON UPDATE CASCADE;
