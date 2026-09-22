"use client";

import { MessageSquare } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import { useMessaging } from "@/features/messaging/hooks/use-messaging";
import MessagingView from "@/features/messaging/components/MessagingView";

export default function CoordinatorMessagesPage() {
  const currentUser = useCurrentUser();
  const messaging = useMessaging();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco Pag. City ZDS"
        items={COORDINATOR_NAV}
        userName={currentUser?.name || "Coordinator"}
      />

      <main className="flex-1 p-4 md:p-6 flex flex-col">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Messages"
            subtitle="Talk to any student or supervisor in the programme"
            icon={MessageSquare}
          />
        </div>

        <MessagingView {...messaging} />
      </main>
    </div>
  );
}
