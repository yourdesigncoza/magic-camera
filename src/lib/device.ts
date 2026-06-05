import { supabaseAdmin } from './supabaseAdmin';
import { DeviceRow } from './types';
import { EVENT_GENERATION_SUCCESS } from './constants';

// Get-or-create a device row keyed by a stable client-generated device_code
// (stored in the browser's localStorage). Single-family MVP: each phone = one device.
export async function getOrCreateDevice(deviceCode: string): Promise<DeviceRow> {
  const db = supabaseAdmin();

  const existing = await db
    .from('devices')
    .select('*')
    .eq('device_code', deviceCode)
    .maybeSingle();

  if (existing.data) return existing.data as DeviceRow;

  const inserted = await db
    .from('devices')
    .insert({ device_code: deviceCode, device_name: 'Magic Camera' })
    .select('*')
    .single();

  if (inserted.error || !inserted.data) {
    // Handle the race where two requests insert the same code concurrently.
    const retry = await db
      .from('devices')
      .select('*')
      .eq('device_code', deviceCode)
      .single();
    if (retry.data) return retry.data as DeviceRow;
    throw new Error(`Failed to create device: ${inserted.error?.message ?? 'unknown'}`);
  }
  return inserted.data as DeviceRow;
}

export async function getDeviceById(deviceId: string): Promise<DeviceRow | null> {
  const { data } = await supabaseAdmin()
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .maybeSingle();
  return (data as DeviceRow) ?? null;
}

// Count successful generations for this device since local midnight (UTC-based).
export async function countGenerationsToday(deviceId: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin()
    .from('usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .eq('event_type', EVENT_GENERATION_SUCCESS)
    .gte('created_at', since.toISOString());

  return count ?? 0;
}

export interface QuotaCheck {
  ok: boolean;
  used: number;
  limit: number;
  reason?: 'inactive' | 'limit_reached';
}

export async function checkQuota(device: DeviceRow): Promise<QuotaCheck> {
  if (!device.is_active) {
    return { ok: false, used: 0, limit: device.daily_limit, reason: 'inactive' };
  }
  const used = await countGenerationsToday(device.id);
  if (used >= device.daily_limit) {
    return { ok: false, used, limit: device.daily_limit, reason: 'limit_reached' };
  }
  return { ok: true, used, limit: device.daily_limit };
}

export async function logUsage(
  deviceId: string,
  eventType: string,
  imageId?: string,
): Promise<void> {
  await supabaseAdmin().from('usage_logs').insert({
    device_id: deviceId,
    event_type: eventType,
    image_id: imageId ?? null,
  });
}
