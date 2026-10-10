import { skipToken } from "@reduxjs/toolkit/query/react";
import { useGetEstablishmentQuery } from "@/lib/api/establishmentApi";

/**
 * The view dialog's assigned-students list, from `GET /establishments/:id`
 * (the coordinator is the only role that receives `students`).
 *
 * Kept out of `useEstablishment` on purpose — that hook owns the form and the
 * PSGC address cascade, and this needs none of it.
 *
 * `refetchOnMountOrArgChange`: a student's placement changes through the
 * coordinator's student edit, which lives in `studentApi` and can't reach this
 * slice's tag without an import cycle (establishmentApi already imports
 * studentApi). Fetching on every open keeps the list current instead.
 */
export function useEstablishmentDetail(id: string | null) {
  const { data, isFetching, isError } = useGetEstablishmentQuery(
    id ?? skipToken,
    { refetchOnMountOrArgChange: true },
  );
  return {
    students: data?.students ?? [],
    isLoading: isFetching,
    isError,
  };
}
