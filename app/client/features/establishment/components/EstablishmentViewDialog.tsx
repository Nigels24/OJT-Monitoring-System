import {
  Briefcase,
  Building2,
  CalendarCheck,
  Mail,
  MapPin,
  User,
  UserCog,
  Users,
} from "lucide-react";
import ViewDialog from "@/components/ui/ViewDialog";
import DetailItem from "@/components/ui/DetailItem";
import StatusBadge from "@/components/ui/StatusBadge";
import { AssignedStudent, Establishment } from "@/lib/api/establishmentApi";

interface EstablishmentViewDialogProps {
  open: boolean;
  /** The list row — shown at once, while the student list loads. */
  establishment: Establishment | null;
  /** From `GET /establishments/:id` (coordinator only). */
  students: AssignedStudent[];
  studentsLoading: boolean;
  studentsError: boolean;
  onClose: () => void;
}

const STATUS_LABEL: Record<AssignedStudent["status"], string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  COMPLETED: "Completed",
  INACTIVE: "Inactive",
};

const STATUS_VARIANT = {
  ACTIVE: "active",
  COMPLETED: "completed",
  PENDING: "neutral",
  INACTIVE: "neutral",
} as const;

export default function EstablishmentViewDialog({
  open,
  establishment,
  students,
  studentsLoading,
  studentsError,
  onClose,
}: EstablishmentViewDialogProps) {
  return (
    <ViewDialog
      open={open}
      title="Establishment Details"
      icon={Building2}
      onClose={onClose}
    >
      {establishment && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <DetailItem
              label="Establishment Name"
              value={establishment.name}
              icon={Building2}
            />
            <DetailItem
              label="Industry Type"
              value={establishment.industryType}
              icon={Building2}
            />
            <DetailItem
              label="Street Address"
              value={establishment.streetAddress}
              icon={MapPin}
            />
            <DetailItem
              label="Region"
              value={establishment.region}
              icon={MapPin}
            />
            <DetailItem
              label="Barangay"
              value={establishment.barangay}
              icon={MapPin}
            />
            <DetailItem label="City" value={establishment.city} icon={MapPin} />
            <DetailItem
              label="Province"
              value={establishment.province}
              icon={MapPin}
            />
            <DetailItem
              label="Zip Code"
              value={establishment.zipCode}
              icon={MapPin}
            />
            <DetailItem
              label="Status"
              value={establishment.status}
              icon={Building2}
            />
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <UserCog size={18} className="text-blue-600" />
              Supervisor
            </h3>
            {establishment.supervisor ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <DetailItem
                  label="Full Name"
                  value={establishment.supervisor.name}
                  icon={User}
                />
                <DetailItem
                  label="Position"
                  value={establishment.supervisor.position}
                  icon={Briefcase}
                />
                <DetailItem
                  label="Email Address"
                  value={establishment.supervisor.email}
                  icon={Mail}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No supervisor yet. Use &ldquo;Add supervisor&rdquo; in the
                establishments list.
              </p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              Assigned Students ({establishment._count?.students ?? 0})
            </h3>
            {studentsLoading ? (
              <p className="text-sm text-gray-400">Loading students…</p>
            ) : studentsError ? (
              <p className="text-sm text-red-600">
                Couldn&apos;t load the assigned students.
              </p>
            ) : students.length === 0 ? (
              <p className="text-sm text-gray-500">No students assigned yet.</p>
            ) : (
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
                {students.map((s) => (
                  <li
                    key={s.id}
                    className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {s.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-mono">{s.studentIdNumber}</span>
                        {" · "}
                        {s.course ?? "—"}
                        {" · "}
                        {s.yearLevel ?? "—"}
                      </div>
                    </div>
                    <StatusBadge
                      label={STATUS_LABEL[s.status]}
                      variant={STATUS_VARIANT[s.status]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <DetailItem
              label="Date Added"
              value={new Date(establishment.createdAt).toLocaleDateString()}
              icon={CalendarCheck}
            />
          </div>
        </div>
      )}
    </ViewDialog>
  );
}