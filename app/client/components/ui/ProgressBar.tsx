interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: "thick" | "thin";
  showLabel?: boolean;
  colorByValue?: boolean;
}

function getColor(percent: number): string {
  if (percent >= 90) return "bg-green-500";
  if (percent >= 80) return "bg-amber-500";
  return "bg-red-500";
}

export default function ProgressBar({
  value,
  max = 100,
  variant = "thick",
  showLabel = false,
  colorByValue = false,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  const barColor = colorByValue ? getColor(percent) : "bg-indigo-500";

  if (variant === "thin") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span
          className={`text-sm font-semibold w-12 text-right ${
            colorByValue
              ? percent >= 90
                ? "text-green-600"
                : percent >= 80
                  ? "text-amber-600"
                  : "text-red-600"
              : "text-gray-700"
          }`}
        >
          {percent}%
        </span>
      </div>
    );
  }

  return (
    <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
      <div
        className={`h-full rounded-full ${barColor} transition-all`}
        style={{ width: `${percent}%` }}
      />
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
          {value}/{max} hours
        </span>
      )}
    </div>
  );
}
