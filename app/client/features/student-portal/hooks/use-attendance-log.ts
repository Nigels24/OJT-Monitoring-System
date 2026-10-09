import { useMemo, useState } from "react";
import {
  useGetAttendanceHistoryQuery,
  useGetTodayAttendanceQuery,
  usePunchMutation,
  useUpdateTodayRemarksMutation,
  DayStatus,
  PunchKind,
} from "@/lib/api/studentPortalApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
import { PUNCH_LABEL, formatPunchTime } from "@/lib/attendance";

const PAGE_SIZE = 10;

/**
 * The student's live punch card and their attendance history.
 *
 * Holds no punch rules. Which of the four punches may be recorded right now —
 * and why not — comes from `GET /student/attendance/today` as `allowed` and
 * `blockedReason`; this hook only asks the student to confirm and sends
 * `{ kind }`. The server stamps the time.
 */
export function useAttendanceLog() {
  const { showSuccess, showError } = useSnackbar();

  // Polled so a supervisor's decision shows up without a reload. Paused while
  // the tab isn't focused — nothing changes on the student's side then.
  const {
    data: today,
    isLoading: isTodayLoading,
    isError: isTodayError,
  } = useGetTodayAttendanceQuery(undefined, {
    pollingInterval: 30_000,
    skipPollingIfUnfocused: true,
  });
  const { data: history, isLoading: isHistoryLoading } =
    useGetAttendanceHistoryQuery();
  const [punch] = usePunchMutation();
  const [updateRemarks, { isLoading: isSavingRemarks }] =
    useUpdateTodayRemarksMutation();

  /** The punch waiting on the confirm dialog. */
  const [confirmKind, setConfirmKind] = useState<PunchKind | null>(null);
  /** The punch in flight, so only its tile spins. */
  const [punchingKind, setPunchingKind] = useState<PunchKind | null>(null);

  const [statusFilter, setStatusFilter] = useState<DayStatus | "">("");
  const [page, setPage] = useState(1);

  // Remarks draft, seeded from the server. Mirrored-state pattern (CLAUDE.md
  // §8 item 18) rather than an effect: when the server's value changes — a
  // save, or the day rolling over — the draft follows, unless the student is
  // mid-edit, in which case their typing wins.
  const serverRemarks = today?.remarks ?? "";
  const [remarksDraft, setRemarksDraft] = useState("");
  const [seededRemarks, setSeededRemarks] = useState<string | null>(null);
  if (today && serverRemarks !== seededRemarks) {
    const isDirty = seededRemarks !== null && remarksDraft !== seededRemarks;
    if (!isDirty) setRemarksDraft(serverRemarks);
    setSeededRemarks(serverRemarks);
  }
  const remarksDirty = seededRemarks !== null && remarksDraft !== seededRemarks;

  const blockedReason = today?.blockedReason ?? null;

  const requestPunch = (kind: PunchKind) => setConfirmKind(kind);
  const cancelPunch = () => setConfirmKind(null);

  const confirmPunch = async () => {
    if (!confirmKind) return;
    const kind = confirmKind;
    setConfirmKind(null);
    setPunchingKind(kind);
    try {
      const result = await punch({ kind }).unwrap();
      const stamped = result.punches[kind];
      showSuccess(
        stamped
          ? `${PUNCH_LABEL[kind]} recorded at ${formatPunchTime(stamped.time)}. Awaiting approval.`
          : `${PUNCH_LABEL[kind]} recorded.`,
      );
    } catch (err: unknown) {
      // 409 (already recorded) and 400 (an ordering rule or a block) both
      // carry a sentence written for the student — show it as is.
      showError(readError(err, `Couldn't record ${PUNCH_LABEL[kind]}.`));
    } finally {
      setPunchingKind(null);
    }
  };

  const saveRemarks = async () => {
    try {
      await updateRemarks({ remarks: remarksDraft.trim() || null }).unwrap();
      showSuccess(remarksDraft.trim() ? "Remarks saved." : "Remarks cleared.");
    } catch (err: unknown) {
      showError(readError(err, "Couldn't save your remarks."));
    }
  };

  const days = useMemo(() => history ?? [], [history]);

  const filtered = useMemo(
    () =>
      statusFilter ? days.filter((d) => d.dayStatus === statusFilter) : days,
    [days, statusFilter],
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Hours come from the server per day; counts are of punches, matching the
  // dashboard (each punch is its own decision).
  const summary = useMemo(() => {
    const punches = days.flatMap((d) =>
      Object.values(d.punches).filter((p) => p !== null),
    );
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      approvedHours: round(days.reduce((acc, d) => acc + d.approvedHours, 0)),
      pendingHours: round(days.reduce((acc, d) => acc + d.pendingHours, 0)),
      approvedPunches: punches.filter((p) => p.status === "APPROVED").length,
      pendingPunches: punches.filter((p) => p.status === "PENDING").length,
      declinedPunches: punches.filter((p) => p.status === "DECLINED").length,
    };
  }, [days]);

  return {
    today,
    isTodayLoading,
    isTodayError,
    blockedReason,
    confirmKind,
    punchingKind,
    remarksDraft,
    remarksDirty,
    isSavingRemarks,

    history: days,
    isHistoryLoading,
    statusFilter,
    page,
    paged,
    totalPages,
    summary,

    requestPunch,
    cancelPunch,
    confirmPunch,
    setRemarksDraft,
    saveRemarks,
    setStatusFilter: (value: DayStatus | "") => {
      setStatusFilter(value);
      setPage(1);
    },
    setPage,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}
