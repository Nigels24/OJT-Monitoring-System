import { LucideIcon } from "lucide-react";

interface RankedBarItem {
  label: string;
  value: number;
  badge?: string;
  badgeVariant?: "green" | "amber";
}

interface RankedBarListProps {
  title: string;
  icon: LucideIcon;
  items: RankedBarItem[];
}

const BADGE_STYLES = {
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
};

export default function RankedBarList({
  title,
  icon: Icon,
  items,
}: RankedBarListProps) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="bg-white rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-gray-500" />
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700">
                {item.label}
              </span>
              {item.badge && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    BADGE_STYLES[item.badgeVariant ?? "green"]
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
