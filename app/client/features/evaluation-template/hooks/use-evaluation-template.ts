import { useMemo, useState } from "react";
import {
  useGetEvaluationTemplateQuery,
  useSaveDraftMutation,
  usePublishDraftMutation,
  useDiscardDraftMutation,
} from "@/lib/api/evaluationTemplateApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
import {
  EditorSheet,
  LIMITS,
  buildPreview,
  fromSheet,
  newUid,
  serialize,
  toPayload,
} from "../sheet";

/** Only the top of the scale is needed locally; the served sheet carries it. */
const FALLBACK_MAX_SCORE = 5;

/**
 * The coordinator's evaluation-sheet editor.
 *
 * All state, derivation and handlers; the components take this object as props
 * and hold nothing of their own.
 *
 * **How the editor is seeded, and why it is not an effect.** The React Compiler
 * rules ban `setState` inside `useEffect` and ref writes during render
 * (CLAUDE.md §8 items 1 and 18), which rules out the obvious "copy the query
 * into state" effect. Two places seed it instead, both legal:
 *
 * - the *adjusting state when a value changes* pattern below, comparing the
 *   served draft's id against a mirrored state snapshot — this is what loads an
 *   existing draft on arrival, and what clears the editor after a publish or a
 *   discard;
 * - the event handlers, which seed from the published sheet on "Edit the
 *   sheet" and re-seed from each save's own response.
 *
 * Re-seeding from the save response matters: the server mints keys for rows
 * that were sent without one, and a second save that still lacked them would
 * add those rows all over again instead of editing them.
 */
export function useEvaluationTemplate() {
  const { showSuccess, showError } = useSnackbar();

  const { data, isLoading, isFetching, isError, refetch } =
    useGetEvaluationTemplateQuery();
  const [saveDraft, { isLoading: isSaving }] = useSaveDraftMutation();
  const [publishDraft, { isLoading: isPublishing }] = usePublishDraftMutation();
  const [discardDraft, { isLoading: isDiscarding }] = useDiscardDraftMutation();

  const published = data?.published ?? null;
  const draft = data?.draft ?? null;
  const maxScore = published?.maxScore ?? draft?.maxScore ?? FALLBACK_MAX_SCORE;

  const [editor, setEditor] = useState<EditorSheet | null>(null);
  /** What the server last confirmed, for the dirty check. */
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<"publish" | "discard" | null>(
    null,
  );

  // Adjusting state when a value changes, not an effect: the served draft's id
  // is mirrored in state, and when it differs the editor is reseeded from it
  // (or cleared, when a publish or discard leaves no draft). `undefined` means
  // "nothing mirrored yet", which is distinct from a real absence of draft.
  const draftId = draft?.templateId ?? null;
  const [trackedDraftId, setTrackedDraftId] = useState<string | null | undefined>(
    undefined,
  );
  if (draftId !== trackedDraftId) {
    setTrackedDraftId(draftId);
    const seeded = draft ? fromSheet(draft) : null;
    setEditor(seeded);
    setSavedSnapshot(seeded ? serialize(seeded) : "");
    setError("");
  }

  /* ---------- derived ---------- */

  const preview = useMemo(
    () => (editor ? buildPreview(editor, maxScore) : null),
    [editor, maxScore],
  );

  const isDirty = editor !== null && serialize(editor) !== savedSnapshot;
  const isEditing = editor !== null;

  /**
   * Why publish is unavailable, in the words the button needs. Empty when it
   * is available.
   */
  const publishBlockedReason = !isEditing
    ? "There is no draft to publish."
    : isDirty
      ? "Save the draft first."
      : preview && !preview.isValid
        ? "Fix the problems listed above first."
        : "";

  /* ---------- editing ---------- */

  /** Replaces one section, leaving the rest alone. */
  const mapSection = (
    sectionUid: string,
    fn: (section: EditorSheet["sections"][number]) => EditorSheet["sections"][number],
  ) => {
    setEditor((current) =>
      current === null
        ? current
        : {
            ...current,
            sections: current.sections.map((section) =>
              section.uid === sectionUid ? fn(section) : section,
            ),
          },
    );
  };

  const setTitle = (title: string) => {
    setEditor((current) => (current === null ? current : { ...current, title }));
  };

  const setSectionLabel = (sectionUid: string, label: string) => {
    mapSection(sectionUid, (section) => ({ ...section, label }));
  };

  const setItemLabel = (
    sectionUid: string,
    itemUid: string,
    label: string,
  ) => {
    mapSection(sectionUid, (section) => ({
      ...section,
      items: section.items.map((item) =>
        item.uid === itemUid ? { ...item, label } : item,
      ),
    }));
  };

  const addSection = () => {
    setEditor((current) =>
      current === null
        ? current
        : {
            ...current,
            sections: [
              ...current.sections,
              {
                uid: newUid(),
                label: "",
                items: [{ uid: newUid(), label: "" }],
              },
            ],
          },
    );
  };

  const addItem = (sectionUid: string) => {
    mapSection(sectionUid, (section) => ({
      ...section,
      items: [...section.items, { uid: newUid(), label: "" }],
    }));
  };

  /**
   * The last section and the last item in a section cannot go — the server
   * rejects both, so the buttons are disabled and the reason is printed beside
   * them rather than being discovered as a 400.
   */
  const removeSection = (sectionUid: string) => {
    setEditor((current) =>
      current === null || current.sections.length <= LIMITS.sectionsMin
        ? current
        : {
            ...current,
            sections: current.sections.filter(
              (section) => section.uid !== sectionUid,
            ),
          },
    );
  };

  const removeItem = (sectionUid: string, itemUid: string) => {
    mapSection(sectionUid, (section) =>
      section.items.length <= LIMITS.itemsMin
        ? section
        : {
            ...section,
            items: section.items.filter((item) => item.uid !== itemUid),
          },
    );
  };

  const moveSection = (sectionUid: string, direction: -1 | 1) => {
    setEditor((current) =>
      current === null
        ? current
        : { ...current, sections: move(current.sections, sectionUid, direction) },
    );
  };

  const moveItem = (
    sectionUid: string,
    itemUid: string,
    direction: -1 | 1,
  ) => {
    mapSection(sectionUid, (section) => ({
      ...section,
      items: move(section.items, itemUid, direction),
    }));
  };

  /* ---------- actions ---------- */

  /**
   * Starts a draft from the published sheet — a client-side copy, keys and all,
   * so every existing item stays the same item and keeps whatever scores refer
   * to it. Saved immediately, so a draft exists from the first click.
   */
  const startDraft = async () => {
    if (!published) return;
    setError("");
    const seeded = fromSheet(published);
    setEditor(seeded);
    try {
      const saved = await saveDraft(toPayload(seeded)).unwrap();
      const fresh = fromSheet(saved);
      setEditor(fresh);
      setSavedSnapshot(serialize(fresh));
      showSuccess(`Draft started from version ${published.version}.`);
    } catch (err: unknown) {
      const message = readError(err, "Could not start a draft.");
      setError(message);
      showError(message);
    }
  };

  const handleSave = async () => {
    if (!editor || !preview) return;
    setError("");
    if (!preview.isValid) {
      const message = "Fix the problems listed before saving.";
      setError(message);
      showError(message);
      return;
    }
    try {
      const saved = await saveDraft(toPayload(editor)).unwrap();
      // Re-seed from the response: rows that were new now have server keys,
      // and without them the next save would add them a second time.
      const fresh = fromSheet(saved);
      setEditor(fresh);
      setSavedSnapshot(serialize(fresh));
      showSuccess("Draft saved.");
    } catch (err: unknown) {
      const message = readError(err, "Could not save the draft.");
      setError(message);
      showError(message);
    }
  };

  const handlePublish = async () => {
    setError("");
    try {
      const result = await publishDraft().unwrap();
      setConfirming(null);
      // The editor is cleared by the mirrored-draft-id check once the
      // invalidated query comes back with no draft.
      showSuccess(
        `Version ${result.version} published — ${result.sections.length} sections, out of ${result.maxTotalRating}.`,
      );
    } catch (err: unknown) {
      setConfirming(null);
      const message = readError(err, "Could not publish the draft.");
      setError(message);
      showError(message);
    }
  };

  const handleDiscard = async () => {
    setError("");
    try {
      await discardDraft().unwrap();
      setConfirming(null);
      showSuccess("Draft discarded. The published sheet is unchanged.");
    } catch (err: unknown) {
      setConfirming(null);
      const message = readError(
        err,
        "Could not discard the draft.",
      );
      setError(message);
      showError(message);
      // A 404 means the draft is already gone — published or discarded in
      // another tab. Nothing was invalidated, so resync rather than leaving an
      // editor open on a draft the server no longer has.
      void refetch();
    }
  };

  return {
    published,
    draft,
    maxScore,
    isLoading,
    isFetching,
    isError,
    refetch,

    editor,
    preview,
    isEditing,
    isDirty,
    error,
    limits: LIMITS,

    isSaving,
    isPublishing,
    isDiscarding,
    publishBlockedReason,
    confirming,
    setConfirming,

    setTitle,
    setSectionLabel,
    setItemLabel,
    addSection,
    addItem,
    removeSection,
    removeItem,
    moveSection,
    moveItem,

    startDraft,
    handleSave,
    handlePublish,
    handleDiscard,
  };
}

/** Moves one row by uid, clamped at both ends. */
function move<T extends { uid: string }>(
  rows: T[],
  uid: string,
  direction: -1 | 1,
): T[] {
  const index = rows.findIndex((row) => row.uid === uid);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}
