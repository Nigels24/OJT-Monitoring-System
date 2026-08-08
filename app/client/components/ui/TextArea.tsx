import { TextareaHTMLAttributes } from "react";
import { LucideIcon } from "lucide-react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  labelIcon?: LucideIcon;
  fieldIcon?: LucideIcon;
}

export default function TextArea({
  label,
  labelIcon: LabelIcon,
  fieldIcon: FieldIcon,
  className = "",
  ...rest
}: TextAreaProps) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
        {LabelIcon && <LabelIcon size={15} className="text-blue-600" />}
        {label}
      </label>
      <div className="flex items-start border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        {FieldIcon && (
          <span className="px-3 pt-3 text-gray-400">
            <FieldIcon size={18} />
          </span>
        )}
        <textarea
          {...rest}
          className="flex-1 outline-none pr-3 py-3 text-gray-900 bg-transparent resize-none"
        />
      </div>
    </div>
  );
}