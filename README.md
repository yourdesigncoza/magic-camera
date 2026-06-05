# Magic Camera

A child-safe AI "toy camera" PWA. A young child takes a photo, taps a big "magic"
preset, and gets back an AI-transformed image in a private gallery. A PIN-gated
parent mode controls cost, presets, storage, and deletion.

Stack: **Next.js (App Router) · Supabase Postgres + Storage · OpenAI Image API · Vercel**.
Full spec: [`PRD-Magic-Camera-PWA.md`](./PRD-Magic-Camera-PWA.md).

## Quick start (local)

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

## 1. Supabase setup

1. Create a new Supabase project.
2. SQL editor → run [`supabase/schema.sql`](./supabase/schema.sql). This creates the
   tables, enables RLS (deny-all to anon — the server uses the service-role key),
   creates the two **private** buckets (`magic-originals`, `magic-generated`), and
   seeds the 6 presets.
3. Settings → API → copy the Project URL, the `anon` key, and the `service_role` key.

No Supabase Auth is used — the app talks to Supabase only from server-side API
routes with the service-role key, plus short-lived signed URLs for the browser.

## 2. Environment variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | anon key (used only to PUT originals to signed URLs). New projects: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) also works |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | service-role key — never expose. New projects: `SUPABASE_SECRET_KEY` (`sb_secret_…`) also works |
| `OPENAI_API_KEY` | **server only** | image generation |
| `OPENAI_IMAGE_MODEL` | server | optional, defaults to `gpt-image-1` |
| `PARENT_PIN_SECRET` | **server only** | `openssl rand -hex 32` — signs parent cookies **and device tokens**, salts PINs. Changing it logs out all parents and invalidates all device tokens |

## 3. Deploy to Vercel

1. Import the repo in Vercel (framework auto-detected as Next.js).
2. Add the env vars above (Production + Preview).
3. Deploy. The free `*.vercel.app` URL is fine for testing — no custom domain needed.
4. On the Android phone, open the URL in Chrome → **Add to Home screen** to install the PWA.

> `gpt-image-1` may require organisation verification on your OpenAI account.
> The `/api/images/generate` route is configured for `maxDuration = 60` (Vercel Hobby max).

## How it works

```
child photo → /api/images/create-upload (signed URL) → browser uploads original
            → /api/images/mark-uploaded → /api/images/generate (server-side OpenAI)
            → result stored in magic-generated → signed URL shown + saved to gallery
```

- **Child mode** (`/`): one-tap camera flow, 6 magic presets, private gallery. No
  text input, sharing, or links — safety is a product requirement (PRD §14).
- **Parent mode** (`/parent`): reached by a 3-second long-press on the home logo,
  then a PIN (set on first entry). Controls daily limit, app lock, preset
  enable/prompt edits, storage retention toggles, and gallery deletion.

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build (also type-checks)
npm run start   # serve the production build
npm run lint    # next lint
```

## Design assets

The original PRD and design starter files live in `design/` and are intentionally
git-ignored. Design tokens (colours, radii, shadows) are mirrored into
`tailwind.config.js` and `src/app/globals.css`, which are the runtime source of truth.
