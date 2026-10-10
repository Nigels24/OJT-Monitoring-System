import { Users, X } from "lucide-react";
import StudentForm from "./StudentForm";
import { Student, StudentStatus } from "@/lib/api/studentApi";
import { Establishment } from "@/lib/api/establishmentApi";
import type {
  StudentForm as StudentFormValues,
  StudentPlacement,
} from "../hooks/use-students";
import Overlay from "@/components/ui/Overlay";

/**
 * Edits a student. There is no create mode: students are created by their
 * establishment's supervisor (`/supervisor/students`).
 */
interface StudentEditDialogProps {
  form: StudentFormValues;
  /** The student being edited; `null` = closed. */
  editTarget: Student | null;
  isUpdating: boolean;
  error: string;
  establishments: Establishment[];
  /** The offered courses, plus an edited student's "(old)" value if any. */
  courseOptions: { label: string; value: string }[];
  placement: StudentPlacement | null;
  statusOptions: StudentStatus[];
  setField: (
    key: keyof StudentFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function StudentEditDialog({
  form,
  editTarget,
  isUpdating,
  error,
  establishments,
  courseOptions,
  placement,
  statusOptions,
  setField,
  onSubmit,
  onClose,
}: StudentEditDialogProps) {
  if (!editTarget) return null;

  return (
    <Overlay
      open
      label="Edit Student"
      onClose={onClose}
      closeOnBackdrop={false}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              Edit Student
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <StudentForm
            form={form}
            editTarget={editTarget}
            isUpdating={isUpdating}
            error={error}
            establishments={establishments}
            courseOptions={courseOptions}
            placement={placement}
            statusOptions={statusOptions}
            setField={setField}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </Overlay>
  );
}
