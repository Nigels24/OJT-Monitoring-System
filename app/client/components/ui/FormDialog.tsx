"use client";

import { useEffect } from "react";
import { LucideIcon, X } from "lucide-react";

interface FormDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A modal that holds a form, as `ViewDialog` holds read-only content.
 *
 * Three deliberate differences from `ViewDialog`, all because there is
 * unsaved work inside:
 *
 * - **A backdrop click does not close it.** Losing a part-filled sheet to a
 *   stray click is not recoverable. Escape and the X are the ways out, the
 *   same pair `ConfirmDialog` offers through its Cancel button.
 * - **The body scrolls, not the dialog.** The panel is capped at the viewport
 *   and its body is the scrollport, so a form can park a `sticky bottom-0`
 *   action row against the foot of the dialog while the sheet scrolls behind
 *   it.
 * - **The page behind is frozen** while it is open, so scrolling inside the
 *   dialog never turns into scrolling the page underneath it.
 *
 * Full-screen below `md` (a tall form has no room for a floating panel at
 * 390px), a centred panel above it.
 */
export default function FormDialog({
  open,
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
}: FormDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-stretch md:items-center justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 md:px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {Icon && <Icon size={22} className="text-blue-600 mt-0.5 shrink-0" />}
            <div className="min-w-0">
              <h2 className="text-base md:text-xl font-bold text-gray-800 truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 shrink-0"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
