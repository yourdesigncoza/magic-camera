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
import { downloadObject, uploadObject, createSignedRead, removeObjects } from '@/lib/storage';
import { generateFromImage } from '@/lib/openai';
import {
  BUCKET_ORIGINALS,
  BUCKET_GENERATED,
  generatedPath,
  EVENT_GENERATION_FAILED,
} from '@/lib/constants';
import { jsonError, jsonOk } from '@/lib/http';
import { ImageRow, PresetRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // image generation can take 30–60s

// POST /api/images/generate { imageId, presetId }  (auth: x-device-token)
// -> { status, imageId, url }
// Runs the full server-side generation synchronously. Fails closed.
export async function POST(req: NextRequest) {
  const callerDeviceId = getRequestDeviceId(req);
  if (!callerDeviceId) return jsonError('Unauthorized', 401);

  let body: { imageId?: string; presetId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { imageId, presetId } = body;
  if (!imageId || !presetId) return jsonError('imageId and presetId are required');

  const db = supabaseAdmin();

  // Load the image record, scoped to the authenticated device (ownership).
  const imgRes = await db
    .from('images')
    .select('*')
    .eq('id', imageId)
    .eq('device_id', callerDeviceId)
    .maybeSingle();
  const image = imgRes.data as ImageRow | null;
  if (!image) return jsonError('Unknown image', 404);
  if (!image.original_path) {
    return jsonError('Image is missing its original upload', 409);
  }
  if (image.status === 'completed') {
    const url = await createSignedRead(BUCKET_GENERATED, image.generated_path);
    return jsonOk({ status: 'completed', imageId, url });
  }

  const device = await getDeviceById(callerDeviceId);
  if (!device) return jsonError('Unknown device', 404);

  // Preset must exist and be enabled.
  const presetRes = await db.from('presets').select('*').eq('id', presetId).maybeSingle();
  const preset = presetRes.data as PresetRow | null;
  if (!preset) return jsonError('Unknown preset', 404);
  if (!preset.is_enabled) return jsonError('Preset is disabled', 409);

  const settings = await getParentSettings(device.id);

  // Atomically reserve a quota slot BEFORE doing any paid work (race-safe).
  const reserved = await reserveGenerationSlot(device.id, imageId);
  if (!reserved) {
    return jsonError('Daily limit reached', 429, { reason: 'limit_reached' });
  }

  // Mark processing + attach preset.
  await db
    .from('images')
    .update({ status: 'processing', preset_id: presetId })
    .eq('id', imageId);

  try {
    const original = await downloadObject(BUCKET_ORIGINALS, image.original_path);
    const result = await generateFromImage(
      original,
      image.original_content_type || 'image/webp',
      preset.prompt,
    );

    // Honour "don't save generated": return the result inline (data URL) and
    // never persist it to storage or the gallery.
    if (settings && settings.save_generated === false) {
      await db
        .from('images')
        .update({
          status: 'completed',
          generated_path: null,
          generated_content_type: result.contentType,
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', imageId);

      // Drop the original too if the parent opted out of keeping originals.
      if (settings.save_originals === false) {
        await removeObjects(BUCKET_ORIGINALS, [image.original_path]);
        await db.from('images').update({ original_path: null }).eq('id', imageId);
      }

      const dataUrl = `data:${result.contentType};base64,${result.bytes.toString('base64')}`;
      return jsonOk({ status: 'completed', imageId, url: dataUrl });
    }

    const genPath = generatedPath(device.id, imageId);
    await uploadObject(BUCKET_GENERATED, genPath, result.bytes, result.contentType);

    await db
      .from('images')
      .update({
        status: 'completed',
        generated_path: genPath,
        generated_content_type: result.contentType,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', imageId);

    // Honour "don't save originals": delete the original after a successful gen.
    if (settings && settings.save_originals === false) {
      await removeObjects(BUCKET_ORIGINALS, [image.original_path]);
      await db.from('images').update({ original_path: null }).eq('id', imageId);
    }

    const url = await createSignedRead(BUCKET_GENERATED, genPath);
    return jsonOk({ status: 'completed', imageId, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    // Refund the reserved slot — failures don't burn quota.
    await refundGenerationSlot(device.id, imageId);
    await db
      .from('images')
      .update({ status: 'failed', error_message: message.slice(0, 500) })
      .eq('id', imageId);
    await logUsage(device.id, EVENT_GENERATION_FAILED, imageId);
    // Friendly, non-technical message for the child UI; details stay server-side.
    return jsonError('Magic did not work this time', 502, { status: 'failed' });
  }
}
