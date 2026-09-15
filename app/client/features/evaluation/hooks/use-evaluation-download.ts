import { useState } from "react";
import {
  Evaluation,
  useLazyDownloadEvaluationPdfQuery,
} from "@/lib/api/evaluationApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

/**
 * Downloading a submitted evaluation as a PDF.
 *
 * All of it happens in the event handler — fetch, object URL, click, revoke —
 * which is also what keeps it clear of the React Compiler's rules about state
 * and refs (CLAUDE.md §8 item 18). Nothing here is an effect.
 *
 * `downloadingId` is the row being generated, so the list can spin that one
 * button rather than every one of them.
 */
export function useEvaluationDownload() {
  const { showError } = useSnackbar();
  const [trigger] = useLazyDownloadEvaluationPdfQuery();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadEvaluation = async (evaluation: Evaluation) => {
    // One at a time: the button for the running row is disabled, and a second
    // row's click while it runs would leave the first spinner stranded.
    if (downloadingId) return;
    setDownloadingId(evaluation.id);
    try {
      const { blob, filename } = await trigger(evaluation.id).unwrap();
      saveBlob(blob, filename ?? evaluationPdfFilename(evaluation));
    } catch (err: unknown) {
      // No success message — the file arriving is the feedback. A failure has
      // nothing visible at all, so it has to say so.
      showError(readError(err, "Could not download the evaluation sheet."));
    } finally {
      setDownloadingId(null);
    }
  };

  return { downloadingId, downloadEvaluation };
}

/** Hands the blob to the browser as a save, then lets go of the object URL. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same tick can cancel the save in some browsers; the next
  // one is late enough for the download to have started and early enough that
  // the blob is not held for the life of the page.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * The same name the server builds in `common/evaluation-pdf.ts`, for the case
 * where the browser cannot read Content-Disposition (an older proxy dropping
 * the CORS exposure, say). Keep the two in step.
 */
function evaluationPdfFilename(evaluation: Evaluation): string {
  const name =
    evaluation.student.user.name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "Trainee";
  // Manila, explicitly: the server names the file by the school's own calendar
  // day, and a viewer in another zone must not produce a different name.
  const date = new Date(evaluation.createdAt).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  return `Evaluation-${name}-v${evaluation.templateVersion}-${date}.pdf`;
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}
