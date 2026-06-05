import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSignedRead, removeObjects } from '@/lib/storage';
import { BUCKET_GENERATED, BUCKET_ORIGINALS } from '@/lib/constants';
import { getParentDeviceId } from '@/lib/parentAuth';
import { jsonError, jsonOk } from '@/lib/http';
import { ImageRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/images/:id -> { status, url, error }
// Polled by the child UI while a generation is in flight.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await supabaseAdmin()
    .from('images')
    .select('id, status, generated_path, error_message')
    .eq('id', id)
    .maybeSingle();

  const image = data as Pick<ImageRow, 'id' | 'status' | 'generated_path' | 'error_message'> | null;
  if (!image) return jsonError('Not found', 404);

  const url =
    image.status === 'completed'
      ? await createSignedRead(BUCKET_GENERATED, image.generated_path)
      : null;

  return jsonOk({
    imageId: image.id,
    status: image.status,
    url,
    error: image.status === 'failed' ? 'Magic did not work this time' : null,
  });
}

// DELETE /api/images/:id?scope=all|original|generated  — parent only.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const scope = req.nextUrl.searchParams.get('scope') || 'all';

  const db = supabaseAdmin();
  const { data } = await db.from('images').select('*').eq('id', id).maybeSingle();
  const image = data as ImageRow | null;
  if (!image) return jsonError('Not found', 404);

  // Must be an authenticated parent for the device that owns this image.
  const parentDeviceId = await getParentDeviceId(image.device_id ?? undefined);
  if (!parentDeviceId) return jsonError('Unauthorized', 401);

  if (scope === 'original' || scope === 'all') {
    if (image.original_path) await removeObjects(BUCKET_ORIGINALS, [image.original_path]);
  }
  if (scope === 'generated' || scope === 'all') {
    if (image.generated_path) await removeObjects(BUCKET_GENERATED, [image.generated_path]);
  }

  if (scope === 'all') {
    await db.from('images').delete().eq('id', id);
  } else if (scope === 'original') {
    await db.from('images').update({ original_path: null }).eq('id', id);
  } else if (scope === 'generated') {
    await db
      .from('images')
      .update({ generated_path: null, status: 'failed' })
      .eq('id', id);
  }

  return jsonOk({ ok: true });
}
