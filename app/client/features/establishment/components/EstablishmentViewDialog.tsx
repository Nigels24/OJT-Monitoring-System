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
import { Establishment } from "@/lib/api/establishmentApi";

interface EstablishmentViewDialogProps {
  open: boolean;
  establishment: Establishment | null;
  onClose: () => void;
}

export default function EstablishmentViewDialog({
  open,
  establishment,
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
            <DetailItem
              label="Date Added"
              value={new Date(establishment.createdAt).toLocaleDateString()}
              icon={CalendarCheck}
            />
            <DetailItem
              label="Students"
              value={establishment._count?.students ?? 0}
              icon={Users}
            />
            <DetailItem
              label="Supervisors"
              value={establishment._count?.supervisors ?? 0}
              icon={Users}
            />
          </div>
        </div>
      )}
    </ViewDialog>
  );
}