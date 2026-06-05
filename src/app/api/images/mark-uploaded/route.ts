import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/images/mark-uploaded { imageId } -> { ok }
export async function POST(req: NextRequest) {
  let body: { imageId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { imageId } = body;
  if (!imageId) return jsonError('imageId is required');

  const { error } = await supabaseAdmin()
    .from('images')
    .update({ status: 'uploaded', uploaded_at: new Date().toISOString() })
    .eq('id', imageId)
    .eq('status', 'pending');

  if (error) return jsonError(error.message, 500);
  return jsonOk({ ok: true });
}
