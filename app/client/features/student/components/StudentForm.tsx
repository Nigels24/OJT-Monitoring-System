import {
  User,
  Mail,
  Phone,
  MapPin,
  IdCard,
  GraduationCap,
  Clock,
  CalendarDays,
  Pencil,
} from "lucide-react";
import TextField from "@/components/ui/TextField";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import SelectField from "@/components/ui/SelectField";
import { Student, StudentStatus } from "@/lib/api/studentApi";
import { Establishment } from "@/lib/api/establishmentApi";
import { SCHOOL_NAME } from "@/lib/school";
import type {
  StudentForm as StudentFormValues,
  StudentPlacement,
} from "../hooks/use-students";

/** The coordinator's edit form — students are created by their supervisor. */
interface StudentFormProps {
  form: StudentFormValues;
  editTarget: Student;
  isUpdating: boolean;
  error: string;
  establishments: Establishment[];
  /** The offered courses, plus an edited student's "(old)" value if any. */
  courseOptions: { label: string; value: string }[];
  /** Year level and hours implied by the course — displayed, never typed. */
  placement: StudentPlacement | null;
  statusOptions: StudentStatus[];
  setField: (
    key: keyof StudentFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const STATUS_LABEL: Record<StudentStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  COMPLETED: "Completed",
  INACTIVE: "Inactive",
};

export default function StudentForm({
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
  onCancel,
}: StudentFormProps) {
  // A select's onChange gives a bare value; setField expects an event shape.
  const setValue = (key: keyof StudentFormValues) => (value: string) => {
    setField(key)({ target: { value } });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 md:space-y-8">
      <section className="border-l-4 border-blue-400 pl-4 md:pl-6">
        <div className="flex items-center gap-2 mb-4">
          <IdCard size={16} className="text-gray-700" />
          <h3 className="font-semibold text-gray-900 text-base md:text-lg">
            Account &amp; Identification
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <TextField
            label="Student ID"
            labelIcon={IdCard}
            fieldIcon={IdCard}
            required
            value={form.studentIdNumber}
            onChange={setField("studentIdNumber")}
            placeholder="e.g., 2024-001"
            // The ID is the student's identity across attendance and
            // evaluations; changing it after creation is not supported.
            disabled
          />
          <TextField
            label="Email Address"
            labelIcon={Mail}
            fieldIcon={Mail}
            type="email"
            required
            value={form.email}
            onChange={setField("email")}
            placeholder="student@wphi.edu"
            disabled
          />
          <ReadOnlyField
            label="Username"
            icon={User}
            value={editTarget.user.username ?? "None — signs in with email"}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Login details can&apos;t be changed from this form. Use Resend login
          in the list to issue a new temporary password.
        </p>
      </section>

      <section className="border-l-4 border-blue-400 pl-4 md:pl-6">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-gray-700" />
          <h3 className="font-semibold text-gray-900 text-base md:text-lg">
            Personal Details
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <TextField
            label="First Name"
            labelIcon={User}
            fieldIcon={User}
            required
            value={form.firstName}
            onChange={setField("firstName")}
            placeholder="Juan"
          />
          <TextField
            label="Last Name"
            labelIcon={User}
            fieldIcon={User}
            required
            value={form.lastName}
            onChange={setField("lastName")}
            placeholder="Dela Cruz"
          />
          <TextField
            label="Middle Initial"
            labelIcon={User}
            fieldIcon={User}
            value={form.middleInitial}
            onChange={setField("middleInitial")}
            placeholder="P"
            maxLength={10}
          />
          <TextField
            label="Contact Number"
            labelIcon={Phone}
            fieldIcon={Phone}
            value={form.contactNumber}
            onChange={setField("contactNumber")}
            placeholder="09123456789"
            pattern="\d{11}"
            title="Please enter exactly 11 digits (e.g., 09123456789)"
          />
          <TextArea
            label="Complete Address"
            labelIcon={MapPin}
            fieldIcon={MapPin}
            value={form.address}
            onChange={setField("address")}
            placeholder="House/Unit, Street, Barangay, City, Province"
            rows={2}
          />
        </div>
      </section>

      <section className="border-l-4 border-blue-400 pl-4 md:pl-6">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap size={16} className="text-gray-700" />
          <h3 className="font-semibold text-gray-900 text-base md:text-lg">
            Academic &amp; OJT
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <GraduationCap size={15} className="text-blue-600" />
              School
            </label>
            {/* This system serves one school — the name is permanent, not a
                form field. Shown for reference, never editable. */}
            <div className="flex items-center gap-2 h-11 px-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
              <GraduationCap size={18} className="text-gray-400" />
              {SCHOOL_NAME}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course / Program
            </label>
            <SelectField
              value={form.course}
              onChange={setValue("course")}
              placeholder="Select Course"
              options={courseOptions}
              className="w-full"
            />
          </div>
          {/* Year level and hours follow from the course — shown, never
              typed. A legacy student's stored values stay (marked "old")
              until the course is changed. */}
          <ReadOnlyField
            label="Year Level"
            icon={GraduationCap}
            value={
              placement
                ? `${placement.yearLevel ?? "—"}${placement.yearLevelIsOld ? " (old)" : ""}`
                : "Set by course"
            }
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Establishment Assignment
            </label>
            <SelectField
              value={form.establishmentId}
              onChange={setValue("establishmentId")}
              placeholder="Select Establishment"
              options={[
                { label: "Unassigned", value: "" },
                ...establishments.map((e) => ({
                  label: e.name,
                  value: e.id,
                })),
              ]}
              className="w-full"
            />
          </div>
          <ReadOnlyField
            label="Required Hours"
            icon={Clock}
            value={
              placement
                ? `${placement.requiredHours} hrs${placement.hoursAreOld ? " (old)" : ""}`
                : "Set by course"
            }
          />
          <TextField
            label="OJT Start Date"
            labelIcon={CalendarDays}
            fieldIcon={CalendarDays}
            type="date"
            value={form.startDate}
            onChange={setField("startDate")}
          />
          {/* A new student is always ACTIVE (set by the server on the
              supervisor's create). COMPLETED / INACTIVE are set here. */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <SelectField
              value={form.status}
              onChange={setValue("status")}
              placeholder="Select Status"
              options={statusOptions.map((s) => ({
                label: STATUS_LABEL[s],
                value: s,
              }))}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <div className="sm:w-48">
          <Button type="submit" icon={Pencil} loading={isUpdating}>
            Save Changes
          </Button>
        </div>
      </div>
    </form>
  );
}

/** A labelled value styled like a disabled input — the School box's look. */
function ReadOnlyField({
  label,
  icon: Icon,
  value,
}: {
  label: string;
  icon: typeof Clock;
  value: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
        <Icon size={15} className="text-blue-600" />
        {label}
      </label>
      <div className="flex items-center gap-2 h-11 px-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
        <Icon size={18} className="text-gray-400" />
        {value}
      </div>
    </div>
  );
}
