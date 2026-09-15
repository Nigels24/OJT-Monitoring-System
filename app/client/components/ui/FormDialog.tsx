"use client";

import { LucideIcon, X } from "lucide-react";
import Overlay from "./Overlay";

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
 * Both sit on `Overlay`, which is what makes them modal at all — portalled out
 * of the page, backdrop over the whole viewport, scroll locked, focus trapped.
 * Three deliberate differences from `ViewDialog`, all because there is unsaved
 * work inside:
 *
 * - **A backdrop click does not close it** (`closeOnBackdrop={false}`). Losing
 *   a part-filled sheet to a stray click is not recoverable. Escape and the X
 *   are the ways out, the same pair `ConfirmDialog` offers through Cancel.
 * - **The body scrolls, not the dialog.** The panel is capped at the viewport,
 *   the header stays put, and the body is the scrollport — so a long form
 *   scrolls inside the dialog while the panel keeps clipping it at its rounded
 *   edges. The form's own actions ride at the end of that scroll, like the foot
 *   of the paper sheet; nothing here pins them over the content.
 * - **Full-screen below `md`** (`align="stretch"`), because a tall form has no
 *   room for a floating panel at 390px.
 */
export default function FormDialog({
  open,
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
}: FormDialogProps) {
  return (
    <Overlay
      open={open}
      label={title}
      onClose={onClose}
      closeOnBackdrop={false}
      align="stretch"
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
    </Overlay>
  );
}
