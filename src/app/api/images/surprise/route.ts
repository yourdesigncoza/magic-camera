import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getDeviceById,
  logUsage,
  reserveGenerationSlot,
  refundGenerationSlot,
} from '@/lib/device';
import { getRequestDeviceId } from '@/lib/deviceToken';
import { getParentSettings } from '@/lib/parentAuth';
import { downloadObject } from '@/lib/storage';
import { planSurprisePrompt } from '@/lib/openai';
import { generateAndStore } from '@/lib/generation';
import { BUCKET_ORIGINALS, EVENT_GENERATION_FAILED } from '@/lib/constants';
import { jsonError, jsonOk } from '@/lib/http';
import { ImageRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/images/surprise { imageId }  (auth: x-device-token)
// A vision model invents a child-safe custom style from the photo, then the
// normal pipeline generates it. -> { status, imageId, url, title }
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
  if (!image.original_path) return jsonError('Image is missing its original upload', 409);

  const device = await getDeviceById(callerDeviceId);
  if (!device) return jsonError('Unknown device', 404);

  const settings = await getParentSettings(device.id);

  const reserved = await reserveGenerationSlot(device.id, imageId);
  if (!reserved) return jsonError('Daily limit reached', 429, { reason: 'limit_reached' });

  await db.from('images').update({ status: 'processing' }).eq('id', imageId);

  try {
    const original = await downloadObject(BUCKET_ORIGINALS, image.original_path);
    const planned = await planSurprisePrompt(
      original,
      image.original_content_type || 'image/webp',
    );
    const { url } = await generateAndStore({
      image,
      device,
      settings,
      prompt: planned.prompt,
      originalBytes: original,
    });
    return jsonOk({ status: 'completed', imageId, url, title: planned.title });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    await refundGenerationSlot(device.id, imageId);
    await db
      .from('images')
      .update({ status: 'failed', error_message: message.slice(0, 500) })
      .eq('id', imageId);
    await logUsage(device.id, EVENT_GENERATION_FAILED, imageId);
    return jsonError('Magic did not work this time', 502, { status: 'failed' });
  }
}
