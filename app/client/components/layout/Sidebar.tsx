"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LucideIcon,
  Building2,
  MapPin,
  LogOut,
  UserCircle,
  ChevronDown,
  Key,
} from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";

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
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handleLogoutClick = () => {
    setShowDropdown(false);
    setShowLogoutDialog(true);
  };

  const handleChangePassword = () => {
    setShowDropdown(false);
    // Add navigation to change password page
    router.push("/change-password");
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
            <a
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
            </a>
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
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label="User menu"
            className="text-white/80 hover:text-white shrink-0 flex items-center gap-1"
          >
            <ChevronDown size={18} />
          </button>
          
          {showDropdown && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-lg shadow-lg overflow-hidden z-50">
              <button
                onClick={handleChangePassword}
                className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-3 text-sm"
              >
                <Key size={16} />
                Change Password
              </button>
              <button
                onClick={handleLogoutClick}
                className="w-full px-4 py-3 text-left text-red-600 hover:bg-gray-100 flex items-center gap-3 text-sm border-t border-gray-200"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showLogoutDialog}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmLabel="Yes, logout"
        cancelLabel="Cancel"
        icon={LogOut}
        variant="danger"
        onConfirm={() => {
          setShowLogoutDialog(false);
          handleLogout();
        }}
        onCancel={() => setShowLogoutDialog(false)}
      />
    </aside>
  );
}
