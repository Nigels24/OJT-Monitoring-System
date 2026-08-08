import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  title: string;
  icon: LucideIcon;
  columns: DataTableColumn<T>[];
  data: T[];
  keyField: keyof T;
  actionLabel?: string;
  onAction?: () => void;
}

export default function DataTable<T>({
  title,
  icon: Icon,
  columns,
  data,
  keyField,
  actionLabel,
  onAction,
}: DataTableProps<T>) {
  return (
    <div className="bg-white rounded-xl p-3 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Icon size={16} className="md:size-18 text-gray-500" />
          <h3 className="font-semibold text-gray-800 text-base md:text-lg">{title}</h3>
        </div>
        {actionLabel && (
          <button
            onClick={onAction}
            className="text-sm font-medium text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors self-start sm:self-auto"
          >
            {actionLabel}
          </button>
        )}
      </div>

      <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left font-semibold text-gray-700 pb-3 pr-4 whitespace-nowrap text-xs md:text-sm"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={String(row[keyField])}
                className="border-b border-gray-50 last:border-0"
              >
                {columns.map((col) => (
                  <td key={col.key} className="py-3 pr-4 text-gray-700 text-xs md:text-sm">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
