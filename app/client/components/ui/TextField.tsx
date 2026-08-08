import { InputHTMLAttributes } from "react";
import { LucideIcon } from "lucide-react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelIcon?: LucideIcon;
  fieldIcon?: LucideIcon;
}

export default function TextField({
  label,
  labelIcon: LabelIcon,
  fieldIcon: FieldIcon,
  className = "",
  ...rest
}: TextFieldProps) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
        {LabelIcon && <LabelIcon size={15} className="text-blue-600" />}
        {label}
      </label>
      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        {FieldIcon && (
          <span className="px-3 text-gray-400">
            <FieldIcon size={18} />
          </span>
        )}
        <input
          {...rest}
          className="flex-1 h-11 outline-none pr-3 text-gray-900 bg-transparent"
        />
      </div>
    </div>
  );
}
