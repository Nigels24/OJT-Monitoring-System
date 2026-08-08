import { Building2, X } from "lucide-react";
import EstablishmentForm from "./EstablishmentForm";

interface EstablishmentEditDialogProps {
  open: boolean;
  form: any;
  editTarget: any;
  isCreating: boolean;
  isUpdating: boolean;
  error: string;
  industryOptions: string[];
  genderOptions: string[];
  regions: { code: string; name: string }[];
  provinces: { code: string; name: string }[];
  municipalities: { code: string; name: string }[];
  barangays: { code: string; name: string }[];
  selectedRegion: string;
  selectedProvince: string;
  selectedMunicipality: string;
  selectedBarangay: string;
  setSelectedRegion: (value: string) => void;
  setSelectedProvince: (value: string) => void;
  setSelectedMunicipality: (value: string) => void;
  setSelectedBarangay: (value: string) => void;
  setField: (key: any) => (e: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function EstablishmentEditDialog({
  open,
  form,
  editTarget,
  isCreating,
  isUpdating,
  error,
  industryOptions,
  genderOptions,
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
  setField,
  onSubmit,
  onReset,
  onClose,
}: EstablishmentEditDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-blue-600" />
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              {editTarget ? "Edit Establishment" : "Add Establishment"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <EstablishmentForm
            form={form}
            editTarget={editTarget}
            isCreating={isCreating}
            isUpdating={isUpdating}
            error={error}
            industryOptions={industryOptions}
            genderOptions={genderOptions}
            setField={setField}
            onSubmit={onSubmit}
            onReset={onReset}
            regions={regions}
            provinces={provinces}
            municipalities={municipalities}
            barangays={barangays}
            selectedRegion={selectedRegion}
            selectedProvince={selectedProvince}
            selectedMunicipality={selectedMunicipality}
            selectedBarangay={selectedBarangay}
            setSelectedRegion={setSelectedRegion}
            setSelectedProvince={setSelectedProvince}
            setSelectedMunicipality={setSelectedMunicipality}
            setSelectedBarangay={setSelectedBarangay}
          />
        </div>
      </div>
    </div>
  );
}
