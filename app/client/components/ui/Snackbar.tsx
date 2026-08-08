"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { useSnackbar, SnackbarType } from "@/lib/contexts/SnackbarContext";

const positionClasses = {
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
};

const typeClasses = {
  default: {
    container: "bg-gray-800 text-white",
    progress: "bg-gray-600",
  },
  error: {
    container: "bg-red-500 text-white",
    progress: "bg-red-700",
  },
  success: {
    container: "bg-green-500 text-white",
    progress: "bg-green-700",
  },
  info: {
    container: "bg-blue-500 text-white",
    progress: "bg-blue-700",
  },
  warning: {
    container: "bg-yellow-500 text-white",
    progress: "bg-yellow-700",
  },
};

const SnackbarIcon = ({ type }: { type: SnackbarType }) => {
  if (type === "default") return null;

  const iconMap = {
    success: <CheckCircle size={24} />,
    error: <XCircle size={24} />,
    info: <Info size={24} />,
    warning: <AlertTriangle size={24} />,
  };

  return <div className="shrink-0">{iconMap[type]}</div>;
};

function SnackbarContent({
  message,
  type,
  duration,
  onClose,
}: {
  message: string;
  type: SnackbarType;
  duration: number;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const stepTime = 50;
    const decrement = 100 / (duration / stepTime);

    const interval = window.setInterval(() => {
      setProgress((prev) => Math.max(prev - decrement, 0));
    }, stepTime);

    const timeout = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [duration, onClose]);

  return (
    <div
      className={`${typeClasses[type].container} rounded-lg shadow-lg min-w-72 max-w-md overflow-hidden`}
    >
      <div className="flex items-start gap-3 p-4">
        <SnackbarIcon type={type} />

        <p className="flex-1 text-sm font-medium">{message}</p>

        <button
          onClick={onClose}
          className="shrink-0 text-white hover:opacity-80 transition-opacity"
          aria-label="Close notification"
        >
          <X size={20} />
        </button>
      </div>

      <div className="h-1 bg-white/20">
        <div
          className={`h-full ${typeClasses[type].progress}`}
          style={{
            width: `${progress}%`,
            transition: "width 50ms linear",
          }}
        />
      </div>
    </div>
  );
}

export default function Snackbar() {
  const { snackbar, hideSnackbar } = useSnackbar();

  const handleClose = () => {
    hideSnackbar();
  };

  if (!snackbar.isOpen) return null;

  return (
    <div
      className={`fixed z-50 ${positionClasses[snackbar.position]} transition-all duration-300 ease-in-out opacity-100 scale-100`}
    >
      <SnackbarContent
        key={snackbar.id}
        message={snackbar.message}
        type={snackbar.type}
        duration={snackbar.duration}
        onClose={handleClose}
      />
    </div>
  );
}