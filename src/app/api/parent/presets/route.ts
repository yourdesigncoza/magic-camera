import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getParentDeviceId } from '@/lib/parentAuth';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/parent/presets { presetId, isEnabled?, prompt?, label? } — parent only.
// Presets are global (not per-device), but only an authenticated parent may edit.
export async function POST(req: NextRequest) {
  const deviceId = await getParentDeviceId();
  if (!deviceId) return jsonError('Unauthorized', 401);

  let body: { presetId?: string; isEnabled?: boolean; prompt?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { presetId } = body;
  if (!presetId) return jsonError('presetId is required');

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.isEnabled === 'boolean') update.is_enabled = body.isEnabled;
  if (typeof body.prompt === 'string' && body.prompt.trim()) update.prompt = body.prompt.trim();
  if (typeof body.label === 'string' && body.label.trim()) update.label = body.label.trim();

  if (Object.keys(update).length === 1) return jsonError('Nothing to update');

  const { error } = await supabaseAdmin().from('presets').update(update).eq('id', presetId);
  if (error) return jsonError(error.message, 500);

  return jsonOk({ ok: true });
}
