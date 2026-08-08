"use client";

import { Provider } from "react-redux";
import { store } from "./store";
import { SnackbarProvider } from "./contexts/SnackbarContext";
import Snackbar from "../components/ui/Snackbar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SnackbarProvider>
        {children}
        <Snackbar />
      </SnackbarProvider>
    </Provider>
  );
}
