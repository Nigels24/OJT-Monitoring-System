import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "./api/authApi";
import { establishmentApi } from "./api/establishmentApi";
import { studentApi } from "./api/studentApi";
import { studentPortalApi } from "./api/studentPortalApi";
import { supervisorApi } from "./api/supervisorApi";
import { supervisorManagementApi } from "./api/supervisorManagementApi";
import { evaluationApi } from "./api/evaluationApi";
import { evaluationTemplateApi } from "./api/evaluationTemplateApi";
import { dashboardApi } from "./api/dashboardApi";
import { attendanceOversightApi } from "./api/attendanceOversightApi";
import { documentApi } from "./api/documentApi";
import { messagesApi } from "./api/messagesApi";

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [establishmentApi.reducerPath]: establishmentApi.reducer,
    [studentApi.reducerPath]: studentApi.reducer,
    [studentPortalApi.reducerPath]: studentPortalApi.reducer,
    [supervisorApi.reducerPath]: supervisorApi.reducer,
    [supervisorManagementApi.reducerPath]: supervisorManagementApi.reducer,
    [evaluationApi.reducerPath]: evaluationApi.reducer,
    [evaluationTemplateApi.reducerPath]: evaluationTemplateApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [attendanceOversightApi.reducerPath]: attendanceOversightApi.reducer,
    [documentApi.reducerPath]: documentApi.reducer,
    [messagesApi.reducerPath]: messagesApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // `downloadEvaluationPdf` resolves to a Blob — a file the user is
        // saving, never state the UI reads back, and dropped from the cache
        // straight away (`keepUnusedDataFor: 0`). Every other evaluationApi
        // endpoint returns plain JSON, so scoping the exemption to this slice
        // silences the dev-only warning without hiding a real one.
        ignoredActions: ["evaluationApi/executeQuery/fulfilled"],
        ignoredPaths: ["evaluationApi.queries"],
      },
    }).concat(
      authApi.middleware,
      establishmentApi.middleware,
      studentApi.middleware,
      studentPortalApi.middleware,
      supervisorApi.middleware,
      supervisorManagementApi.middleware,
      evaluationApi.middleware,
      evaluationTemplateApi.middleware,
      dashboardApi.middleware,
      attendanceOversightApi.middleware,
      documentApi.middleware,
      messagesApi.middleware
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
