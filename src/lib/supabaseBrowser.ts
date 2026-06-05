'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Anon browser client — only used to upload originals to signed upload URLs.
// The anon key is safe to expose; private buckets remain inaccessible without
// a signed URL/token issued by the server.
let cached: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }
  cached = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
