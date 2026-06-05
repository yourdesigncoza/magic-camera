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
-- `name` is the seed's natural key — makes re-running the seed idempotent and
-- prevents the duplicate-preset bug.
create unique index if not exists presets_name_key on presets (name);

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

-- ── Atomic quota reservation ────────────────────────────────────────────────
-- Race-safe "check daily limit and consume one slot" used by /api/images/generate.
-- A per-device transaction-scoped advisory lock serialises concurrent requests
-- from the same device, so N parallel generations can't all pass the check.
-- Returns true and logs a generation_success row if a slot was available.
create or replace function increment_usage_if_allowed(
  p_device_id uuid,
  p_image_id uuid default null
)
returns boolean
language plpgsql
as $$
declare
  v_limit int;
  v_active boolean;
  v_count int;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  -- Serialise per device for the duration of the transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_device_id::text, 0));

  select daily_limit, is_active into v_limit, v_active
  from devices where id = p_device_id;

  if v_limit is null then return false; end if;  -- unknown device
  if not v_active then return false; end if;       -- locked / inactive

  select count(*) into v_count
  from usage_logs
  where device_id = p_device_id
    and event_type = 'generation_success'
    and created_at >= v_day_start;

  if v_count >= v_limit then return false; end if;

  insert into usage_logs (device_id, image_id, event_type)
  values (p_device_id, p_image_id, 'generation_success');

  return true;
end;
$$;

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
 true, 6),
('scribble', 'Pathetic Scribble', '✏️',
 'Redraw the attached image in the most clumsy, scribbly, and utterly pathetic way possible. Use a white background, and make it look like it was drawn in an old computer painting program with a mouse. It should be vaguely similar but also not really, kind of matching but also off in a confusing, awkward way, with that low-quality pixel-by-pixel feel that really emphasizes how ridiculously bad it is. Actually, you know what, whatever, just draw it however you want.',
 true, 7),
('cheese', 'Turn to Cheese', '🧀',
 'Change nothing about this photo except everyone is turned into cheese.',
 true, 8),
('goblin', 'Goblin Mode', '👹',
 'Make the subject into a cute fantasy character in a scrappy handmade indie webcomic style. Use exaggerated fantasy anatomy with huge pointed ears, oversized expressive yellow eyes, tiny fangs, simplified facial features, and chibi-adjacent proportions. Draw with thick uneven black ink outlines, sketchy hand-drawn linework, and intentionally imperfect shapes. Use flat cel shading only — NO painterly rendering, realistic lighting, or detailed textures. The palette should be muted earthy greens, dusty reds, faded browns, warm creams, and soft olive tones with minimal gradients. The subject wears ragged fantasy adventurer clothes with wraps around the arms and legs and holds a crooked wooden staff with a glowing gem attached. A small bag of golden tokens sits near their feet. There should never be any text on the final image. Despite the web comic reference, the image should be focused on the main subject(s) and the illustrated background without text. The expression should feel slightly startled, mischievous, and awkwardly charming. Composition should feel like an indie animation character sheet or fantasy webcomic panel with lots of negative space and a sparse lightly sketched forest background bathed in warm golden light. Add tiny doodle-like motion lines, dust puffs, and whimsical comic accents. Preserve a playful chaotic energy and cozy spooky fantasy mood. Aesthetic references: indie fantasy webcomic, internet sketchbook character art, handmade cartoon fantasy, cozy spooky zine art, and indie RPG-inspired character sheets. Avoid: painterly rendering, realism, cinematic lighting, detailed skin texture, glossy shading, 3D rendering, hyper-detail, polished anime style, realistic proportions, dramatic depth-of-field, complex backgrounds. Important: there should never be any mention of stealing, lying, or any other criminal activity.',
 true, 9),
('anime', 'Anime Portrait', '🎨',
 'Create a trending anime art style image from the uploaded subject. Use confident line-work with slight variation and minimal cel shading using flat shadow shapes. Use bright, saturated colors and clean graphic lighting. The style that is defined by its exaggerated, cartoonish character proportions featuring highly expressive, simplistic facial features that allow for immense emotional range, with highly varied stretched anatomy. Transform the environment into a slightly warped space with playful perspective distortion and simplified objects. Composition and tone is energetic, lively, and comedic in a fully stylized, non-realistic world.',
 true, 10)
on conflict (name) do nothing;
