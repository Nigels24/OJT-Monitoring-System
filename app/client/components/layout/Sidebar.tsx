"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";
import ChangePasswordDialog from "@/features/account/ChangePasswordDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Z_LAYERS } from "@/components/ui/Overlay";
import { useUnreadCount } from "@/features/messaging/hooks/use-unread-count";
import {
  LucideIcon,
  Building2,
  MapPin,
  LogOut,
  KeyRound,
  UserCircle,
} from "lucide-react";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarProps {
  orgName: string;
  orgSubtitle?: string;
  items: SidebarNavItem[];
  userName: string;
  userSubtitle?: string;
  onLogout?: () => void;
}

export default function Sidebar({
  orgName,
  orgSubtitle,
  items,
  userName,
  userSubtitle,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const { conversationCount } = useUnreadCount();

  const handleLogout = () => {
    // Always clear first. `proxy.ts` trusts the role cookie for routing, so a
    // caller-supplied onLogout that skipped this would leave the user routed as
    // if still signed in — and unable to reach /login to fix it.
    clearSession();
    if (onLogout) {
      onLogout();
      return;
    }
    router.push("/login");
  };

  return (
    <aside
      style={{ zIndex: Z_LAYERS.sidebar }}
      className="w-64 sticky top-0 h-screen shrink-0 overflow-y-auto flex flex-col bg-gradient-to-b from-indigo-500 to-purple-700 text-white"
    >
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Building2 size={22} />
          {orgName}
        </div>
        {orgSubtitle && (
          <div className="flex items-center gap-1.5 text-sm text-white/80 mt-1">
            <MapPin size={14} />
            {orgSubtitle}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          // Read off the entry's own href, so all three roles get the badge
          // without their nav.ts knowing anything about messaging.
          const unread = href.endsWith("/messages") ? conversationCount : 0;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-white/25 text-white"
                  : "text-white/85 hover:bg-white/10"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {/* The label keeps wrapping as it always did, but gives up its
                  width to the badge rather than pushing it out of a 256px
                  sidebar at 390px. */}
              <span className="flex-1 min-w-0">{label}</span>
              {unread > 0 && (
                <>
                  {/* Solid red with a white ring: legible on the purple
                      gradient and on the lighter bg-white/25 of the active
                      entry alike. */}
                  <span
                    aria-hidden="true"
                    className="shrink-0 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-600 ring-1 ring-white/80 text-white text-[11px] font-bold tabular-nums"
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                  <span className="sr-only">
                    {`${unread} conversation${unread === 1 ? "" : "s"} with unread messages`}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 flex items-center gap-2">
        <UserCircle size={32} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{userName}</p>
          {userSubtitle && (
            <p className="text-xs text-white/70 truncate">{userSubtitle}</p>
          )}
        </div>
        {/* One hit-target size for both, matching the nav rows' touch area. */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPasswordDialogOpen(true);
            }}
            aria-label="Change password"
            title="Change password"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10"
          >
            <KeyRound size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setLogoutConfirmOpen(true);
            }}
            aria-label="Logout"
            title="Logout"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onClose={() => {
          setPasswordDialogOpen(false);
        }}
      />

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log Out?"
        message="You'll need to sign in again to continue."
        confirmLabel="Yes, log out"
        icon={LogOut}
        variant="danger"
        onConfirm={handleLogout}
        onCancel={() => {
          setLogoutConfirmOpen(false);
        }}
      />
    </aside>
  );
}
