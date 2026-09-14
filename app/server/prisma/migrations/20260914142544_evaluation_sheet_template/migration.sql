-- The evaluation sheet becomes a versioned template the school owns.
--
-- Written by hand, in this order, so it is one transaction and no signed sheet
-- loses its scores: structure first, then template version 1 seeded with the
-- exact wording the nineteen columns were printed under, then the new
-- Evaluation columns backfilled to version 1, then the scores copied out of
-- the columns, and only then the columns dropped.
--
-- The structural statements come from
--   prisma migrate diff --from-schema-datamodel <previous schema> \
--     --to-schema-datamodel prisma/schema.prisma --script
-- with the DROP COLUMN block moved to the end (step 5) and the data steps
-- inserted, per CLAUDE.md section 6.

-- ---------------------------------------------------------------------------
-- 1. Structure: the four new tables, their indexes and their foreign keys.
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "EvaluationTemplate" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "EvaluationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationTemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "EvaluationTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationTemplateItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "EvaluationTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationTemplate_version_key" ON "EvaluationTemplate"("version");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationTemplateSection_templateId_key_key" ON "EvaluationTemplateSection"("templateId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationTemplateItem_sectionId_key_key" ON "EvaluationTemplateItem"("sectionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationScore_evaluationId_itemKey_key" ON "EvaluationScore"("evaluationId", "itemKey");

-- AddForeignKey
ALTER TABLE "EvaluationTemplateSection" ADD CONSTRAINT "EvaluationTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationTemplateItem" ADD CONSTRAINT "EvaluationTemplateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "EvaluationTemplateSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Template version 1: the sheet exactly as it was hardcoded, PUBLISHED.
--
--    The item keys are the nineteen column names, which is what makes step 4
--    a straight copy. Ids are readable rather than cuids because they are
--    written here once and referenced by the statements below; every row
--    created by the application from now on gets a cuid.
-- ---------------------------------------------------------------------------

INSERT INTO "EvaluationTemplate" ("id", "version", "status", "title", "createdAt", "publishedAt")
VALUES ('evaltpl_v1', 1, 'PUBLISHED', 'ON-THE-JOB TRAINING PERFORMANCE EVALUATION SHEET', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "EvaluationTemplateSection" ("id", "templateId", "key", "label", "order") VALUES
  ('evaltplsec_v1_workAttitudesAndHabits', 'evaltpl_v1', 'workAttitudesAndHabits', 'WORK ATTITUDES AND HABITS', 1),
  ('evaltplsec_v1_workKnowledge', 'evaltpl_v1', 'workKnowledge', 'WORK KNOWLEDGE', 2),
  ('evaltplsec_v1_personalityAndAppearance', 'evaltpl_v1', 'personalityAndAppearance', 'PERSONALITY AND PERSONAL APPEARANCE', 3),
  ('evaltplsec_v1_professionalCompetence', 'evaltpl_v1', 'professionalCompetence', 'PROFESSIONAL COMPETENCE', 4);

INSERT INTO "EvaluationTemplateItem" ("id", "sectionId", "key", "label", "order") VALUES
  ('evaltplitem_v1_courtesy', 'evaltplsec_v1_workAttitudesAndHabits', 'courtesy', 'Courtesy in dealing with superiors and peers', 1),
  ('evaltplitem_v1_patienceAndDiligence', 'evaltplsec_v1_workAttitudesAndHabits', 'patienceAndDiligence', 'Patience and diligence in performing assigned tasks', 2),
  ('evaltplitem_v1_punctualityAndAttendance', 'evaltplsec_v1_workAttitudesAndHabits', 'punctualityAndAttendance', 'Punctuality and regularity in attendance', 3),
  ('evaltplitem_v1_neatnessOfReports', 'evaltplsec_v1_workAttitudesAndHabits', 'neatnessOfReports', 'Neatness of the reports submitted on the scheduled time', 4),
  ('evaltplitem_v1_punctualityOfReports', 'evaltplsec_v1_workAttitudesAndHabits', 'punctualityOfReports', 'Punctuality in submitting reports on the assigned tasks', 5),
  ('evaltplitem_v1_technicalKnowledge', 'evaltplsec_v1_workKnowledge', 'technicalKnowledge', 'Technical knowledge', 1),
  ('evaltplitem_v1_relatesTheoryToPractice', 'evaltplsec_v1_workKnowledge', 'relatesTheoryToPractice', 'Ability to relate the theories to actual experience', 2),
  ('evaltplitem_v1_openToCriticism', 'evaltplsec_v1_workKnowledge', 'openToCriticism', 'Open to constructive criticism', 3),
  ('evaltplitem_v1_discretion', 'evaltplsec_v1_workKnowledge', 'discretion', 'Discreet, capable of observing prudent silence', 4),
  ('evaltplitem_v1_neatAndWellGroomed', 'evaltplsec_v1_personalityAndAppearance', 'neatAndWellGroomed', 'Always neat and well-groomed', 1),
  ('evaltplitem_v1_properAttire', 'evaltplsec_v1_personalityAndAppearance', 'properAttire', 'Wears proper and decent attire', 2),
  ('evaltplitem_v1_poiseAndSelfConfidence', 'evaltplsec_v1_personalityAndAppearance', 'poiseAndSelfConfidence', 'Shows poise and self-confidence', 3),
  ('evaltplitem_v1_emotionalMaturity', 'evaltplsec_v1_personalityAndAppearance', 'emotionalMaturity', 'Shows emotional maturity', 4),
  ('evaltplitem_v1_dealsWellWithCoworkers', 'evaltplsec_v1_personalityAndAppearance', 'dealsWellWithCoworkers', 'Can easily deal with co-workers', 5),
  ('evaltplitem_v1_performanceOfWork', 'evaltplsec_v1_professionalCompetence', 'performanceOfWork', 'Performance of work (as a whole)', 1),
  ('evaltplitem_v1_understandsInstructions', 'evaltplsec_v1_professionalCompetence', 'understandsInstructions', 'Easily understands instructions', 2),
  ('evaltplitem_v1_sharesSuggestions', 'evaltplsec_v1_professionalCompetence', 'sharesSuggestions', 'Shares sounds suggestions to the problems', 3),
  ('evaltplitem_v1_ethicalStandards', 'evaltplsec_v1_professionalCompetence', 'ethicalStandards', 'Can cope up with the prescribed ethical standards', 4),
  ('evaltplitem_v1_speaksAudibly', 'evaltplsec_v1_professionalCompetence', 'speaksAudibly', 'Speaks audibility in a well-modulated voice', 5);

-- ---------------------------------------------------------------------------
-- 3. Evaluation gains its template and its frozen maximum.
--
--    Added nullable, backfilled, then made NOT NULL: every existing sheet was
--    signed on version 1, out of 95.
-- ---------------------------------------------------------------------------

ALTER TABLE "Evaluation" ADD COLUMN "templateId" TEXT;
ALTER TABLE "Evaluation" ADD COLUMN "maxTotalRating" INTEGER;

UPDATE "Evaluation" SET "templateId" = 'evaltpl_v1', "maxTotalRating" = 95;

ALTER TABLE "Evaluation" ALTER COLUMN "templateId" SET NOT NULL;
ALTER TABLE "Evaluation" ALTER COLUMN "maxTotalRating" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Copy the nineteen columns into EvaluationScore, one row per item per
--    evaluation. Must run before step 5 — this is the only read of those
--    columns that will ever happen again.
-- ---------------------------------------------------------------------------

INSERT INTO "EvaluationScore" ("id", "evaluationId", "itemKey", "score")
SELECT 'evalscore_v1_' || e."id" || '_' || s."itemKey", e."id", s."itemKey", s."score"
FROM "Evaluation" e
CROSS JOIN LATERAL (VALUES
  ('courtesy', e."courtesy"),
  ('patienceAndDiligence', e."patienceAndDiligence"),
  ('punctualityAndAttendance', e."punctualityAndAttendance"),
  ('neatnessOfReports', e."neatnessOfReports"),
  ('punctualityOfReports', e."punctualityOfReports"),
  ('technicalKnowledge', e."technicalKnowledge"),
  ('relatesTheoryToPractice', e."relatesTheoryToPractice"),
  ('openToCriticism', e."openToCriticism"),
  ('discretion', e."discretion"),
  ('neatAndWellGroomed', e."neatAndWellGroomed"),
  ('properAttire', e."properAttire"),
  ('poiseAndSelfConfidence', e."poiseAndSelfConfidence"),
  ('emotionalMaturity', e."emotionalMaturity"),
  ('dealsWellWithCoworkers', e."dealsWellWithCoworkers"),
  ('performanceOfWork', e."performanceOfWork"),
  ('understandsInstructions', e."understandsInstructions"),
  ('sharesSuggestions', e."sharesSuggestions"),
  ('ethicalStandards', e."ethicalStandards"),
  ('speaksAudibly', e."speaksAudibly")
) AS s("itemKey", "score");

-- ---------------------------------------------------------------------------
-- 5. Only now, drop the nineteen columns.
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "Evaluation"
  DROP COLUMN "courtesy",
  DROP COLUMN "patienceAndDiligence",
  DROP COLUMN "punctualityAndAttendance",
  DROP COLUMN "neatnessOfReports",
  DROP COLUMN "punctualityOfReports",
  DROP COLUMN "technicalKnowledge",
  DROP COLUMN "relatesTheoryToPractice",
  DROP COLUMN "openToCriticism",
  DROP COLUMN "discretion",
  DROP COLUMN "neatAndWellGroomed",
  DROP COLUMN "properAttire",
  DROP COLUMN "poiseAndSelfConfidence",
  DROP COLUMN "emotionalMaturity",
  DROP COLUMN "dealsWellWithCoworkers",
  DROP COLUMN "performanceOfWork",
  DROP COLUMN "understandsInstructions",
  DROP COLUMN "sharesSuggestions",
  DROP COLUMN "ethicalStandards",
  DROP COLUMN "speaksAudibly";
