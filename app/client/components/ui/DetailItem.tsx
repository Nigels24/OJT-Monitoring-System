import { LucideIcon } from "lucide-react";

interface DetailItemProps {
  label: string;
  value: string | number | null | undefined;
  icon?: LucideIcon;
  className?: string;
}

export default function DetailItem({ label, value, icon: Icon, className = "" }: DetailItemProps) {
  return (
    <div className={`flex items-start gap-3 p-3 bg-gray-50 rounded-lg ${className}`}>
      {Icon && <Icon size={18} className="text-blue-600 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          {label}
        </p>
        <p className="text-sm text-gray-900 break-words">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}