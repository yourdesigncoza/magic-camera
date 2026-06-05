import { clearParentCookie } from '@/lib/parentAuth';
import { jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/parent/logout
export async function POST() {
  await clearParentCookie();
  return jsonOk({ ok: true });
}
