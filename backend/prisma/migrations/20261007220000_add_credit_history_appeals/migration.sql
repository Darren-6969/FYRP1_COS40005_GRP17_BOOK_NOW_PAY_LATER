ALTER TABLE "CreditProfileEvent"
  ADD COLUMN "actorUserId" INTEGER,
  ADD COLUMN "reason" TEXT NOT NULL DEFAULT 'Credit profile event',
  ADD COLUMN "beforeTier" TEXT,
  ADD COLUMN "afterTier" TEXT,
  ADD COLUMN "reversalOfId" INTEGER;

CREATE TABLE "CreditAppeal" (
  "id" SERIAL NOT NULL,
  "customerId" INTEGER NOT NULL,
  "eventId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "resolution" TEXT,
  "upheldById" INTEGER,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditAppeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreditAppeal_customerId_createdAt_idx" ON "CreditAppeal"("customerId", "createdAt");
CREATE INDEX "CreditAppeal_status_createdAt_idx" ON "CreditAppeal"("status", "createdAt");
CREATE INDEX "CreditProfileEvent_customerId_createdAt_idx" ON "CreditProfileEvent"("customerId", "createdAt");

ALTER TABLE "CreditProfileEvent" ADD CONSTRAINT "CreditProfileEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditProfileEvent" ADD CONSTRAINT "CreditProfileEvent_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "CreditProfileEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditAppeal" ADD CONSTRAINT "CreditAppeal_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditAppeal" ADD CONSTRAINT "CreditAppeal_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "CreditProfileEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditAppeal" ADD CONSTRAINT "CreditAppeal_upheldById_fkey"
  FOREIGN KEY ("upheldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
