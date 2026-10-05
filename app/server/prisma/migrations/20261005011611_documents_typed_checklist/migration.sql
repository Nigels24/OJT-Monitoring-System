-- Documents become a typed, one-file-per-type checklist; Credentials fold into
-- them; the review workflow is removed.
--
-- Hand-ordered. Structural statements come from
-- `prisma migrate diff --from-schema-datamodel <previous> --to-schema-datamodel <current> --script`;
-- the data steps (3-6) are hand-written. The whole script is sent as one
-- multi-statement query, which Postgres runs as a single implicit transaction:
-- if any step fails (including the guard in step 5) nothing is applied.

-- 1. The six requirement types.
CREATE TYPE "DocumentType" AS ENUM ('APPLICATION_LETTER', 'ENDORSEMENT_LETTER', 'RESUME', 'MOA', 'PARENTS_CONSENT', 'WAIVER');

-- 2. New columns. `type` starts nullable so existing rows can be filled first.
ALTER TABLE "Document" ADD COLUMN "type" "DocumentType",
ADD COLUMN "originalFileName" TEXT;

-- 3. Every pre-existing Document row is free-text test data ("PaySLip", "test")
--    that maps to no type. Deleted by agreement; their storage objects are
--    cleaned up by hand beforehand (see the orphan-files SELECT).
DELETE FROM "Document";

-- 4. Credentials become Documents. Same id, same storage path, createdAt
--    becomes uploadedAt. `name` is filled only because it is still NOT NULL
--    here — it is dropped in step 7. `status` takes its default, also dropped.
INSERT INTO "Document" ("id", "studentId", "name", "fileUrl", "uploadedAt", "type")
SELECT "id", "studentId", "type", "fileUrl", "createdAt", "type"::"DocumentType"
FROM "Credential";

-- 5. Safety net: refuse to continue if any row is still untyped.
DO $$
DECLARE untyped INTEGER;
BEGIN
  SELECT COUNT(*) INTO untyped FROM "Document" WHERE "type" IS NULL;
  IF untyped > 0 THEN
    RAISE EXCEPTION 'documents_typed_checklist: % Document row(s) have no type; aborting', untyped;
  END IF;
END $$;

-- 6. One row per (studentId, type): keep the newest, drop the rest.
DELETE FROM "Document" d
USING (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "studentId", "type"
           ORDER BY "uploadedAt" DESC, "id" DESC
         ) AS rn
  FROM "Document"
) ranked
WHERE d."id" = ranked."id" AND ranked.rn > 1;

-- 7. Lock it down and drop what is no longer used.
ALTER TABLE "Document" ALTER COLUMN "type" SET NOT NULL;

CREATE UNIQUE INDEX "Document_studentId_type_key" ON "Document"("studentId", "type");

ALTER TABLE "Document" DROP CONSTRAINT "Document_reviewedById_fkey";

ALTER TABLE "Document" DROP COLUMN "name",
DROP COLUMN "reviewNote",
DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedById",
DROP COLUMN "status";

ALTER TABLE "Credential" DROP CONSTRAINT "Credential_studentId_fkey";

DROP TABLE "Credential";
