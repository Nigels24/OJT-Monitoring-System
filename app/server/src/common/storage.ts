import { randomUUID } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * The single private bucket for student-owned files. New uploads go under
 * `documents/<studentId>/`; rows migrated from the retired Credential table
 * still point at their original `credentials/<studentId>/` objects, which is
 * harmless — nothing reads the prefix. See CLAUDE.md §7 "File storage".
 */
const BUCKET = 'student-files';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;

let client: SupabaseClient | null = null;

/** Lazily built so a missing env var fails loudly at first use, not at import time. */
function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Add them to app/server/.env before starting the server.',
    );
  }

  client = createClient(url, key);
  return client;
}

/**
 * Builds a collision-free object path under a prefix, e.g.
 * `buildObjectPath('documents', studentId, 'resume.pdf')` ->
 * `documents/<studentId>/<uuid>.pdf`.
 *
 * The original filename is not used in the path — it is stored separately
 * (`Document.originalFileName`), so the object path only needs to be unique
 * and carry the right extension.
 */
export function buildObjectPath(
  prefix: string,
  studentId: string,
  originalName: string,
): string {
  const dot = originalName.lastIndexOf('.');
  const ext = dot === -1 ? '' : originalName.slice(dot);
  return `${prefix}/${studentId}/${randomUUID()}${ext}`;
}

/** Uploads a buffer to `path`. Never overwrites — every path is freshly generated. */
export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await getClient()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) {
    throw new Error(`Failed to upload file to storage: ${error.message}`);
  }
}

/** Mints a time-limited URL for a stored object path. Never store the result. */
export async function getSignedUrl(
  path: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await getClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(
      `Failed to create signed URL: ${error?.message ?? 'unknown error'}`,
    );
  }
  return data.signedUrl;
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await getClient().storage.from(BUCKET).remove([path]);
  if (error) {
    throw new Error(`Failed to delete file from storage: ${error.message}`);
  }
}

/**
 * Fetches an object's bytes, for the coordinator's download and ZIP routes.
 *
 * Buffered rather than streamed: files are capped at 10MB, and having the
 * whole thing in hand before any response header goes out means a storage
 * failure becomes a clean HTTP error instead of a truncated 200.
 */
export async function downloadFile(
  path: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const { data, error } = await getClient().storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new Error(
      `Failed to download file from storage: ${error?.message ?? 'unknown error'}`,
    );
  }
  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || 'application/octet-stream',
  };
}
