'use client';

const KEY = 'mc_device_code';

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

export interface DeviceInfo {
  deviceId: string;
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
  return res.json();
}
