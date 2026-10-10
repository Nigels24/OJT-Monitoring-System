-- One supervisor per establishment (paid step P1, item 3).
--
-- NOT YET APPLIED. Apply with `prisma migrate deploy`, after a `pg_dump`, and
-- only after resolving by hand any establishment that has two or more
-- supervisors — this migration never deletes or moves anyone.
--
-- 1. Guard: abort, changing nothing, if any establishment already has 2+
--    supervisors. The index below would fail on such data anyway, but with a
--    duplicate-key error that does not say what to do.
-- 2. The unique index that makes Establishment -> Supervisor one-to-one
--    (Supervisor.establishmentId @unique in schema.prisma). The CREATE INDEX
--    statement is exactly what `prisma migrate diff` emits between the
--    previous and the current schema file.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Supervisor"
    GROUP BY "establishmentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'An establishment has 2+ supervisors, resolve before migrating';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_establishmentId_key" ON "Supervisor"("establishmentId");
