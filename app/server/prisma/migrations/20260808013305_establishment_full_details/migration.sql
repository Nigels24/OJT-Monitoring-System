/*
  Warnings:

  - You are about to drop the column `address` on the `Establishment` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EstablishmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Establishment" DROP COLUMN "address",
ADD COLUMN     "barangay" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "coordinatorAddress" TEXT,
ADD COLUMN     "coordinatorAge" INTEGER,
ADD COLUMN     "coordinatorContact" TEXT,
ADD COLUMN     "coordinatorEmail" TEXT,
ADD COLUMN     "coordinatorFirstName" TEXT,
ADD COLUMN     "coordinatorGender" TEXT,
ADD COLUMN     "coordinatorLastName" TEXT,
ADD COLUMN     "coordinatorMiddleInitial" TEXT,
ADD COLUMN     "coordinatorPosition" TEXT,
ADD COLUMN     "industryType" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "status" "EstablishmentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "streetAddress" TEXT,
ADD COLUMN     "zipCode" TEXT;
