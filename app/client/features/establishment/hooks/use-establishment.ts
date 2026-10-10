import { useState, useEffect, useRef } from "react";
import {
  useGetEstablishmentsQuery,
  useCreateEstablishmentMutation,
  useUpdateEstablishmentMutation,
  useDeleteEstablishmentMutation,
  useAddEstablishmentSupervisorMutation,
  Establishment,
} from "@/lib/api/establishmentApi";
import { establishmentLabel } from "@/lib/establishment";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
import {
  emailOutcomeOf,
  type IssuedCredentials,
} from "@/features/account/CredentialsDialog";
import { useSupervisorFields } from "./use-supervisor-fields";
import {
  getAllRegions,
  getProvincesByRegion,
  getMunicipalitiesByProvince,
  getBarangaysByMunicipality,
} from "@aivangogh/ph-address";
import type {
  PHRegion,
  PHProvince,
  PHMunicipality,
  PHBarangay,
} from "@aivangogh/ph-address";

const INDUSTRY_OPTIONS = [
  "Information Technology",
  "Business Process Outsourcing",
  "Banking & Finance",
  "Hospitality & Tourism",
  "Manufacturing",
  "Healthcare",
  "Education",
  "Retail",
  "Construction",
  "Other",
];

const EMPTY_FORM = {
  name: "",
  industryType: "",
  streetAddress: "",
  region: "",
  barangay: "",
  city: "",
  province: "",
  zipCode: "",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
};

interface LocationOption {
  code: string;
  name: string;
}

export function useEstablishment() {
  const [form, setForm] = useState(EMPTY_FORM);
  // The optional branch, in its own state rather than in `form`: nothing in
  // the address cascade below reads or writes it, and keeping it out of
  // `form` means no existing setForm call had to change for it.
  const [branch, setBranch] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Establishment | null>(null);
  const [viewTarget, setViewTarget] = useState<Establishment | null>(null);
  const [editTarget, setEditTarget] = useState<Establishment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { showSuccess, showError } = useSnackbar();

  // The supervisor, kept out of `form` so the address cascade below can never
  // reset or repopulate it (see use-supervisor-fields.ts). Two instances: the
  // optional section on the create form, and the list's "Add supervisor"
  // dialog for an establishment that has none.
  const newSupervisor = useSupervisorFields();
  const laterSupervisor = useSupervisorFields();
  const [addSupervisorTarget, setAddSupervisorTarget] =
    useState<Establishment | null>(null);
  const [addSupervisorError, setAddSupervisorError] = useState("");
  /**
   * Login details just generated for a supervisor, shown once. Cleared on
   * close and kept nowhere else, so nothing can reopen it.
   */
  const [issuedCredentials, setIssuedCredentials] =
    useState<IssuedCredentials | null>(null);

  // Location state
  const [regions, setRegions] = useState<LocationOption[]>([]);
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [municipalities, setMunicipalities] = useState<LocationOption[]>([]);
  const [barangays, setBarangays] = useState<LocationOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  const [selectedBarangay, setSelectedBarangay] = useState<string>("");

  // When true, the location-cascade effects below skip their "reset children"
  // step. handleEdit sets this before programmatically restoring a saved
  // region/province/municipality/barangay, so the cascade effects (which
  // normally clear children when a user picks a new parent) don't wipe out
  // the values we just restored.
  const isPopulatingRef = useRef(false);

  const { data: establishments, isLoading } = useGetEstablishmentsQuery();
  const [createEstablishment, { isLoading: isCreating }] =
    useCreateEstablishmentMutation();
  const [updateEstablishment, { isLoading: isUpdating }] =
    useUpdateEstablishmentMutation();
  const [deleteEstablishment] = useDeleteEstablishmentMutation();
  const [addEstablishmentSupervisor, { isLoading: isAddingSupervisor }] =
    useAddEstablishmentSupervisorMutation();

  // Load all regions on mount
  useEffect(() => {
    const allRegions = getAllRegions();
    setRegions(
      allRegions.map((r: PHRegion) => ({
        code: r.psgcCode,
        name: r.name,
      })),
    );
  }, []);

  // Load provinces when region changes
  useEffect(() => {
    if (selectedRegion) {
      const provinceList = getProvincesByRegion(selectedRegion);
      setProvinces(
        provinceList.map((p: PHProvince) => ({
          code: p.psgcCode,
          name: p.name,
        })),
      );
    } else {
      setProvinces([]);
    }
    if (!isPopulatingRef.current) {
      setSelectedProvince("");
      setSelectedMunicipality("");
      setSelectedBarangay("");
    }
  }, [selectedRegion]);

  // Load municipalities when province changes
  useEffect(() => {
    if (selectedProvince) {
      const municipalityList = getMunicipalitiesByProvince(selectedProvince);
      setMunicipalities(
        municipalityList.map((m: PHMunicipality) => ({
          code: m.psgcCode,
          name: m.name,
        })),
      );
    } else {
      setMunicipalities([]);
    }
    if (!isPopulatingRef.current) {
      setSelectedMunicipality("");
      setSelectedBarangay("");
    }
  }, [selectedProvince]);

  // Load barangays when municipality changes
  useEffect(() => {
    if (selectedMunicipality) {
      const barangayList = getBarangaysByMunicipality(selectedMunicipality);
      setBarangays(
        barangayList.map((b: PHBarangay) => ({
          code: b.psgcCode,
          name: b.name,
        })),
      );
    } else {
      setBarangays([]);
    }
    if (!isPopulatingRef.current) {
      setSelectedBarangay("");
    }
  }, [selectedMunicipality]);

  // Once the state set by handleEdit has been committed and the cascade
  // effects above have run (and skipped their resets), turn the flag back off
  // so normal user interaction resets children as expected again.
  useEffect(() => {
    isPopulatingRef.current = false;
  }, [editTarget]);

  const setField = (key: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (editTarget) {
        await handleUpdate(e);
      } else {
        // The supervisor section is optional, but a half-filled one is a
        // mistake rather than "no supervisor": refuse it instead of silently
        // dropping what was typed.
        if (newSupervisor.isFilled && newSupervisor.missingRequired.length) {
          const message = `Supervisor: fill in ${newSupervisor.missingRequired.join(", ")}, or clear the section to add a supervisor later.`;
          setError(message);
          return;
        }
        const result = await createEstablishment({
          name: form.name,
          branch: branch.trim() || undefined,
          industryType: form.industryType || undefined,
          streetAddress: form.streetAddress || undefined,
          region: form.region || undefined,
          barangay: form.barangay || undefined,
          city: form.city || undefined,
          province: form.province || undefined,
          zipCode: form.zipCode || undefined,
          // No status: a new establishment is always ACTIVE server-side.
          supervisor: newSupervisor.isFilled
            ? newSupervisor.toRequest()
            : undefined,
        }).unwrap();
        setForm(EMPTY_FORM);
        setBranch("");
        newSupervisor.reset();
        setIsDialogOpen(false);
        showSuccess(`"${form.name}" has been created successfully.`);
        // The supervisor's generated username and temporary password, shown
        // once — same dialog and same rules as every other generated login.
        if (result.credentials && result.supervisor) {
          setIssuedCredentials({
            name: result.supervisor.name,
            email: result.supervisor.email,
            username: result.credentials.username,
            tempPassword: result.credentials.tempPassword,
            reason: "created",
            ...emailOutcomeOf(result),
          });
        }
      }
    } catch (err: any) {
      const errorMessage =
        err?.data?.message ||
        (editTarget
          ? "Failed to update establishment."
          : "Failed to create establishment.");
      setError(errorMessage);
      showError(errorMessage);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setError("");
    try {
      await updateEstablishment({
        id: editTarget.id,
        name: form.name,
        // null, not undefined: a cleared branch must clear (CLAUDE.md §4).
        branch: branch.trim() || null,
        industryType: form.industryType || undefined,
        streetAddress: form.streetAddress || undefined,
        region: form.region || undefined,
        barangay: form.barangay || undefined,
        city: form.city || undefined,
        province: form.province || undefined,
        zipCode: form.zipCode || undefined,
        status: form.status,
      }).unwrap();
      setEditTarget(null);
      setForm(EMPTY_FORM);
      setIsDialogOpen(false);
      showSuccess(`"${form.name}" has been updated successfully.`);
    } catch (err: any) {
      const errorMessage =
        err?.data?.message || "Failed to update establishment.";
      setError(errorMessage);
      showError(errorMessage);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEstablishment(deleteTarget.id).unwrap();
      setDeleteTarget(null);
      showSuccess(
        `"${establishmentLabel(deleteTarget)}" has been deleted successfully.`,
      );
    } catch (err: any) {
      const errorMessage =
        err?.data?.message || err?.message || "Failed to delete establishment.";
      setError(errorMessage);
      showError(errorMessage);
    }
  };

  const handleView = (establishment: Establishment) => {
    setViewTarget(establishment);
  };

  const handleEdit = (establishment: Establishment) => {
    isPopulatingRef.current = true;
    setEditTarget(establishment);

    // Reverse lookup location codes from names
    const allRegions = getAllRegions();

    let selectedRegionCode = "";
    let selectedProvinceCode = "";
    let selectedMunicipalityCode = "";
    let selectedBarangayCode = "";

    if (establishment.region) {
      const foundRegion = allRegions.find(
        (r) => r.name === establishment.region,
      );
      if (foundRegion) {
        selectedRegionCode = foundRegion.psgcCode;
      }
    }

    if (establishment.province) {
      for (const region of allRegions) {
        const regionProvinceList = getProvincesByRegion(region.psgcCode);
        const foundProvince = regionProvinceList.find(
          (p) => p.name === establishment.province,
        );
        if (foundProvince) {
          if (!selectedRegionCode) {
            selectedRegionCode = region.psgcCode;
          }
          selectedProvinceCode = foundProvince.psgcCode;
          break;
        }
      }
    }

    if (selectedRegionCode) {
      const provinceList = getProvincesByRegion(selectedRegionCode);
      setProvinces(
        provinceList.map((p: PHProvince) => ({
          code: p.psgcCode,
          name: p.name,
        })),
      );
    }
    setSelectedRegion(selectedRegionCode);
    let municipalityList: readonly PHMunicipality[] = [];
    if (selectedProvinceCode) {
      municipalityList = getMunicipalitiesByProvince(selectedProvinceCode);

      const foundMunicipality = municipalityList.find(
        (m) => m.name === establishment.city,
      );
      if (foundMunicipality) {
        selectedMunicipalityCode = foundMunicipality.psgcCode;
      }

      setMunicipalities(
        municipalityList.map((m: PHMunicipality) => ({
          code: m.psgcCode,
          name: m.name,
        })),
      );
      setSelectedMunicipality(selectedMunicipalityCode);
    }
    setSelectedProvince(selectedProvinceCode);

    if (selectedMunicipalityCode) {
      const barangayList = getBarangaysByMunicipality(selectedMunicipalityCode);
      const foundBarangay = barangayList.find(
        (b) => b.name === establishment.barangay,
      );
      if (foundBarangay) {
        selectedBarangayCode = foundBarangay.psgcCode;
      }
      setBarangays(
        barangayList.map((b: PHBarangay) => ({
          code: b.psgcCode,
          name: b.name,
        })),
      );
    }
    setSelectedBarangay(selectedBarangayCode);

    setForm({
      name: establishment.name || "",
      industryType: establishment.industryType || "",
      streetAddress: establishment.streetAddress || "",
      region: establishment.region || "",
      barangay: establishment.barangay || "",
      city: establishment.city || "",
      province: establishment.province || "",
      zipCode: establishment.zipCode || "",
      status: establishment.status || "ACTIVE",
    });
    setBranch(establishment.branch || "");
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setBranch("");
    newSupervisor.reset();
    setSelectedRegion("");
    setSelectedProvince("");
    setSelectedMunicipality("");
    setSelectedBarangay("");
  };

  const handleOpenAddDialog = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setBranch("");
    newSupervisor.reset();
    setError("");
    setSelectedRegion("");
    setSelectedProvince("");
    setSelectedMunicipality("");
    setSelectedBarangay("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  /** Opens the "Add supervisor" dialog for an establishment that has none. */
  const handleOpenAddSupervisor = (establishment: Establishment) => {
    laterSupervisor.reset();
    setAddSupervisorError("");
    setAddSupervisorTarget(establishment);
  };

  const handleCloseAddSupervisor = () => {
    setAddSupervisorTarget(null);
    laterSupervisor.reset();
    setAddSupervisorError("");
  };

  const handleAddSupervisorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSupervisorTarget) return;
    setAddSupervisorError("");
    try {
      const result = await addEstablishmentSupervisor({
        establishmentId: addSupervisorTarget.id,
        ...laterSupervisor.toRequest(),
      }).unwrap();
      handleCloseAddSupervisor();
      setIssuedCredentials({
        name: result.name,
        email: result.email,
        username: result.credentials.username,
        tempPassword: result.credentials.tempPassword,
        reason: "created",
        ...emailOutcomeOf(result),
      });
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string | string[] } })?.data;
      const message = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || "Failed to add supervisor.";
      setAddSupervisorError(message);
      showError(message);
    }
  };

  const filteredEstablishments =
    establishments?.filter((est: Establishment) => {
      const searchLower = search.toLowerCase();
      return (
        est.name.toLowerCase().includes(searchLower) ||
        est.industryType?.toLowerCase().includes(searchLower) ||
        (est.supervisor?.name.toLowerCase().includes(searchLower) ?? false)
      );
    }) || [];

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(filteredEstablishments.length / PAGE_SIZE);
  const paged = filteredEstablishments.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return {
    form,
    branch,
    setBranch,
    error,
    deleteTarget,
    viewTarget,
    editTarget,
    search,
    page,
    establishments,
    isLoading,
    isCreating,
    isUpdating,
    paged,
    totalPages,
    filteredEstablishments,
    isDialogOpen,

    regions,
    provinces,
    municipalities,
    barangays,
    selectedRegion,
    selectedProvince,
    selectedMunicipality,
    selectedBarangay,
    setSelectedRegion,
    setSelectedProvince,
    setSelectedMunicipality,
    setSelectedBarangay,

    INDUSTRY_OPTIONS,

    newSupervisor,
    laterSupervisor,
    addSupervisorTarget,
    addSupervisorError,
    isAddingSupervisor,
    issuedCredentials,

    setForm,
    setError,
    setDeleteTarget,
    setViewTarget,
    setSearch,
    setPage,
    setField,
    setIsDialogOpen,

    handleSubmit,
    handleUpdate,
    handleDeleteConfirm,
    handleView,
    handleEdit,
    handleOpenAddDialog,
    handleCloseDialog,
    handleOpenAddSupervisor,
    handleCloseAddSupervisor,
    handleAddSupervisorSubmit,
    closeIssuedCredentials: () => {
      setIssuedCredentials(null);
    },
  };
}
