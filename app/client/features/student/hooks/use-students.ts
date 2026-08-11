import { useMemo, useState } from "react";
import {
  useGetStudentsQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  Student,
  StudentStatus,
} from "@/lib/api/studentApi";
import { useGetEstablishmentsQuery } from "@/lib/api/establishmentApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

export const COURSE_OPTIONS = [
  "BS Information Technology",
  "BS Computer Science",
  "BS Accountancy",
  "BS Business Administration",
  "BS Hospitality Management",
  "BS Tourism Management",
  "Associate in Computer Science",
];

export const YEAR_LEVEL_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
];

export const STATUS_OPTIONS: StudentStatus[] = [
  "ACTIVE",
  "PENDING",
  "COMPLETED",
  "INACTIVE",
];

const EMPTY_FORM = {
  studentIdNumber: "",
  firstName: "",
  middleInitial: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
  age: "",
  dateOfBirth: "",
  school: "",
  contactNumber: "",
  address: "",
  course: "",
  yearLevel: "",
  establishmentId: "",
  requiredHours: "",
  status: "ACTIVE" as StudentStatus,
};

export type StudentForm = typeof EMPTY_FORM;

const PAGE_SIZE = 5;

export function useStudents() {
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [viewTarget, setViewTarget] = useState<Student | null>(null);
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "">("");
  const [page, setPage] = useState(1);

  const { showSuccess, showError } = useSnackbar();

  const { data: students, isLoading } = useGetStudentsQuery();
  const { data: establishments } = useGetEstablishmentsQuery();
  const [createStudent, { isLoading: isCreating }] = useCreateStudentMutation();
  const [updateStudent, { isLoading: isUpdating }] = useUpdateStudentMutation();
  const [deleteStudent] = useDeleteStudentMutation();

  const setField =
    (key: keyof StudentForm) =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  /** Strips blanks so the server sees "not supplied" rather than "". */
  const detailsPayload = () => ({
    firstName: form.firstName || undefined,
    lastName: form.lastName || undefined,
    middleInitial: form.middleInitial || undefined,
    age: form.age ? Number(form.age) : undefined,
    dateOfBirth: form.dateOfBirth
      ? new Date(form.dateOfBirth).toISOString()
      : undefined,
    school: form.school || undefined,
    contactNumber: form.contactNumber || undefined,
    address: form.address || undefined,
    course: form.course || undefined,
    yearLevel: form.yearLevel || undefined,
    establishmentId: form.establishmentId || undefined,
    requiredHours: form.requiredHours ? Number(form.requiredHours) : undefined,
    status: form.status,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (editTarget) {
        await updateStudent({
          id: editTarget.id,
          ...detailsPayload(),
        }).unwrap();
        showSuccess(`"${form.firstName} ${form.lastName}" has been updated.`);
      } else {
        const result = await createStudent({
          email: form.email,
          username: form.username,
          password: form.password,
          studentIdNumber: form.studentIdNumber,
          ...detailsPayload(),
        }).unwrap();

        showSuccess(
          `"${result.name}" has been added. Give them the username and password you set.`,
        );
      }
      closeDialog();
    } catch (err: unknown) {
      const message = readError(
        err,
        editTarget ? "Failed to update student." : "Failed to add student.",
      );
      setError(message);
      showError(message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStudent(deleteTarget.id).unwrap();
      showSuccess(`"${deleteTarget.user.name}" has been removed.`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const message = readError(err, "Failed to remove student.");
      setError(message);
      showError(message);
    }
  };

  const handleView = (student: Student) => {
    setViewTarget(student);
  };

  const handleEdit = (student: Student) => {
    setEditTarget(student);
    setForm({
      studentIdNumber: student.studentIdNumber,
      firstName: student.firstName ?? "",
      middleInitial: student.middleInitial ?? "",
      lastName: student.lastName ?? "",
      email: student.user.email,
      // Credentials are not editable here — the fields are disabled in edit
      // mode and these values are only shown for reference.
      username: student.user.username ?? "",
      password: "",
      age: student.age?.toString() ?? "",
      // <input type="date"> wants yyyy-mm-dd, not a full ISO timestamp.
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : "",
      school: student.school ?? "",
      contactNumber: student.contactNumber ?? "",
      address: student.address ?? "",
      course: student.course ?? "",
      yearLevel: student.yearLevel ?? "",
      establishmentId: student.establishmentId ?? "",
      requiredHours: student.requiredHours?.toString() ?? "",
      status: student.status,
    });
    setIsDialogOpen(true);
  };

  const handleOpenAddDialog = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (students ?? []).filter((s) => {
      const matchesStatus = !statusFilter || s.status === statusFilter;
      const haystack = [
        s.studentIdNumber,
        s.user.name,
        s.user.email,
        s.course,
        s.establishment?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && haystack.includes(term);
    });
  }, [students, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const all = students ?? [];
    return {
      total: all.length,
      active: all.filter((s) => s.status === "ACTIVE").length,
      inProgress: all.filter(
        (s) => s.requiredHours > 0 && s.completedHours < s.requiredHours,
      ).length,
      completed: all.filter((s) => s.status === "COMPLETED").length,
    };
  }, [students]);

  return {
    form,
    error,
    students,
    establishments,
    isLoading,
    isCreating,
    isUpdating,
    deleteTarget,
    viewTarget,
    editTarget,
    isDialogOpen,
    search,
    statusFilter,
    page,
    paged,
    totalPages,
    filtered,
    stats,

    COURSE_OPTIONS,
    YEAR_LEVEL_OPTIONS,
    STATUS_OPTIONS,

    setField,
    setSearch,
    setStatusFilter,
    setPage,
    setDeleteTarget,
    setViewTarget,

    handleSubmit,
    handleDeleteConfirm,
    handleView,
    handleEdit,
    handleOpenAddDialog,
    closeDialog,
  };
}

/** Pulls the API's message out of an RTK Query error, with a fallback. */
function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}
