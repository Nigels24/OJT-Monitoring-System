/**
 * One student's monthly Daily Time Record, as a one-page PDF in the style of
 * Civil Service Form No. 48.
 *
 * A pure renderer, like `evaluation-pdf.ts`: it is given plain data and
 * returns bytes, and never touches the database or computes hours. The caller
 * (`CoordinatorService.getStudentDtr`) decides which punches are printable
 * (APPROVED only) and supplies the total from `common/attendance-hours.ts`, so
 * the hours rule exists in exactly one place. A later batch ZIP can call this
 * once per student unchanged.
 *
 * Layout decisions:
 * - one copy per page (Form 48 is often printed two-up; that is not done here);
 * - one row per real calendar day of the month — 28 to 31 rows;
 * - an APPROVED punch is printed even when its partner is not approved, but
 *   the total counts only complete approved sessions (the caller's number);
 * - Undertime columns are left blank: there are no official hours to measure
 *   against;
 * - every position is computed up front, so the page can never overflow onto a
 *   second one; long text is shrunk, then truncated, to fit its box.
 *
 * Built into a Buffer and returned whole, for the same reason as the
 * evaluation PDF: a failure must be an error, never a truncated 200.
 */
import PDFDocument from 'pdfkit';

/** The four punches of one day, as real instants; `null` = not printed. */
export interface DtrDay {
  /** Day of the month, 1-31. */
  day: number;
  amArrival: Date | null;
  amDeparture: Date | null;
  pmArrival: Date | null;
  pmDeparture: Date | null;
}

export interface DtrPdfData {
  studentName: string;
  schoolName: string;
  course: string | null;
  /** `null` prints a blank. */
  establishmentName: string | null;
  /** `null` prints a blank signature line. */
  supervisorName: string | null;
  year: number;
  /** 1-12 */
  month: number;
  /** Any subset of the month's days, in any order; missing days print blank. */
  days: readonly DtrDay[];
  /** Approved hours from complete sessions only, already rounded. */
  totalApprovedHours: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 28-31: the real length of the month (Feb 29 in leap years). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const MANILA_CLOCK = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Manila',
});

/**
 * A punch as Form 48 writes it: 12-hour `h:mm` in Manila, no AM/PM — the
 * column already says which half of the day it is.
 */
export function formatDtrTime(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return '';
  const parts = MANILA_CLOCK.formatToParts(value);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  return `${hour}:${minute}`;
}

/** "15.5" / "8" — the total as the rest of the app prints hours. */
export function formatDtrHours(hours: number): string {
  return String(hours);
}

/* ---------------------------------------------------------------------------
 * Layout — LETTER, every y fixed in advance so the page cannot overflow.
 * ------------------------------------------------------------------------ */

const MARGIN = 40;
/**
 * The document's own bottom margin is tiny on purpose: every element is placed
 * at a fixed y below, and PDFKit adds a page whenever text is written past the
 * bottom margin. The real bottom edge of the layout is `MARGIN`, enforced by
 * the arithmetic here (31 rows end ~735pt on a 792pt page), not by PDFKit.
 */
const DOC_BOTTOM_MARGIN = 8;
const INK = '#111827';
const MUTED = '#4b5563';
const RULE = '#374151';
const LIGHT_RULE = '#9ca3af';

/** Day | AM Arr | AM Dep | PM Arr | PM Dep | UT Hours | UT Minutes */
const COLUMN_WIDTHS = [44, 92, 92, 92, 92, 60, 60];
const ROW_HEIGHT = 13.5;
const HEADER_ROW_HEIGHT = 15;

export function renderDtrPdf(data: DtrPdfData): Promise<Buffer> {
  const monthName = MONTH_NAMES[data.month - 1] ?? '';
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: {
      top: MARGIN,
      bottom: DOC_BOTTOM_MARGIN,
      left: MARGIN,
      right: MARGIN,
    },
    info: {
      Title: `Daily Time Record — ${data.studentName} — ${monthName} ${data.year}`,
      Author: data.schoolName,
    },
  });

  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = MARGIN;
  const contentWidth = doc.page.width - MARGIN * 2; // 532 on LETTER
  const right = left + contentWidth;

  /**
   * Draws `text` inside a fixed box on one line: shrinks the font down to
   * `minSize`, then truncates with an ellipsis. Never wraps, never moves the
   * cursor past the box — which is what keeps the page count at one.
   */
  const fitText = (
    text: string,
    x: number,
    y: number,
    width: number,
    opts: {
      size: number;
      minSize?: number;
      font?: string;
      align?: 'left' | 'center' | 'right';
      color?: string;
    },
  ) => {
    const font = opts.font ?? 'Helvetica';
    const minSize = opts.minSize ?? opts.size;
    doc.font(font);
    let size = opts.size;
    doc.fontSize(size);
    while (size > minSize && doc.widthOfString(text) > width) {
      size -= 0.5;
      doc.fontSize(size);
    }
    let shown = text;
    if (doc.widthOfString(shown) > width) {
      while (shown.length > 1 && doc.widthOfString(`${shown}…`) > width) {
        shown = shown.slice(0, -1);
      }
      shown = `${shown.trimEnd()}…`;
    }
    doc.fillColor(opts.color ?? INK).text(shown, x, y, {
      width,
      align: opts.align ?? 'left',
      lineBreak: false,
    });
  };

  const hLine = (y: number, x1 = left, x2 = right, color = RULE, w = 0.75) => {
    doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(w).stroke();
  };
  const vLine = (x: number, y1: number, y2: number, color = RULE, w = 0.75) => {
    doc.moveTo(x, y1).lineTo(x, y2).strokeColor(color).lineWidth(w).stroke();
  };

  /* -------- title block -------- */

  let y = MARGIN;
  fitText('Civil Service Form No. 48', left, y, contentWidth, {
    size: 7.5,
    font: 'Helvetica-Oblique',
    color: MUTED,
  });
  y += 14;
  fitText('DAILY TIME RECORD', left, y, contentWidth, {
    size: 15,
    font: 'Helvetica-Bold',
    align: 'center',
  });
  y += 19;
  fitText(data.schoolName, left, y, contentWidth, {
    size: 9,
    minSize: 7,
    align: 'center',
    color: MUTED,
  });
  y += 20;

  // The name on its own underlined line, as on the paper form.
  fitText(data.studentName, left + 60, y, contentWidth - 120, {
    size: 12,
    minSize: 7,
    font: 'Helvetica-Bold',
    align: 'center',
  });
  y += 15;
  hLine(y, left + 60, right - 60, INK, 0.75);
  y += 2;
  fitText('(Name)', left, y, contentWidth, {
    size: 7.5,
    align: 'center',
    color: MUTED,
  });
  y += 16;

  /** "Label: value" in a half-width column, value shrunk to fit. */
  const labelled = (label: string, value: string, x: number, width: number) => {
    doc.font('Helvetica').fontSize(8.5);
    const labelText = `${label}:`;
    const labelWidth = doc.widthOfString(labelText) + 4;
    fitText(labelText, x, y, labelWidth, { size: 8.5, color: MUTED });
    fitText(value, x + labelWidth, y, width - labelWidth, {
      size: 9,
      minSize: 6.5,
      font: 'Helvetica-Bold',
    });
    hLine(y + 11, x + labelWidth, x + width, LIGHT_RULE, 0.5);
  };

  const half = (contentWidth - 16) / 2;
  labelled('For the month of', `${monthName} ${data.year}`, left, half);
  labelled('Course', data.course ?? '', left + half + 16, half);
  y += 17;
  labelled('Establishment', data.establishmentName ?? '', left, half);
  labelled('Supervisor', data.supervisorName ?? '', left + half + 16, half);
  y += 22;

  /* -------- grid header (two levels) -------- */

  const xs: number[] = [left];
  for (const w of COLUMN_WIDTHS) xs.push(xs[xs.length - 1] + w);

  const gridTop = y;
  const headMid = gridTop + HEADER_ROW_HEIGHT;
  const headBottom = headMid + HEADER_ROW_HEIGHT;

  doc
    .rect(left, gridTop, contentWidth, headBottom - gridTop)
    .fillColor('#f3f4f6')
    .fill();

  const headCell = (
    text: string,
    x1: number,
    x2: number,
    top: number,
    height: number,
  ) =>
    fitText(text, x1 + 2, top + (height - 8) / 2, x2 - x1 - 4, {
      size: 7.5,
      minSize: 6,
      font: 'Helvetica-Bold',
      align: 'center',
    });

  headCell('Day', xs[0], xs[1], gridTop, HEADER_ROW_HEIGHT * 2);
  headCell('A.M.', xs[1], xs[3], gridTop, HEADER_ROW_HEIGHT);
  headCell('P.M.', xs[3], xs[5], gridTop, HEADER_ROW_HEIGHT);
  headCell('UNDERTIME', xs[5], xs[7], gridTop, HEADER_ROW_HEIGHT);
  ['Arrival', 'Departure', 'Arrival', 'Departure', 'Hours', 'Minutes'].forEach(
    (label, i) =>
      headCell(label, xs[i + 1], xs[i + 2], headMid, HEADER_ROW_HEIGHT),
  );

  /* -------- day rows -------- */

  const count = daysInMonth(data.year, data.month);
  const byDay = new Map(data.days.map((d) => [d.day, d]));
  const rowsTop = headBottom;

  for (let day = 1; day <= count; day++) {
    const top = rowsTop + (day - 1) * ROW_HEIGHT;
    const entry = byDay.get(day);
    const textY = top + (ROW_HEIGHT - 8.5) / 2;
    fitText(String(day), xs[0], textY, COLUMN_WIDTHS[0], {
      size: 8.5,
      align: 'center',
    });
    const times = entry
      ? [entry.amArrival, entry.amDeparture, entry.pmArrival, entry.pmDeparture]
      : [null, null, null, null];
    times.forEach((time, i) => {
      const text = formatDtrTime(time);
      if (text) {
        fitText(text, xs[i + 1], textY, COLUMN_WIDTHS[i + 1], {
          size: 8.5,
          align: 'center',
        });
      }
    });
    // Undertime (xs[5]..xs[7]) is deliberately left blank.
    hLine(top + ROW_HEIGHT, left, right, LIGHT_RULE, 0.4);
  }

  const rowsBottom = rowsTop + count * ROW_HEIGHT;
  const totalBottom = rowsBottom + ROW_HEIGHT + 2;

  /* -------- total row -------- */

  fitText(
    'TOTAL APPROVED HOURS (complete sessions only)',
    xs[0] + 6,
    rowsBottom + (ROW_HEIGHT + 2 - 8.5) / 2,
    xs[3] - xs[0] - 12,
    { size: 8.5, minSize: 7, font: 'Helvetica-Bold' },
  );
  fitText(
    `${formatDtrHours(data.totalApprovedHours)} hrs`,
    xs[3],
    rowsBottom + (ROW_HEIGHT + 2 - 9) / 2,
    xs[5] - xs[3],
    { size: 9, font: 'Helvetica-Bold', align: 'center' },
  );

  /* -------- grid rules, drawn last so they sit on top of the header fill --- */

  doc
    .rect(left, gridTop, contentWidth, totalBottom - gridTop)
    .strokeColor(RULE)
    .lineWidth(0.9)
    .stroke();
  hLine(headMid, xs[1], xs[7]); // under A.M. / P.M. / UNDERTIME
  hLine(headBottom);
  hLine(rowsBottom, left, right, RULE, 0.9);
  // Group boundaries (Day | A.M. | P.M. | UNDERTIME) run from the top; the
  // Arrival/Departure and Hours/Minutes splits start under the group label.
  for (const i of [1, 3, 5]) vLine(xs[i], gridTop, rowsBottom);
  for (const i of [2, 4, 6]) vLine(xs[i], headMid, rowsBottom);
  // The total row: label over Day..A.M., value over P.M., Undertime blank.
  vLine(xs[3], rowsBottom, totalBottom);
  vLine(xs[5], rowsBottom, totalBottom);

  /* -------- certification and signatures -------- */

  y = totalBottom + 9;
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(INK)
    .text(
      'I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.',
      left,
      y,
      { width: contentWidth, align: 'justify' },
    );
  y += 36;

  const signWidth = 220;
  // Trainee
  fitText(data.studentName, right - signWidth, y - 11, signWidth, {
    size: 9,
    minSize: 6.5,
    font: 'Helvetica-Bold',
    align: 'center',
  });
  hLine(y, right - signWidth, right, INK, 0.75);
  fitText('Signature of Trainee', right - signWidth, y + 2, signWidth, {
    size: 7.5,
    align: 'center',
    color: MUTED,
  });
  y += 18;

  fitText(
    'VERIFIED as to the prescribed office hours:',
    left,
    y,
    contentWidth,
    {
      size: 8,
    },
  );
  y += 26;

  // Supervisor — the line stays, blank, when there is none.
  if (data.supervisorName) {
    fitText(data.supervisorName, right - signWidth, y - 11, signWidth, {
      size: 9,
      minSize: 6.5,
      font: 'Helvetica-Bold',
      align: 'center',
    });
  }
  hLine(y, right - signWidth, right, INK, 0.75);
  fitText('In-Charge', right - signWidth, y + 2, signWidth, {
    size: 7.5,
    align: 'center',
    color: MUTED,
  });

  // Footnote, pinned above the bottom margin.
  fitText(
    'Only supervisor-approved time records are shown. Times are Philippine time (Asia/Manila).',
    left,
    doc.page.height - MARGIN - 9,
    contentWidth,
    { size: 6.5, color: MUTED, align: 'center' },
  );

  doc.end();
  return finished;
}
