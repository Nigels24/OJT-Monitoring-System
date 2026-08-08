import { LucideIcon } from "lucide-react";

export interface TabOption<T extends string> {
  key: T;
  label: string;
  icon?: LucideIcon;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function Tabs<T extends string>({
  options,
  value,
  onChange,
}: TabsProps<T>) {
  return (
    <div className="flex border border-blue-200 rounded-lg overflow-hidden">
      {options.map(({ key, label, icon: Icon }, i) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "bg-white text-blue-600 hover:bg-blue-50"
            } ${i !== 0 ? "border-l border-blue-200" : ""}`}
          >
            {Icon && <Icon size={16} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
