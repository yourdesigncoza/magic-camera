import { supabaseAdmin } from './supabaseAdmin';
import { SIGNED_READ_TTL, SIGNED_UPLOAD_TTL } from './constants';

// Create a short-lived signed upload URL so the client can PUT the original
// directly to a private bucket without ever seeing the service-role key.
export async function createSignedUpload(bucket: string, path: string) {
  const { data, error } = await supabaseAdmin()
    .storage.from(bucket)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    throw new Error(`createSignedUploadUrl failed: ${error?.message ?? 'unknown'}`);
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

// Signed read URL for display (gallery / result). Null if path missing.
export async function createSignedRead(
  bucket: string,
  path: string | null | undefined,
  ttl: number = SIGNED_READ_TTL,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin()
    .storage.from(bucket)
    .createSignedUrl(path, ttl);
  if (error || !data) return null;
  return data.signedUrl;
}

// Download an object's bytes (used server-side to send the original to OpenAI).
export async function downloadObject(
  bucket: string,
  path: string,
): Promise<Buffer> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`download failed for ${bucket}/${path}: ${error?.message ?? 'no data'}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Upload bytes server-side (used for the generated result).
export async function uploadObject(
  bucket: string,
  path: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .storage.from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (error) {
    throw new Error(`upload failed for ${bucket}/${path}: ${error.message}`);
  }
}

export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  const clean = paths.filter(Boolean);
  if (clean.length === 0) return;
  await supabaseAdmin().storage.from(bucket).remove(clean);
}

export { SIGNED_UPLOAD_TTL };
