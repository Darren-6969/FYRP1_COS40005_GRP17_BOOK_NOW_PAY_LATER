-- Blocker D (Task 3): photos could share a position, so a listing's gallery
-- order was unpredictable. Rewrite every listing's order once as 0 to n-1,
-- keeping the order customers see today (primary first, then position, then
-- age), with only the first photo marked primary. Data only; safe to re-run.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "listingId"
      ORDER BY "isPrimary" DESC, "sortOrder" ASC, "id" ASC
    ) - 1 AS "position"
  FROM "ListingImage"
)
UPDATE "ListingImage" AS image
SET "sortOrder" = ranked."position",
    "isPrimary" = (ranked."position" = 0)
FROM ranked
WHERE image."id" = ranked."id";
