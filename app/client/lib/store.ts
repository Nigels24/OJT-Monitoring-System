import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "./api/authApi";
import { establishmentApi } from "./api/establishmentApi";
import { studentApi } from "./api/studentApi";
import { studentPortalApi } from "./api/studentPortalApi";

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [establishmentApi.reducerPath]: establishmentApi.reducer,
    [studentApi.reducerPath]: studentApi.reducer,
    [studentPortalApi.reducerPath]: studentPortalApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      establishmentApi.middleware,
      studentApi.middleware,
      studentPortalApi.middleware
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
