import { Star, User, Building2, CalendarDays, IdCard } from "lucide-react";
import ViewDialog from "@/components/ui/ViewDialog";
import DetailItem from "@/components/ui/DetailItem";
import StatusBadge from "@/components/ui/StatusBadge";
import { Evaluation } from "@/lib/api/evaluationApi";
import { CATEGORIES, levelBadgeVariant } from "../rubric";

interface EvaluationViewDialogProps {
  open: boolean;
  evaluation: Evaluation | null;
  onClose: () => void;
}

export default function EvaluationViewDialog({
  open,
  evaluation,
  onClose,
}: EvaluationViewDialogProps) {
  return (
    <ViewDialog
      open={open}
      title="Evaluation Details"
      icon={Star}
      onClose={onClose}
    >
      {evaluation && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-gray-500">Overall rating</div>
              <div className="text-2xl font-semibold text-gray-900">
                {evaluation.overallRating.toFixed(1)}
                <span className="text-sm font-normal text-gray-500"> / 5</span>
              </div>
            </div>
            <StatusBadge
              label={evaluation.performanceLevel}
              variant={levelBadgeVariant(evaluation.performanceLevel)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <DetailItem
              label="Student"
              value={evaluation.student.user.name}
              icon={User}
            />
            <DetailItem
              label="Student ID"
              value={evaluation.student.studentIdNumber}
              icon={IdCard}
            />
            <DetailItem
              label="Establishment"
              value={evaluation.student.establishment?.name}
              icon={Building2}
            />
            <DetailItem
              label="Evaluator"
              value={`${evaluation.supervisor.user.name}${
                evaluation.supervisor.position
                  ? ` (${evaluation.supervisor.position})`
                  : ""
              }`}
              icon={User}
            />
            <DetailItem
              label="Evaluation Period"
              value={
                evaluation.periodStart || evaluation.periodEnd
                  ? `${
                      evaluation.periodStart
                        ? new Date(evaluation.periodStart).toLocaleDateString()
                        : "…"
                    } – ${
                      evaluation.periodEnd
                        ? new Date(evaluation.periodEnd).toLocaleDateString()
                        : "…"
                    }`
                  : null
              }
              icon={CalendarDays}
            />
            <DetailItem
              label="Date Evaluated"
              value={new Date(evaluation.createdAt).toLocaleDateString()}
              icon={CalendarDays}
            />
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-base font-semibold text-gray-800 mb-3">
              Scores
            </h3>
            <div className="space-y-4">
              {CATEGORIES.map((category) => {
                const summary = evaluation.categories.find(
                  (c) => c.key === category.key,
                );
                return (
                  <div key={category.key}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {category.label}
                        <span className="text-xs text-gray-500 font-normal">
                          {" "}
                          ({Math.round(category.weight * 100)}%)
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {summary ? summary.average.toFixed(1) : "—"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                      {category.criteria.map((criterion) => (
                        <div
                          key={criterion.key}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <span className="text-gray-600">
                            {criterion.label}
                          </span>
                          <span className="font-medium text-gray-900">
                            {evaluation[criterion.key]} / 5
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {(evaluation.comments || evaluation.recommendations) && (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              {evaluation.comments && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">
                    Comments
                  </h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {evaluation.comments}
                  </p>
                </div>
              )}
              {evaluation.recommendations && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">
                    Recommendations
                  </h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {evaluation.recommendations}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ViewDialog>
  );
}
