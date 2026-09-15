import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import type { useEvaluationTemplate } from "../hooks/use-evaluation-template";

type Template = ReturnType<typeof useEvaluationTemplate>;

/**
 * A small square control for the repeating rows.
 *
 * `Button` is the page-level primitive — 48px tall and full width by default —
 * which is the wrong shape for three controls sitting beside an input, so the
 * row controls are plain buttons with an `aria-label`, the way `EvaluationForm`
 * uses bare inputs for its dense header row.
 */
function RowButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`w-9 h-9 shrink-0 rounded-md border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-gray-300 text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon size={16} />
    </button>
  );
}

/** The label inputs repeat per row, so they carry an aria-label, not a visible one. */
function RowInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  invalid,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  invalid: boolean;
  maxLength: number;
}) {
  return (
    <input
      type="text"
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      className={`w-full min-w-0 h-10 px-3 rounded-lg border bg-white text-sm text-gray-900 outline-none focus:ring-2 ${
        invalid
          ? "border-red-400 focus:ring-red-400"
          : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
      }`}
    />
  );
}

/**
 * The draft editor: the sheet as an ordered list of sections and items, with
 * the numerals, letters, section maximums and TOTAL RATING derived live as the
 * user types and reorders. Nothing here holds state — every value and handler
 * comes from `useEvaluationTemplate`.
 */
export default function DraftSheetEditor({
  template,
}: {
  template: Template;
}) {
  const {
    editor,
    preview,
    isDirty,
    error,
    limits,
    maxScore,
    isSaving,
    isPublishing,
    publishBlockedReason,
    setTitle,
    setSectionLabel,
    setItemLabel,
    addSection,
    addItem,
    removeSection,
    removeItem,
    moveSection,
    moveItem,
    handleSave,
    setConfirming,
  } = template;

  if (!editor || !preview) return null;

  const atSectionLimit = editor.sections.length >= limits.sectionsMax;
  const onlyOneSection = editor.sections.length <= limits.sectionsMin;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-blue-600 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-800">
            Draft — not yet live
          </h3>
        </div>
        <span
          className={`self-start sm:self-auto text-xs font-medium px-2.5 py-1 rounded-full ${
            isDirty
              ? "bg-amber-100 text-amber-800 border border-amber-300"
              : "bg-green-100 text-green-800 border border-green-300"
          }`}
        >
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </span>
      </div>

      <TextField
        label="Sheet title"
        value={editor.title}
        maxLength={limits.titleMax}
        onChange={(e) => {
          setTitle(e.target.value);
        }}
      />
      {preview.titleError && (
        <p className="text-xs text-red-600 -mt-2">{preview.titleError}</p>
      )}

      {/* Sections. Numerals and letters come from position, so a move renumbers
          everything below it on the spot. */}
      <div className="space-y-3">
        {preview.sections.map((section, sectionIndex) => {
          const onlyOneItem = section.items.length <= limits.itemsMin;
          return (
            <div
              key={section.uid}
              className="border border-gray-300 rounded-lg overflow-hidden"
            >
              <div className="bg-gray-800 px-3 py-2.5 flex flex-col md:flex-row md:items-center gap-2">
                <span className="text-white text-xs md:text-sm font-bold tabular-nums shrink-0 w-8">
                  {section.numeral}.
                </span>
                <RowInput
                  value={section.label}
                  onChange={(value) => {
                    setSectionLabel(section.uid, value);
                  }}
                  placeholder="Section name, e.g. WORK KNOWLEDGE"
                  ariaLabel={`Section ${section.numeral} name`}
                  invalid={section.error !== ""}
                  maxLength={limits.sectionLabelMax}
                />
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                  <span className="text-white text-xs font-semibold tabular-nums mr-1 whitespace-nowrap">
                    {section.items.length} × {maxScore} ={" "}
                    {section.maxPoints} POINTS
                  </span>
                  <RowButton
                    label="Move section up"
                    icon={ChevronUp}
                    disabled={sectionIndex === 0}
                    onClick={() => {
                      moveSection(section.uid, -1);
                    }}
                  />
                  <RowButton
                    label="Move section down"
                    icon={ChevronDown}
                    disabled={sectionIndex === preview.sections.length - 1}
                    onClick={() => {
                      moveSection(section.uid, 1);
                    }}
                  />
                  <RowButton
                    label="Delete section"
                    icon={Trash2}
                    danger
                    disabled={onlyOneSection}
                    onClick={() => {
                      removeSection(section.uid);
                    }}
                  />
                </div>
              </div>

              {section.error && (
                <p className="px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-red-200">
                  {section.error}
                </p>
              )}
              {onlyOneSection && (
                <p className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                  A sheet needs at least one section, so this one cannot be
                  deleted.
                </p>
              )}

              <ul className="divide-y divide-gray-200">
                {section.items.map((item, itemIndex) => (
                  <li key={item.uid} className="px-3 py-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 shrink-0 w-6 tabular-nums">
                        {item.letter}.
                      </span>
                      <RowInput
                        value={item.label}
                        onChange={(value) => {
                          setItemLabel(section.uid, item.uid, value);
                        }}
                        placeholder="What is being scored, e.g. Technical knowledge"
                        ariaLabel={`Section ${section.numeral} item ${item.letter}`}
                        invalid={item.error !== ""}
                        maxLength={limits.itemLabelMax}
                      />
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <RowButton
                          label="Move item up"
                          icon={ChevronUp}
                          disabled={itemIndex === 0}
                          onClick={() => {
                            moveItem(section.uid, item.uid, -1);
                          }}
                        />
                        <RowButton
                          label="Move item down"
                          icon={ChevronDown}
                          disabled={itemIndex === section.items.length - 1}
                          onClick={() => {
                            moveItem(section.uid, item.uid, 1);
                          }}
                        />
                        <RowButton
                          label="Delete item"
                          icon={Trash2}
                          danger
                          disabled={onlyOneItem}
                          onClick={() => {
                            removeItem(section.uid, item.uid);
                          }}
                        />
                      </div>
                    </div>
                    {item.error && (
                      <p className="mt-1 text-xs text-red-600 sm:ml-8">
                        {item.error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    addItem(section.uid);
                  }}
                  disabled={section.items.length >= limits.itemsMax}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-white text-blue-700 text-xs font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  Add item
                </button>
                {onlyOneItem && (
                  <span className="text-xs text-gray-500">
                    A section needs at least one item, so the last one cannot be
                    deleted.
                  </span>
                )}
                {section.items.length >= limits.itemsMax && (
                  <span className="text-xs text-gray-500">
                    Maximum {limits.itemsMax} items per section.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addSection}
          disabled={atSectionLimit}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 bg-white text-blue-700 text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          Add section
        </button>
        {atSectionLimit && (
          <span className="text-xs text-gray-500">
            Maximum {limits.sectionsMax} sections.
          </span>
        )}
      </div>

      {/* The new maximum, derived: every item at the top of the scale. */}
      <div className="rounded-lg border-2 border-gray-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <span className="text-sm md:text-base font-bold tracking-wide text-gray-900">
          TOTAL RATING
        </span>
        <span className="text-xl font-bold text-gray-900 tabular-nums">
          {preview.maxTotalRating}
          <span className="text-xs font-normal text-gray-500">
            {" "}
            ({preview.itemCount} items × {maxScore})
          </span>
        </span>
      </div>

      {preview.problems.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
          <div className="flex items-start gap-2 text-sm text-amber-900">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <span className="font-medium">
                {preview.problems.length} thing
                {preview.problems.length === 1 ? "" : "s"} to fix before this can
                be saved:
              </span>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                {preview.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Server errors land beside the buttons that caused them, not only in
          the snackbar, which is gone by the time the user looks back. */}
      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={() => {
            setConfirming("discard");
          }}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50"
        >
          <X size={16} />
          Discard draft
        </button>
        <div className="sm:w-44">
          <Button
            variant="secondary"
            icon={Save}
            loading={isSaving}
            disabled={!preview.isValid}
            onClick={() => {
              void handleSave();
            }}
          >
            Save draft
          </Button>
        </div>
        <div className="sm:w-44">
          <Button
            icon={Upload}
            loading={isPublishing}
            disabled={publishBlockedReason !== ""}
            onClick={() => {
              setConfirming("publish");
            }}
          >
            Publish
          </Button>
        </div>
      </div>
      {publishBlockedReason && (
        <p className="text-xs text-gray-500 text-right">
          Publish is unavailable: {publishBlockedReason}
        </p>
      )}
    </div>
  );
}
