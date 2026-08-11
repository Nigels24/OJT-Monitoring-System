import { useMemo, useState } from "react";
import {
  useGetMyAttendanceQuery,
  useSubmitAttendanceMutation,
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

export function useAttendanceLog() {
  const [form, setForm] = useState<AttendanceFormValues>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "">("");
  const [page, setPage] = useState(1);
  const { showSuccess, showError } = useSnackbar();

  const { data: attendance, isLoading } = useGetMyAttendanceQuery();
  const [submitAttendance, { isLoading: isSubmitting }] =
    useSubmitAttendanceMutation();

  const setField =
    (key: keyof AttendanceFormValues) =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
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

    if (!form.date) {
      setError("Pick the date you are logging.");
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
      showSuccess("Attendance submitted and sent for approval.");
    } catch (err: unknown) {
      const message = readError(err, "Failed to submit attendance.");
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
    statusFilter,
    page,
    paged,
    totalPages,
    summary,

    setField,
    setStatusFilter,
    setPage,
    handleSubmit,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}
