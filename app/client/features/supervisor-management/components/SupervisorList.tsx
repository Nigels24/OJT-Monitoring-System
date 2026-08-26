import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  UserCog,
  KeyRound,
  Trash2,
} from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import SearchInput from "@/components/ui/SearchInput";
import { CoordinatorSupervisor } from "@/lib/api/supervisorManagementApi";

interface SupervisorListProps {
  isLoading: boolean;
  search: string;
  page: number;
  totalPages: number;
  paged: CoordinatorSupervisor[];
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onResetPassword: (supervisor: CoordinatorSupervisor) => void;
  onDelete: (supervisor: CoordinatorSupervisor) => void;
}

export default function SupervisorList({
  isLoading,
  search,
  page,
  totalPages,
  paged,
  onSearchChange,
  onPageChange,
  onResetPassword,
  onDelete,
}: SupervisorListProps) {
  // Seeded once from the prop. The parent's `search` is only ever changed by
  // the debounce below, so there is nothing to sync back the other way.
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce, matching StudentList/EstablishmentList.
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
      onPageChange(1);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [localSearch, onSearchChange, onPageChange]);

  const columns: DataTableColumn<CoordinatorSupervisor>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <div className="font-semibold text-gray-900">{r.user.name}</div>
      ),
    },
    {
      key: "username",
      label: "Username",
      render: (r) => (
        <span className="font-mono text-xs text-gray-700">
          {r.user.username || "—"}
        </span>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (r) => r.user.email,
    },
    {
      key: "establishment",
      label: "Establishment",
      render: (r) => r.establishment?.name || "Unassigned",
    },
    {
      key: "position",
      label: "Position",
      render: (r) => r.position || "—",
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex gap-1 md:gap-2">
          <button
            onClick={() => onResetPassword(r)}
            className="p-1 md:p-1.5 rounded-md border border-amber-200 text-amber-600 hover:bg-amber-50"
            aria-label={`Reset ${r.user.name}'s password`}
            title="Reset password"
          >
            <KeyRound size={14} />
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
      <div className="mb-4">
        <SearchInput
          value={localSearch}
          onChange={(e) => {
            setLocalSearch(e.target.value);
          }}
          placeholder="Search by name, username, email, establishment, position..."
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : paged.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          No supervisors match your search.
        </p>
      ) : (
        <>
          <DataTable
            title=""
            icon={UserCog}
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
