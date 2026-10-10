import {
  CalendarDays,
  Clock,
  GraduationCap,
  IdCard,
  Mail,
  MapPin,
  Phone,
  User,
  UserPlus,
} from "lucide-react";
import FormDialog from "@/components/ui/FormDialog";
import TextField from "@/components/ui/TextField";
import TextArea from "@/components/ui/TextArea";
import SelectField from "@/components/ui/SelectField";
import Button from "@/components/ui/Button";
import {
  COURSE_OPTIONS,
  type NewStudentForm,
} from "../hooks/use-supervisor-students";

interface AddStudentDialogProps {
  open: boolean;
  form: NewStudentForm;
  /** Implied by the course; `null` until one is picked. */
  placement: { yearLevel: string; requiredHours: number } | null;
  error: string;
  isSubmitting: boolean;
  setField: (
    key: keyof NewStudentForm,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

/**
 * The supervisor's Add Student form. A `FormDialog` (closes only on Escape or
 * X), since it holds unsaved input. No establishment field: the student joins
 * the supervisor's own establishment, set by the server. On success the hook
 * closes it and opens `CredentialsDialog` with the generated login.
 */
export default function AddStudentDialog({
  open,
  form,
  placement,
  error,
  isSubmitting,
  setField,
  onSubmit,
  onClose,
}: AddStudentDialogProps) {
  return (
    <FormDialog
      open={open}
      title="Add Student"
      subtitle="The student joins your establishment."
      icon={UserPlus}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <TextField
            label="Student ID"
            labelIcon={IdCard}
            fieldIcon={IdCard}
            required
            value={form.studentIdNumber}
            onChange={setField("studentIdNumber")}
            placeholder="e.g., 2024-001"
            maxLength={50}
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
          />
          <TextField
            label="First Name"
            labelIcon={User}
            fieldIcon={User}
            required
            value={form.firstName}
            onChange={setField("firstName")}
            placeholder="Juan"
            maxLength={120}
          />
          <TextField
            label="Last Name"
            labelIcon={User}
            fieldIcon={User}
            required
            value={form.lastName}
            onChange={setField("lastName")}
            placeholder="Dela Cruz"
            maxLength={120}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course / Program <span className="text-red-500">*</span>
            </label>
            <SelectField
              value={form.course}
              onChange={(value) => setField("course")({ target: { value } })}
              placeholder="Select Course"
              options={COURSE_OPTIONS}
              className="w-full"
            />
          </div>
          <TextField
            label="OJT Start Date"
            labelIcon={CalendarDays}
            fieldIcon={CalendarDays}
            type="date"
            value={form.startDate}
            onChange={setField("startDate")}
          />
          {/* Follow the course — shown, never typed, never sent. */}
          <ReadOnlyField
            label="Year Level"
            icon={GraduationCap}
            value={placement ? placement.yearLevel : "Set by course"}
          />
          <ReadOnlyField
            label="Required Hours"
            icon={Clock}
            value={placement ? `${placement.requiredHours} hrs` : "Set by course"}
          />
          <div className="md:col-span-2">
            <TextArea
              label="Complete Address"
              labelIcon={MapPin}
              fieldIcon={MapPin}
              value={form.address}
              onChange={setField("address")}
              placeholder="House/Unit, Street, Barangay, City, Province"
              rows={2}
              maxLength={255}
            />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          A username and a temporary password are generated and shown to you
          once. The student must choose their own password the first time they
          sign in.
        </p>

        {error && (
          <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            fullWidth={false}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            icon={UserPlus}
            fullWidth={false}
            loading={isSubmitting}
          >
            Add Student
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

/** A labelled value styled like a disabled input, as on the coordinator form. */
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
