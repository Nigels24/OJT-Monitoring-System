import { useState } from "react";
import type { NewSupervisorRequest } from "@/lib/api/establishmentApi";

/**
 * The five supervisor fields — on the establishment create form and in the
 * list's "Add supervisor" dialog.
 *
 * Deliberately separate from `useEstablishment`'s `form`: that object is reset
 * and repopulated by the PSGC address cascade (`handleEdit`,
 * `isPopulatingRef`), and keeping these fields out of it means nothing here
 * can disturb that sequence, or be disturbed by it.
 */
const EMPTY_SUPERVISOR = {
  firstName: "",
  middleInitial: "",
  lastName: "",
  email: "",
  position: "",
};

export type SupervisorFieldValues = typeof EMPTY_SUPERVISOR;

/** Required whenever a supervisor is being created at all. */
const REQUIRED: { key: keyof SupervisorFieldValues; label: string }[] = [
  { key: "firstName", label: "first name" },
  { key: "lastName", label: "last name" },
  { key: "email", label: "email" },
];

export function useSupervisorFields() {
  const [values, setValues] = useState<SupervisorFieldValues>(EMPTY_SUPERVISOR);

  const setField =
    (key: keyof SupervisorFieldValues) =>
    (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
    };

  /** True once anything at all has been typed into the section. */
  const isFilled = Object.values(values).some((v) => v.trim() !== "");

  /** Labels of the required fields still blank. */
  const missingRequired = REQUIRED.filter(
    ({ key }) => values[key].trim() === "",
  ).map(({ label }) => label);

  /** The request body: trimmed, blanks of optional fields left out. */
  const toRequest = (): NewSupervisorRequest => ({
    firstName: values.firstName.trim(),
    middleInitial: values.middleInitial.trim() || undefined,
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    position: values.position.trim() || undefined,
  });

  return {
    values,
    setField,
    isFilled,
    missingRequired,
    toRequest,
    reset: () => setValues(EMPTY_SUPERVISOR),
  };
}

export type SupervisorFields = ReturnType<typeof useSupervisorFields>;
