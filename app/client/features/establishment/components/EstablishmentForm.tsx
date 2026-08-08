import {
  Building2,
  MapPin,
  User,
  Phone,
  Mail,
} from "lucide-react";
import TextField from "@/components/ui/TextField";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import SelectField from "@/components/ui/SelectField";

interface EstablishmentFormProps {
  form: any;
  editTarget: any;
  isCreating: boolean;
  isUpdating: boolean;
  error: string;
  industryOptions: string[];
  genderOptions: string[];
  setField: (key: any) => (e: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  // Location props
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
}

export default function EstablishmentForm({
  form,
  editTarget,
  isCreating,
  isUpdating,
  error,
  industryOptions,
  genderOptions,
  setField,
  onSubmit,
  onReset,
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
}: EstablishmentFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-6 md:space-y-8">
      {/* Establishment Details */}
      <div className="border-l-4 border-blue-400 pl-4 md:pl-6">
        <div className="flex items-center gap-2 mb-4 max-w-4xl mx-auto">
          <Building2 size={16} className="md:size-18 text-gray-700" />
          <h3 className="font-semibold text-gray-900 text-base md:text-lg">
            Establishment Details
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-4xl mx-auto">
          <TextField
            label="Establishment Name"
            labelIcon={Building2}
            fieldIcon={Building2}
            required
            value={form.name}
            onChange={setField("name")}
            placeholder="e.g., Tech Solutions Inc."
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Industry Type <span className="text-red-500">*</span>
            </label>
            <SelectField
              value={form.industryType}
              onChange={(value) =>
                setField("industryType")({ target: { value } })
              }
              placeholder="Select Industry"
              options={industryOptions.map((opt) => ({
                label: opt,
                value: opt,
              }))}
              className="w-full"
            />
          </div>
          <TextField
            label="Street Address"
            labelIcon={MapPin}
            fieldIcon={MapPin}
            value={form.streetAddress}
            onChange={setField("streetAddress")}
            placeholder="Street building, unit"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Region <span className="text-red-500">*</span>
            </label>
            <SelectField
              value={selectedRegion}
              onChange={(value) => {
                setSelectedRegion(value);
                const regionName =
                  regions.find((r) => r.code === value)?.name || "";
                setField("region")({ target: { value: regionName } });
                setField("province")({ target: { value: "" } });
                setField("city")({ target: { value: "" } });
                setField("barangay")({ target: { value: "" } });
              }}
              placeholder="Select Region"
              options={regions.map((r) => ({ label: r.name, value: r.code }))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Province <span className="text-red-500">*</span>
            </label>
            <SelectField
              value={selectedProvince}
              onChange={(value) => {
                setSelectedProvince(value);
                const provinceName =
                  provinces.find((p) => p.code === value)?.name || "";
                setField("province")({ target: { value: provinceName } });
                setField("city")({ target: { value: "" } });
                setField("barangay")({ target: { value: "" } });
              }}
              placeholder="Select Province"
              options={provinces.map((p) => ({ label: p.name, value: p.code }))}
              className="w-full"
              disabled={!selectedRegion}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City/Municipality <span className="text-red-500">*</span>
            </label>
            <SelectField
              value={selectedMunicipality}
              onChange={(value) => {
                setSelectedMunicipality(value);
                const cityName =
                  municipalities.find((m) => m.code === value)?.name || "";
                setField("city")({ target: { value: cityName } });
                setField("barangay")({ target: { value: "" } });
              }}
              placeholder="Select City/Municipality"
              options={municipalities.map((m) => ({
                label: m.name,
                value: m.code,
              }))}
              className="w-full"
              disabled={!selectedProvince}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Barangay <span className="text-red-500">*</span>
            </label>
            <SelectField
              value={selectedBarangay}
              onChange={(value) => {
                setSelectedBarangay(value);
                const barangayName =
                  barangays.find((b) => b.code === value)?.name || "";
                setField("barangay")({ target: { value: barangayName } });
              }}
              placeholder="Select Barangay"
              options={barangays.map((b) => ({ label: b.name, value: b.code }))}
              className="w-full"
              disabled={!selectedMunicipality}
            />
          </div>
          <TextField
            label="Zip Code"
            labelIcon={MapPin}
            fieldIcon={MapPin}
            value={form.zipCode}
            onChange={setField("zipCode")}
            placeholder="Zip code"
          />
        </div>
      </div>

      {/* Establishment Coordinator Details */}
      <div className="border-l-4 border-blue-400 pl-4 md:pl-6">
        <div className="flex items-center gap-2 mb-4 max-w-4xl mx-auto">
          <User size={16} className="md:size-18 text-gray-700" />
          <h3 className="font-semibold text-gray-900 text-base md:text-lg">
            Establishment Coordinator Details
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 max-w-4xl mx-auto">
          <TextField
            label="First Name"
            required
            value={form.coordinatorFirstName}
            onChange={setField("coordinatorFirstName")}
            placeholder="First name"
          />
          <TextField
            label="Last Name"
            required
            value={form.coordinatorLastName}
            onChange={setField("coordinatorLastName")}
            placeholder="Last name"
          />
          <TextField
            label="Middle Initial"
            value={form.coordinatorMiddleInitial}
            onChange={setField("coordinatorMiddleInitial")}
            placeholder="M.I."
          />
          <TextField
            label="Age"
            required
            type="number"
            value={form.coordinatorAge}
            onChange={setField("coordinatorAge")}
            placeholder="Age"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender <span className="text-red-500">*</span>
            </label>
            <SelectField
              value={form.coordinatorGender}
              onChange={(value) =>
                setField("coordinatorGender")({ target: { value } })
              }
              placeholder="Select Gender"
              options={genderOptions.map((opt) => ({
                label: opt,
                value: opt,
              }))}
              className="w-full"
            />
          </div>
          <TextField
            label="Position/Title"
            required
            value={form.coordinatorPosition}
            onChange={setField("coordinatorPosition")}
            placeholder="e.g., HR Manager, IT Director"
          />
        </div>
        <div className="mt-4 max-w-4xl mx-auto">
          <TextArea
            label="Complete Address"
            labelIcon={MapPin}
            required
            value={form.coordinatorAddress}
            onChange={setField("coordinatorAddress")}
            placeholder="House/Unit No., Street, Barangay, City, Province"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 max-w-4xl mx-auto">
          <TextField
            label="Contact Number"
            labelIcon={Phone}
            fieldIcon={Phone}
            required
            value={form.coordinatorContact}
            onChange={setField("coordinatorContact")}
            placeholder="09123456789"
          />
          <TextField
            label="Email Address"
            labelIcon={Mail}
            fieldIcon={Mail}
            required
            type="email"
            value={form.coordinatorEmail}
            onChange={setField("coordinatorEmail")}
            placeholder="coordinator@company.com"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onReset}>
            {editTarget ? "Cancel" : "Clear"}
          </Button>
          <Button
            type="submit"
            loading={isCreating || isUpdating}
          >
            {editTarget ? "Update Establishment" : "Save Establishment"}
          </Button>
        </div>
      </div>
    </form>
  );
}
