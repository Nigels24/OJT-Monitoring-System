import { AlertTriangle, RotateCw } from "lucide-react";

interface SectionErrorProps {
  /** What could not be loaded, in the reader's words. */
  label: string;
  onRetry: () => void;
  retrying?: boolean;
}

/**
 * Inline notice for one section of a page that failed to load.
 *
 * The dashboards return `failedSections` and empty defaults instead of a 500,
 * so a single broken query degrades to this banner rather than blanking the
 * whole screen. Retry refetches the page's query — the other sections keep the
 * data they already have.
 */
export default function SectionError({
  label,
  onRetry,
  retrying = false,
}: SectionErrorProps) {
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-start gap-2 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <span>
          <span className="font-semibold">{label}</span> could not be loaded.
          The rest of this page is up to date.
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-amber-800 text-xs font-medium hover:bg-amber-100 disabled:opacity-60 inline-flex items-center gap-1.5"
      >
        <RotateCw size={13} className={retrying ? "animate-spin" : ""} />
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
