"use client";

import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { Star, ClipboardCheck, Hourglass, TrendingUp } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { SUPERVISOR_NAV } from "@/features/supervisor/nav";
import { useEvaluations } from "@/features/evaluation/hooks/use-evaluations";
import { PERFORMANCE_LEVELS } from "@/features/evaluation/rubric";
import EvaluationForm from "@/features/evaluation/components/EvaluationForm";
import EvaluationList from "@/features/evaluation/components/EvaluationList";
import EvaluationViewDialog from "@/features/evaluation/components/EvaluationViewDialog";

export default function SupervisorEvaluationPage() {
  const currentUser = useCurrentUser();
  const {
    form,
    error,
    preview,
    students,
    isLoading,
    isSubmitting,
    viewTarget,
    search,
    page,
    paged,
    totalPages,
    stats,
    setField,
    setViewTarget,
    setSearch,
    setPage,
    handleSubmit,
    resetForm,
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
            subtitle="Rate your students' performance across nine criteria"
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
            subtext="students not yet evaluated"
          />
          <StatCard
            label="Average Rating"
            value={stats.total === 0 ? "—" : stats.averageRating.toFixed(1)}
            icon={TrendingUp}
            subtext={stats.averageLevel}
          />
        </div>

        <Card className="mb-4">
          <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <ClipboardCheck size={18} className="text-blue-600" />
            New Evaluation
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Each criterion is scored 1–5. The overall rating is weighted —
            Work Performance 40%, Professional Behavior 30%, Technical Skills
            30% — and calculated on the server when you submit.
          </p>
          <EvaluationForm
            form={form}
            error={error}
            preview={preview}
            students={students ?? []}
            isSubmitting={isSubmitting}
            setField={setField}
            onSubmit={handleSubmit}
            onReset={resetForm}
          />

          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Performance levels
            </h3>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
              {PERFORMANCE_LEVELS.map((l) => (
                <span key={l.level}>
                  <span className="font-medium text-gray-800">{l.level}</span>{" "}
                  {l.range}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Star size={18} className="text-blue-600" />
            Completed Evaluations
          </h2>
          <EvaluationList
            rows={paged}
            isLoading={isLoading}
            search={search}
            page={page}
            totalPages={totalPages}
            onSearchChange={setSearch}
            onPageChange={setPage}
            onView={setViewTarget}
            emptyMessage="You haven't evaluated anyone yet."
          />
        </Card>
      </main>

      <EvaluationViewDialog
        open={!!viewTarget}
        evaluation={viewTarget}
        onClose={() => {
          setViewTarget(null);
        }}
      />
    </div>
  );
}
