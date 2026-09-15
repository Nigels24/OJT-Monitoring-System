import { FilePlus2, Star } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SectionError from "@/components/ui/SectionError";
import PublishedSheetPanel from "./PublishedSheetPanel";
import DraftSheetEditor from "./DraftSheetEditor";
import type { useEvaluationTemplate } from "../hooks/use-evaluation-template";

/**
 * The coordinator's evaluation-sheet editor: what is live, and what is next.
 *
 * Presentational — every value and handler comes from `useEvaluationTemplate`,
 * passed whole the way `MessagingView` takes `useMessaging`.
 */
export default function EvaluationSheetTab(
  template: ReturnType<typeof useEvaluationTemplate>,
) {
  const {
    published,
    preview,
    isLoading,
    isFetching,
    isError,
    refetch,
    isEditing,
    isSaving,
    isDiscarding,
    isPublishing,
    error,
    confirming,
    setConfirming,
    startDraft,
    handlePublish,
    handleDiscard,
  } = template;

  if (isError) {
    return (
      <Card>
        <SectionError
          label="The evaluation sheet"
          onRetry={() => {
            void refetch();
          }}
          retrying={isFetching}
        />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm text-gray-400">Loading the evaluation sheet…</p>
      </Card>
    );
  }

  const nextVersion = published ? published.version + 1 : 1;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Star size={18} className="text-blue-600" />
          The sheet supervisors are filling in
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          The official on-the-job training performance evaluation sheet, as
          published.
        </p>
        <PublishedSheetPanel sheet={published} />
      </Card>

      <Card>
        {isEditing ? (
          <DraftSheetEditor template={template} />
        ) : (
          <div className="text-center py-4">
            <FilePlus2 size={28} className="mx-auto text-blue-600 mb-2" />
            <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1">
              Change the sheet
            </h2>
            <p className="text-xs text-gray-500 mb-4 max-w-md mx-auto">
              Starts a draft from version {published?.version ?? 1}, with every
              section and item copied across. Nothing changes for supervisors
              until you publish it.
            </p>
            {error && (
              <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}
            <div className="sm:w-56 mx-auto">
              <Button
                icon={FilePlus2}
                loading={isSaving}
                disabled={!published}
                onClick={() => {
                  void startDraft();
                }}
              >
                Edit the sheet
              </Button>
            </div>
            {!published && (
              <p className="text-xs text-gray-500 mt-2">
                There is no published sheet to copy from.
              </p>
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirming === "publish"}
        title={`Publish version ${nextVersion}?`}
        message={
          `This becomes the live sheet every supervisor fills in from now on` +
          (preview
            ? `, with ${preview.sections.length} sections and ${preview.itemCount} items, out of ${preview.maxTotalRating}`
            : "") +
          `. Version ${published?.version ?? 1} is archived, and a published version can never be edited — further changes mean another version. Evaluations already submitted are unaffected: each keeps the version it was signed with.`
        }
        confirmLabel={isPublishing ? "Publishing…" : "Yes, publish it"}
        icon={Star}
        onConfirm={() => {
          void handlePublish();
        }}
        onCancel={() => {
          setConfirming(null);
        }}
      />

      <ConfirmDialog
        open={confirming === "discard"}
        title="Discard this draft?"
        message={
          preview
            ? `The draft — ${preview.sections.length} sections, ${preview.itemCount} items — is deleted and cannot be recovered. Version ${published?.version ?? 1} stays live and unchanged, along with every evaluation already submitted.`
            : "The draft is deleted and cannot be recovered."
        }
        confirmLabel={isDiscarding ? "Discarding…" : "Yes, discard it"}
        variant="danger"
        onConfirm={() => {
          void handleDiscard();
        }}
        onCancel={() => {
          setConfirming(null);
        }}
      />
    </div>
  );
}
