import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "./api/authApi";
import { establishmentApi } from "./api/establishmentApi";
import { studentApi } from "./api/studentApi";

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [establishmentApi.reducerPath]: establishmentApi.reducer,
    [studentApi.reducerPath]: studentApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      establishmentApi.middleware,
      studentApi.middleware
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
