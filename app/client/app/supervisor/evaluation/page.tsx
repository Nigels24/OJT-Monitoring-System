"use client";

import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Star, ClipboardCheck, Hourglass, TrendingUp } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { SUPERVISOR_NAV } from "@/features/supervisor/nav";
import { useEvaluations } from "@/features/evaluation/hooks/use-evaluations";
import EvaluationForm from "@/features/evaluation/components/EvaluationForm";
import EvaluationList from "@/features/evaluation/components/EvaluationList";
import EvaluationViewDialog from "@/features/evaluation/components/EvaluationViewDialog";
import EvaluationEditDialog from "@/features/evaluation/components/EvaluationEditDialog";

export default function SupervisorEvaluationPage() {
  const currentUser = useCurrentUser();
  const {
    sheet,
    sheetLoading,
    sheetSummary,
    students,
    createForm,
    editForm,
    isEditOpen,
    isLoading,
    canModify,
    viewTarget,
    deleteTarget,
    search,
    page,
    paged,
    totalPages,
    stats,
    setViewTarget,
    setDeleteTarget,
    setSearch,
    setPage,
    startEdit,
    closeEdit,
    handleDeleteConfirm,
  } = useEvaluations();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="OJT Monitoring"
        items={SUPERVISOR_NAV}
        userName={currentUser?.name || "Supervisor"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Evaluation"
            subtitle="The school's official on-the-job training performance evaluation sheet"
            icon={Star}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Evaluations Completed"
            value={stats.total}
            icon={ClipboardCheck}
            variant="accent"
          />
          <StatCard
            label="Awaiting Evaluation"
            value={stats.pending}
            icon={Hourglass}
            subtext="trainees not yet evaluated"
          />
          <StatCard
            label="Average Total Rating"
            value={stats.averageRating ?? "—"}
            icon={TrendingUp}
            subtext={
              stats.averageRating === null || stats.maxTotalRating === null
                ? "No evaluations yet"
                : `out of ${stats.maxTotalRating}`
            }
          />
        </div>

        <Card className="mb-4">
          <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <ClipboardCheck size={18} className="text-blue-600" />
            New Evaluation
          </h2>
          <p className="text-xs text-gray-500 mb-4">{sheetSummary}</p>
          <EvaluationForm
            sheet={sheet}
            sheetLoading={sheetLoading}
            students={students ?? []}
            {...createForm}
          />
        </Card>

        <Card>
          <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <Star size={18} className="text-blue-600" />
            Submitted Evaluations
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Newest first. A trainee may have more than one — edit and delete are
            offered only on sheets you wrote.
          </p>
          <EvaluationList
            rows={paged}
            isLoading={isLoading}
            search={search}
            page={page}
            totalPages={totalPages}
            onSearchChange={setSearch}
            onPageChange={setPage}
            onView={setViewTarget}
            onEdit={startEdit}
            onDelete={setDeleteTarget}
            canModify={canModify}
            emptyMessage="You haven't evaluated anyone yet."
          />
        </Card>
      </main>

      <EvaluationEditDialog
        open={isEditOpen}
        sheet={sheet}
        sheetLoading={sheetLoading}
        students={students ?? []}
        form={editForm}
        onClose={closeEdit}
      />

      <EvaluationViewDialog
        open={!!viewTarget}
        evaluation={viewTarget}
        onClose={() => {
          setViewTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Evaluation?"
        message={
          deleteTarget
            ? `Permanently delete the evaluation of ${deleteTarget.student.user.name} scored ${deleteTarget.totalRating}/${deleteTarget.maxTotalRating}? This cannot be undone.`
            : ""
        }
        confirmLabel="Yes, delete permanently"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
