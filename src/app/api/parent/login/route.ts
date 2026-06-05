import { NextRequest } from 'next/server';
import { getParentSettings, verifyPin, setParentCookie } from '@/lib/parentAuth';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/parent/login { deviceId, pin } -> sets parent session cookie.
export async function POST(req: NextRequest) {
  let body: { deviceId?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { deviceId, pin } = body;
  if (!deviceId || !pin) return jsonError('deviceId and pin are required');

  const settings = await getParentSettings(deviceId);
  if (!settings) return jsonError('No PIN set for this device', 404);

  if (!verifyPin(pin, settings.parent_pin_hash)) {
    return jsonError('Incorrect PIN', 401);
  }

  await setParentCookie(deviceId);
  return jsonOk({ ok: true });
}
