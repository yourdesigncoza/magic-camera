import { supabaseAdmin } from './supabaseAdmin';
import { downloadObject, uploadObject, createSignedRead, removeObjects } from './storage';
import { generateFromImage } from './openai';
import { BUCKET_ORIGINALS, BUCKET_GENERATED, generatedPath } from './constants';
import { ImageRow, ParentSettingsRow, DeviceRow } from './types';

function extForContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg')) return 'jpg';
  return 'webp';
}

// Shared generation core used by both /generate and /surprise: edit the original
// with the given prompt, store the result honouring the save_generated /
// save_originals settings, mark the image completed, and return the display URL
// (signed URL, or an inline data URL when the result isn't persisted).
export async function generateAndStore(params: {
  image: ImageRow;
  device: DeviceRow;
  settings: ParentSettingsRow | null;
  prompt: string;
  originalBytes?: Buffer; // optional, avoids re-downloading the original
}): Promise<{ url: string }> {
  const { image, device, settings, prompt } = params;
  const db = supabaseAdmin();
  const imageId = image.id;
  const originalPath = image.original_path;
  if (!originalPath) throw new Error('Image is missing its original upload');

  const original =
    params.originalBytes ?? (await downloadObject(BUCKET_ORIGINALS, originalPath));
  const result = await generateFromImage(
    original,
    image.original_content_type || 'image/webp',
    prompt,
  );

  const now = new Date().toISOString();
  const dropOriginal = async () => {
    if (settings && settings.save_originals === false && image.original_path) {
      await removeObjects(BUCKET_ORIGINALS, [image.original_path]);
      await db.from('images').update({ original_path: null }).eq('id', imageId);
    }
  };

  // Don't-save-generated: return inline, never persist the result.
  if (settings && settings.save_generated === false) {
    await db
      .from('images')
      .update({
        status: 'completed',
        generated_path: null,
        generated_content_type: result.contentType,
        completed_at: now,
        error_message: null,
      })
      .eq('id', imageId);
    await dropOriginal();
    return {
      url: `data:${result.contentType};base64,${result.bytes.toString('base64')}`,
    };
  }

  const genPath = generatedPath(device.id, imageId, extForContentType(result.contentType));
  await uploadObject(BUCKET_GENERATED, genPath, result.bytes, result.contentType);
  await db
    .from('images')
    .update({
      status: 'completed',
      generated_path: genPath,
      generated_content_type: result.contentType,
      completed_at: now,
      error_message: null,
    })
    .eq('id', imageId);
  await dropOriginal();

  const url = await createSignedRead(BUCKET_GENERATED, genPath);
  if (!url) throw new Error('Could not create result URL');
  return { url };
}
