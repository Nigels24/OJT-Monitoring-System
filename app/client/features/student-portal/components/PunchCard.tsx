import {
  Info,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Save,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import type { PunchKind, TodayAttendance } from "@/lib/api/studentPortalApi";
import {
  DAY_STATUS_LABEL,
  DAY_STATUS_VARIANT,
  PUNCH_STATUS_LABEL,
  PUNCH_STATUS_VARIANT,
  SESSIONS,
  formatPunchTime,
} from "@/lib/attendance";
import { formatDateOnly } from "@/lib/format";

interface PunchCardProps {
  today: TodayAttendance | undefined;
  isLoading: boolean;
  isError: boolean;
  blockedReason: string | null;
  noticeMessage?: string;
  punchingKind: PunchKind | null;
  remarksDraft: string;
  remarksDirty: boolean;
  isSavingRemarks: boolean;
  onPunch: (kind: PunchKind) => void;
  onRemarksChange: (value: string) => void;
  onSaveRemarks: () => void;
}

/**
 * Today's four punches as a 2×2 grid. Every enabled/disabled state and every
 * reason shown here is the server's `allowed` verdict, rendered as is.
 */
export default function PunchCard({
  today,
  isLoading,
  isError,
  blockedReason,
  noticeMessage,
  punchingKind,
  remarksDraft,
  remarksDirty,
  isSavingRemarks,
  onPunch,
  onRemarksChange,
  onSaveRemarks,
}: PunchCardProps) {
  if (isLoading) return <p className="text-gray-400 text-sm">Loading...</p>;
  if (isError || !today) {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t load today&apos;s attendance. Please refresh to try again.
      </p>
    );
  }

  const anyPunching = punchingKind !== null;

  const tile = (kind: PunchKind, label: string) => {
    const punch = today.punches[kind];
    const verdict = today.allowed[kind];
    const canPunch = verdict === true && !anyPunching;
    const busy = punchingKind === kind;
    // Under a block every verdict is the same sentence, already shown once
    // above the grid — don't repeat it four times.
    const reason = verdict === true || blockedReason ? null : verdict;

    return (
      <div
        key={kind}
        className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col gap-2 min-h-28"
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>

        {punch ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-semibold text-gray-900">
                {formatPunchTime(punch.time)}
              </span>
              <StatusBadge
                label={PUNCH_STATUS_LABEL[punch.status]}
                variant={PUNCH_STATUS_VARIANT[punch.status]}
              />
            </div>
            {punch.status === "DECLINED" && (
              <>
                {punch.declineReason && (
                  <p className="text-xs text-red-600">
                    <span className="font-medium">Declined:</span>{" "}
                    {punch.declineReason}
                  </p>
                )}
                {verdict === true ? (
                  <button
                    type="button"
                    onClick={() => onPunch(kind)}
                    disabled={!canPunch}
                    className="mt-auto inline-flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    Punch again
                  </button>
                ) : (
                  reason && <p className="text-xs text-gray-500">{reason}</p>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onPunch(kind)}
              disabled={!canPunch}
              className="mt-auto inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {label}
            </button>
            {reason && <p className="text-xs text-gray-500">{reason}</p>}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-gray-600">{formatDateOnly(today.date)}</p>
        {today.dayStatus && (
          <StatusBadge
            label={DAY_STATUS_LABEL[today.dayStatus]}
            variant={DAY_STATUS_VARIANT[today.dayStatus]}
          />
        )}
      </div>

      {blockedReason && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Info size={16} className="shrink-0 mt-0.5" />
          {blockedReason}
        </p>
      )}
      {noticeMessage && (
        <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Info size={16} className="shrink-0 mt-0.5" />
          {noticeMessage}
        </p>
      )}

      {SESSIONS.map((session) => (
        <div key={session.label}>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            {session.label}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {tile(session.inKind, "Time In")}
            {tile(session.outKind, "Time Out")}
          </div>
        </div>
      ))}

      <div className="space-y-3">
        <TextArea
          label="Remarks"
          labelIcon={MessageSquareText}
          value={remarksDraft}
          onChange={(e) => onRemarksChange(e.target.value)}
          placeholder="Optional note about today, e.g. tasks you worked on"
          rows={3}
          maxLength={500}
          disabled={!!blockedReason}
        />
        <div className="sm:w-44">
          <Button
            type="button"
            icon={Save}
            variant="secondary"
            loading={isSavingRemarks}
            disabled={!remarksDirty || !!blockedReason}
            onClick={onSaveRemarks}
          >
            Save remarks
          </Button>
        </div>
      </div>
    </div>
  );
}
