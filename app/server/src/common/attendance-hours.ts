import type {
  AttendanceStatus,
  PunchKind,
} from '../../generated/prisma/client';

/**
 * Hours, day status and punch ordering — the one place that turns a day's
 * `AttendancePunch` rows into anything a person reads.
 *
 * A day (`Attendance`) holds up to four punches, each approved or declined by
 * a supervisor on its own. A **session** (AM or PM) counts toward hours only
 * when BOTH its In and Out punches are APPROVED; nothing else ever does.
 */

/** Enum order, which is also the order a day is lived in. */
export const PUNCH_KINDS = [
  'TIME_IN_AM',
  'TIME_OUT_AM',
  'TIME_IN_PM',
  'TIME_OUT_PM',
] as const satisfies readonly PunchKind[];

export const PUNCH_LABEL: Record<PunchKind, string> = {
  TIME_IN_AM: 'Time In (AM)',
  TIME_OUT_AM: 'Time Out (AM)',
  TIME_IN_PM: 'Time In (PM)',
  TIME_OUT_PM: 'Time Out (PM)',
};

const SESSIONS = [
  { inKind: 'TIME_IN_AM', outKind: 'TIME_OUT_AM' },
  { inKind: 'TIME_IN_PM', outKind: 'TIME_OUT_PM' },
] as const;

/**
 * What every reader of a punch selects. `decidedBy` is narrowed to a name —
 * never a bare relation include, which would return every column of a row
 * that leads to `User` (CLAUDE.md §8 item 16).
 */
export const PUNCH_SELECT = {
  id: true,
  kind: true,
  time: true,
  status: true,
  declineReason: true,
  decidedAt: true,
  decidedBy: { select: { id: true, user: { select: { name: true } } } },
} as const;

/** A day with its punches, as the student and supervisor lists read it. */
export const DAY_SELECT = {
  id: true,
  date: true,
  remarks: true,
  createdAt: true,
  punches: { select: PUNCH_SELECT },
} as const;

/** Just enough to compute hours. */
export const HOURS_PUNCH_SELECT = {
  kind: true,
  time: true,
  status: true,
} as const;

/** The least a punch must carry for anything in this module. */
export interface PunchLike {
  kind: PunchKind;
  time: Date;
  status: AttendanceStatus;
}

/**
 * Derived, never stored. In precedence order:
 * - PENDING    — any punch awaits a decision
 * - PARTIAL    — something was declined, but at least one session is approved
 * - DECLINED   — something was declined and no session is approved
 * - APPROVED   — every punch approved, at least one complete session
 * - INCOMPLETE — nothing pending or declined, but no complete session
 *                (an In with no Out yet, or a day with only remarks)
 */
export type DayStatus =
  'PENDING' | 'PARTIAL' | 'DECLINED' | 'APPROVED' | 'INCOMPLETE';

const MS_PER_HOUR = 1000 * 60 * 60;

/** Every kind as a key, `null` where nothing was punched. */
export function punchMap<P extends PunchLike>(
  punches: readonly P[],
): Record<PunchKind, P | null> {
  const map = {
    TIME_IN_AM: null,
    TIME_OUT_AM: null,
    TIME_IN_PM: null,
    TIME_OUT_PM: null,
  } as Record<PunchKind, P | null>;
  for (const punch of punches) map[punch.kind] = punch;
  return map;
}

function span(start: Date, end: Date): number {
  // Out is always stamped after In on a live punch, but migrated or re-punched
  // rows carry no such guarantee — never let a pair go negative.
  return Math.max(0, end.getTime() - start.getTime()) / MS_PER_HOUR;
}

function sessions<P extends PunchLike>(punches: readonly P[]) {
  const map = punchMap(punches);
  return SESSIONS.map(({ inKind, outKind }) => ({
    timeIn: map[inKind],
    timeOut: map[outKind],
  }));
}

const isApprovedPair = (s: {
  timeIn: PunchLike | null;
  timeOut: PunchLike | null;
}) => s.timeIn?.status === 'APPROVED' && s.timeOut?.status === 'APPROVED';

/** True when at least one session has both punches APPROVED. */
export function hasApprovedSession(punches: readonly PunchLike[]): boolean {
  return sessions(punches).some(isApprovedPair);
}

/** Hours that count: sessions with both punches APPROVED. Unrounded. */
export function approvedHoursForDay(punches: readonly PunchLike[]): number {
  return sessions(punches)
    .filter(isApprovedPair)
    .reduce((acc, s) => acc + span(s.timeIn!.time, s.timeOut!.time), 0);
}

/**
 * Hours that may still count: both punches present, neither DECLINED, but not
 * both APPROVED yet. Unrounded.
 */
export function pendingHoursForDay(punches: readonly PunchLike[]): number {
  return sessions(punches)
    .filter(
      (s) =>
        s.timeIn &&
        s.timeOut &&
        s.timeIn.status !== 'DECLINED' &&
        s.timeOut.status !== 'DECLINED' &&
        !isApprovedPair(s),
    )
    .reduce((acc, s) => acc + span(s.timeIn!.time, s.timeOut!.time), 0);
}

export function dayStatus(punches: readonly PunchLike[]): DayStatus {
  if (punches.some((p) => p.status === 'PENDING')) return 'PENDING';
  const approvedSession = hasApprovedSession(punches);
  if (punches.some((p) => p.status === 'DECLINED')) {
    return approvedSession ? 'PARTIAL' : 'DECLINED';
  }
  return approvedSession ? 'APPROVED' : 'INCOMPLETE';
}

export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

/**
 * Everything a reader of one day needs: the punches keyed by kind, the derived
 * status and both hour figures, rounded. Spread it over the day's own fields.
 */
export function summarizeDay<P extends PunchLike>(punches: readonly P[]) {
  return {
    punches: punchMap(punches),
    dayStatus: dayStatus(punches),
    approvedHours: roundHours(approvedHoursForDay(punches)),
    pendingHours: roundHours(pendingHoursForDay(punches)),
  };
}

/**
 * Approved hours across many days, rounded to two decimals. Callers may
 * pre-filter punches to APPROVED in the query — unapproved punches never
 * contribute, so it changes nothing but the rows fetched.
 */
export function totalApprovedHours(
  days: readonly { punches: readonly PunchLike[] }[],
): number {
  return roundHours(
    days.reduce((acc, d) => acc + approvedHoursForDay(d.punches), 0),
  );
}

/**
 * The latest day with at least one approved session (In and Out both
 * APPROVED — `hasApprovedSession`), or `null` when there is none. This is the
 * evaluation sheet's Training Date Ended: the last day that counted, never
 * today. Like `totalApprovedHours`, callers may pre-filter to APPROVED punches.
 */
export function lastApprovedDay(
  days: readonly { date: Date; punches: readonly PunchLike[] }[],
): Date | null {
  let latest: Date | null = null;
  for (const day of days) {
    if (!hasApprovedSession(day.punches)) continue;
    if (!latest || day.date > latest) latest = day.date;
  }
  return latest;
}

/** Pending hours across many days, rounded to two decimals. */
export function totalPendingHours(
  days: readonly { punches: readonly PunchLike[] }[],
): number {
  return roundHours(
    days.reduce((acc, d) => acc + pendingHoursForDay(d.punches), 0),
  );
}

/**
 * Whether each kind may be punched now, given the day's punches so far:
 * `true`, or the reason it may not — shown to the student verbatim, so the
 * client holds no copy of these rules.
 *
 * Sessions are strictly sequential, which together with the server stamping
 * every time is what keeps In < Out and AM < PM without comparing clocks:
 * - An Out needs its In, and that In must not be DECLINED.
 * - PM In is blocked while the AM session is open (an AM In that isn't
 *   declined, with no Out that isn't declined).
 * - Once a PM In that isn't declined exists, the morning is closed.
 * - A PENDING or APPROVED punch is final for the day.
 * - A DECLINED punch may be punched again — overwriting it — unless that
 *   would break the order: an In can't be redone once its Out stands.
 *
 * `blockedReason` (a completed OJT, no establishment, before the start date)
 * blocks every kind.
 */
export function punchAvailability(
  punches: readonly PunchLike[],
  blockedReason: string | null,
): Record<PunchKind, true | string> {
  const map = punchMap(punches);
  const stands = (kind: PunchKind) =>
    map[kind] !== null && map[kind].status !== 'DECLINED';

  const check = (kind: PunchKind): true | string => {
    if (blockedReason) return blockedReason;
    const existing = map[kind];
    if (existing && existing.status !== 'DECLINED') {
      return `${PUNCH_LABEL[kind]} is already recorded for today.`;
    }

    const isAm = kind === 'TIME_IN_AM' || kind === 'TIME_OUT_AM';
    if (isAm && stands('TIME_IN_PM')) {
      return 'The afternoon session has started; morning punches are closed.';
    }

    switch (kind) {
      case 'TIME_IN_AM':
        if (stands('TIME_OUT_AM')) {
          return `${PUNCH_LABEL.TIME_OUT_AM} is already recorded, so ${PUNCH_LABEL.TIME_IN_AM} can't be redone.`;
        }
        return true;
      case 'TIME_OUT_AM':
        return outRule('TIME_IN_AM');
      case 'TIME_IN_PM':
        if (stands('TIME_IN_AM') && !stands('TIME_OUT_AM')) {
          return `Record ${PUNCH_LABEL.TIME_OUT_AM} first to close your morning session.`;
        }
        if (stands('TIME_OUT_PM')) {
          return `${PUNCH_LABEL.TIME_OUT_PM} is already recorded, so ${PUNCH_LABEL.TIME_IN_PM} can't be redone.`;
        }
        return true;
      case 'TIME_OUT_PM':
        return outRule('TIME_IN_PM');
    }
  };

  const outRule = (inKind: PunchKind): true | string => {
    const timeIn = map[inKind];
    if (!timeIn) return `Record ${PUNCH_LABEL[inKind]} first.`;
    if (timeIn.status === 'DECLINED') {
      return `${PUNCH_LABEL[inKind]} was declined. Record it again first.`;
    }
    return true;
  };

  return {
    TIME_IN_AM: check('TIME_IN_AM'),
    TIME_OUT_AM: check('TIME_OUT_AM'),
    TIME_IN_PM: check('TIME_IN_PM'),
    TIME_OUT_PM: check('TIME_OUT_PM'),
  };
}
