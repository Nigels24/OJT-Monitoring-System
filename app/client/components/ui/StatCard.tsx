import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  subtextIcon?: LucideIcon;
  variant?: "default" | "accent";
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  subtext,
  subtextIcon: SubtextIcon,
  variant = "default",
}: StatCardProps) {
  const isAccent = variant === "accent";

  return (
    <div
      className={`rounded-xl p-5 flex flex-col gap-2 ${
        isAccent
          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
          : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <span
          className={`text-xs font-medium uppercase tracking-wide ${
            isAccent ? "text-white/80" : "text-gray-500"
          }`}
        >
          {label}
        </span>
        <Icon
          size={22}
          className={isAccent ? "text-white/70" : "text-gray-300"}
        />
      </div>

      <span
        className={`text-3xl font-bold ${
          isAccent ? "text-white" : "text-gray-900"
        }`}
      >
        {value}
      </span>

      {subtext && (
        <span
          className={`flex items-center gap-1 text-xs font-medium ${
            isAccent ? "text-white/90" : "text-green-600"
          }`}
        >
          {SubtextIcon && <SubtextIcon size={13} />}
          {subtext}
        </span>
      )}
    </div>
  );
}
