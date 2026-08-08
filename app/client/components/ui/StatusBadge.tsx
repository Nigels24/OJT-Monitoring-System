export type BadgeVariant =
  | "pending"
  | "approved"
  | "declined"
  | "completed"
  | "onProgress"
  | "good"
  | "veryGood"
  | "excellent"
  | "active"
  | "neutral";

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-700",
  onProgress: "bg-amber-100 text-amber-700",
  good: "bg-blue-100 text-blue-700",
  veryGood: "bg-sky-100 text-sky-700",
  excellent: "bg-emerald-100 text-emerald-700",
  active: "bg-green-100 text-green-700",
  neutral: "bg-gray-100 text-gray-600",
};

export default function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${VARIANT_STYLES[variant]}`}
    >
      {label}
    </span>
  );
}
