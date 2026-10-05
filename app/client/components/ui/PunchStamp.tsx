import StatusBadge from "./StatusBadge";
import type { Punch } from "@/lib/api/studentPortalApi";
import {
  PUNCH_STATUS_LABEL,
  PUNCH_STATUS_VARIANT,
  formatPunchTime,
  punchDecisionTitle,
} from "@/lib/attendance";

interface PunchStampProps {
  punch: Punch | null;
  /** Show a declined punch's reason under it. */
  showReason?: boolean;
}

/**
 * One punch as a table cell: stamped time + status badge, or an em dash.
 * Hovering a decided punch says who decided it and when.
 */
export default function PunchStamp({
  punch,
  showReason = false,
}: PunchStampProps) {
  if (!punch) return <span className="text-gray-400">—</span>;

  return (
    <div title={punchDecisionTitle(punch)} className="space-y-1">
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="font-medium text-gray-900">
          {formatPunchTime(punch.time)}
        </span>
        <StatusBadge
          label={PUNCH_STATUS_LABEL[punch.status]}
          variant={PUNCH_STATUS_VARIANT[punch.status]}
        />
      </div>
      {showReason && punch.status === "DECLINED" && punch.declineReason && (
        <p className="text-xs text-red-600 max-w-56">{punch.declineReason}</p>
      )}
    </div>
  );
}
