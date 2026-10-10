import {
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FolderOpen,
  Loader2,
} from "lucide-react";
import ViewDialog from "@/components/ui/ViewDialog";
import {
  ChecklistDocument,
  StudentDocumentChecklist,
} from "@/lib/api/documentApi";
import { DOCUMENT_TYPES } from "@/lib/api/studentPortalApi";
import { DOCUMENT_TYPE_LABEL } from "@/features/student-portal/components/documentType";
import { TOTAL_DOCUMENT_TYPES } from "../hooks/use-coordinator-documents";
import { optionalEstablishmentLabel } from "@/lib/establishment";

interface StudentDocumentsDialogProps {
  student: StudentDocumentChecklist | null;
  selectedIds: string[];
  allSelected: boolean;
  busyKey: string | null;
  onToggleSelected: (docId: string) => void;
  onToggleSelectAll: () => void;
  onViewFile: (doc: ChecklistDocument) => void;
  onDownloadFile: (doc: ChecklistDocument) => void;
  onDownloadSelected: () => void;
  onClose: () => void;
}

/**
 * One student's six requirements. Read-only apart from a download selection,
 * which costs nothing to lose — so `ViewDialog` (backdrop closes), not
 * `FormDialog`.
 */
export default function StudentDocumentsDialog({
  student,
  selectedIds,
  allSelected,
  busyKey,
  onToggleSelected,
  onToggleSelectAll,
  onViewFile,
  onDownloadFile,
  onDownloadSelected,
  onClose,
}: StudentDocumentsDialogProps) {
  const selectedCount = selectedIds.length;
  const submittedCount = student?.submittedCount ?? 0;

  return (
    <ViewDialog
      open={!!student}
      title={student ? `${student.name} — Documents` : "Documents"}
      icon={FolderOpen}
      onClose={onClose}
    >
      {student && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {student.studentIdNumber} ·{" "}
            {optionalEstablishmentLabel(student.establishment) ?? "No establishment"} ·{" "}
            <span className="font-semibold text-gray-700">
              {submittedCount} of {TOTAL_DOCUMENT_TYPES} submitted
            </span>
          </p>

          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {DOCUMENT_TYPES.map((type) => {
              const doc = student.documents[type];
              const label = DOCUMENT_TYPE_LABEL[type];
              return (
                <li
                  key={type}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3"
                >
                  <label
                    className={`flex items-start gap-3 flex-1 min-w-0 ${
                      doc ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-blue-600"
                      disabled={!doc}
                      checked={!!doc && selectedIds.includes(doc.id)}
                      onChange={() => doc && onToggleSelected(doc.id)}
                      aria-label={`Select ${label}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-gray-900 text-sm">
                        {doc ? (
                          <CheckCircle2
                            size={15}
                            className="text-green-600 shrink-0"
                          />
                        ) : (
                          <Circle
                            size={15}
                            className="text-gray-300 shrink-0"
                          />
                        )}
                        {label}
                      </div>
                      {doc ? (
                        <div className="text-xs text-gray-500 break-all">
                          {doc.fileName} · uploaded{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">
                          Not submitted
                        </div>
                      )}
                    </div>
                  </label>

                  {doc && (
                    <div className="flex gap-2 sm:shrink-0 pl-7 sm:pl-0">
                      <button
                        onClick={() => onViewFile(doc)}
                        disabled={!!busyKey}
                        className="px-2 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent inline-flex items-center gap-1 text-xs font-medium"
                        aria-label={`View ${label}`}
                      >
                        {busyKey === `view:${doc.id}` ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Eye size={14} />
                        )}
                        View
                      </button>
                      <button
                        onClick={() => onDownloadFile(doc)}
                        disabled={!!busyKey}
                        className="px-2 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent inline-flex items-center gap-1 text-xs font-medium"
                        aria-label={`Download ${label}`}
                      >
                        {busyKey === `file:${doc.id}` ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        Download
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5">
            <label
              className={`inline-flex items-center gap-2 text-sm text-gray-700 ${
                submittedCount === 0
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                disabled={submittedCount === 0}
                checked={allSelected}
                onChange={onToggleSelectAll}
              />
              Select all
            </label>

            <div className="flex gap-2 sm:ml-auto">
              <button
                onClick={onDownloadSelected}
                disabled={selectedCount === 0 || !!busyKey}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 disabled:cursor-not-allowed inline-flex items-center gap-2 text-sm font-medium"
              >
                {busyKey === "selected" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                Download selected ({selectedCount})
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ViewDialog>
  );
}
