"use client";

import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Button from "@/components/ui/Button";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  MessageSquare,
  Star,
  Plus,
  CheckCircle2,
  Clock,
  UserCheck,
} from "lucide-react";
import { useStudents } from "@/features/student/hooks/use-students";
import StudentList from "@/features/student/components/StudentList";
import StudentViewDialog from "@/features/student/components/StudentViewDialog";
import StudentEditDialog from "@/features/student/components/StudentEditDialog";
import NewCredentialsDialog from "@/features/student/components/NewCredentialsDialog";

const COORDINATOR_NAV = [
  { label: "Dashboard", href: "/coordinator/dashboard", icon: LayoutDashboard },
  {
    label: "Establishment Management",
    href: "/coordinator/establishments",
    icon: Building2,
  },
  { label: "Student Management", href: "/coordinator/students", icon: Users },
  { label: "Attendance", href: "/coordinator/attendance", icon: CalendarCheck },
  { label: "Messages", href: "/coordinator/messages", icon: MessageSquare },
  { label: "Evaluations", href: "/coordinator/evaluations", icon: Star },
];

export default function StudentManagementPage() {
  const currentUser = useCurrentUser();
  const {
    form,
    error,
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
    stats,
    newCredentials,
    COURSE_OPTIONS,
    YEAR_LEVEL_OPTIONS,
    STATUS_OPTIONS,
    setField,
    setSearch,
    setStatusFilter,
    setPage,
    setDeleteTarget,
    setViewTarget,
    setNewCredentials,
    handleSubmit,
    handleDeleteConfirm,
    handleView,
    handleEdit,
    handleOpenAddDialog,
    closeDialog,
  } = useStudents();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco"
        items={COORDINATOR_NAV}
        userName={currentUser?.name || "Coordinator"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <PageHeader
            title="Student Management"
            subtitle="Manage OJT students, their assignments and progress"
            icon={Users}
          />
          <Button
            icon={Plus}
            onClick={handleOpenAddDialog}
            className="self-start md:self-auto"
          >
            Add Student
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Total Students"
            value={stats.total}
            icon={Users}
            variant="accent"
          />
          <StatCard
            label="Active"
            value={stats.active}
            icon={UserCheck}
            subtext="Currently on OJT"
          />
          <StatCard
            label="In Progress"
            value={stats.inProgress}
            icon={Clock}
            subtext="Hours not yet met"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            subtext="Finished program"
          />
        </div>

        <Card>
          <StudentList
            isLoading={isLoading}
            search={search}
            statusFilter={statusFilter}
            page={page}
            totalPages={totalPages}
            paged={paged}
            statusOptions={STATUS_OPTIONS}
            onSearchChange={setSearch}
            onStatusFilterChange={setStatusFilter}
            onPageChange={setPage}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={(student) => {
              setDeleteTarget(student);
            }}
          />
        </Card>
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Student?"
        message={`This permanently deletes "${deleteTarget?.user.name}" and their login. Students with attendance, evaluations or documents cannot be deleted — set them to Inactive instead.`}
        confirmLabel="Yes, remove"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
        }}
      />

      <StudentViewDialog
        open={!!viewTarget}
        student={viewTarget}
        onClose={() => {
          setViewTarget(null);
        }}
      />

      <StudentEditDialog
        open={isDialogOpen}
        form={form}
        editTarget={editTarget}
        isCreating={isCreating}
        isUpdating={isUpdating}
        error={error}
        establishments={establishments || []}
        courseOptions={COURSE_OPTIONS}
        yearLevelOptions={YEAR_LEVEL_OPTIONS}
        statusOptions={STATUS_OPTIONS}
        setField={setField}
        onSubmit={handleSubmit}
        onClose={closeDialog}
      />

      <NewCredentialsDialog
        credentials={newCredentials}
        onClose={() => {
          setNewCredentials(null);
        }}
      />
    </div>
  );
}
