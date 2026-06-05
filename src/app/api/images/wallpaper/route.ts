import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getDeviceById,
  logUsage,
  reserveGenerationSlot,
  refundGenerationSlot,
} from '@/lib/device';
import { getRequestDeviceId } from '@/lib/deviceToken';
import { downloadObject } from '@/lib/storage';
import { generateFromImage } from '@/lib/openai';
import { BUCKET_GENERATED, EVENT_GENERATION_FAILED } from '@/lib/constants';
import { jsonError, jsonOk } from '@/lib/http';
import { ImageRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WALLPAPER_PROMPT =
  'Reframe this picture into a clean 9:16 vertical phone-wallpaper composition. ' +
  'Keep the main subject and the existing art style, and fill the taller canvas naturally ' +
  'with matching background so nothing important is cropped.';

// POST /api/images/wallpaper { imageId }  (auth: x-device-token)
// Re-edits a stored generated image into a 9:16 wallpaper. Returns an inline
// data URL (not persisted to the gallery). Counts as one generation.
export async function POST(req: NextRequest) {
  const callerDeviceId = getRequestDeviceId(req);
  if (!callerDeviceId) return jsonError('Unauthorized', 401);

  let body: { imageId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { imageId } = body;
  if (!imageId) return jsonError('imageId is required');

  const db = supabaseAdmin();
  const imgRes = await db
    .from('images')
    .select('*')
    .eq('id', imageId)
    .eq('device_id', callerDeviceId)
    .maybeSingle();
  const image = imgRes.data as ImageRow | null;
  if (!image) return jsonError('Unknown image', 404);
  if (!image.generated_path) {
    return jsonError('No saved image to make a wallpaper from', 409);
  }

  const device = await getDeviceById(callerDeviceId);
  if (!device) return jsonError('Unknown device', 404);

  const reserved = await reserveGenerationSlot(device.id, imageId);
  if (!reserved) return jsonError('Daily limit reached', 429, { reason: 'limit_reached' });

  try {
    const source = await downloadObject(BUCKET_GENERATED, image.generated_path);
    const result = await generateFromImage(
      source,
      image.generated_content_type || 'image/webp',
      WALLPAPER_PROMPT,
      { size: '1024x1536' },
    );
    const url = `data:${result.contentType};base64,${result.bytes.toString('base64')}`;
    return jsonOk({ url, title: 'Wallpaper' });
  } catch (err) {
    await refundGenerationSlot(device.id, imageId);
    await logUsage(device.id, EVENT_GENERATION_FAILED, imageId);
    return jsonError('Could not make a wallpaper this time', 502);
  }
}
