-- Run before applying 20261008090000_operator_overtime_policy.
-- Lists operators whose car listings have different overtime settings, so
-- they can be told the single value their shop settings will start with.
SELECT
  o."id",
  o."companyName",
  ARRAY_AGG(DISTINCT l."overtimeFee")        AS "overtimeFees",
  ARRAY_AGG(DISTINCT l."blockNightHandover") AS "nightBlocked",
  MAX(l."overtimeFee")                       AS "willBecomeFee",
  BOOL_OR(l."blockNightHandover")            AS "willBlockNights"
FROM "Listing" l
JOIN "Operator" o ON o."id" = l."operatorId"
WHERE l."category" = 'CAR_RENTAL'
GROUP BY o."id", o."companyName"
HAVING COUNT(DISTINCT COALESCE(l."overtimeFee", -1)) > 1
    OR COUNT(DISTINCT l."blockNightHandover") > 1;
