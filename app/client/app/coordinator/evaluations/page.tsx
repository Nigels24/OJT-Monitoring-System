"use client";

import { useMemo, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { Star, ClipboardCheck, TrendingUp, Building2 } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  useGetAllEvaluationsQuery,
  Evaluation,
} from "@/lib/api/evaluationApi";
import { previewLevel } from "@/features/evaluation/rubric";
import EvaluationList from "@/features/evaluation/components/EvaluationList";
import EvaluationViewDialog from "@/features/evaluation/components/EvaluationViewDialog";

const PAGE_SIZE = 10;

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return evaluations ?? [];
    return (evaluations ?? []).filter((ev) =>
      [
        ev.student.user.name,
        ev.student.studentIdNumber,
        ev.student.course,
        ev.student.establishment?.name,
        ev.performanceLevel,
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
    const avg =
      all.length === 0
        ? 0
        : Math.round(
            (all.reduce((a, e) => a + e.overallRating, 0) / all.length) * 10,
          ) / 10;
    return {
      total: all.length,
      averageRating: avg,
      averageLevel: all.length === 0 ? "—" : previewLevel(avg),
      establishments: new Set(
        all.map((e) => e.student.establishment?.id).filter(Boolean),
      ).size,
    };
  }, [evaluations]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco"
        items={COORDINATOR_NAV}
        userName={currentUser?.name || "Coordinator"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Evaluations"
            subtitle="Performance evaluations submitted by supervisors across all establishments"
            icon={Star}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Total Evaluations"
            value={stats.total}
            icon={ClipboardCheck}
            variant="accent"
          />
          <StatCard
            label="Average Rating"
            value={stats.total === 0 ? "—" : stats.averageRating.toFixed(1)}
            icon={TrendingUp}
            subtext={stats.averageLevel}
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
            emptyMessage="No supervisor has submitted an evaluation yet."
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
