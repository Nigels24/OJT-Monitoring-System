import { CheckCircle2, Circle } from "lucide-react";
import { DOCUMENT_TYPES, DocumentType } from "@/lib/api/studentPortalApi";
import { DOCUMENT_TYPE_LABEL } from "./documentType";

interface DocumentChecklistProps {
  uploadedTypes: Set<DocumentType>;
}

/** The six requirements, so the student can see what is still missing. */
export default function DocumentChecklist({
  uploadedTypes,
}: DocumentChecklistProps) {
  const submitted = DOCUMENT_TYPES.filter((t) => uploadedTypes.has(t)).length;

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        <span className="font-semibold text-gray-900">
          {submitted} of {DOCUMENT_TYPES.length}
        </span>{" "}
        submitted
      </p>
      <ul className="space-y-2">
        {DOCUMENT_TYPES.map((type) => {
          const done = uploadedTypes.has(type);
          return (
            <li key={type} className="flex items-center gap-2 text-sm">
              {done ? (
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              ) : (
                <Circle size={16} className="text-gray-300 shrink-0" />
              )}
              <span className={done ? "text-gray-900" : "text-gray-500"}>
                {DOCUMENT_TYPE_LABEL[type]}
              </span>
              <span className="sr-only">
                {done ? "(submitted)" : "(missing)"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
