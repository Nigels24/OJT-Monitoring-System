import { Star, User, Building2, CalendarDays, IdCard } from "lucide-react";
import ViewDialog from "@/components/ui/ViewDialog";
import DetailItem from "@/components/ui/DetailItem";
import { Evaluation } from "@/lib/api/evaluationApi";

interface EvaluationViewDialogProps {
  open: boolean;
  evaluation: Evaluation | null;
  onClose: () => void;
}

function dateOrNull(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString() : null;
}

/**
 * The filled-in sheet, read-only.
 *
 * Every section, item, letter and wording comes from the evaluation's own
 * `sections` — the server sends them with the scores, so this renders the same
 * sheet the supervisor filled in without a client-side copy of the form.
 */
export default function EvaluationViewDialog({
  open,
  evaluation,
  onClose,
}: EvaluationViewDialogProps) {
  return (
    <ViewDialog
      open={open}
      title="On-the-Job Training Performance Evaluation Sheet"
      icon={Star}
      onClose={onClose}
    >
      {evaluation && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-gray-800 bg-gray-50 p-4 flex items-center justify-between gap-4">
            <span className="text-sm font-bold tracking-wide text-gray-900">
              TOTAL RATING
            </span>
            <span className="text-2xl font-bold text-gray-900 tabular-nums">
              {evaluation.totalRating}
              <span className="text-sm font-normal text-gray-500">
                {" "}
                / {evaluation.maxTotalRating}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <DetailItem
              label="Name of the Trainee"
              value={evaluation.student.user.name}
              icon={User}
            />
            <DetailItem
              label="Student ID"
              value={evaluation.student.studentIdNumber}
              icon={IdCard}
            />
            <DetailItem
              label="Training Employed at"
              value={
                evaluation.trainingEmployedAt ??
                evaluation.student.establishment?.name
              }
              icon={Building2}
            />
            <DetailItem
              label="Date Evaluated"
              value={new Date(evaluation.createdAt).toLocaleDateString()}
              icon={CalendarDays}
            />
            <DetailItem
              label="Training Date Started"
              value={dateOrNull(evaluation.trainingStartedAt)}
              icon={CalendarDays}
            />
            <DetailItem
              label="Training Date Ended"
              value={dateOrNull(evaluation.trainingEndedAt)}
              icon={CalendarDays}
            />
          </div>

          <div className="space-y-4 border-t border-gray-200 pt-4">
            {evaluation.sections.map((section) => (
              <div key={section.key}>
                <div className="flex items-center justify-between gap-3 bg-gray-800 text-white px-3 py-2 rounded-t-lg">
                  <h3 className="text-xs md:text-sm font-bold tracking-wide">
                    {section.numeral}. {section.label} ({section.maxPoints}{" "}
                    POINTS)
                  </h3>
                  <span className="text-xs font-semibold shrink-0 tabular-nums">
                    {section.total} / {section.maxPoints}
                  </span>
                </div>
                <div className="rounded-b-lg border border-t-0 border-gray-300 divide-y divide-gray-100">
                  {section.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="text-gray-600">
                        <span className="font-semibold text-gray-500 mr-1.5">
                          {item.letter}.
                        </span>
                        {item.label}
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums shrink-0">
                        {item.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 border-t border-gray-200 pt-4">
            <DetailItem
              label="Evaluated by"
              value={evaluation.evaluatorName ?? evaluation.supervisor.user.name}
              icon={User}
            />
            <DetailItem
              label="Position"
              value={
                evaluation.evaluatorPosition ?? evaluation.supervisor.position
              }
            />
          </div>
        </div>
      )}
    </ViewDialog>
  );
}
