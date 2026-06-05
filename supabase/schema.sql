-- ============================================================================
-- Magic Camera — Supabase schema, storage buckets, and seed data
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where practical.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ── Tables (per PRD §12) ────────────────────────────────────────────────────

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  device_name text,
  device_code text unique,
  is_active boolean default true,
  daily_limit int default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists parent_settings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references devices(id) on delete cascade,
  parent_pin_hash text not null,
  save_originals boolean default true,
  save_generated boolean default true,
  auto_delete_originals_days int default 30,
  auto_delete_generated_days int default 90,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- One settings row per device.
create unique index if not exists parent_settings_device_id_key
  on parent_settings (device_id);

create table if not exists presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  label text not null,
  emoji text,
  prompt text not null,
  is_enabled boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references devices(id) on delete set null,
  preset_id uuid references presets(id) on delete set null,
  original_path text,
  generated_path text,
  original_content_type text,
  generated_content_type text,
  status text check (status in ('pending', 'uploaded', 'processing', 'completed', 'failed')) default 'pending',
  error_message text,
  created_at timestamptz default now(),
  uploaded_at timestamptz,
  completed_at timestamptz
);
create index if not exists images_device_created_idx
  on images (device_id, created_at desc);
create index if not exists images_status_idx on images (status);

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references devices(id) on delete cascade,
  image_id uuid references images(id) on delete set null,
  event_type text not null,
  created_at timestamptz default now()
);
create index if not exists usage_logs_device_created_idx
  on usage_logs (device_id, created_at desc);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- The app only ever talks to these tables through the service-role key in
-- server-side API routes, which bypasses RLS. Enabling RLS with no policies
-- denies all anon/public access — exactly what we want for child data.
alter table devices enable row level security;
alter table parent_settings enable row level security;
alter table presets enable row level security;
alter table images enable row level security;
alter table usage_logs enable row level security;

-- ── Storage buckets (private) ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('magic-originals', 'magic-originals', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('magic-generated', 'magic-generated', false)
on conflict (id) do nothing;
-- No storage policies are added: anon/public cannot read or write. The server
-- uses the service-role key + short-lived signed URLs for all access.

-- ── Seed presets (per PRD §18) ──────────────────────────────────────────────
insert into presets (name, label, emoji, prompt, is_enabled, sort_order) values
('superhero', 'Superhero', '🦸',
 'Turn the uploaded photo into a cheerful storybook superhero scene. Keep the main subject recognisable. Add a colourful cape, bright sky, and playful heroic energy. Safe for a 4-year-old. No weapons, fighting, danger, horror, or scary elements.',
 true, 1),
('dinosaur', 'Dinosaur World', '🦕',
 'Transform the uploaded photo into a warm illustrated dinosaur adventure. Keep the main subject recognisable. Add friendly cartoon dinosaurs, soft jungle plants, sunshine, and playful colours. Safe for a 4-year-old. No scary dinosaurs, chasing, danger, or violence.',
 true, 2),
('space', 'Space Explorer', '🚀',
 'Turn the uploaded photo into a cheerful space explorer scene. Keep the main subject recognisable. Add a cute space helmet, stars, planets, and a friendly little robot. Safe for a 4-year-old. No scary aliens, darkness, danger, or weapons.',
 true, 3),
('storybook', 'Storybook', '📖',
 'Transform the uploaded photo into a beautiful children''s storybook illustration. Keep the main subject recognisable. Use warm colours, soft texture, gentle lighting, and magical but safe details. No scary, violent, adult, or disturbing elements.',
 true, 4),
('robot', 'Robot Toy', '🤖',
 'Turn the uploaded photo into a playful robot toy workshop scene. Keep the main subject recognisable. Add cute friendly robots, colourful tools, buttons, and lights. Safe for a 4-year-old. No weapons, danger, horror, or sharp scary machinery.',
 true, 5),
('fairy', 'Fairy Castle', '🏰',
 'Transform the uploaded photo into a cheerful fairy-tale castle scene. Keep the main subject recognisable. Add a bright castle, friendly animals, flowers, sparkles, and warm storybook colours. Safe for a 4-year-old. No scary witches, monsters, danger, or dark themes.',
 true, 6)
on conflict do nothing;
