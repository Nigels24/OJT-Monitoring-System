"use client";

import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import DetailItem from "@/components/ui/DetailItem";
import {
  UserCircle,
  IdCard,
  GraduationCap,
  Cake,
  Users,
  School,
  Phone,
  MapPin,
  Mail,
  Building2,
  CalendarClock,
  CalendarCheck2,
  Pencil,
} from "lucide-react";
import { STUDENT_NAV } from "@/features/student-portal/nav";
import { useProfile } from "@/features/student-portal/hooks/use-profile";
import ProfileEditForm from "@/features/student-portal/components/ProfileEditForm";

export default function StudentProfilePage() {
  const {
    data,
    isLoading,
    loadError,
    form,
    error,
    isEditing,
    isSubmitting,
    setField,
    startEditing,
    cancelEditing,
    handleSubmit,
  } = useProfile();

  const displayName = data?.user.name ?? "Student";
  const fullName =
    [data?.firstName, data?.middleInitial, data?.lastName]
      .filter(Boolean)
      .join(" ") || displayName;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="OJT Monitoring"
        items={STUDENT_NAV}
        userName={displayName}
        userSubtitle={data?.studentIdNumber}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Profile"
            subtitle="Your personal and OJT details"
            icon={UserCircle}
          />
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : loadError || !data ? (
          <Card>
            <p className="text-sm text-gray-600">
              We couldn&apos;t load your profile. If you were just enrolled,
              your coordinator may still be setting it up.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <GraduationCap size={18} className="text-blue-600" />
                Personal Details
              </h2>
              <div className="space-y-3">
                <DetailItem label="Full Name" value={fullName} icon={UserCircle} />
                <DetailItem
                  label="Student ID"
                  value={data.studentIdNumber}
                  icon={IdCard}
                />
                <DetailItem label="Email" value={data.user.email} icon={Mail} />
                <DetailItem label="Gender" value={data.gender} icon={Users} />
                <DetailItem
                  label="Date of Birth"
                  value={
                    data.dateOfBirth
                      ? new Date(data.dateOfBirth).toLocaleDateString()
                      : null
                  }
                  icon={Cake}
                />
                <DetailItem label="Course" value={data.course} icon={GraduationCap} />
                <DetailItem label="Year Level" value={data.yearLevel} icon={GraduationCap} />
                <DetailItem label="School" value={data.school} icon={School} />
              </div>
            </Card>

            <Card className="lg:col-span-1">
              <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building2 size={18} className="text-blue-600" />
                OJT Details
              </h2>
              <div className="space-y-3">
                <DetailItem
                  label="Establishment"
                  value={data.establishment?.name}
                  icon={Building2}
                />
                <DetailItem
                  label="Required Hours"
                  value={data.requiredHours}
                  icon={CalendarCheck2}
                />
                <DetailItem
                  label="Start Date"
                  value={
                    data.startDate
                      ? new Date(data.startDate).toLocaleDateString()
                      : null
                  }
                  icon={CalendarClock}
                />
                <DetailItem
                  label="End Date"
                  value={
                    data.endDate
                      ? new Date(data.endDate).toLocaleDateString()
                      : null
                  }
                  icon={CalendarClock}
                />
                <DetailItem label="Status" value={data.status} icon={UserCircle} />
              </div>
            </Card>

            <Card className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Phone size={18} className="text-blue-600" />
                  Contact
                </h2>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <ProfileEditForm
                  form={form}
                  error={error}
                  isSubmitting={isSubmitting}
                  setField={setField}
                  onSubmit={handleSubmit}
                  onCancel={cancelEditing}
                />
              ) : (
                <div className="space-y-3">
                  <DetailItem
                    label="Contact Number"
                    value={data.contactNumber}
                    icon={Phone}
                  />
                  <DetailItem label="Address" value={data.address} icon={MapPin} />
                  <p className="text-xs text-gray-500 pt-1">
                    Only your contact number and address can be updated here.
                    Everything else is managed by your coordinator.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
