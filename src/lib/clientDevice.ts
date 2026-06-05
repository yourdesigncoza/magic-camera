'use client';

const KEY = 'mc_device_code';
const TOKEN_KEY = 'mc_device_token';

// Stable per-install device code stored in localStorage.
export function getDeviceCode(): string {
  if (typeof window === 'undefined') return '';
  let code = window.localStorage.getItem(KEY);
  if (!code) {
    code =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    window.localStorage.setItem(KEY, code);
  }
  return code;
}

export function getDeviceToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

// Headers that authenticate child-mode requests to the server.
export function authHeaders(): Record<string, string> {
  const token = getDeviceToken();
  return token ? { 'x-device-token': token } : {};
}

export interface DeviceInfo {
  deviceId: string;
  deviceToken: string;
  dailyLimit: number;
  used: number;
  isActive: boolean;
  hasPin: boolean;
}

export async function registerDevice(): Promise<DeviceInfo> {
  const res = await fetch('/api/device/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode: getDeviceCode() }),
  });
  if (!res.ok) throw new Error('Could not register device');
  const info: DeviceInfo = await res.json();
  if (info.deviceToken && typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_KEY, info.deviceToken);
  }
  return info;
}
