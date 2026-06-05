import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSignedRead } from '@/lib/storage';
import { BUCKET_GENERATED, BUCKET_ORIGINALS } from '@/lib/constants';
import { getParentDeviceId } from '@/lib/parentAuth';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GalleryRow {
  id: string;
  created_at: string;
  generated_path: string | null;
  original_path: string | null;
  preset_id: string | null;
  presets: { label: string; emoji: string | null } | null;
}

// GET /api/gallery?deviceId=...&scope=child|parent
// child  -> completed generated images only, signed display URLs.
// parent -> requires parent session; also returns original signed URLs.
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId');
  const scope = req.nextUrl.searchParams.get('scope') || 'child';
  if (!deviceId) return jsonError('deviceId is required');

  if (scope === 'parent') {
    const parentDeviceId = await getParentDeviceId(deviceId);
    if (!parentDeviceId) return jsonError('Unauthorized', 401);
  }

  const query = supabaseAdmin()
    .from('images')
    .select('id, created_at, generated_path, original_path, preset_id, presets(label, emoji)')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(100);

  // Child gallery shows successful results only.
  if (scope !== 'parent') {
    query.eq('status', 'completed').not('generated_path', 'is', null);
  }

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  const rows = (data as unknown as GalleryRow[]) ?? [];
  const items = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      createdAt: row.created_at,
      url: await createSignedRead(BUCKET_GENERATED, row.generated_path),
      originalUrl:
        scope === 'parent'
          ? await createSignedRead(BUCKET_ORIGINALS, row.original_path)
          : null,
      presetLabel: row.presets?.label ?? null,
      presetEmoji: row.presets?.emoji ?? null,
    })),
  );

  return jsonOk({ items });
}
