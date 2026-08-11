import { useSyncExternalStore } from "react";
import { getStoredUser, type StoredUser } from "@/lib/auth";

/**
 * The signed-in user, read from localStorage.
 *
 * localStorage is an external store, so this uses useSyncExternalStore rather
 * than a useState/useEffect pair: it gives React a correct server snapshot
 * (null) with no hydration mismatch, and no setState-in-effect cascade.
 *
 * The snapshot must be referentially stable or React re-renders forever, so the
 * parsed object is memoised against the raw string it came from.
 */
let cachedRaw: string | null = null;
let cachedUser: StoredUser | null = null;

function getSnapshot(): StoredUser | null {
  const raw = localStorage.getItem("user");
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedUser = getStoredUser();
  }
  return cachedUser;
}

function getServerSnapshot(): StoredUser | null {
  return null;
}

function subscribe(onChange: () => void) {
  // Fires when another tab logs in or out, so the sidebar name stays honest.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}

export function useCurrentUser(): StoredUser | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
