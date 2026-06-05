import { NextRequest } from 'next/server';
import { getParentSettings, getParentDeviceId } from '@/lib/parentAuth';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/parent/status?deviceId=... -> { hasPin, authed }
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId');
  if (!deviceId) return jsonError('deviceId is required');

  const settings = await getParentSettings(deviceId);
  const authedDeviceId = await getParentDeviceId(deviceId);

  return jsonOk({ hasPin: !!settings, authed: !!authedDeviceId });
}
