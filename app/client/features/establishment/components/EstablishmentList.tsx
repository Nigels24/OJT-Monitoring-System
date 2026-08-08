import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import { Eye, Pencil, Trash2, MessageCircle, Building2, MapPin, User, Phone, Mail, CalendarCheck, Users } from "lucide-react";
import { Establishment } from "@/lib/api/establishmentApi";

interface EstablishmentListProps {
  establishments: Establishment[];
  isLoading: boolean;
  search: string;
  page: number;
  totalPages: number;
  paged: Establishment[];
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onView: (establishment: Establishment) => void;
  onEdit: (establishment: Establishment) => void;
  onDelete: (establishment: Establishment) => void;
}

export default function EstablishmentList({
  establishments,
  isLoading,
  search,
  page,
  totalPages,
  paged,
  onSearchChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}: EstablishmentListProps) {
  const [localSearch, setLocalSearch] = useState(search);

  // Sync local search with parent search prop
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
      onPageChange(1);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [localSearch, onSearchChange, onPageChange]);

  const columns: DataTableColumn<Establishment>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <span className="font-medium text-gray-900">{r.name}</span>
      ),
    },
    {
      key: "industryType",
      label: "Industry",
      render: (r) => r.industryType || "—",
    },
    {
      key: "address",
      label: "Location",
      render: (r) => `${r.region || ""}, ${r.city || ""}`.trim() || "—",
    },
    {
      key: "coordinator",
      label: "Coordinator",
      render: (r) => {
        const fullName = [r.coordinatorFirstName, r.coordinatorLastName]
          .filter(Boolean)
          .join(" ");
        return (
          <div>
            <div className="font-semibold text-gray-900">{fullName || "—"}</div>
            {r.coordinatorPosition && (
              <div className="text-xs text-gray-500">
                {r.coordinatorPosition}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "coordinatorContact",
      label: "Contact",
      render: (r) => r.coordinatorContact || "—",
    },
    {
      key: "students",
      label: "Students",
      render: (r) => r._count?.students ?? 0,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            r.status === "ACTIVE"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {r.status === "ACTIVE" ? "Active" : "Inactive"}
        </span>
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
            aria-label="View"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => onEdit(r)}
            className="p-1 md:p-1.5 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
            aria-label="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(r)}
            className="p-1 md:p-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
          <button
            className="p-1 md:p-1.5 rounded-md border border-green-200 text-green-600 hover:bg-green-50"
            aria-label="Message"
          >
            <MessageCircle size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mt-6">
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={localSearch}
          onChange={(e) => {
            setLocalSearch(e.target.value);
          }}
          placeholder="Search by establishment name, industry, coordinator..."
          className="w-full h-10 md:h-12 pl-9 md:pl-11 pr-3 md:pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <>
          <DataTable
            title=""
            icon={Building2}
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
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (n) => (
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
                )
              )}
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