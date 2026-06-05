import { NextRequest } from 'next/server';
import { getOrCreateDevice, checkQuota } from '@/lib/device';
import { getParentSettings } from '@/lib/parentAuth';
import { createDeviceToken } from '@/lib/deviceToken';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/device/register { deviceCode } -> { deviceId, dailyLimit, used, isActive, hasPin }
// Called once on app load with a stable localStorage device code.
export async function POST(req: NextRequest) {
  let body: { deviceCode?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const code = body.deviceCode?.trim();
  if (!code || code.length < 8 || code.length > 100) {
    return jsonError('deviceCode is required');
  }

  const device = await getOrCreateDevice(code);
  const quota = await checkQuota(device);
  const settings = await getParentSettings(device.id);

  return jsonOk({
    deviceId: device.id,
    // Authenticates subsequent child-mode requests (sent as x-device-token).
    deviceToken: createDeviceToken(device.id),
    dailyLimit: device.daily_limit,
    used: quota.used,
    isActive: device.is_active,
    hasPin: !!settings,
  });
}
