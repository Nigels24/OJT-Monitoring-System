-- Unique establishment names, plus an optional Branch (paid step P4, item 14).
--
-- NOT YET APPLIED. Apply with `prisma migrate deploy`, after a `pg_dump`, and
-- only after resolving by hand any two establishments whose names collide
-- (same name and no branch, compared case-insensitively and ignoring extra
-- spaces) — this migration never merges, renames or deletes anything.
--
-- An establishment is identified by name + optional branch. The comparison
-- runs on two stored key columns rather than an expression index, because
-- Prisma cannot describe an expression index and a later `migrate diff` would
-- emit a DROP for it. `branchKey` is '' rather than NULL for "no branch":
-- Postgres treats NULLs in a unique index as all different, so two
-- "Jollibee" with no branch would otherwise both be allowed.
--
-- Structural statements are what `prisma migrate diff` emits between the
-- previous and the current schema file, except that `nameKey` is added
-- nullable, backfilled, and only then made NOT NULL (the diff adds it NOT
-- NULL with no default, which fails on a table that has rows).
--
-- Explicit BEGIN/COMMIT, as in 20261005015145_attendance_punches: if the
-- guard in step 3 (or anything else) fails, nothing here is applied.

BEGIN;

-- 1. The columns. Every existing establishment has no branch (branchKey '').
ALTER TABLE "Establishment" ADD COLUMN "branch" TEXT,
ADD COLUMN "branchKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN "nameKey" TEXT;

-- 2. Backfill the key from the name: collapse every whitespace run to one
--    space, trim, lower-case — the same steps, in the same order, as
--    normalizeKey() in src/common/establishment-identity.ts.
UPDATE "Establishment"
SET "nameKey" = lower(btrim(regexp_replace("name", '\s+', ' ', 'g')));

ALTER TABLE "Establishment" ALTER COLUMN "nameKey" SET NOT NULL;

-- 3. Guard: abort, changing nothing, if any (nameKey, branchKey) pair repeats.
--    The index below would fail on such data anyway, but with a duplicate-key
--    error that names neither the establishments nor what to do.
DO $$
DECLARE
  clashes TEXT;
BEGIN
  SELECT string_agg(format('%s (%s rows: %s)', "nameKey", n, names), '; ')
  INTO clashes
  FROM (
    SELECT "nameKey", COUNT(*) AS n,
           string_agg(format('%L [%s]', "name", "id"), ', ') AS names
    FROM "Establishment"
    GROUP BY "nameKey", "branchKey"
    HAVING COUNT(*) > 1
  ) d;

  IF clashes IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate establishment names remain, resolve before migrating'
      USING DETAIL = clashes;
  END IF;
END $$;

-- 4. The index that enforces it (@@unique([nameKey, branchKey])).
CREATE UNIQUE INDEX "Establishment_nameKey_branchKey_key" ON "Establishment"("nameKey", "branchKey");

COMMIT;
