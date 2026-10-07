import { useMemo, useState } from "react";
import {
  useGetStudentsQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useBulkDeleteStudentsMutation,
  Student,
  StudentStatus,
} from "@/lib/api/studentApi";
import { useGetEstablishmentsQuery } from "@/lib/api/establishmentApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
import { COURSES, isOfferedCourse } from "@/lib/courses";

/** The word the coordinator types to arm the bulk-delete button. */
export const BULK_DELETE_CONFIRM_WORD = "DELETE";

export const YEAR_LEVEL_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
];

// Same values as the establishment coordinator's gender select.
export const GENDER_OPTIONS = ["Male", "Female", "Other"];

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
  gender: "",
  contactNumber: "",
  address: "",
  course: "",
  yearLevel: "",
  establishmentId: "",
  requiredHours: "",
  startDate: "",
  endDate: "",
  // Only sent on an edit — a new student is always ACTIVE server-side.
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState("");

  const { showSuccess, showError } = useSnackbar();

  const { data: students, isLoading } = useGetStudentsQuery();
  const { data: establishments } = useGetEstablishmentsQuery();
  const [createStudent, { isLoading: isCreating }] = useCreateStudentMutation();
  const [updateStudent, { isLoading: isUpdating }] = useUpdateStudentMutation();
  const [deleteStudent] = useDeleteStudentMutation();
  const [bulkDeleteStudents, { isLoading: isBulkDeleting }] =
    useBulkDeleteStudentsMutation();

  const setField =
    (key: keyof StudentForm) =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  /**
   * Blanks go as `null` so an emptied box actually clears the column — the
   * server reads an *absent* field as "leave unchanged", so omitting them
   * would silently restore the old value on every edit.
   *
   * `requiredHours` is the exception: it is NOT NULL server-side, so a blank
   * stays omitted rather than becoming a null write.
   */
  const detailsPayload = () => ({
    firstName: form.firstName || null,
    lastName: form.lastName || null,
    middleInitial: form.middleInitial || null,
    age: form.age ? Number(form.age) : null,
    dateOfBirth: form.dateOfBirth
      ? new Date(form.dateOfBirth).toISOString()
      : null,
    gender: form.gender || null,
    contactNumber: form.contactNumber || null,
    address: form.address || null,
    course: form.course || null,
    yearLevel: form.yearLevel || null,
    establishmentId: form.establishmentId || null,
    requiredHours: form.requiredHours ? Number(form.requiredHours) : undefined,
    startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
    endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (editTarget) {
        await updateStudent({
          id: editTarget.id,
          ...detailsPayload(),
          status: form.status,
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
      gender: student.gender ?? "",
      contactNumber: student.contactNumber ?? "",
      address: student.address ?? "",
      course: student.course ?? "",
      yearLevel: student.yearLevel ?? "",
      establishmentId: student.establishmentId ?? "",
      requiredHours: student.requiredHours?.toString() ?? "",
      startDate: student.startDate ? student.startDate.slice(0, 10) : "",
      endDate: student.endDate ? student.endDate.slice(0, 10) : "",
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

  // Search alone, before the status filter — "Select all completed" picks
  // from this, so it works whichever status the filter currently shows.
  const searchMatches = useMemo(() => {
    const term = search.toLowerCase();
    return (students ?? []).filter((s) => {
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
      return haystack.includes(term);
    });
  }, [students, search]);

  const filtered = useMemo(
    () =>
      searchMatches.filter((s) => !statusFilter || s.status === statusFilter),
    [searchMatches, statusFilter],
  );

  /**
   * The edit form's course options: the offered list, plus — only when the
   * student being edited still carries a course from before the list existed
   * — that old value marked "(old)", so opening the dialog doesn't silently
   * blank it. The server accepts the old value only while it is unchanged.
   */
  const courseOptions = useMemo(() => {
    const options: { label: string; value: string }[] = COURSES.map((c) => ({
      label: c,
      value: c,
    }));
    const saved = editTarget?.course;
    if (saved && !isOfferedCourse(saved)) {
      options.push({ label: `${saved} (old)`, value: saved });
    }
    return options;
  }, [editTarget]);

  // ── Bulk delete ────────────────────────────────────────────────────────
  // Only COMPLETED students are selectable. The selection is derived against
  // the live list on every render, so a student deleted elsewhere, or edited
  // away from COMPLETED, simply drops out of it — no effect to prune it.
  const selectedStudents = useMemo(
    () =>
      (students ?? []).filter(
        (s) => selectedIds.has(s.id) && s.status === "COMPLETED",
      ),
    [students, selectedIds],
  );
  const selectableFiltered = useMemo(
    () => filtered.filter((s) => s.status === "COMPLETED"),
    [filtered],
  );
  const allFilteredSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((s) => selectedIds.has(s.id));
  const someFilteredSelected =
    !allFilteredSelected && selectableFiltered.some((s) => selectedIds.has(s.id));

  const toggleSelected = (student: Student) => {
    if (student.status !== "COMPLETED") return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(student.id)) next.delete(student.id);
      else next.add(student.id);
      return next;
    });
  };

  /** Header checkbox: every selectable row matching the filters, all pages. */
  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        selectableFiltered.forEach((s) => next.delete(s.id));
      } else {
        selectableFiltered.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const selectAllCompleted = () => {
    setStatusFilter("COMPLETED");
    setPage(1);
    setSelectedIds(
      new Set(
        searchMatches.filter((s) => s.status === "COMPLETED").map((s) => s.id),
      ),
    );
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const openBulkDelete = () => {
    if (selectedStudents.length === 0) return;
    setBulkConfirmText("");
    setIsBulkDeleteOpen(true);
  };

  const closeBulkDelete = () => {
    setIsBulkDeleteOpen(false);
    setBulkConfirmText("");
  };

  const handleBulkDeleteConfirm = async () => {
    if (bulkConfirmText !== BULK_DELETE_CONFIRM_WORD) return;
    const ids = selectedStudents.map((s) => s.id);
    if (ids.length === 0) return;
    try {
      const result = await bulkDeleteStudents(ids).unwrap();
      const n = result.deleted.length;
      if (n > 0) {
        showSuccess(`${n} ${n === 1 ? "student" : "students"} deleted`);
      }
      if (result.failed.length > 0) {
        const names = result.failed
          .map(
            (f) =>
              (students ?? []).find((s) => s.id === f.id)?.user.name ?? f.id,
          )
          .join(", ");
        showError(
          `${result.failed.length} could not be deleted: ${names}. They are still selected.`,
        );
      }
      // Keep only the failures selected, so a retry is one click away.
      setSelectedIds(new Set(result.failed.map((f) => f.id)));
      closeBulkDelete();
    } catch (err: unknown) {
      showError(readError(err, "Failed to delete the selected students."));
    }
  };

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
    courseOptions,

    selectedIds,
    selectedStudents,
    selectableFilteredCount: selectableFiltered.length,
    allFilteredSelected,
    someFilteredSelected,
    isBulkDeleteOpen,
    isBulkDeleting,
    bulkConfirmText,
    setBulkConfirmText,
    toggleSelected,
    toggleSelectAllFiltered,
    selectAllCompleted,
    clearSelection,
    openBulkDelete,
    closeBulkDelete,
    handleBulkDeleteConfirm,

    YEAR_LEVEL_OPTIONS,
    GENDER_OPTIONS,
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
