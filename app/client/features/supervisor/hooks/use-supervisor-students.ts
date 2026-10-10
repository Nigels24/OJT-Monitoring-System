import { useState } from "react";
import {
  SupervisorStudent,
  useCreateSupervisorStudentMutation,
  useGetSupervisorStudentsQuery,
  useResendSupervisorStudentCredentialsMutation,
} from "@/lib/api/supervisorApi";
import type { IssuedCredentials } from "@/features/account/CredentialsDialog";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
import { COURSES, findCourse } from "@/lib/courses";

/**
 * The supervisor's Students page: the roster, Add Student and Resend login.
 *
 * There is no establishment field anywhere here. A new student always joins
 * the supervisor's own establishment — the server takes it from the
 * supervisor's profile and rejects a body that names one.
 */
const EMPTY_FORM = {
  studentIdNumber: "",
  firstName: "",
  middleInitial: "",
  lastName: "",
  email: "",
  course: "",
  contactNumber: "",
  address: "",
  startDate: "",
};

export type NewStudentForm = typeof EMPTY_FORM;

/** The two offered courses — the only values the server accepts. */
export const COURSE_OPTIONS = COURSES.map((c) => ({
  label: `${c.label} (${c.code})`,
  value: c.label,
}));

export function useSupervisorStudents() {
  const [form, setForm] = useState<NewStudentForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  /** The student whose Resend login is awaiting confirmation. */
  const [resendTarget, setResendTarget] = useState<SupervisorStudent | null>(
    null,
  );
  /**
   * Login details just generated (create or resend), shown once. Cleared when
   * the dialog closes and kept nowhere else, so nothing can reopen it.
   */
  const [issuedCredentials, setIssuedCredentials] =
    useState<IssuedCredentials | null>(null);

  const { showSuccess, showError } = useSnackbar();
  const { data: students, isLoading } = useGetSupervisorStudentsQuery();
  const [createStudent, { isLoading: isCreating }] =
    useCreateSupervisorStudentMutation();
  const [resendCredentials, { isLoading: isResending }] =
    useResendSupervisorStudentCredentialsMutation();

  const setField =
    (key: keyof NewStudentForm) => (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  /**
   * Year level and required hours follow from the course — shown read-only,
   * never sent. `null` until a course is picked.
   */
  const course = findCourse(form.course);
  const placement = course
    ? { yearLevel: course.yearLevel, requiredHours: course.requiredHours }
    : null;

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError("");
    setIsAddOpen(true);
  };

  const closeAdd = () => {
    setIsAddOpen(false);
    setForm(EMPTY_FORM);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // SelectField has no native `required`, so a missing course is caught
    // here rather than as a 400 — it decides the year level and hours.
    if (!form.course) {
      setError("Select a course.");
      return;
    }

    try {
      // Optional blanks are left out (`undefined`), not sent as "" — this is
      // a create, where absent simply means "none".
      const result = await createStudent({
        studentIdNumber: form.studentIdNumber.trim(),
        firstName: form.firstName.trim(),
        middleInitial: form.middleInitial.trim() || undefined,
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        course: form.course,
        contactNumber: form.contactNumber.trim() || undefined,
        address: form.address.trim() || undefined,
        startDate: form.startDate || undefined,
      }).unwrap();

      closeAdd();
      showSuccess(`${result.user.name} has been added.`);
      // The generated username and temporary password, shown once.
      setIssuedCredentials({
        name: result.user.name,
        email: result.user.email,
        username: result.credentials.username,
        tempPassword: result.credentials.tempPassword,
        reason: "created",
      });
    } catch (err: unknown) {
      const message = readError(err, "Failed to add student.");
      setError(message);
      showError(message);
    }
  };

  /** Resend login: a new generated password, after the supervisor confirms. */
  const handleResendConfirm = async () => {
    if (!resendTarget) return;
    try {
      const result = await resendCredentials(resendTarget.id).unwrap();
      setResendTarget(null);
      setIssuedCredentials({
        name: result.name,
        email: result.email,
        username: result.credentials.username,
        tempPassword: result.credentials.tempPassword,
        reason: "resent",
      });
    } catch (err: unknown) {
      showError(readError(err, "Failed to issue a new login."));
    }
  };

  return {
    students: students ?? [],
    isLoading,

    form,
    error,
    placement,
    isAddOpen,
    isCreating,
    setField,
    openAdd,
    closeAdd,
    handleSubmit,

    resendTarget,
    isResending,
    setResendTarget,
    handleResendConfirm,

    issuedCredentials,
    closeIssuedCredentials: () => {
      setIssuedCredentials(null);
    },
  };
}

/** Pulls the API's message out of an RTK Query error, with a fallback. */
function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}
