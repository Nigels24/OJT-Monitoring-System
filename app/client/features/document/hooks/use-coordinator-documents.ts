import { useMemo, useState } from "react";
import {
  useGetCoordinatorDocumentsQuery,
  ChecklistDocument,
  StudentDocumentChecklist,
} from "@/lib/api/documentApi";
import { DOCUMENT_TYPES } from "@/lib/api/studentPortalApi";
import { downloadFile, openFileInNewTab } from "@/lib/api/fileDownload";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

const PAGE_SIZE = 10;

export const TOTAL_DOCUMENT_TYPES = DOCUMENT_TYPES.length;

export type CompletionFilter = "" | "COMPLETE" | "INCOMPLETE";

/** Value of the establishment filter that matches students with none. */
export const NO_ESTABLISHMENT = "__none__";

const filePath = (doc: ChecklistDocument) =>
  `/coordinator/documents/${doc.id}/download`;

const zipPath = (studentId: string, ids?: string[]) =>
  `/coordinator/students/${studentId}/documents/zip` +
  (ids && ids.length > 0
    ? `?ids=${ids.map(encodeURIComponent).join(",")}`
    : "");

/** The server names the archive the same way; used only if the header is unreadable. */
const zipFallbackName = (row: StudentDocumentChecklist) =>
  `${row.name} - OJT Documents.zip`;

export function useCoordinatorDocuments() {
  const { data, isLoading, isError } = useGetCoordinatorDocumentsQuery();
  const { showError } = useSnackbar();

  const [search, setSearch] = useState("");
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>("");
  const [establishmentFilter, setEstablishmentFilter] = useState("");
  const [page, setPage] = useState(1);

  // An id, not the row: the row is re-read from the query, so a refetch while
  // the dialog is open shows fresh data rather than a stale snapshot.
  const [viewStudentId, setViewStudentId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /**
   * The one transfer in flight — `view:<docId>`, `file:<docId>`,
   * `zip:<studentId>` or `selected` — so only the clicked button spins. One at
   * a time, like the evaluation PDF download.
   */
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  const establishmentOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) {
      if (r.establishment) byId.set(r.establishment.id, r.establishment.name);
    }
    const named = [...byId]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
    return [
      { value: "", label: "All Establishments" },
      ...named,
      { value: NO_ESTABLISHMENT, label: "No establishment" },
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      const complete = r.submittedCount >= TOTAL_DOCUMENT_TYPES;
      if (completionFilter === "COMPLETE" && !complete) return false;
      if (completionFilter === "INCOMPLETE" && complete) return false;

      if (establishmentFilter === NO_ESTABLISHMENT) {
        if (r.establishment) return false;
      } else if (
        establishmentFilter &&
        r.establishment?.id !== establishmentFilter
      ) {
        return false;
      }

      if (!term) return true;
      return [r.name, r.studentIdNumber, r.establishment?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [rows, search, completionFilter, establishmentFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const completeCount = rows.filter(
    (r) => r.submittedCount >= TOTAL_DOCUMENT_TYPES,
  ).length;
  const stats = {
    students: rows.length,
    complete: completeCount,
    incomplete: rows.length - completeCount,
  };

  const viewTarget = viewStudentId
    ? (rows.find((r) => r.id === viewStudentId) ?? null)
    : null;

  // Submitted documents of the open student, in enum order.
  const viewDocuments = viewTarget
    ? DOCUMENT_TYPES.map((t) => viewTarget.documents[t]).filter(
        (d): d is ChecklistDocument => d !== null,
      )
    : [];
  // A selected id whose file has since been deleted is dropped here, not
  // in an effect.
  const effectiveSelected = viewDocuments
    .filter((d) => selectedIds.has(d.id))
    .map((d) => d.id);
  const allSelected =
    viewDocuments.length > 0 &&
    effectiveSelected.length === viewDocuments.length;

  /** Every filter change starts back on page 1. */
  const withPageReset =
    <T>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const openView = (row: StudentDocumentChecklist) => {
    setViewStudentId(row.id);
    setSelectedIds(new Set());
  };
  const closeView = () => {
    setViewStudentId(null);
    setSelectedIds(new Set());
  };

  const toggleSelected = (docId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds(
      allSelected ? new Set() : new Set(viewDocuments.map((d) => d.id)),
    );

  /** Runs one transfer under `key`, reporting any failure in the snackbar. */
  const run = async (
    key: string,
    task: () => Promise<void>,
    fallback: string,
  ) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await task();
    } catch (err: unknown) {
      showError(err instanceof Error && err.message ? err.message : fallback);
    } finally {
      setBusyKey(null);
    }
  };

  // No `await` before openFileInNewTab: its window.open has to happen inside
  // the click's own task or the popup blocker stops it.
  const viewFile = (doc: ChecklistDocument) => {
    void run(
      `view:${doc.id}`,
      () => openFileInNewTab(filePath(doc)),
      "Could not open the file.",
    );
  };

  const downloadOne = (doc: ChecklistDocument) => {
    void run(
      `file:${doc.id}`,
      () => downloadFile(filePath(doc), doc.fileName),
      "Could not download the file.",
    );
  };

  /** Everything the student submitted — the ZIP route with no `ids`. */
  const downloadAll = (row: StudentDocumentChecklist) => {
    if (row.submittedCount === 0) return;
    void run(
      `zip:${row.id}`,
      () => downloadFile(zipPath(row.id), zipFallbackName(row)),
      "Could not download the documents.",
    );
  };

  /** One file goes as itself; two or more as a ZIP of just those. */
  const downloadSelected = () => {
    if (!viewTarget || effectiveSelected.length === 0) return;
    if (effectiveSelected.length === 1) {
      const doc = viewDocuments.find((d) => d.id === effectiveSelected[0]);
      if (!doc) return;
      void run(
        "selected",
        () => downloadFile(filePath(doc), doc.fileName),
        "Could not download the file.",
      );
      return;
    }
    void run(
      "selected",
      () =>
        downloadFile(
          zipPath(viewTarget.id, effectiveSelected),
          zipFallbackName(viewTarget),
        ),
      "Could not download the documents.",
    );
  };

  return {
    isLoading,
    isError,
    stats,
    search,
    completionFilter,
    establishmentFilter,
    establishmentOptions,
    page,
    paged,
    totalPages,
    filtered,
    viewTarget,
    selectedIds: effectiveSelected,
    allSelected,
    busyKey,

    setSearch: withPageReset(setSearch),
    setCompletionFilter: withPageReset(setCompletionFilter),
    setEstablishmentFilter: withPageReset(setEstablishmentFilter),
    setPage,

    openView,
    closeView,
    toggleSelected,
    toggleSelectAll,
    viewFile,
    downloadOne,
    downloadAll,
    downloadSelected,
  };
}
