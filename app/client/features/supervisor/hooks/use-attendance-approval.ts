import { useMemo, useState } from "react";
import {
  useGetSupervisorAttendanceQuery,
  useApproveAttendanceMutation,
  useDeclineAttendanceMutation,
  SupervisorAttendance,
} from "@/lib/api/supervisorApi";
import type { AttendanceStatus } from "@/lib/api/studentPortalApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

const PAGE_SIZE = 10;

export function useAttendanceApproval() {
  // Defaults to PENDING: the whole point of this screen is the approval queue,
  // and the old endpoint returned every status with no way to tell them apart.
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "">(
    "PENDING",
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [declineTarget, setDeclineTarget] =
    useState<SupervisorAttendance | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState("");
  // Tracks which row is mid-request so only that row's buttons disable.
  const [actioningId, setActioningId] = useState<string | null>(null);

  const { showSuccess, showError } = useSnackbar();

  const { data: attendance, isLoading } = useGetSupervisorAttendanceQuery(
    statusFilter || undefined,
  );
  const [approveAttendance] = useApproveAttendanceMutation();
  const [declineAttendance, { isLoading: isDeclining }] =
    useDeclineAttendanceMutation();

  const handleApprove = async (record: SupervisorAttendance) => {
    setActioningId(record.id);
    try {
      await approveAttendance(record.id).unwrap();
      showSuccess(
        `Approved ${record.hours} hrs for ${record.student.user.name}.`,
      );
    } catch (err: unknown) {
      showError(readError(err, "Failed to approve attendance."));
    } finally {
      setActioningId(null);
    }
  };

  const openDecline = (record: SupervisorAttendance) => {
    setDeclineTarget(record);
    setDeclineReason("");
    setDeclineError("");
  };

  const closeDecline = () => {
    setDeclineTarget(null);
    setDeclineReason("");
    setDeclineError("");
  };

  const handleDeclineConfirm = async () => {
    if (!declineTarget) return;

    // Mirrors the server's MinLength(3); a bare "no" helps nobody.
    if (declineReason.trim().length < 3) {
      setDeclineError("Give the student a reason so they can correct it.");
      return;
    }

    try {
      await declineAttendance({
        id: declineTarget.id,
        reason: declineReason.trim(),
      }).unwrap();
      showSuccess(`Declined ${declineTarget.student.user.name}'s log.`);
      closeDecline();
    } catch (err: unknown) {
      const message = readError(err, "Failed to decline attendance.");
      setDeclineError(message);
      showError(message);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return attendance ?? [];
    return (attendance ?? []).filter((a) =>
      [a.student.user.name, a.student.studentIdNumber, a.student.course]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [attendance, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pendingHours = useMemo(
    () =>
      Math.round(
        (attendance ?? [])
          .filter((a) => a.status === "PENDING")
          .reduce((acc, a) => acc + a.hours, 0) * 100,
      ) / 100,
    [attendance],
  );

  return {
    attendance,
    isLoading,
    statusFilter,
    search,
    page,
    paged,
    totalPages,
    filtered,
    pendingHours,
    declineTarget,
    declineReason,
    declineError,
    isDeclining,
    actioningId,

    setStatusFilter,
    setSearch,
    setPage,
    setDeclineReason,

    handleApprove,
    openDecline,
    closeDecline,
    handleDeclineConfirm,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}
