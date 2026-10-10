"use client";

import { KeyRound, Plus, Users } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CredentialsDialog from "@/features/account/CredentialsDialog";
import { SUPERVISOR_NAV } from "@/features/supervisor/nav";
import StudentRoster from "@/features/supervisor/components/StudentRoster";
import AddStudentDialog from "@/features/supervisor/components/AddStudentDialog";
import { useSupervisorStudents } from "@/features/supervisor/hooks/use-supervisor-students";
import { useGetSupervisorDashboardQuery } from "@/lib/api/supervisorApi";

export default function SupervisorStudentsPage() {
  // Only for the sidebar's establishment name and the signed-in name — the
  // same cached query the dashboard reads.
  const { data: dashboard } = useGetSupervisorDashboardQuery();
  const {
    students,
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
    closeIssuedCredentials,
  } = useSupervisorStudents();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName={dashboard?.establishment?.name ?? "Establishment"}
        orgSubtitle="Barangay San Francisco Pag. City ZDS"
        items={SUPERVISOR_NAV}
        userName={dashboard?.supervisor.name ?? "Supervisor"}
        userSubtitle={dashboard?.supervisor.position ?? undefined}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <PageHeader
            title="Students"
            subtitle="Add your establishment's OJT students and manage their logins."
            icon={Users}
          />
          <Button
            icon={Plus}
            onClick={openAdd}
            fullWidth={false}
            className="self-start md:self-auto"
          >
            Add Student
          </Button>
        </div>

        <Card>
          <p className="text-xs text-gray-500 mb-4">
            Students you add join your establishment. Mark a finished OJT
            complete to take it out of your approval queue — every record is
            kept.
          </p>
          <StudentRoster
            students={students}
            isLoading={isLoading}
            onResendLogin={setResendTarget}
          />
        </Card>
      </main>

      <AddStudentDialog
        open={isAddOpen}
        form={form}
        placement={placement}
        error={error}
        isSubmitting={isCreating}
        setField={setField}
        onSubmit={handleSubmit}
        onClose={closeAdd}
      />

      <ConfirmDialog
        open={!!resendTarget}
        title="Resend login?"
        message={
          resendTarget
            ? `This generates a new temporary password for ${resendTarget.user.name} and stops their current password from working. They must choose a new one when they next sign in.`
            : ""
        }
        confirmLabel={isResending ? "Generating..." : "Yes, issue a new login"}
        confirmDisabled={isResending}
        icon={KeyRound}
        onConfirm={handleResendConfirm}
        onCancel={() => {
          setResendTarget(null);
        }}
      />

      <CredentialsDialog
        credentials={issuedCredentials}
        onDone={closeIssuedCredentials}
      />
    </div>
  );
}
