import { BadgeCheck, Info } from "lucide-react";
import type { TemplateSheet } from "@/lib/api/evaluationTemplateApi";

interface PublishedSheetPanelProps {
  sheet: TemplateSheet | null;
}

/** A real instant, not a date-only column — shown in the viewer's own zone. */
function publishedOn(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

/**
 * The version supervisors are filling in right now, read-only.
 *
 * The paragraph under the heading is the point of the panel as much as the
 * sheet is: versioning only makes sense if the person about to publish knows
 * that old evaluations keep their own version.
 */
export default function PublishedSheetPanel({
  sheet,
}: PublishedSheetPanelProps) {
  if (!sheet) {
    return (
      <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-6 text-center">
        <p className="text-sm text-gray-500">
          No evaluation sheet has been published yet. Supervisors cannot write
          evaluations until one is.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BadgeCheck size={18} className="text-green-600 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-gray-800">
              Version {sheet.version} — live
            </div>
            <div className="text-xs text-gray-500">
              Published {publishedOn(sheet.publishedAt)} ·{" "}
              {sheet.sections.length} sections ·{" "}
              {sheet.sections.reduce((n, s) => n + s.items.length, 0)} items ·
              out of {sheet.maxTotalRating}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 mb-4 flex items-start gap-2">
        <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-900">
          Editing the sheet never changes it in place. Saving a draft and
          publishing it creates a <strong>new version</strong> and archives this
          one. Every evaluation already submitted keeps the version it was
          signed with — its wording, its items and the total it was scored out
          of stay exactly as they were, so past records never change.
        </p>
      </div>

      <div className="text-center border-b-2 border-gray-800 pb-2 mb-3">
        <h3 className="text-sm md:text-base font-bold tracking-wide text-gray-900">
          {sheet.title}
        </h3>
      </div>

      <div className="space-y-3">
        {sheet.sections.map((section) => (
          <div
            key={section.key}
            className="border border-gray-300 rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 bg-gray-800 text-white px-3 py-2">
              <h4 className="text-xs md:text-sm font-bold tracking-wide">
                {section.numeral}. {section.label}
              </h4>
              <span className="text-xs font-semibold shrink-0 tabular-nums">
                {section.maxPoints} POINTS
              </span>
            </div>
            <ul className="divide-y divide-gray-200">
              {section.items.map((item) => (
                <li key={item.key} className="px-3 py-2 text-sm text-gray-800">
                  <span className="font-semibold text-gray-500 mr-1.5">
                    {item.letter}.
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border-2 border-gray-800 px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-bold tracking-wide text-gray-900">
          TOTAL RATING
        </span>
        <span className="text-lg font-bold text-gray-900 tabular-nums">
          {sheet.maxTotalRating}
        </span>
      </div>
    </div>
  );
}
