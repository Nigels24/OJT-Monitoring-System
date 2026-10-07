"use client";

import type { ReactNode } from "react";
import { LucideIcon, HelpCircle } from "lucide-react";
import Overlay from "./Overlay";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  variant?: "default" | "danger";
  /** Extra content between the message and the buttons (a list, an input). */
  children?: ReactNode;
  /** Holds the confirm button disabled, e.g. until a typed confirmation matches. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Yes, confirm it!",
  cancelLabel = "Cancel",
  icon: Icon = HelpCircle,
  variant = "default",
  children,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmColor =
    variant === "danger"
      ? "bg-red-500 hover:bg-red-600"
      : "bg-green-500 hover:bg-green-600";

  // Escape and the backdrop both cancel — the safe half of an irreversible
  // choice, the same one Cancel holds focus for.
  return (
    <Overlay open={open} label={title} onClose={onCancel}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full max-h-[90vh] overflow-y-auto text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full border-2 border-sky-300 flex items-center justify-center">
            <Icon size={28} className="text-sky-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500 text-sm mb-6">{message}</p>

        {children && <div className="text-left mb-6">{children}</div>}

        <div className="flex gap-3 justify-center">
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`flex-1 h-11 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmColor}`}
          >
            {confirmLabel}
          </button>
          {/*
            Cancel takes focus on open, not confirm: these dialogs guard
            irreversible deletes, so a stray Enter must not be the thing that
            destroys a record. The dialog unmounts when closed, so `autoFocus`
            fires on every open, and `Overlay` leaves it alone precisely
            because something inside already holds focus.
          */}
          <button
            onClick={onCancel}
            autoFocus
            className="flex-1 h-11 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
