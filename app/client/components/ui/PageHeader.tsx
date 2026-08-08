"use client";

import { useEffect, useState } from "react";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  showDateTime?: boolean;
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  showDateTime = true,
}: PageHeaderProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        <Icon size={28} className="text-white" />
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && (
            <p className="text-white/80 text-sm mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {showDateTime && now && (
        <div className="text-right text-white">
          <p className="text-sm">
            {now.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="text-blue-300 font-semibold text-sm">
            {now.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
