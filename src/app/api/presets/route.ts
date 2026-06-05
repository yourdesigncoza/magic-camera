import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonError, jsonOk } from '@/lib/http';
import { PresetRow, PublicPreset } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/presets — enabled presets for child mode. Prompt text is NOT exposed.
export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from('presets')
    .select('id, name, label, emoji')
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true });

  if (error) return jsonError(error.message, 500);

  const presets: PublicPreset[] = (data as PresetRow[]) ?? [];
  return jsonOk({ presets });
}
