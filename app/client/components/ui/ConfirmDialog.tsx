"use client";

import { LucideIcon, HelpCircle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  variant?: "default" | "danger";
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
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmColor =
    variant === "danger"
      ? "bg-red-500 hover:bg-red-600"
      : "bg-green-500 hover:bg-green-600";

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-8 max-w-sm w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full border-2 border-sky-300 flex items-center justify-center">
            <Icon size={28} className="text-sky-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500 text-sm mb-6">{message}</p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onConfirm}
            className={`flex-1 h-11 rounded-lg text-white font-medium transition-colors ${confirmColor}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
