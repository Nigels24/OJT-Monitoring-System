import { randomUUID } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * The single private bucket for student-owned files. Documents and
 * Credentials share it under different prefixes (`documents/<studentId>/`,
 * `credentials/<studentId>/`) — see CLAUDE.md §7 "File storage".
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
 * The original filename is discarded rather than sanitized and kept — the
 * human-readable name is stored separately (`Document.name`), so the object
 * path only needs to be unique and carry the right extension.
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
