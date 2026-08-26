"use client";

import { InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff, LucideIcon } from "lucide-react";

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
  type,
  ...rest
}: TextFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

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
          type={isPassword ? (visible ? "text" : "password") : type}
          className="flex-1 h-11 outline-none pr-3 text-gray-900 bg-transparent"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => {
              setVisible((v) => !v);
            }}
            aria-label={visible ? "Hide password" : "Show password"}
            className="px-3 text-gray-400 hover:text-gray-600"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
