import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "./api/authApi";
import { establishmentApi } from "./api/establishmentApi";

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [establishmentApi.reducerPath]: establishmentApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      establishmentApi.middleware
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
