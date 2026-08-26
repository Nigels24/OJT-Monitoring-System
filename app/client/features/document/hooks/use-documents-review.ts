import { useMemo, useState } from "react";
import {
  useGetDocumentsQuery,
  useReviewDocumentMutation,
  CoordinatorDocument,
} from "@/lib/api/documentApi";
import type { DocumentStatus } from "@/lib/api/studentPortalApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

const PAGE_SIZE = 10;

export function useDocumentsReview() {
  // Defaults to PENDING: this screen exists to clear the review queue, not to
  // browse everything ever uploaded.
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">(
    "PENDING",
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<CoordinatorDocument | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  // Tracks which row is mid-request so only that row's buttons disable.
  const [actioningId, setActioningId] = useState<string | null>(null);

  const { showSuccess, showError } = useSnackbar();

  const { data: documents, isLoading, isError } = useGetDocumentsQuery();
  const [reviewDocument, { isLoading: isRejecting }] =
    useReviewDocumentMutation();

  const filtered = useMemo(() => {
    const all = documents ?? [];
    const byStatus = statusFilter
      ? all.filter((d) => d.status === statusFilter)
      : all;

    const term = search.trim().toLowerCase();
    if (!term) return byStatus;
    return byStatus.filter((d) =>
      [
        d.name,
        d.student.user.name,
        d.student.studentIdNumber,
        d.student.establishment?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [documents, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pendingCount = (documents ?? []).filter((d) => d.status === "PENDING")
    .length;

  const handleApprove = async (doc: CoordinatorDocument) => {
    setActioningId(doc.id);
    try {
      await reviewDocument({ id: doc.id, status: "APPROVED" }).unwrap();
      showSuccess(`Approved "${doc.name}".`);
    } catch (err: unknown) {
      showError(readError(err, "Failed to approve document."));
    } finally {
      setActioningId(null);
    }
  };

  const openReject = (doc: CoordinatorDocument) => {
    setRejectTarget(doc);
    setRejectReason("");
    setRejectError("");
  };

  const closeReject = () => {
    setRejectTarget(null);
    setRejectReason("");
    setRejectError("");
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;

    // Mirrors the server's MinLength(3); a bare "no" helps nobody.
    if (rejectReason.trim().length < 3) {
      setRejectError("Give the student a reason so they know what to fix.");
      return;
    }

    try {
      await reviewDocument({
        id: rejectTarget.id,
        status: "REJECTED",
        reviewNote: rejectReason.trim(),
      }).unwrap();
      showSuccess(`Rejected "${rejectTarget.name}".`);
      closeReject();
    } catch (err: unknown) {
      const message = readError(err, "Failed to reject document.");
      setRejectError(message);
      showError(message);
    }
  };

  return {
    documents,
    isLoading,
    isError,
    statusFilter,
    search,
    page,
    paged,
    totalPages,
    filtered,
    pendingCount,
    rejectTarget,
    rejectReason,
    rejectError,
    isRejecting,
    actioningId,

    setStatusFilter,
    setSearch,
    setPage,
    setRejectReason,

    handleApprove,
    openReject,
    closeReject,
    handleRejectConfirm,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}
