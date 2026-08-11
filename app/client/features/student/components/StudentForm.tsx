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
  UserPlus,
} from "lucide-react";
import TextField from "@/components/ui/TextField";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import SelectField from "@/components/ui/SelectField";
import { Student, StudentStatus } from "@/lib/api/studentApi";
import { Establishment } from "@/lib/api/establishmentApi";
import type { StudentForm as StudentFormValues } from "../hooks/use-students";

interface StudentFormProps {
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
  isCreating,
  isUpdating,
  error,
  establishments,
  courseOptions,
  yearLevelOptions,
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
            disabled={!!editTarget}
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
            disabled={!!editTarget}
          />
        </div>
        {!editTarget && (
          <p className="text-xs text-gray-500 mt-2">
            A temporary password is generated on save and shown once — copy it
            and give it to the student.
          </p>
        )}
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
            label="Age"
            labelIcon={User}
            fieldIcon={User}
            type="number"
            min={15}
            max={100}
            value={form.age}
            onChange={setField("age")}
            placeholder="21"
          />
          <TextField
            label="Date of Birth"
            labelIcon={CalendarDays}
            fieldIcon={CalendarDays}
            type="date"
            value={form.dateOfBirth}
            onChange={setField("dateOfBirth")}
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
          <TextField
            label="School"
            labelIcon={GraduationCap}
            fieldIcon={GraduationCap}
            value={form.school}
            onChange={setField("school")}
            placeholder="West Prime Horizon Institute Inc."
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course / Program
            </label>
            <SelectField
              value={form.course}
              onChange={setValue("course")}
              placeholder="Select Course"
              options={courseOptions.map((c) => ({ label: c, value: c }))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year Level
            </label>
            <SelectField
              value={form.yearLevel}
              onChange={setValue("yearLevel")}
              placeholder="Select Year"
              options={yearLevelOptions.map((y) => ({ label: y, value: y }))}
              className="w-full"
            />
          </div>
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
          <TextField
            label="Required Hours"
            labelIcon={Clock}
            fieldIcon={Clock}
            type="number"
            min={0}
            value={form.requiredHours}
            onChange={setField("requiredHours")}
            placeholder="500"
          />
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
          <Button
            type="submit"
            icon={editTarget ? Pencil : UserPlus}
            loading={isCreating || isUpdating}
          >
            {editTarget ? "Save Changes" : "Add Student"}
          </Button>
        </div>
      </div>
    </form>
  );
}
