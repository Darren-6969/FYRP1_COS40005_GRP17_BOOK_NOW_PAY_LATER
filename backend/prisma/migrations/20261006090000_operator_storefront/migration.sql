-- Operator seller page (FR-CUST-007): shareable slug, operator-written
-- profile, and per-day branch hours.

ALTER TABLE "Operator"
  ADD COLUMN "slug"            TEXT,
  ADD COLUMN "about"           TEXT,
  ADD COLUMN "coverImageUrl"   TEXT,
  ADD COLUMN "establishedYear" INTEGER,
  ADD COLUMN "languages"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Branch" ADD COLUMN "weeklyHours" JSONB;

-- Backfill slugs from the company name: "Borneo Wheels Sdn. Bhd." becomes
-- "borneo-wheels". Names that clash, or have nothing usable, get the id.
WITH base AS (
  SELECT id,
         trim(both '-' from regexp_replace(
           lower(regexp_replace("companyName", '\s*(sdn\.?\s*bhd\.?|bhd\.?|enterprise)\s*$', '', 'i')),
           '[^a-z0-9]+', '-', 'g')) AS stem
  FROM "Operator"
),
ranked AS (
  SELECT id, stem, count(*) OVER (PARTITION BY stem) AS n FROM base
)
UPDATE "Operator" o
SET slug = CASE
  WHEN r.stem = '' THEN 'operator-' || r.id
  WHEN r.n > 1 THEN r.stem || '-' || r.id
  ELSE r.stem
END
FROM ranked r
WHERE o.id = r.id;

CREATE UNIQUE INDEX "Operator_slug_key" ON "Operator"("slug");
