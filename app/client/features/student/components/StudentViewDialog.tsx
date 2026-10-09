import {
  User,
  Mail,
  Phone,
  MapPin,
  IdCard,
  GraduationCap,
  Building2,
  Clock,
  CalendarDays,
  FileText,
} from "lucide-react";
import ViewDialog from "@/components/ui/ViewDialog";
import DetailItem from "@/components/ui/DetailItem";
import ProgressBar from "@/components/ui/ProgressBar";
import { Student } from "@/lib/api/studentApi";
import { DOCUMENT_TYPES } from "@/lib/api/studentPortalApi";
import { formatDateOnly } from "@/lib/format";
import { SCHOOL_NAME } from "@/lib/school";

interface StudentViewDialogProps {
  open: boolean;
  student: Student | null;
  onClose: () => void;
}

export default function StudentViewDialog({
  open,
  student,
  onClose,
}: StudentViewDialogProps) {
  return (
    <ViewDialog
      open={open}
      title="Student Details"
      icon={User}
      onClose={onClose}
    >
      {student && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <DetailItem
              label="Student ID"
              value={student.studentIdNumber}
              icon={IdCard}
            />
            <DetailItem
              label="Full Name"
              value={student.user.name}
              icon={User}
            />
            <DetailItem
              label="Email Address"
              value={student.user.email}
              icon={Mail}
            />
            <DetailItem
              label="Contact Number"
              value={student.contactNumber}
              icon={Phone}
            />
            <DetailItem
              label="Address"
              value={student.address}
              icon={MapPin}
              className="md:col-span-2"
            />
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <GraduationCap size={18} className="text-blue-600" />
              Academic &amp; OJT
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <DetailItem
                label="School"
                value={SCHOOL_NAME}
                icon={GraduationCap}
              />
              <DetailItem
                label="Course / Program"
                value={student.course}
                icon={GraduationCap}
              />
              <DetailItem
                label="Year Level"
                value={student.yearLevel}
                icon={GraduationCap}
              />
              <DetailItem
                label="Establishment"
                value={student.establishment?.name ?? "Unassigned"}
                icon={Building2}
              />
              <DetailItem
                label="Status"
                value={student.status}
                icon={User}
              />
              <DetailItem
                label="Start Date"
                value={formatDateOnly(student.startDate, "") || null}
                icon={CalendarDays}
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-blue-600" />
              Progress
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
              <DetailItem
                label="Hours Completed"
                value={`${student.completedHours} / ${student.requiredHours} hrs`}
                icon={Clock}
              />
              <DetailItem
                label="Documents Submitted"
                value={`${student._count?.documents ?? 0} / ${DOCUMENT_TYPES.length}`}
                icon={FileText}
              />
            </div>
            <ProgressBar
              value={student.completedHours}
              max={student.requiredHours || 1}
              showLabel
              colorByValue
            />
            <p className="text-xs text-gray-500 mt-2">
              Counts approved attendance only.
            </p>
          </div>
        </div>
      )}
    </ViewDialog>
  );
}
