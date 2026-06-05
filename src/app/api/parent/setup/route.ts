import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getDeviceById } from '@/lib/device';
import { hashPin, setParentCookie, getParentSettings } from '@/lib/parentAuth';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/parent/setup { deviceId, pin }
// Creates the first parent PIN for a device. Only works when none exists yet.
export async function POST(req: NextRequest) {
  let body: { deviceId?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { deviceId, pin } = body;
  if (!deviceId || !pin) return jsonError('deviceId and pin are required');
  if (!/^\d{4,8}$/.test(pin)) return jsonError('PIN must be 4–8 digits');

  const device = await getDeviceById(deviceId);
  if (!device) return jsonError('Unknown device', 404);

  const existing = await getParentSettings(deviceId);
  if (existing) return jsonError('A PIN already exists for this device', 409);

  const { error } = await supabaseAdmin().from('parent_settings').insert({
    device_id: deviceId,
    parent_pin_hash: hashPin(pin),
  });
  if (error) return jsonError(error.message, 500);

  await setParentCookie(deviceId);
  return jsonOk({ ok: true });
}
