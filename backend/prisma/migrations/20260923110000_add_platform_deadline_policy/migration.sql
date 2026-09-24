CREATE TABLE "PlatformDeadlinePolicy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "publishedTiers" INTEGER[] NOT NULL DEFAULT ARRAY[1, 3, 7],
    "mostLenientDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformDeadlinePolicy_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformDeadlinePolicy" ("id", "updatedAt")
VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;