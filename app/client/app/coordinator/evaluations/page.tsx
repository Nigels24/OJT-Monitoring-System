"use client";

import { useMemo, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import Tabs from "@/components/ui/Tabs";
import {
  Star,
  ClipboardCheck,
  TrendingUp,
  Building2,
  FileText,
} from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  useGetAllEvaluationsQuery,
  Evaluation,
} from "@/lib/api/evaluationApi";
import EvaluationList from "@/features/evaluation/components/EvaluationList";
import { useEvaluationDownload } from "@/features/evaluation/hooks/use-evaluation-download";
import EvaluationViewDialog from "@/features/evaluation/components/EvaluationViewDialog";
import { useEvaluationTemplate } from "@/features/evaluation-template/hooks/use-evaluation-template";
import EvaluationSheetTab from "@/features/evaluation-template/components/EvaluationSheetTab";

const PAGE_SIZE = 10;

/** Read-only oversight, and the sheet itself — two tabs, one route. */
type EvaluationTab = "submitted" | "sheet";

/**
 * Read-only oversight across every establishment.
 *
 * Coordinators don't write evaluations — supervisors do — so this page has no
 * form, only the cross-establishment list the prototype's admin/evaluation.html
 * shows.
 */
export default function CoordinatorEvaluationsPage() {
  const currentUser = useCurrentUser();
  const { data: evaluations, isLoading } = useGetAllEvaluationsQuery();
  const [viewTarget, setViewTarget] = useState<Evaluation | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<EvaluationTab>("submitted");
  const template = useEvaluationTemplate();
  const { downloadingId, downloadEvaluation } = useEvaluationDownload();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return evaluations ?? [];
    return (evaluations ?? []).filter((ev) =>
      [
        ev.student.user.name,
        ev.student.studentIdNumber,
        ev.student.course,
        ev.trainingEmployedAt,
        ev.student.establishment?.name,
        ev.evaluatorName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [evaluations, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const all = evaluations ?? [];
    // null, not 0, until something has been evaluated.
    const avg =
      all.length === 0
        ? null
        : Math.round(
            (all.reduce((a, e) => a + e.totalRating, 0) / all.length) * 10,
          ) / 10;
    return {
      total: all.length,
      averageRating: avg,
      // Read off a row, not a constant: the sheet is versioned, so the
      // maximum is whatever these evaluations were signed out of.
      maxTotalRating: all[0]?.maxTotalRating ?? null,
      establishments: new Set(
        all.map((e) => e.student.establishment?.id).filter(Boolean),
      ).size,
    };
  }, [evaluations]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco Pag. City ZDS"
        items={COORDINATOR_NAV}
        userName={currentUser?.name || "Coordinator"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Evaluations"
            subtitle="Official evaluation sheets submitted by supervisors across all establishments"
            icon={Star}
          />
        </div>

        <div className="mb-4">
          <Tabs
            options={[
              {
                key: "submitted" as const,
                label: "Submitted Evaluations",
                icon: ClipboardCheck,
              },
              {
                key: "sheet" as const,
                label: "Evaluation Sheet",
                icon: FileText,
              },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {tab === "submitted" ? (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatCard
              label="Total Evaluations"
              value={stats.total}
              icon={ClipboardCheck}
              variant="accent"
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
            <StatCard
              label="Establishments Reporting"
              value={stats.establishments}
              icon={Building2}
            />
          </div>

          <Card>
            <EvaluationList
              rows={paged}
              isLoading={isLoading}
              search={search}
              page={page}
              totalPages={totalPages}
              showEstablishment
              onSearchChange={setSearch}
              onPageChange={setPage}
              onView={setViewTarget}
              onDownload={(evaluation) => {
                void downloadEvaluation(evaluation);
              }}
              downloadingId={downloadingId}
              emptyMessage="No supervisor has submitted an evaluation yet."
            />
          </Card>
          </>
        ) : (
          <EvaluationSheetTab {...template} />
        )}

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
