"use client";

import { PencilLine } from "lucide-react";
import FormDialog from "@/components/ui/FormDialog";
import EvaluationForm, { EvaluationFormProps } from "./EvaluationForm";
import { SupervisorStudent } from "@/lib/api/supervisorApi";
import type { EvaluationSheet } from "@/lib/api/evaluationApi";

/**
 * The same sheet the page's card renders, in a modal.
 *
 * Everything but the chrome comes from `EvaluationForm` — the form text, the
 * radio groups and the running totals have one implementation, not two. The
 * draft behind `form` is the hook's *edit* draft, separate from the card's, so
 * opening this never touches a half-filled new evaluation.
 */
interface EvaluationEditDialogProps {
  open: boolean;
  sheet: EvaluationSheet | undefined;
  sheetLoading: boolean;
  students: SupervisorStudent[];
  form: Omit<EvaluationFormProps, "sheet" | "sheetLoading" | "students">;
  onClose: () => void;
}

export default function EvaluationEditDialog({
  open,
  sheet,
  sheetLoading,
  students,
  form,
  onClose,
}: EvaluationEditDialogProps) {
  return (
    <FormDialog
      open={open}
      title="Edit Evaluation"
      subtitle={
        form.traineeName
          ? `Submitted sheet for ${form.traineeName}`
          : "Submitted sheet"
      }
      icon={PencilLine}
      onClose={onClose}
    >
      <EvaluationForm
        sheet={sheet}
        sheetLoading={sheetLoading}
        students={students}
        {...form}
      />
    </FormDialog>
  );
}
