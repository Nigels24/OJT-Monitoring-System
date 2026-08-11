import { Users, X } from "lucide-react";
import StudentForm from "./StudentForm";
import { Student, StudentStatus } from "@/lib/api/studentApi";
import { Establishment } from "@/lib/api/establishmentApi";
import type { StudentForm as StudentFormValues } from "../hooks/use-students";

interface StudentEditDialogProps {
  open: boolean;
  form: StudentFormValues;
  editTarget: Student | null;
  isCreating: boolean;
  isUpdating: boolean;
  error: string;
  establishments: Establishment[];
  courseOptions: string[];
  yearLevelOptions: string[];
  statusOptions: StudentStatus[];
  setField: (
    key: keyof StudentFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function StudentEditDialog({
  open,
  form,
  editTarget,
  isCreating,
  isUpdating,
  error,
  establishments,
  courseOptions,
  yearLevelOptions,
  statusOptions,
  setField,
  onSubmit,
  onClose,
}: StudentEditDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              {editTarget ? "Edit Student" : "Add Student"}
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
            isCreating={isCreating}
            isUpdating={isUpdating}
            error={error}
            establishments={establishments}
            courseOptions={courseOptions}
            yearLevelOptions={yearLevelOptions}
            statusOptions={statusOptions}
            setField={setField}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
