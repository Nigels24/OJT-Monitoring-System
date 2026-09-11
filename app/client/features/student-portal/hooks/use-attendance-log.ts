import { useMemo, useState } from "react";
import {
  useGetMyAttendanceQuery,
  useGetMyProfileQuery,
  useSubmitAttendanceMutation,
  AttendanceRecord,
  AttendanceStatus,
} from "@/lib/api/studentPortalApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

const EMPTY_FORM = {
  date: "",
  timeInAM: "",
  timeOutAM: "",
  timeInPM: "",
  timeOutPM: "",
  remarks: "",
};

export type AttendanceFormValues = typeof EMPTY_FORM;

const PAGE_SIZE = 10;

/**
 * Combines a `yyyy-mm-dd` date with an `HH:mm` time into an ISO instant.
 *
 * The API stores real timestamps, not clock strings, so the two halves the form
 * collects separately have to be joined. Parsing without a timezone suffix uses
 * the browser's local zone, which is what the student actually means, and
 * toISOString then normalises it.
 */
function toIsoInstant(date: string, time: string): string | undefined {
  if (!date || !time) return undefined;
  const combined = new Date(`${date}T${time}`);
  return Number.isNaN(combined.getTime()) ? undefined : combined.toISOString();
}

/** Hours between two `HH:mm` values on the same day; 0 if incomplete or reversed. */
function spanHours(from: string, to: string): number {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const minutes = th * 60 + tm - (fh * 60 + fm);
  return minutes > 0 ? minutes / 60 : 0;
}

/**
 * Today as `yyyy-mm-dd` in the browser's own local time zone (not UTC).
 *
 * `new Date().toISOString().slice(0, 10)` looks equivalent but isn't: it
 * converts to UTC first, so a student in Asia/Manila (UTC+8) submitting in
 * the early morning would see yesterday's date as the bound. Reading the
 * local getters avoids that conversion entirely.
 */
function todayLocalDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `yyyy-mm-dd` -> "Dec 1, 2026", parsed as UTC so no local shift applies. */
function formatDateLabel(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * ISO instant -> `HH:mm` in the browser's own local time, the inverse of
 * `toIsoInstant`. Used to load a log's existing times back into the form
 * when correcting it — the round trip has to use the same (local, not UTC)
 * reading `toIsoInstant` used to build the instant in the first place.
 */
function isoToLocalTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function useAttendanceLog() {
  const [form, setForm] = useState<AttendanceFormValues>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "">("");
  const [page, setPage] = useState(1);
  // Set while the student is correcting an existing PENDING/DECLINED log
  // rather than logging a new day. Its date is what locks the date field and
  // what `handleSubmit` resubmits against — the server's submitAttendance
  // treats a same-date resubmission as an in-place correction, not a
  // duplicate, for anything short of APPROVED.
  const [correctionTarget, setCorrectionTarget] =
    useState<AttendanceRecord | null>(null);
  const { showSuccess, showError } = useSnackbar();

  const { data: attendance, isLoading } = useGetMyAttendanceQuery();
  const { data: profile } = useGetMyProfileQuery();
  const [submitAttendance, { isLoading: isSubmitting }] =
    useSubmitAttendanceMutation();

  // Mirrors the server's OJT-period rules (student.service.ts
  // submitAttendance) — this is UX only, so a student sees why before they
  // submit rather than after; the server re-validates regardless of what's
  // sent here.
  //
  // Completion is by hours, not the calendar, so a scheduled endDate never
  // blocks logging — only status COMPLETED does. That leaves five states:
  //   1. NOT STARTED  — today < startDate: form disabled, no min/max shown.
  //   2. ACTIVE        — form enabled, min=startDate, max=today.
  //   3. PAST SCHEDULED END, not complete — form stays enabled with a
  //      non-blocking notice; bounds are the same as ACTIVE.
  //   4. COMPLETED     — form disabled.
  //   5. UNASSIGNED    — no establishment: form disabled. Nothing a student
  //      logs here could ever be approved, because the supervisor's queue is
  //      scoped to an establishment.
  const today = todayLocalDateString();
  const startDate = profile?.startDate
    ? profile.startDate.slice(0, 10)
    : undefined;
  const endDate = profile?.endDate ? profile.endDate.slice(0, 10) : undefined;

  const isCompleted = profile?.status === "COMPLETED";
  // `profile &&` so this doesn't flash "unassigned" while the profile loads.
  const isUnassigned = !!profile && !profile.establishment;
  const isNotStarted =
    !isCompleted && !isUnassigned && !!startDate && today < startDate;
  const isPastScheduledEnd =
    !isCompleted &&
    !isUnassigned &&
    !isNotStarted &&
    !!endDate &&
    today > endDate;

  let minDate: string | undefined;
  let maxDate: string | undefined;
  let isDisabled = isCompleted || isUnassigned || isNotStarted;
  let disabledMessage: string | undefined = isCompleted
    ? "Your OJT is complete."
    : isUnassigned
      ? "You are not assigned to an establishment yet. Contact your coordinator."
      : isNotStarted
        ? `Your OJT starts on ${formatDateLabel(startDate!)}. You'll be able to log attendance from then.`
        : undefined;

  if (!isDisabled) {
    minDate = startDate;
    maxDate = today;
    // Safety net: bounds should never invert once NOT_STARTED is excluded
    // above, but if they somehow do, disable rather than hand the native
    // date input an impossible min/max pair (Chrome rejects the field
    // outright with its own unstyled message in that case).
    if (minDate && minDate > maxDate) {
      minDate = undefined;
      maxDate = undefined;
      isDisabled = true;
      disabledMessage = "Attendance logging is unavailable right now.";
    }
  }

  const noticeMessage =
    !isDisabled && isPastScheduledEnd
      ? `Your scheduled OJT ended on ${formatDateLabel(endDate!)}. Keep logging until your required hours are met.`
      : undefined;

  const setField =
    (key: keyof AttendanceFormValues) =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const isCorrecting = !!correctionTarget;

  /** Loads a PENDING/DECLINED log into the form so its date and times can be fixed. */
  const startCorrection = (record: AttendanceRecord) => {
    setCorrectionTarget(record);
    setError("");
    setForm({
      date: record.date.slice(0, 10),
      timeInAM: isoToLocalTimeInput(record.timeInAM),
      timeOutAM: isoToLocalTimeInput(record.timeOutAM),
      timeInPM: isoToLocalTimeInput(record.timeInPM),
      timeOutPM: isoToLocalTimeInput(record.timeOutPM),
      remarks: record.remarks ?? "",
    });
  };

  const cancelCorrection = () => {
    setCorrectionTarget(null);
    setError("");
    setForm(EMPTY_FORM);
  };

  // Live preview so the student sees the hours before submitting; the server
  // recomputes it from the stored timestamps and is the source of truth.
  const previewHours = useMemo(() => {
    const total =
      spanHours(form.timeInAM, form.timeOutAM) +
      spanHours(form.timeInPM, form.timeOutPM);
    return Math.round(total * 100) / 100;
  }, [form.timeInAM, form.timeOutAM, form.timeInPM, form.timeOutPM]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isDisabled) {
      setError(disabledMessage ?? "Attendance logging is unavailable.");
      return;
    }

    if (!form.date) {
      setError("Pick the date you are logging.");
      return;
    }

    // Mirrors the server's checks (student.service.ts submitAttendance) —
    // never a combined "between X and Y" range, since startDate and today
    // can legitimately be inconsistent with each other (e.g. an OJT period
    // that hasn't started yet). endDate is not checked here — a scheduled
    // end never blocks logging, only status COMPLETED does (handled above).
    if (startDate && form.date < startDate) {
      setError(
        `Your OJT period starts on ${formatDateLabel(startDate)}. You cannot log attendance before then.`,
      );
      return;
    }
    if (form.date > today) {
      setError("Attendance cannot be logged for a future date.");
      return;
    }

    const hasAm = !!form.timeInAM && !!form.timeOutAM;
    const hasPm = !!form.timeInPM && !!form.timeOutPM;
    if (!hasAm && !hasPm) {
      setError(
        "Fill in a complete AM or PM session — both a time in and a time out.",
      );
      return;
    }
    if (previewHours <= 0) {
      setError("Time out must be later than time in.");
      return;
    }

    try {
      await submitAttendance({
        date: form.date,
        timeInAM: toIsoInstant(form.date, form.timeInAM),
        timeOutAM: toIsoInstant(form.date, form.timeOutAM),
        timeInPM: toIsoInstant(form.date, form.timeInPM),
        timeOutPM: toIsoInstant(form.date, form.timeOutPM),
        remarks: form.remarks || undefined,
      }).unwrap();

      setForm(EMPTY_FORM);
      setCorrectionTarget(null);
      showSuccess(
        isCorrecting
          ? "Log corrected and resubmitted — awaiting approval again."
          : "Attendance submitted and sent for approval.",
      );
    } catch (err: unknown) {
      const message = readError(
        err,
        isCorrecting
          ? "Failed to update log."
          : "Failed to submit attendance.",
      );
      setError(message);
      showError(message);
    }
  };

  const filtered = useMemo(() => {
    const all = attendance ?? [];
    return statusFilter ? all.filter((a) => a.status === statusFilter) : all;
  }, [attendance, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const summary = useMemo(() => {
    const all = attendance ?? [];
    const sum = (status: AttendanceStatus) =>
      Math.round(
        all
          .filter((a) => a.status === status)
          .reduce((acc, a) => acc + a.hours, 0) * 100,
      ) / 100;
    return {
      approvedHours: sum("APPROVED"),
      pendingHours: sum("PENDING"),
      approvedCount: all.filter((a) => a.status === "APPROVED").length,
      pendingCount: all.filter((a) => a.status === "PENDING").length,
      declinedCount: all.filter((a) => a.status === "DECLINED").length,
      totalLogs: all.length,
    };
  }, [attendance]);

  return {
    form,
    error,
    previewHours,
    attendance,
    isLoading,
    isSubmitting,
    minDate,
    maxDate,
    isDisabled,
    disabledMessage,
    noticeMessage,
    statusFilter,
    page,
    paged,
    totalPages,
    summary,
    isCorrecting,
    correctionTarget,

    setField,
    setStatusFilter,
    setPage,
    handleSubmit,
    startCorrection,
    cancelCorrection,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}
