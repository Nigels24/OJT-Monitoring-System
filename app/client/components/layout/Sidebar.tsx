"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";
import {
  LucideIcon,
  Building2,
  MapPin,
  LogOut,
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
    <aside className="w-64 min-h-screen flex flex-col bg-gradient-to-b from-indigo-500 to-purple-700 text-white">
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
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 flex items-center gap-3">
        <UserCircle size={32} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{userName}</p>
          {userSubtitle && (
            <p className="text-xs text-white/70 truncate">{userSubtitle}</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          aria-label="Logout"
          className="text-white/80 hover:text-white shrink-0"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
