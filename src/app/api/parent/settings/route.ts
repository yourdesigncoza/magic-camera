import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getParentDeviceId, getParentSettings } from '@/lib/parentAuth';
import { getDeviceById, countGenerationsToday } from '@/lib/device';
import { jsonError, jsonOk } from '@/lib/http';
import { PresetRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/parent/settings — full dashboard payload (parent only).
export async function GET() {
  const deviceId = await getParentDeviceId();
  if (!deviceId) return jsonError('Unauthorized', 401);

  const device = await getDeviceById(deviceId);
  if (!device) return jsonError('Unknown device', 404);

  const settings = await getParentSettings(deviceId);
  const usedToday = await countGenerationsToday(deviceId);

  const { data: presets } = await supabaseAdmin()
    .from('presets')
    .select('*')
    .order('sort_order', { ascending: true });

  return jsonOk({
    device: {
      id: device.id,
      name: device.device_name,
      isActive: device.is_active,
      dailyLimit: device.daily_limit,
    },
    usedToday,
    settings: settings
      ? {
          saveOriginals: settings.save_originals,
          saveGenerated: settings.save_generated,
          autoDeleteOriginalsDays: settings.auto_delete_originals_days,
          autoDeleteGeneratedDays: settings.auto_delete_generated_days,
        }
      : null,
    presets: (presets as PresetRow[]) ?? [],
  });
}

// POST /api/parent/settings — update device limit + storage settings (parent only).
export async function POST(req: NextRequest) {
  const deviceId = await getParentDeviceId();
  if (!deviceId) return jsonError('Unauthorized', 401);

  let body: {
    dailyLimit?: number;
    isActive?: boolean;
    saveOriginals?: boolean;
    saveGenerated?: boolean;
    autoDeleteOriginalsDays?: number;
    autoDeleteGeneratedDays?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const db = supabaseAdmin();
  const now = new Date().toISOString();

  // Device-level fields.
  const deviceUpdate: Record<string, unknown> = { updated_at: now };
  if (typeof body.dailyLimit === 'number') {
    deviceUpdate.daily_limit = Math.max(0, Math.min(200, Math.floor(body.dailyLimit)));
  }
  if (typeof body.isActive === 'boolean') deviceUpdate.is_active = body.isActive;
  if (Object.keys(deviceUpdate).length > 1) {
    const { error } = await db.from('devices').update(deviceUpdate).eq('id', deviceId);
    if (error) return jsonError(error.message, 500);
  }

  // parent_settings fields.
  const settingsUpdate: Record<string, unknown> = { updated_at: now };
  if (typeof body.saveOriginals === 'boolean') settingsUpdate.save_originals = body.saveOriginals;
  if (typeof body.saveGenerated === 'boolean') settingsUpdate.save_generated = body.saveGenerated;
  if (typeof body.autoDeleteOriginalsDays === 'number')
    settingsUpdate.auto_delete_originals_days = Math.max(0, Math.floor(body.autoDeleteOriginalsDays));
  if (typeof body.autoDeleteGeneratedDays === 'number')
    settingsUpdate.auto_delete_generated_days = Math.max(0, Math.floor(body.autoDeleteGeneratedDays));
  if (Object.keys(settingsUpdate).length > 1) {
    const { error } = await db
      .from('parent_settings')
      .update(settingsUpdate)
      .eq('device_id', deviceId);
    if (error) return jsonError(error.message, 500);
  }

  return jsonOk({ ok: true });
}
