import { DocumentType } from '../../generated/prisma/client';

/**
 * The six OJT requirements, in the order the checklist prints them. Read from
 * the Prisma enum rather than redeclared, so the schema stays the single list.
 */
export const DOCUMENT_TYPES = Object.values(DocumentType);

/**
 * Human labels, used for fallback filenames and ZIP entry names. The client
 * keeps its own copy for the dropdown and table headers — the two projects
 * share no code — so keep them in step.
 */
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  APPLICATION_LETTER: 'Application Letter',
  ENDORSEMENT_LETTER: 'Endorsement Letter',
  RESUME: 'Resume',
  MOA: 'MOA',
  PARENTS_CONSENT: 'Parents Consent',
  WAIVER: 'Waiver',
};

/** `documents/<id>/<uuid>.pdf` -> `.pdf`; `''` when the path has none. */
export function fileExtension(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot).toLowerCase();
}

/**
 * The name a document is shown and downloaded under.
 *
 * Rows migrated from the old Credential table have no `originalFileName`
 * (it was never stored), so they fall back to `<Type Label>.<ext>`, with the
 * extension recovered from the storage path.
 */
export function documentFileName(doc: {
  type: DocumentType;
  originalFileName: string | null;
  fileUrl: string;
}): string {
  return (
    doc.originalFileName ??
    `${DOCUMENT_TYPE_LABEL[doc.type]}${fileExtension(doc.fileUrl)}`
  );
}

/**
 * Strips the characters Windows, macOS and ZIP tools refuse in a filename, so
 * a student named "A/B" cannot produce an entry that unpacks into a folder.
 */
export function safeFileName(name: string): string {
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'file'
  );
}

/**
 * A `Content-Disposition: attachment` value that survives non-ASCII names.
 *
 * Unlike the evaluation PDF's filename (ASCII by construction), these come
 * from student names and the student's own files. `filename=` carries an
 * ASCII-only fallback for old clients; `filename*=` (RFC 5987) carries the
 * real UTF-8 name, and every current browser prefers it.
 */
export function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
