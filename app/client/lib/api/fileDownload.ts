import { clearSession } from "@/lib/auth";
import { API_BASE_URL, getAuthToken } from "./baseQuery";

/**
 * Authenticated file fetches that end in the browser, not the Redux store.
 *
 * The coordinator's document downloads and ZIPs go through the server (no
 * signed URLs — CLAUDE.md §7 "File storage"), so a plain `<a href>` can't
 * carry the bearer token. These fetch the bytes with the same auth as
 * `baseQueryWithAuth`, then hand a Blob to the browser. Kept out of RTK Query
 * on purpose: a Blob in the cache trips the serializable check (§8 item 27),
 * and nothing here is worth caching.
 */

export interface FetchedFile {
  blob: Blob;
  /** From Content-Disposition; `null` when the browser could not read it. */
  filename: string | null;
}

/**
 * Throws an `Error` whose message is the server's own (Nest's `message`), or
 * a generic one. A 401 ends the session exactly as `baseQueryWithAuth` does.
 */
export async function fetchFile(path: string): Promise<FetchedFile> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (response.status === 401) {
    clearSession();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new Error("Your session has expired.");
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(
      response.headers.get("Content-Disposition"),
    ),
  };
}

/** Fetches a file and saves it under the server's filename, or `fallbackName`. */
export async function downloadFile(
  path: string,
  fallbackName: string,
): Promise<void> {
  const { blob, filename } = await fetchFile(path);
  saveBlob(blob, filename ?? fallbackName);
}

/**
 * Opens a file in a new tab. The tab must be opened synchronously inside the
 * click handler — a `window.open` after an `await` is no longer a user gesture
 * and the popup blocker eats it — so this opens a blank tab first, then points
 * it at the blob once it arrives. On failure the blank tab is closed and the
 * error rethrown for the caller's snackbar.
 *
 * Call it directly from the click handler, before any `await` of your own.
 */
export async function openFileInNewTab(path: string): Promise<void> {
  // Not "noopener": that makes window.open return null and the tab
  // unreachable. The opener link is severed by hand below instead.
  const tab = window.open("", "_blank");
  if (!tab) {
    throw new Error(
      "Your browser blocked the new tab. Allow pop-ups to view files.",
    );
  }
  tab.opener = null;
  tab.document.title = "Loading…";
  tab.document.body.textContent = "Loading file…";

  try {
    const { blob } = await fetchFile(path);
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    // The tab needs the URL alive while it loads and renders; a minute is
    // plenty, and the blob isn't then held for the life of this page.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab.close();
    throw err;
  }
}

/** Hands the blob to the browser as a save, then lets go of the object URL. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same tick can cancel the save in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * The server sends both forms (`attachmentDisposition` in the server's
 * `common/document-types.ts`): `filename="..."` is an ASCII-only fallback with
 * `_` for anything else, `filename*=UTF-8''...` is the real name. Prefer the
 * latter, or "Résumé.pdf" saves as "R_sum_.pdf".
 */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;

  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // Malformed percent-encoding — fall through to the plain form.
    }
  }

  const plain = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/i.exec(header);
  const name = (plain?.[1] ?? plain?.[2])?.trim();
  return name || null;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback =
    response.status === 503
      ? "File storage is unavailable right now. Try again in a moment."
      : response.status === 404
        ? "That file no longer exists."
        : "Could not fetch the file.";
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join(", ");
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}
