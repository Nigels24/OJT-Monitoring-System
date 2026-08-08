import { useState, useEffect, useRef } from "react";
import {
  useGetEstablishmentsQuery,
  useCreateEstablishmentMutation,
  useUpdateEstablishmentMutation,
  useDeleteEstablishmentMutation,
  Establishment,
} from "@/lib/api/establishmentApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
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

const GENDER_OPTIONS = ["Male", "Female", "Other"];

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
  coordinatorFirstName: "",
  coordinatorLastName: "",
  coordinatorMiddleInitial: "",
  coordinatorAge: "",
  coordinatorGender: "",
  coordinatorPosition: "",
  coordinatorAddress: "",
  coordinatorContact: "",
  coordinatorEmail: "",
};

interface LocationOption {
  code: string;
  name: string;
}

export function useEstablishment() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Establishment | null>(null);
  const [viewTarget, setViewTarget] = useState<Establishment | null>(null);
  const [editTarget, setEditTarget] = useState<Establishment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { showSuccess, showError } = useSnackbar();

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
        await createEstablishment({
          name: form.name,
          industryType: form.industryType || undefined,
          streetAddress: form.streetAddress || undefined,
          region: form.region || undefined,
          barangay: form.barangay || undefined,
          city: form.city || undefined,
          province: form.province || undefined,
          zipCode: form.zipCode || undefined,
          status: form.status,
          coordinatorFirstName: form.coordinatorFirstName || undefined,
          coordinatorLastName: form.coordinatorLastName || undefined,
          coordinatorMiddleInitial: form.coordinatorMiddleInitial || undefined,
          coordinatorAge: form.coordinatorAge
            ? Number(form.coordinatorAge)
            : undefined,
          coordinatorGender: form.coordinatorGender || undefined,
          coordinatorPosition: form.coordinatorPosition || undefined,
          coordinatorAddress: form.coordinatorAddress || undefined,
          coordinatorContact: form.coordinatorContact || undefined,
          coordinatorEmail: form.coordinatorEmail || undefined,
        }).unwrap();
        setForm(EMPTY_FORM);
        setIsDialogOpen(false);
        showSuccess(`"${form.name}" has been created successfully.`);
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
        industryType: form.industryType || undefined,
        streetAddress: form.streetAddress || undefined,
        region: form.region || undefined,
        barangay: form.barangay || undefined,
        city: form.city || undefined,
        province: form.province || undefined,
        zipCode: form.zipCode || undefined,
        status: form.status,
        coordinatorFirstName: form.coordinatorFirstName || undefined,
        coordinatorLastName: form.coordinatorLastName || undefined,
        coordinatorMiddleInitial: form.coordinatorMiddleInitial || undefined,
        coordinatorAge: form.coordinatorAge
          ? Number(form.coordinatorAge)
          : undefined,
        coordinatorGender: form.coordinatorGender || undefined,
        coordinatorPosition: form.coordinatorPosition || undefined,
        coordinatorAddress: form.coordinatorAddress || undefined,
        coordinatorContact: form.coordinatorContact || undefined,
        coordinatorEmail: form.coordinatorEmail || undefined,
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
      showSuccess(`"${deleteTarget.name}" has been deleted successfully.`);
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
      coordinatorFirstName: establishment.coordinatorFirstName || "",
      coordinatorLastName: establishment.coordinatorLastName || "",
      coordinatorMiddleInitial: establishment.coordinatorMiddleInitial || "",
      coordinatorAge: establishment.coordinatorAge?.toString() || "",
      coordinatorGender: establishment.coordinatorGender || "",
      coordinatorPosition: establishment.coordinatorPosition || "",
      coordinatorAddress: establishment.coordinatorAddress || "",
      coordinatorContact: establishment.coordinatorContact || "",
      coordinatorEmail: establishment.coordinatorEmail || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setSelectedRegion("");
    setSelectedProvince("");
    setSelectedMunicipality("");
    setSelectedBarangay("");
  };

  const handleOpenAddDialog = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
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

  const filteredEstablishments =
    establishments?.filter((est: Establishment) => {
      const searchLower = search.toLowerCase();
      return (
        est.name.toLowerCase().includes(searchLower) ||
        est.industryType?.toLowerCase().includes(searchLower) ||
        `${est.coordinatorFirstName} ${est.coordinatorLastName}`
          .toLowerCase()
          .includes(searchLower)
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
    GENDER_OPTIONS,

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
  };
}
