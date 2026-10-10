import { FilterX } from "lucide-react";
import SelectField from "@/components/ui/SelectField";
import type {
  EstablishmentFilters,
  StatusFilter,
  SupervisorFilter,
} from "../hooks/use-establishment-filters";

interface EstablishmentFilterBarProps {
  filters: EstablishmentFilters;
}

/**
 * Industry / province / city / status / supervisor filters, the
 * "showing X of Y" count and Clear filters. Laid out like the Student
 * Management page's filter row. The search box stays in `EstablishmentList`.
 *
 * Options are the distinct values in the loaded list, so a filter can never
 * offer something that matches nothing. City is disabled until a province is
 * picked.
 */
export default function EstablishmentFilterBar({
  filters,
}: EstablishmentFilterBarProps) {
  const all = (label: string) => ({ label, value: "" });

  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <SelectField
          value={filters.industry}
          onChange={filters.setIndustry}
          placeholder="All Industries"
          options={[
            all("All Industries"),
            ...filters.industryOptions.map((v) => ({ label: v, value: v })),
          ]}
          className="w-full"
        />
        <SelectField
          value={filters.province}
          onChange={filters.setProvince}
          placeholder="All Provinces"
          options={[
            all("All Provinces"),
            ...filters.provinceOptions.map((v) => ({ label: v, value: v })),
          ]}
          className="w-full"
        />
        <SelectField
          value={filters.city}
          onChange={filters.setCity}
          placeholder={filters.province ? "All Cities" : "Pick a province first"}
          options={[
            all("All Cities"),
            ...filters.cityOptions.map((v) => ({ label: v, value: v })),
          ]}
          disabled={!filters.province}
          className="w-full"
        />
        <SelectField
          value={filters.status}
          onChange={(v) => filters.setStatus(v as StatusFilter)}
          placeholder="All Statuses"
          options={[
            all("All Statuses"),
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
          ]}
          className="w-full"
        />
        <SelectField
          value={filters.supervisor}
          onChange={(v) => filters.setSupervisor(v as SupervisorFilter)}
          placeholder="Any Supervisor"
          options={[
            all("Any Supervisor"),
            { label: "Has supervisor", value: "with" },
            { label: "No supervisor", value: "without" },
          ]}
          className="w-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span>
          Showing {filters.shownCount} of {filters.totalCount} establishment
          {filters.totalCount === 1 ? "" : "s"}
        </span>
        {filters.isFiltered && (
          <button
            type="button"
            onClick={filters.clearFilters}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50"
          >
            <FilterX size={14} />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
