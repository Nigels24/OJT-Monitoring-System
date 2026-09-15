/**
 * The filled-in evaluation sheet, as a printable PDF.
 *
 * **Everything printed here comes from the evaluation that was passed in**, and
 * that row carries its own template version: its sections, item wording,
 * printed letters, numerals and `maxTotalRating` were all frozen when the
 * supervisor signed it (`withSectionTotals` in `supervisor.service.ts` rebuilds
 * them from *that* version). So a sheet signed on version 1 downloads as
 * version 1's items out of 95 however many versions have been published since.
 * Nothing in this file may look up the *published* template, and nothing here
 * may touch the database — it is given a row and returns bytes, the same
 * division as `attendance-hours.ts` and `evaluation-scoring.ts`.
 *
 * The document is built into a Buffer and returned whole. Piping PDFKit
 * straight at the response would mean a failure halfway through arrives as a
 * 200 with a truncated file — and a coordinator forwarding that to a student
 * has no way to tell it apart from a good one.
 */
import PDFDocument from 'pdfkit';
import { SCHOOL_NAME } from './school';
import { MAX_SCORE, MIN_SCORE, SCORE_LABELS } from './evaluation-scoring';

/* ---------------------------------------------------------------------------
 * Input. Structural, not Prisma types: this takes the shape
 * `coordinator.service.ts` already returns.
 * ------------------------------------------------------------------------ */

export interface EvaluationPdfItem {
  letter: string;
  label: string;
  score: number;
}

export interface EvaluationPdfSection {
  numeral: string;
  label: string;
  maxPoints: number;
  total: number;
  items: readonly EvaluationPdfItem[];
}

export interface EvaluationPdfData {
  /** The version this sheet was signed on, and the title it was printed under. */
  templateVersion: number;
  templateTitle: string;
  sections: readonly EvaluationPdfSection[];
  totalRating: number;
  /** Frozen with the version — never a constant, never 95 by assumption. */
  maxTotalRating: number;
  trainingStartedAt: Date | string | null;
  trainingEndedAt: Date | string | null;
  trainingEmployedAt: string | null;
  evaluatorName: string | null;
  evaluatorPosition: string | null;
  comments: string | null;
  recommendations: string | null;
  createdAt: Date | string;
  student: {
    studentIdNumber: string;
    course: string | null;
    user: { name: string };
    establishment: { name: string } | null;
  };
}

/* ---------------------------------------------------------------------------
 * Dates. Two different rules, and mixing them prints the wrong day.
 * ------------------------------------------------------------------------ */

/**
 * A date-only column (`trainingStartedAt`/`trainingEndedAt`), which is stored
 * as UTC midnight of the intended day — so it must be read back in UTC, the
 * same rule as `formatDateOnly` in `common/dates.ts` and on the client.
 */
function printDateOnly(value: Date | string | null, fallback = '—'): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** A real instant (`createdAt`), which belongs in the school's own zone. */
function printInstant(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

/** `2026-09-14` in Manila — the date part of the download's filename. */
function manilaDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'undated';
  // en-CA is ISO-shaped (YYYY-MM-DD), which is what sorts in a downloads folder.
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

/* ---------------------------------------------------------------------------
 * Filename
 * ------------------------------------------------------------------------ */

/** ASCII, no spaces, no separators — safe in a Content-Disposition and on disk. */
function asciiSlug(value: string, fallback: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

/**
 * `Evaluation-Nicko-N-Balboa-v1-2026-09-14.pdf` — who, which version of the
 * sheet, and when it was signed, so a folder of these is readable without
 * opening them.
 *
 * Mirrored on the client (`use-evaluation-download.ts`) for the case where the
 * browser cannot read Content-Disposition; keep the two in step.
 */
export function evaluationPdfFilename(data: EvaluationPdfData): string {
  const name = asciiSlug(data.student.user.name, 'Trainee');
  return `Evaluation-${name}-v${data.templateVersion}-${manilaDateKey(data.createdAt)}.pdf`;
}

/* ---------------------------------------------------------------------------
 * Layout constants
 * ------------------------------------------------------------------------ */

const MARGIN = 50;
/** Reserved strip at the foot of every page for the version + page number. */
const FOOTER_SPACE = 28;
const LETTER_WIDTH = 18;
const SCORE_WIDTH = 28;
const COLUMN_GAP = 10;
const ROW_GAP = 4;
const SECTION_GAP = 12;

const INK = '#111827';
const MUTED = '#6b7280';
const RULE = '#d1d5db';

/* ---------------------------------------------------------------------------
 * Render
 * ------------------------------------------------------------------------ */

/**
 * Renders the sheet and resolves with the finished document.
 *
 * Paginates: the item count is a property of the template version, so nothing
 * here may assume the original nineteen items fit one page. A section that will
 * not fit in the space left starts on the next page instead of being split
 * across the break — unless it is taller than a whole page, where splitting is
 * the only option.
 */
export function renderEvaluationPdf(data: EvaluationPdfData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    // Pages are held open so the "Page X of Y" footer can be written once the
    // total is known.
    bufferPages: true,
    info: {
      Title: `${data.templateTitle} — ${data.student.user.name}`,
      Author: SCHOOL_NAME,
    },
  });

  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const contentWidth = doc.page.width - MARGIN * 2;
  const labelWidth = contentWidth - LETTER_WIDTH - SCORE_WIDTH - COLUMN_GAP;

  /** The lowest y content may reach before it has to move to a new page. */
  const bottomLimit = () => doc.page.height - MARGIN - FOOTER_SPACE;

  const ensureSpace = (needed: number) => {
    const usable = doc.page.height - MARGIN * 2 - FOOTER_SPACE;
    // A block taller than a whole page cannot be kept together; let it flow.
    if (needed > usable) return;
    if (doc.y + needed > bottomLimit()) doc.addPage();
  };

  const rule = () => {
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(doc.page.width - MARGIN, doc.y)
      .strokeColor(RULE)
      .lineWidth(0.5)
      .stroke();
    doc.y += 8;
  };

  /* -------- letterhead -------- */

  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(SCHOOL_NAME, MARGIN, MARGIN, {
      width: contentWidth,
      align: 'center',
    });
  doc.moveDown(0.3);
  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .text(data.templateTitle.toUpperCase(), {
      width: contentWidth,
      align: 'center',
    });
  doc.moveDown(0.8);
  rule();

  /* -------- header block -------- */

  /** One labelled blank, in a half-width column. */
  const field = (label: string, value: string, column: 0 | 1, top: number) => {
    const width = (contentWidth - COLUMN_GAP) / 2;
    const x = MARGIN + column * (width + COLUMN_GAP);
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(label.toUpperCase(), x, top, { width });
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(INK)
      .text(value || '—', x, doc.y, { width });
    return doc.y;
  };

  const fieldRow = (left: [string, string], right: [string, string]) => {
    const top = doc.y;
    const leftBottom = field(left[0], left[1], 0, top);
    const rightBottom = field(right[0], right[1], 1, top);
    doc.y = Math.max(leftBottom, rightBottom) + 8;
  };

  fieldRow(
    ['Name of the Trainee', data.student.user.name],
    ['Student ID', data.student.studentIdNumber],
  );
  fieldRow(
    ['Course', data.student.course ?? '—'],
    [
      'Training Employed at',
      // The snapshot first: it is what the sheet was signed with, and the
      // student may have been moved or unassigned since.
      data.trainingEmployedAt ?? data.student.establishment?.name ?? '—',
    ],
  );
  fieldRow(
    ['Training Date Started', printDateOnly(data.trainingStartedAt)],
    ['Training Date Ended', printDateOnly(data.trainingEndedAt)],
  );

  /* -------- the printed 1-5 legend -------- */

  const legend = [MAX_SCORE, 4, 3, 2, MIN_SCORE]
    .map((value) => `${value} ${SCORE_LABELS[value]}`)
    .join('    ');

  const legendTop = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
  const legendHeight =
    doc.heightOfString(legend, { width: contentWidth - 16 }) + 12;
  doc
    .roundedRect(MARGIN, legendTop, contentWidth, legendHeight, 3)
    .fillAndStroke('#f9fafb', RULE);
  doc.fillColor(INK).text(legend, MARGIN + 8, legendTop + 6, {
    width: contentWidth - 16,
    align: 'center',
  });
  doc.y = legendTop + legendHeight + SECTION_GAP;

  /* -------- sections -------- */

  /** How tall one item's row is, wrapping included. */
  const itemHeight = (item: EvaluationPdfItem) => {
    doc.font('Helvetica').fontSize(9.5);
    return doc.heightOfString(item.label, { width: labelWidth }) + ROW_GAP;
  };

  for (const section of data.sections) {
    const headingHeight = 20;
    const bodyHeight = section.items.reduce(
      (sum, item) => sum + itemHeight(item),
      0,
    );
    ensureSpace(headingHeight + bodyHeight + SECTION_GAP);

    const headingTop = doc.y;
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(INK)
      .text(`${section.numeral}. ${section.label}`, MARGIN, headingTop, {
        width: contentWidth - 90,
      });
    // The label's own bottom, captured before the total is drawn: the total
    // is always one line, so reading doc.y after it would clip a heading that
    // wrapped.
    const headingBottom = doc.y;
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(
        `${section.total} / ${section.maxPoints}`,
        doc.page.width - MARGIN - 90,
        headingTop,
        {
          width: 90,
          align: 'right',
        },
      );
    doc.y = Math.max(headingBottom, headingTop + 14);
    rule();

    for (const item of section.items) {
      const top = doc.y;
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor(MUTED)
        .text(`${item.letter}.`, MARGIN, top, { width: LETTER_WIDTH });
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(INK)
        .text(item.label, MARGIN + LETTER_WIDTH, top, { width: labelWidth });
      const rowBottom = doc.y;
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(String(item.score), doc.page.width - MARGIN - SCORE_WIDTH, top, {
          width: SCORE_WIDTH,
          align: 'right',
        });
      doc.y = rowBottom + ROW_GAP;
    }

    doc.y += SECTION_GAP - ROW_GAP;
  }

  /* -------- total -------- */

  ensureSpace(34);
  const totalTop = doc.y;
  doc
    .roundedRect(MARGIN, totalTop, contentWidth, 26, 3)
    .fillAndStroke('#eef2ff', '#c7d2fe');
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(INK)
    .text('TOTAL RATING', MARGIN + 10, totalTop + 8, {
      width: contentWidth / 2,
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(
      `${data.totalRating} / ${data.maxTotalRating}`,
      doc.page.width - MARGIN - 110,
      totalTop + 7,
      { width: 100, align: 'right' },
    );
  doc.y = totalTop + 26 + SECTION_GAP;

  /* -------- free text, printed only when there is any -------- */

  const prose = (heading: string, body: string | null) => {
    const text = body?.trim();
    // An empty heading over blank space reads as a form nobody finished; a
    // sheet with no comments simply has no Comments block.
    if (!text) return;
    doc.font('Helvetica').fontSize(9.5);
    const height = doc.heightOfString(text, { width: contentWidth }) + 22;
    ensureSpace(height);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text(heading.toUpperCase(), MARGIN, doc.y, { width: contentWidth });
    doc.y += 2;
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(INK)
      .text(text, MARGIN, doc.y, { width: contentWidth });
    doc.y += SECTION_GAP;
  };

  prose('Comments', data.comments);
  prose('Recommendations', data.recommendations);

  /* -------- signature block -------- */

  ensureSpace(70);
  doc.y += 8;
  const signTop = doc.y;
  const signWidth = (contentWidth - COLUMN_GAP) / 2;

  // The snapshots, not the supervisor's current row: a rename or a departure
  // must not rewrite a sheet that was already signed.
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(INK)
    .text(data.evaluatorName ?? '—', MARGIN, signTop, { width: signWidth });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('EVALUATED BY', MARGIN, doc.y + 1, { width: signWidth });

  const leftBottom = doc.y;
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(INK)
    .text(
      data.evaluatorPosition ?? '—',
      MARGIN + signWidth + COLUMN_GAP,
      signTop,
      {
        width: signWidth,
      },
    );
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('POSITION', MARGIN + signWidth + COLUMN_GAP, doc.y + 1, {
      width: signWidth,
    });

  doc.y = Math.max(leftBottom, doc.y) + 10;
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(`Date evaluated: ${printInstant(data.createdAt)}`, MARGIN, doc.y, {
      width: contentWidth,
    });

  /* -------- footer, once the page count is known -------- */

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    // Writing into the bottom margin would otherwise flow onto a new page —
    // which would then need a footer of its own, and so on.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        `Evaluation sheet version ${data.templateVersion}  ·  Page ${index + 1} of ${range.count}`,
        MARGIN,
        doc.page.height - MARGIN + 10,
        { width: contentWidth, align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = bottomMargin;
  }

  doc.end();
  return finished;
}
