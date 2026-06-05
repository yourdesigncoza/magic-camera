import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

// A device token authenticates child-mode requests. There is no user login, so
// instead of trusting a client-supplied deviceId, the server issues an
// HMAC-signed token bound to the device_id at registration. The browser stores
// it and sends it on every child request; the server derives the *authoritative*
// deviceId from the signature. This closes the IDOR where any client could read
// or act on another device's images by passing its UUID.

export const DEVICE_TOKEN_HEADER = 'x-device-token';

function secret(): string {
  const s = process.env.PARENT_PIN_SECRET;
  if (!s) throw new Error('Missing PARENT_PIN_SECRET');
  return s;
}

function sign(payload: string): string {
  // Domain-separated from parent-session signatures.
  return createHmac('sha256', secret()).update(`device:${payload}`).digest('hex');
}

// Long-lived per-install token (no expiry — it identifies the device, like a
// password manager entry, and is revocable only by clearing localStorage).
export function createDeviceToken(deviceId: string): string {
  return `${deviceId}.${sign(deviceId)}`;
}

export function verifyDeviceToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const deviceId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(deviceId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return deviceId;
}

// Read + verify the device token from a request header. Returns the authoritative
// deviceId, or null if missing/invalid.
export function getRequestDeviceId(req: NextRequest): string | null {
  return verifyDeviceToken(req.headers.get(DEVICE_TOKEN_HEADER));
}
