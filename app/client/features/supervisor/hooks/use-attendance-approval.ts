import { useMemo, useState } from "react";
import {
  useGetSupervisorAttendanceQuery,
  useApprovePunchMutation,
  useDeclinePunchMutation,
  SupervisorAttendance,
} from "@/lib/api/supervisorApi";
import type { Punch } from "@/lib/api/studentPortalApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
import { PUNCH_LABEL } from "@/lib/attendance";
import { formatDateOnly } from "@/lib/format";

const PAGE_SIZE = 10;

/** "PENDING" = days with a punch still awaiting a decision; "" = every day. */
export type QueueFilter = "PENDING" | "";

/** The punch being declined, with the day it belongs to for the dialog's context. */
export interface DeclineTarget {
  day: SupervisorAttendance;
  punch: Punch;
}

/**
 * The supervisor's approval queue. Every punch is approved or declined on its
 * own — there is deliberately no "approve the whole day" action, per the
 * professor's requirement.
 */
export function useAttendanceApproval() {
  const [filter, setFilter] = useState<QueueFilter>("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [declineTarget, setDeclineTarget] = useState<DeclineTarget | null>(
    null,
  );
  const [declineReason, setDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState("");
  // The punch mid-request, so only its buttons disable.
  const [actioningId, setActioningId] = useState<string | null>(null);

  const { showSuccess, showError } = useSnackbar();

  // Polled: students punch throughout the day. Paused while unfocused.
  const { data: attendance, isLoading } = useGetSupervisorAttendanceQuery(
    filter || undefined,
    { pollingInterval: 30_000, skipPollingIfUnfocused: true },
  );
  const [approvePunch] = useApprovePunchMutation();
  const [declinePunch, { isLoading: isDeclining }] = useDeclinePunchMutation();

  const handleApprove = async (day: SupervisorAttendance, punch: Punch) => {
    setActioningId(punch.id);
    try {
      const result = await approvePunch(punch.id).unwrap();
      const done = result.completedStudent;
      showSuccess(
        done
          ? `${done.name} has reached ${done.approvedHours} of ${done.requiredHours} hours and is now COMPLETED.`
          : `Approved ${PUNCH_LABEL[punch.kind]} for ${day.student.user.name}.`,
      );
    } catch (err: unknown) {
      // A 409 means someone already decided it; the refetch shows the result.
      showError(readError(err, "Failed to approve the punch."));
    } finally {
      setActioningId(null);
    }
  };

  const openDecline = (day: SupervisorAttendance, punch: Punch) => {
    setDeclineTarget({ day, punch });
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
      setDeclineError("Give the student a reason so they know what to fix.");
      return;
    }

    const { day, punch } = declineTarget;
    try {
      await declinePunch({
        id: punch.id,
        reason: declineReason.trim(),
      }).unwrap();
      showSuccess(
        `Declined ${PUNCH_LABEL[punch.kind]} for ${day.student.user.name}, ${formatDateOnly(day.date)}.`,
      );
      closeDecline();
    } catch (err: unknown) {
      const message = readError(err, "Failed to decline the punch.");
      setDeclineError(message);
      showError(message);
    }
  };

  const days = useMemo(() => attendance ?? [], [attendance]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return days;
    return days.filter((d) =>
      [d.student.user.name, d.student.studentIdNumber, d.student.course]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [days, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const summary = useMemo(() => {
    const punches = filtered.flatMap((d) =>
      Object.values(d.punches).filter((p) => p !== null),
    );
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      pendingPunches: punches.filter((p) => p.status === "PENDING").length,
      pendingHours: round(filtered.reduce((acc, d) => acc + d.pendingHours, 0)),
      approvedHours: round(
        filtered.reduce((acc, d) => acc + d.approvedHours, 0),
      ),
    };
  }, [filtered]);

  return {
    isLoading,
    filter,
    search,
    page,
    paged,
    totalPages,
    filtered,
    summary,
    declineTarget,
    declineReason,
    declineError,
    isDeclining,
    actioningId,

    setFilter: (value: QueueFilter) => {
      setFilter(value);
      setPage(1);
    },
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
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
