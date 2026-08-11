/** The four nullable clock fields on an Attendance row. */
export interface AttendanceTimes {
  timeInAM: Date | null;
  timeOutAM: Date | null;
  timeInPM: Date | null;
  timeOutPM: Date | null;
}

const MS_PER_HOUR = 1000 * 60 * 60;

function span(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  // Guard against an out-of-order pair producing negative hours; the schema
  // has no constraint preventing timeOut < timeIn.
  return Math.max(0, end.getTime() - start.getTime());
}

/** Hours logged by a single attendance record, AM and PM sessions combined. */
export function hoursForAttendance(record: AttendanceTimes): number {
  return (
    (span(record.timeInAM, record.timeOutAM) +
      span(record.timeInPM, record.timeOutPM)) /
    MS_PER_HOUR
  );
}

/**
 * Total hours across many records, rounded to two decimals.
 *
 * Callers decide which records to pass in — completed hours should only count
 * APPROVED attendance, so filter before calling.
 */
export function totalHours(records: AttendanceTimes[]): number {
  const sum = records.reduce((acc, r) => acc + hoursForAttendance(r), 0);
  return Math.round(sum * 100) / 100;
}
