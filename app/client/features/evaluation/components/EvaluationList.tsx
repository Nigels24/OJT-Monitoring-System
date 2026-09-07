import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Star,
  Pencil,
  Trash2,
} from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import { Evaluation } from "@/lib/api/evaluationApi";
import { formatDateOnly } from "@/lib/format";

interface EvaluationListProps {
  rows: Evaluation[];
  isLoading: boolean;
  search: string;
  page: number;
  totalPages: number;
  /** Coordinator view spans establishments; supervisor's is a single one. */
  showEstablishment?: boolean;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onView: (evaluation: Evaluation) => void;
  /**
   * Supervisor only, and only for sheets they wrote. The coordinator passes
   * neither — evaluations belong to the supervisor who wrote them.
   */
  onEdit?: (evaluation: Evaluation) => void;
  onDelete?: (evaluation: Evaluation) => void;
  canModify?: (evaluation: Evaluation) => boolean;
  emptyMessage?: string;
}

function trainingPeriod(ev: Evaluation): string {
  if (!ev.trainingStartedAt && !ev.trainingEndedAt) return "—";
  const fmt = (d: string | null) => formatDateOnly(d, "…");
  return `${fmt(ev.trainingStartedAt)} – ${fmt(ev.trainingEndedAt)}`;
}

export default function EvaluationList({
  rows,
  isLoading,
  search,
  page,
  totalPages,
  showEstablishment = false,
  onSearchChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  canModify,
  emptyMessage = "No evaluations yet.",
}: EvaluationListProps) {
  const columns: DataTableColumn<Evaluation>[] = [
    {
      key: "studentIdNumber",
      label: "ID",
      render: (r) => (
        <span className="font-mono text-xs text-gray-700">
          {r.student.studentIdNumber}
        </span>
      ),
    },
    {
      key: "student",
      label: "Trainee",
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900">
            {r.student.user.name}
          </div>
          {r.student.course && (
            <div className="text-xs text-gray-500">{r.student.course}</div>
          )}
        </div>
      ),
    },
    ...(showEstablishment
      ? [
          {
            key: "establishment",
            label: "Establishment",
            render: (r: Evaluation) =>
              r.trainingEmployedAt ?? r.student.establishment?.name ?? "—",
          },
        ]
      : []),
    { key: "training", label: "Training Period", render: trainingPeriod },
    {
      key: "totalRating",
      label: "Total Rating",
      render: (r) => (
        <span className="font-semibold text-gray-900 tabular-nums">
          {r.totalRating}
          <span className="text-xs font-normal text-gray-500">
            /{r.maxTotalRating}
          </span>
        </span>
      ),
    },
    {
      key: "evaluator",
      label: "Evaluated by",
      render: (r) => (
        <div>
          <div>{r.evaluatorName ?? r.supervisor.user.name}</div>
          {(r.evaluatorPosition ?? r.supervisor.position) && (
            <div className="text-xs text-gray-500">
              {r.evaluatorPosition ?? r.supervisor.position}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (r) => (
        <div>
          <div>{new Date(r.createdAt).toLocaleDateString()}</div>
          {r.updatedAt !== r.createdAt && (
            <div className="text-xs text-gray-500">
              edited {new Date(r.updatedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => {
        // The server 403s a non-author anyway; not offering the button keeps
        // the UI honest about what this supervisor may do.
        const mine = canModify ? canModify(r) : false;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onView(r)}
              className="p-1 md:p-1.5 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
              aria-label={`View ${r.student.user.name}'s evaluation`}
            >
              <Eye size={14} />
            </button>
            {mine && onEdit && (
              <button
                onClick={() => onEdit(r)}
                className="p-1 md:p-1.5 rounded-md border border-amber-200 text-amber-600 hover:bg-amber-50"
                aria-label={`Edit ${r.student.user.name}'s evaluation`}
              >
                <Pencil size={14} />
              </button>
            )}
            {mine && onDelete && (
              <button
                onClick={() => onDelete(r)}
                className="p-1 md:p-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                aria-label={`Delete ${r.student.user.name}'s evaluation`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onPageChange(1);
          }}
          placeholder="Search by trainee, ID, course or evaluator..."
          className="w-full h-10 md:h-12 pl-9 md:pl-11 pr-3 md:pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">{emptyMessage}</p>
      ) : (
        <>
          <DataTable
            title=""
            icon={Star}
            columns={columns}
            data={rows}
            keyField="id"
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                disabled={page === 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className="p-2 rounded-md border border-gray-300 text-gray-500 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => onPageChange(n)}
                  className={`w-9 h-9 rounded-md text-sm font-medium ${
                    n === page
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className="p-2 rounded-md border border-gray-300 text-gray-500 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
