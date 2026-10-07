-- Overtime and night handover move from each listing to the operator's shop
-- settings (SRS 4.3.5). Additive: the Listing columns stay until the Module 5
-- migration drops them, so this can be rolled back by redeploying old code.

ALTER TABLE "BNPLConfig"
  ADD COLUMN "overtimeFee"        DECIMAL(10,2),
  ADD COLUMN "blockNightHandover" BOOLEAN NOT NULL DEFAULT false;

-- Carry each operator's current values over from their listings. Where an
-- operator's listings disagree, take the highest fee, and block nights if any
-- listing blocks them. Applied to every config row of the operator, since
-- some operators have more than one.
UPDATE "BNPLConfig" AS c
SET
  "overtimeFee"        = l."overtimeFee",
  "blockNightHandover" = l."blockNightHandover"
FROM (
  SELECT
    "operatorId",
    MAX("overtimeFee")         AS "overtimeFee",
    BOOL_OR("blockNightHandover") AS "blockNightHandover"
  FROM "Listing"
  WHERE "category" = 'CAR_RENTAL'
  GROUP BY "operatorId"
) AS l
WHERE c."operatorId" = l."operatorId";
