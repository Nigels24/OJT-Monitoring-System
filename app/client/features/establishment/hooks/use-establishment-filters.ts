import { useMemo, useState } from "react";
import type { Establishment } from "@/lib/api/establishmentApi";

/**
 * The Establishments list's search, filters and pagination.
 *
 * In its own hook, deliberately apart from `useEstablishment`: that hook owns
 * the add/edit form and the PSGC address cascade (`isPopulatingRef`), and
 * nothing here may touch either. Everything is client-side over the list the
 * page already loads — no request, no query params — and the province and
 * city options are the distinct values present in that list, never the PSGC
 * data, so filtering makes no calls and shares no state with the form.
 */
export type SupervisorFilter = "" | "with" | "without";
export type StatusFilter = "" | "ACTIVE" | "INACTIVE";

const PAGE_SIZE = 5;

/** Distinct non-empty values, sorted for display. */
function distinct(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v?.trim()))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function useEstablishmentFilters(
  establishments: Establishment[] | undefined,
) {
  const all = useMemo(() => establishments ?? [], [establishments]);

  const [search, setSearch] = useState("");
  const [industry, setIndustryState] = useState("");
  const [province, setProvinceState] = useState("");
  const [city, setCityState] = useState("");
  const [status, setStatusState] = useState<StatusFilter>("");
  const [supervisor, setSupervisorState] = useState<SupervisorFilter>("");
  const [page, setPage] = useState(1);

  // Every filter change goes back to page 1, in the handler — not an effect.
  const setIndustry = (value: string) => {
    setIndustryState(value);
    setPage(1);
  };
  /** City depends on province, so a new province clears it. */
  const setProvince = (value: string) => {
    setProvinceState(value);
    setCityState("");
    setPage(1);
  };
  const setCity = (value: string) => {
    setCityState(value);
    setPage(1);
  };
  const setStatus = (value: StatusFilter) => {
    setStatusState(value);
    setPage(1);
  };
  const setSupervisor = (value: SupervisorFilter) => {
    setSupervisorState(value);
    setPage(1);
  };

  const industryOptions = useMemo(
    () => distinct(all.map((e) => e.industryType)),
    [all],
  );
  const provinceOptions = useMemo(
    () => distinct(all.map((e) => e.province)),
    [all],
  );
  /** Only the cities of the chosen province; empty until one is chosen. */
  const cityOptions = useMemo(
    () =>
      province
        ? distinct(all.filter((e) => e.province === province).map((e) => e.city))
        : [],
    [all, province],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((e) => {
      if (
        term &&
        !e.name.toLowerCase().includes(term) &&
        !(e.supervisor?.name.toLowerCase().includes(term) ?? false)
      ) {
        return false;
      }
      if (industry && e.industryType !== industry) return false;
      if (province && e.province !== province) return false;
      if (city && e.city !== city) return false;
      if (status && e.status !== status) return false;
      if (supervisor === "with" && !e.supervisor) return false;
      if (supervisor === "without" && e.supervisor) return false;
      return true;
    });
  }, [all, search, industry, province, city, status, supervisor]);

  const isFiltered =
    search.trim() !== "" ||
    !!industry ||
    !!province ||
    !!city ||
    !!status ||
    !!supervisor;

  const clearFilters = () => {
    setSearch("");
    setIndustryState("");
    setProvinceState("");
    setCityState("");
    setStatusState("");
    setSupervisorState("");
    setPage(1);
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    // Plain state setters for the list's debounced search box: stable
    // identities, so its debounce effect re-runs only when the text changes.
    search,
    setSearch,
    page,
    setPage,

    industry,
    province,
    city,
    status,
    supervisor,
    setIndustry,
    setProvince,
    setCity,
    setStatus,
    setSupervisor,

    industryOptions,
    provinceOptions,
    cityOptions,

    paged,
    totalPages,
    shownCount: filtered.length,
    totalCount: all.length,
    isFiltered,
    clearFilters,
  };
}

export type EstablishmentFilters = ReturnType<typeof useEstablishmentFilters>;
