import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getDeviceById, checkQuota, logUsage } from '@/lib/device';
import { getParentSettings } from '@/lib/parentAuth';
import { downloadObject, uploadObject, createSignedRead, removeObjects } from '@/lib/storage';
import { generateFromImage } from '@/lib/openai';
import {
  BUCKET_ORIGINALS,
  BUCKET_GENERATED,
  generatedPath,
  EVENT_GENERATION_SUCCESS,
  EVENT_GENERATION_FAILED,
} from '@/lib/constants';
import { jsonError, jsonOk } from '@/lib/http';
import { ImageRow, PresetRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // image generation can take 30–60s

// POST /api/images/generate { imageId, presetId } -> { status, imageId, url }
// Runs the full server-side generation synchronously. Fails closed.
export async function POST(req: NextRequest) {
  let body: { imageId?: string; presetId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { imageId, presetId } = body;
  if (!imageId || !presetId) return jsonError('imageId and presetId are required');

  const db = supabaseAdmin();

  // Load the image record.
  const imgRes = await db.from('images').select('*').eq('id', imageId).maybeSingle();
  const image = imgRes.data as ImageRow | null;
  if (!image) return jsonError('Unknown image', 404);
  if (!image.device_id || !image.original_path) {
    return jsonError('Image is missing its original upload', 409);
  }
  if (image.status === 'completed') {
    const url = await createSignedRead(BUCKET_GENERATED, image.generated_path);
    return jsonOk({ status: 'completed', imageId, url });
  }

  // Device + quota (fail closed).
  const device = await getDeviceById(image.device_id);
  if (!device) return jsonError('Unknown device', 404);
  const quota = await checkQuota(device);
  if (!quota.ok) {
    return jsonError('Daily limit reached', 429, {
      reason: quota.reason,
      used: quota.used,
      limit: quota.limit,
    });
  }

  // Preset must exist and be enabled.
  const presetRes = await db.from('presets').select('*').eq('id', presetId).maybeSingle();
  const preset = presetRes.data as PresetRow | null;
  if (!preset) return jsonError('Unknown preset', 404);
  if (!preset.is_enabled) return jsonError('Preset is disabled', 409);

  const settings = await getParentSettings(device.id);

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

    await logUsage(device.id, EVENT_GENERATION_SUCCESS, imageId);

    // Honour "don't save originals": delete the original after a successful gen.
    if (settings && settings.save_originals === false) {
      await removeObjects(BUCKET_ORIGINALS, [image.original_path]);
      await db.from('images').update({ original_path: null }).eq('id', imageId);
    }

    const url = await createSignedRead(BUCKET_GENERATED, genPath);
    return jsonOk({ status: 'completed', imageId, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    await db
      .from('images')
      .update({ status: 'failed', error_message: message.slice(0, 500) })
      .eq('id', imageId);
    await logUsage(device.id, EVENT_GENERATION_FAILED, imageId);
    // Friendly, non-technical message for the child UI; details stay server-side.
    return jsonError('Magic did not work this time', 502, { status: 'failed' });
  }
}
