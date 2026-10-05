-- Attendance gets four separately approved punches per day.
--
-- `Attendance` stays the per-day row (studentId, date, remarks, one per day).
-- Its four clock columns and its single day-level decision move into a new
-- `AttendancePunch` table: one row per clock event (TIME_IN_AM, TIME_OUT_AM,
-- TIME_IN_PM, TIME_OUT_PM), each with its own status, decider, decision time
-- and decline reason.
--
-- Hand-ordered. Structural statements come from
-- `prisma migrate diff --from-schema-datamodel <previous> --to-schema-datamodel <current> --script`,
-- which emits the column drops FIRST; here they are moved to the end so the
-- data is copied out before it is dropped. Steps 4-5 are hand-written.
-- Explicit BEGIN/COMMIT: if any step fails (including the guard in step 5)
-- nothing is applied.

BEGIN;

-- 1. The four clock events.
CREATE TYPE "PunchKind" AS ENUM ('TIME_IN_AM', 'TIME_OUT_AM', 'TIME_IN_PM', 'TIME_OUT_PM');

-- 2. The punch table.
CREATE TABLE "AttendancePunch" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "kind" "PunchKind" NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendancePunch_status_idx" ON "AttendancePunch"("status");

-- At most one punch of each kind per day.
CREATE UNIQUE INDEX "AttendancePunch_attendanceId_kind_key" ON "AttendancePunch"("attendanceId", "kind");

-- 3. Foreign keys. RESTRICT on the day (no cascades in this schema — deletes
--    are ordered in src/common/cascade-delete.ts); SET NULL on the decider,
--    matching the old Attendance.approvedById.
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Every non-null clock value becomes a punch carrying its day's decision:
--    status, approvedById -> decidedById, declineReason (a whole-day reason
--    applies to each of that day's punches). decidedAt is NULL — the old
--    model never recorded when a day was decided, and inventing a time would
--    be a false claim. createdAt keeps the day's original createdAt.
--    gen_random_uuid() because cuid() exists only in the Prisma client; the
--    id column accepts any unique string.
INSERT INTO "AttendancePunch" ("id", "attendanceId", "kind", "time", "status", "decidedById", "decidedAt", "declineReason", "createdAt")
SELECT gen_random_uuid()::text,
       a."id",
       k.kind::"PunchKind",
       k.t,
       a."status",
       a."approvedById",
       NULL,
       a."declineReason",
       a."createdAt"
FROM "Attendance" a
CROSS JOIN LATERAL (
    VALUES ('TIME_IN_AM',  a."timeInAM"),
           ('TIME_OUT_AM', a."timeOutAM"),
           ('TIME_IN_PM',  a."timeInPM"),
           ('TIME_OUT_PM', a."timeOutPM")
) AS k(kind, t)
WHERE k.t IS NOT NULL;

-- 5. Guard: every clock value must have become exactly one punch before the
--    columns holding them are dropped. (8 on the live DB when this was written:
--    2 APPROVED days x 4 times.)
DO $$
DECLARE
    expected integer;
    actual   integer;
BEGIN
    SELECT count("timeInAM") + count("timeOutAM") + count("timeInPM") + count("timeOutPM")
      INTO expected
      FROM "Attendance";
    SELECT count(*) INTO actual FROM "AttendancePunch";
    IF expected <> actual THEN
        RAISE EXCEPTION 'attendance_punches: expected % punch(es), copied %; aborting', expected, actual;
    END IF;
END $$;

-- 6. Only now drop the old per-day clock and decision columns.
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_approvedById_fkey";

ALTER TABLE "Attendance" DROP COLUMN "approvedById",
DROP COLUMN "declineReason",
DROP COLUMN "status",
DROP COLUMN "timeInAM",
DROP COLUMN "timeInPM",
DROP COLUMN "timeOutAM",
DROP COLUMN "timeOutPM";

COMMIT;
