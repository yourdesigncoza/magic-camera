import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from 'crypto';
import { cookies } from 'next/headers';
import { PARENT_COOKIE, PARENT_SESSION_TTL } from './constants';
import { supabaseAdmin } from './supabaseAdmin';
import { ParentSettingsRow } from './types';

function secret(): string {
  const s = process.env.PARENT_PIN_SECRET;
  if (!s) throw new Error('Missing PARENT_PIN_SECRET');
  return s;
}

// ── PIN hashing (scrypt) ────────────────────────────────────────────────────
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(pin, salt + secret(), 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  const derived = scryptSync(pin, salt + secret(), 32);
  const expectedBuf = Buffer.from(expected, 'hex');
  if (expectedBuf.length !== derived.length) return false;
  return timingSafeEqual(derived, expectedBuf);
}

// ── Session token (HMAC-signed) ─────────────────────────────────────────────
function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function createSessionToken(deviceId: string): string {
  const exp = Math.floor(Date.now() / 1000) + PARENT_SESSION_TTL;
  const payload = `${deviceId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expectedSig = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [deviceId, expStr] = payload.split('.');
  const exp = Number(expStr);
  if (!deviceId || !exp || exp < Math.floor(Date.now() / 1000)) return null;
  return deviceId;
}

// ── Cookie helpers (server components / route handlers) ──────────────────────
export async function setParentCookie(deviceId: string): Promise<void> {
  const store = await cookies();
  store.set(PARENT_COOKIE, createSessionToken(deviceId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PARENT_SESSION_TTL,
  });
}

export async function clearParentCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PARENT_COOKIE);
}

// Returns the authenticated deviceId, or null. Also enforces that the cookie's
// device matches the requested device when one is supplied.
export async function getParentDeviceId(
  requireDeviceId?: string,
): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PARENT_COOKIE)?.value;
  const deviceId = verifySessionToken(token);
  if (!deviceId) return null;
  if (requireDeviceId && requireDeviceId !== deviceId) return null;
  return deviceId;
}

export async function getParentSettings(
  deviceId: string,
): Promise<ParentSettingsRow | null> {
  const { data } = await supabaseAdmin()
    .from('parent_settings')
    .select('*')
    .eq('device_id', deviceId)
    .maybeSingle();
  return (data as ParentSettingsRow) ?? null;
}
