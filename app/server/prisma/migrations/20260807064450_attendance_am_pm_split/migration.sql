/*
  Warnings:

  - You are about to drop the column `timeIn` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `timeOut` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `totalHours` on the `Attendance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "timeIn",
DROP COLUMN "timeOut",
DROP COLUMN "totalHours",
ADD COLUMN     "timeInAM" TIMESTAMP(3),
ADD COLUMN     "timeInPM" TIMESTAMP(3),
ADD COLUMN     "timeOutAM" TIMESTAMP(3),
ADD COLUMN     "timeOutPM" TIMESTAMP(3);
