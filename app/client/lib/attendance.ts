import type { BadgeVariant } from "@/components/ui/StatusBadge";
import type {
  AttendanceStatus,
  DayStatus,
  PunchKind,
} from "@/lib/api/studentPortalApi";

/*
 * How attendance punches *read* — labels, badge colours, clock format — shared
 * by the student's and the supervisor's screens. Presentation only: whether a
 * punch is allowed is the server's call (`TodayAttendance.allowed`), and none
 * of the punch rules live here.
 */

/** Same wording the server uses in its messages (PUNCH_LABEL in attendance-hours.ts). */
export const PUNCH_LABEL: Record<PunchKind, string> = {
  TIME_IN_AM: "Time In (AM)",
  TIME_OUT_AM: "Time Out (AM)",
  TIME_IN_PM: "Time In (PM)",
  TIME_OUT_PM: "Time Out (PM)",
};

export const PUNCH_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

export const PUNCH_STATUS_VARIANT: Record<AttendanceStatus, BadgeVariant> = {
  PENDING: "pending",
  APPROVED: "approved",
  DECLINED: "declined",
};

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  PENDING: "Awaiting approval",
  PARTIAL: "Partially approved",
  DECLINED: "Declined",
  APPROVED: "Approved",
  INCOMPLETE: "Incomplete",
};

export const DAY_STATUS_VARIANT: Record<DayStatus, BadgeVariant> = {
  PENDING: "pending",
  PARTIAL: "onProgress",
  DECLINED: "declined",
  APPROVED: "approved",
  INCOMPLETE: "neutral",
};

/** The two sessions, in order, with the kinds that make them up. */
export const SESSIONS = [
  { label: "Morning", inKind: "TIME_IN_AM", outKind: "TIME_OUT_AM" },
  { label: "Afternoon", inKind: "TIME_IN_PM", outKind: "TIME_OUT_PM" },
] as const satisfies readonly {
  label: string;
  inKind: PunchKind;
  outKind: PunchKind;
}[];

/**
 * A punch's stamped time as "8:02 AM", in Manila — the school's clock, so a
 * viewer in another zone sees the same time the student punched.
 */
export function formatPunchTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

/** "Approved by Akeelah Andrea · Oct 5, 9:14 AM" — the hover text on a decided punch. */
export function punchDecisionTitle(punch: {
  status: AttendanceStatus;
  decidedAt: string | null;
  decidedBy: { user: { name: string } } | null;
}): string | undefined {
  if (punch.status === "PENDING") return undefined;
  const verb = punch.status === "APPROVED" ? "Approved" : "Declined";
  const who = punch.decidedBy?.user.name ?? "a supervisor no longer on file";
  const when = punch.decidedAt
    ? ` · ${new Date(punch.decidedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      })}`
    : "";
  return `${verb} by ${who}${when}`;
}
