// Shared constants for storage layout and lifecycle.

export const BUCKET_ORIGINALS = 'magic-originals';
export const BUCKET_GENERATED = 'magic-generated';

// Storage object paths follow: <device-id>/<image-id>/<original|generated>.webp
export function originalPath(deviceId: string, imageId: string): string {
  return `${deviceId}/${imageId}/original.webp`;
}

export function generatedPath(deviceId: string, imageId: string): string {
  return `${deviceId}/${imageId}/generated.webp`;
}

// Signed read URLs expire after this many seconds (gallery display / result).
export const SIGNED_READ_TTL = 60 * 60; // 1 hour
// Signed upload URLs are short-lived (client uploads immediately after request).
export const SIGNED_UPLOAD_TTL = 60 * 5; // 5 minutes

export const PARENT_COOKIE = 'mc_parent';
export const PARENT_SESSION_TTL = 60 * 60 * 8; // 8 hours

// usage_logs.event_type values
export const EVENT_GENERATION_SUCCESS = 'generation_success';
export const EVENT_GENERATION_FAILED = 'generation_failed';
