-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "feedback",
DROP COLUMN "score",
ADD COLUMN     "attendance" INTEGER NOT NULL,
ADD COLUMN     "comments" TEXT,
ADD COLUMN     "communication" INTEGER NOT NULL,
ADD COLUMN     "efficiency" INTEGER NOT NULL,
ADD COLUMN     "initiative" INTEGER NOT NULL,
ADD COLUMN     "knowledge" INTEGER NOT NULL,
ADD COLUMN     "overallRating" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "performanceLevel" TEXT NOT NULL,
ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3),
ADD COLUMN     "problemSolving" INTEGER NOT NULL,
ADD COLUMN     "quality" INTEGER NOT NULL,
ADD COLUMN     "quantity" INTEGER NOT NULL,
ADD COLUMN     "recommendations" TEXT,
ADD COLUMN     "teamwork" INTEGER NOT NULL;

