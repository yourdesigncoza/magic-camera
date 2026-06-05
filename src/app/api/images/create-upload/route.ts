import { NextRequest } from 'next/server';
import { getDeviceById, checkQuota } from '@/lib/device';
import { getRequestDeviceId } from '@/lib/deviceToken';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSignedUpload } from '@/lib/storage';
import { BUCKET_ORIGINALS, originalPath, ALLOWED_UPLOAD_TYPES } from '@/lib/constants';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/images/create-upload { contentType }  (auth: x-device-token)
// -> { imageId, uploadUrl, uploadToken, path, bucket }
// Creates a pending image row and a short-lived signed upload URL for the original.
export async function POST(req: NextRequest) {
  // Authoritative device identity comes from the signed token, not the body.
  const deviceId = getRequestDeviceId(req);
  if (!deviceId) return jsonError('Unauthorized', 401);

  let body: { contentType?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const contentType = body.contentType ?? 'image/webp';
  const ext = ALLOWED_UPLOAD_TYPES[contentType];
  if (!ext) return jsonError('Unsupported content type');

  const device = await getDeviceById(deviceId);
  if (!device) return jsonError('Unknown device', 404);

  // Fail closed before allocating an upload slot (soft gate; the authoritative,
  // race-safe quota reservation happens in /generate).
  const quota = await checkQuota(device);
  if (!quota.ok) {
    return jsonError('Daily limit reached', 429, {
      reason: quota.reason,
      used: quota.used,
      limit: quota.limit,
    });
  }

  const db = supabaseAdmin();
  const inserted = await db
    .from('images')
    .insert({ device_id: deviceId, status: 'pending', original_content_type: contentType })
    .select('id')
    .single();

  if (inserted.error || !inserted.data) {
    return jsonError(`Failed to create image record: ${inserted.error?.message}`, 500);
  }

  const imageId = inserted.data.id as string;
  const path = originalPath(deviceId, imageId, ext);

  const signed = await createSignedUpload(BUCKET_ORIGINALS, path);

  await db.from('images').update({ original_path: path }).eq('id', imageId);

  return jsonOk({
    imageId,
    bucket: BUCKET_ORIGINALS,
    path: signed.path,
    uploadToken: signed.token,
    uploadUrl: signed.signedUrl,
  });
}
