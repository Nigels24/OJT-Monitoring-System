"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type SnackbarType = "default" | "error" | "success" | "info" | "warning";
export type SnackbarPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface SnackbarState {
  isOpen: boolean;
  message: string;
  type: SnackbarType;
  position: SnackbarPosition;
  duration: number;
  id: number;
}

interface SnackbarContextType {
  snackbar: SnackbarState;
  showSnackbar: (message: string, type?: SnackbarType, position?: SnackbarPosition, duration?: number) => void;
  hideSnackbar: () => void;
  showSuccess: (message: string, position?: SnackbarPosition, duration?: number) => void;
  showError: (message: string, position?: SnackbarPosition, duration?: number) => void;
  showInfo: (message: string, position?: SnackbarPosition, duration?: number) => void;
  showWarning: (message: string, position?: SnackbarPosition, duration?: number) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

const initialState: SnackbarState = {
  isOpen: false,
  message: "",
  type: "default",
  position: "bottom-right",
  duration: 4000,
  id: 0,
};

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snackbar, setSnackbar] = useState<SnackbarState>(initialState);

  const showSnackbar = useCallback(
    (message: string, type: SnackbarType = "default", position: SnackbarPosition = "bottom-right", duration: number = 4000) => {
      setSnackbar((prev) => ({
        isOpen: true,
        message,
        type,
        position,
        duration,
        id: prev.id + 1,
      }));
    },
    []
  );

  const hideSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const showSuccess = useCallback(
    (message: string, position: SnackbarPosition = "bottom-right", duration: number = 4000) => {
      showSnackbar(message, "success", position, duration);
    },
    [showSnackbar]
  );

  const showError = useCallback(
    (message: string, position: SnackbarPosition = "bottom-right", duration: number = 4000) => {
      showSnackbar(message, "error", position, duration);
    },
    [showSnackbar]
  );

  const showInfo = useCallback(
    (message: string, position: SnackbarPosition = "bottom-right", duration: number = 4000) => {
      showSnackbar(message, "info", position, duration);
    },
    [showSnackbar]
  );

  const showWarning = useCallback(
    (message: string, position: SnackbarPosition = "bottom-right", duration: number = 4000) => {
      showSnackbar(message, "warning", position, duration);
    },
    [showSnackbar]
  );

  return (
    <SnackbarContext.Provider
      value={{
        snackbar,
        showSnackbar,
        hideSnackbar,
        showSuccess,
        showError,
        showInfo,
        showWarning,
      }}
    >
      {children}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (context === undefined) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}