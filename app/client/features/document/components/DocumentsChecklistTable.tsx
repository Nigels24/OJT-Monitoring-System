import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  Loader2,
} from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import SearchInput from "@/components/ui/SearchInput";
import SelectField from "@/components/ui/SelectField";
import { StudentDocumentChecklist } from "@/lib/api/documentApi";
import { DOCUMENT_TYPES, DocumentType } from "@/lib/api/studentPortalApi";
import { DOCUMENT_TYPE_LABEL } from "@/features/student-portal/components/documentType";
import {
  CompletionFilter,
  TOTAL_DOCUMENT_TYPES,
} from "../hooks/use-coordinator-documents";

interface DocumentsChecklistTableProps {
  rows: StudentDocumentChecklist[];
  isLoading: boolean;
  isError: boolean;
  search: string;
  completionFilter: CompletionFilter;
  establishmentFilter: string;
  establishmentOptions: { value: string; label: string }[];
  page: number;
  totalPages: number;
  busyKey: string | null;
  onSearchChange: (value: string) => void;
  onCompletionFilterChange: (value: CompletionFilter) => void;
  onEstablishmentFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onView: (row: StudentDocumentChecklist) => void;
  onDownloadAll: (row: StudentDocumentChecklist) => void;
}

/** Six type columns have to fit a laptop; the full label is the header tooltip. */
const SHORT_LABEL: Record<DocumentType, string> = {
  APPLICATION_LETTER: "App. Letter",
  ENDORSEMENT_LETTER: "Endorsement",
  RESUME: "Resume",
  MOA: "MOA",
  PARENTS_CONSENT: "Parents' Consent",
  WAIVER: "Waiver",
};

const COMPLETION_OPTIONS = [
  { label: "All Students", value: "" },
  {
    label: `Complete (${TOTAL_DOCUMENT_TYPES}/${TOTAL_DOCUMENT_TYPES})`,
    value: "COMPLETE",
  },
  { label: "Incomplete", value: "INCOMPLETE" },
];

export default function DocumentsChecklistTable({
  rows,
  isLoading,
  isError,
  search,
  completionFilter,
  establishmentFilter,
  establishmentOptions,
  page,
  totalPages,
  busyKey,
  onSearchChange,
  onCompletionFilterChange,
  onEstablishmentFilterChange,
  onPageChange,
  onView,
  onDownloadAll,
}: DocumentsChecklistTableProps) {
  const typeColumns: DataTableColumn<StudentDocumentChecklist>[] =
    DOCUMENT_TYPES.map((type) => ({
      key: type,
      label: SHORT_LABEL[type],
      headerTitle: DOCUMENT_TYPE_LABEL[type],
      render: (r) => {
        const doc = r.documents[type];
        return doc ? (
          <span
            title={`${doc.fileName} · uploaded ${new Date(doc.uploadedAt).toLocaleDateString()}`}
            className="inline-flex"
          >
            <CheckCircle2 size={18} className="text-green-600" />
            <span className="sr-only">
              {DOCUMENT_TYPE_LABEL[type]} submitted
            </span>
          </span>
        ) : (
          <span title="Not submitted" className="inline-flex">
            <Circle size={18} className="text-gray-300" />
            <span className="sr-only">
              {DOCUMENT_TYPE_LABEL[type]} not submitted
            </span>
          </span>
        );
      },
    }));

  const columns: DataTableColumn<StudentDocumentChecklist>[] = [
    {
      key: "student",
      label: "Student",
      render: (r) => (
        <div className="min-w-40">
          <div className="font-semibold text-gray-900">{r.name}</div>
          <div className="text-xs text-gray-500">{r.studentIdNumber}</div>
          <div className="text-xs text-gray-400">
            {r.establishment?.name ?? "No establishment"}
          </div>
        </div>
      ),
    },
    ...typeColumns,
    {
      key: "submitted",
      label: "Submitted",
      render: (r) => {
        const complete = r.submittedCount >= TOTAL_DOCUMENT_TYPES;
        return (
          <span
            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
              complete
                ? "bg-green-100 text-green-700"
                : r.submittedCount === 0
                  ? "bg-gray-100 text-gray-500"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {r.submittedCount}/{TOTAL_DOCUMENT_TYPES}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => {
        const zipping = busyKey === `zip:${r.id}`;
        const none = r.submittedCount === 0;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => onView(r)}
              className="px-2 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap"
              aria-label={`View documents for ${r.name}`}
            >
              <Eye size={14} />
              View
            </button>
            <button
              onClick={() => onDownloadAll(r)}
              disabled={none || !!busyKey}
              title={none ? "Nothing submitted yet" : undefined}
              className="px-2 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap"
              aria-label={`Download all documents for ${r.name}`}
            >
              {zipping ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Download all
            </button>
          </div>
        );
      },
    },
  ];

  const filtersActive =
    search.trim() !== "" ||
    completionFilter !== "" ||
    establishmentFilter !== "";

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by student, ID number or establishment..."
            aria-label="Search students"
          />
        </div>
        <div className="lg:w-52">
          <SelectField
            value={completionFilter}
            onChange={(value) =>
              onCompletionFilterChange(value as CompletionFilter)
            }
            options={COMPLETION_OPTIONS}
            className="w-full"
          />
        </div>
        <div className="lg:w-60">
          <SelectField
            value={establishmentFilter}
            onChange={onEstablishmentFilterChange}
            options={establishmentOptions}
            className="w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : isError ? (
        <p className="text-red-600 text-sm py-8 text-center">
          Couldn&apos;t load documents. Please refresh to try again.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          {filtersActive
            ? "No students match your filters."
            : "No students yet."}
        </p>
      ) : (
        <>
          <DataTable
            title=""
            icon={FileText}
            columns={columns}
            data={rows}
            keyField="id"
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                disabled={page === 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className="p-2 rounded-md border border-gray-300 text-gray-500 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => onPageChange(n)}
                  className={`w-9 h-9 rounded-md text-sm font-medium ${
                    n === page
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className="p-2 rounded-md border border-gray-300 text-gray-500 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
