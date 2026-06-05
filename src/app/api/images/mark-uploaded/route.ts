import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getRequestDeviceId } from '@/lib/deviceToken';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/images/mark-uploaded { imageId }  (auth: x-device-token)
export async function POST(req: NextRequest) {
  const deviceId = getRequestDeviceId(req);
  if (!deviceId) return jsonError('Unauthorized', 401);

  let body: { imageId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { imageId } = body;
  if (!imageId) return jsonError('imageId is required');

  const { error, data } = await supabaseAdmin()
    .from('images')
    .update({ status: 'uploaded', uploaded_at: new Date().toISOString() })
    .eq('id', imageId)
    .eq('device_id', deviceId) // ownership scope
    .eq('status', 'pending')
    .select('id');

  if (error) return jsonError(error.message, 500);
  if (!data || data.length === 0) return jsonError('Not found', 404);
  return jsonOk({ ok: true });
}
