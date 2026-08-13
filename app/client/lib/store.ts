import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "./api/authApi";
import { establishmentApi } from "./api/establishmentApi";
import { studentApi } from "./api/studentApi";
import { studentPortalApi } from "./api/studentPortalApi";
import { supervisorApi } from "./api/supervisorApi";
import { evaluationApi } from "./api/evaluationApi";
import { dashboardApi } from "./api/dashboardApi";
import { attendanceOversightApi } from "./api/attendanceOversightApi";

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [establishmentApi.reducerPath]: establishmentApi.reducer,
    [studentApi.reducerPath]: studentApi.reducer,
    [studentPortalApi.reducerPath]: studentPortalApi.reducer,
    [supervisorApi.reducerPath]: supervisorApi.reducer,
    [evaluationApi.reducerPath]: evaluationApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [attendanceOversightApi.reducerPath]: attendanceOversightApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      establishmentApi.middleware,
      studentApi.middleware,
      studentPortalApi.middleware,
      supervisorApi.middleware,
      evaluationApi.middleware,
      dashboardApi.middleware,
      attendanceOversightApi.middleware
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
