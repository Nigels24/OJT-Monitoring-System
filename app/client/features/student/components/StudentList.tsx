import { useEffect, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Users,
  FileText,
} from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import ProgressBar from "@/components/ui/ProgressBar";
import SelectField from "@/components/ui/SelectField";
import StatusBadge, { BadgeVariant } from "@/components/ui/StatusBadge";
import { Student, StudentStatus } from "@/lib/api/studentApi";

interface StudentListProps {
  isLoading: boolean;
  search: string;
  statusFilter: StudentStatus | "";
  page: number;
  totalPages: number;
  paged: Student[];
  statusOptions: StudentStatus[];
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: StudentStatus | "") => void;
  onPageChange: (page: number) => void;
  onView: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}

const STATUS_VARIANT: Record<StudentStatus, BadgeVariant> = {
  ACTIVE: "active",
  PENDING: "pending",
  COMPLETED: "completed",
  INACTIVE: "neutral",
};

const STATUS_LABEL: Record<StudentStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  COMPLETED: "Completed",
  INACTIVE: "Inactive",
};

export default function StudentList({
  isLoading,
  search,
  statusFilter,
  page,
  totalPages,
  paged,
  statusOptions,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}: StudentListProps) {
  // Seeded once from the prop. The parent's `search` is only ever changed by
  // the debounce below, so there is nothing to sync back the other way.
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce, matching EstablishmentList.
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
      onPageChange(1);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [localSearch, onSearchChange, onPageChange]);

  const columns: DataTableColumn<Student>[] = [
    {
      key: "studentIdNumber",
      label: "ID",
      render: (r) => (
        <span className="font-mono text-xs text-gray-700">
          {r.studentIdNumber}
        </span>
      ),
    },
    {
      key: "student",
      label: "Student",
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900">{r.user.name}</div>
          <div className="text-xs text-gray-500">{r.user.email}</div>
        </div>
      ),
    },
    {
      key: "course",
      label: "Course",
      render: (r) => (
        <div>
          <div>{r.course || "—"}</div>
          {r.yearLevel && (
            <div className="text-xs text-gray-500">{r.yearLevel}</div>
          )}
        </div>
      ),
    },
    {
      key: "establishment",
      label: "Establishment",
      render: (r) => r.establishment?.name || "Unassigned",
    },
    {
      key: "contactNumber",
      label: "Contact",
      render: (r) => r.contactNumber || "—",
    },
    {
      key: "hours",
      label: "Hours",
      render: (r) => (
        <span className="whitespace-nowrap">
          {r.completedHours}/{r.requiredHours} hrs
        </span>
      ),
    },
    {
      key: "progress",
      label: "Progress",
      render: (r) => (
        <div className="min-w-28">
          <ProgressBar
            value={r.completedHours}
            max={r.requiredHours || 1}
            variant="thin"
            showLabel
            colorByValue
          />
        </div>
      ),
    },
    {
      key: "credentials",
      label: "Credentials",
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-gray-600">
          <FileText size={14} />
          {r._count?.credentials ?? 0}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge
          label={STATUS_LABEL[r.status]}
          variant={STATUS_VARIANT[r.status]}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex gap-1 md:gap-2">
          <button
            onClick={() => onView(r)}
            className="p-1 md:p-1.5 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
            aria-label={`View ${r.user.name}`}
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => onEdit(r)}
            className="p-1 md:p-1.5 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
            aria-label={`Edit ${r.user.name}`}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(r)}
            className="p-1 md:p-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
            aria-label={`Delete ${r.user.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
            }}
            placeholder="Search by name, student ID, email, course, establishment..."
            className="w-full h-10 md:h-12 pl-9 md:pl-11 pr-3 md:pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
          />
        </div>
        <div className="md:w-56">
          <SelectField
            value={statusFilter}
            onChange={(value) => {
              onStatusFilterChange(value as StudentStatus | "");
              onPageChange(1);
            }}
            placeholder="All Statuses"
            options={[
              { label: "All Statuses", value: "" },
              ...statusOptions.map((s) => ({
                label: STATUS_LABEL[s],
                value: s,
              })),
            ]}
            className="w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : paged.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          No students match your filters.
        </p>
      ) : (
        <>
          <DataTable
            title=""
            icon={Users}
            columns={columns}
            data={paged}
            keyField="id"
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                disabled={page === 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className="p-2 rounded-md border border-gray-300 text-gray-500 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => onPageChange(n)}
                  className={`w-9 h-9 rounded-md text-sm font-medium ${
                    n === page
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className="p-2 rounded-md border border-gray-300 text-gray-500 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
