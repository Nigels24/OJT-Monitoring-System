import { Eye, FileWarning } from "lucide-react";

interface FileLinkProps {
  /** Signed URL, or `null` when the stored object is missing. */
  href: string | null;
  /** Names the file in the unavailable state's tooltip and aria-label. */
  label: string;
}

/**
 * Opens a stored file, or explains why it can't be opened.
 *
 * The API returns `fileUrl: null` when the object behind a row has gone
 * missing, so that one row degrades instead of the whole list failing. Without
 * this the link would render `href={null}` and navigate to the current page.
 */
export default function FileLink({ href, label }: FileLinkProps) {
  if (!href) {
    return (
      <span
        title={`The stored file for "${label}" is missing. Ask your coordinator to re-upload it.`}
        aria-label={`File for ${label} is unavailable`}
        className="px-2 py-1.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 inline-flex items-center gap-1 text-xs font-medium cursor-not-allowed"
      >
        <FileWarning size={14} />
        Unavailable
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="px-2 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1 text-xs font-medium"
    >
      <Eye size={14} />
      View
    </a>
  );
}
