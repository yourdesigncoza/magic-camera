# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

The MVP is **implemented**: a Next.js (App Router, TS) PWA with the full server-side
image pipeline, child + parent modes, and PWA assets. `next build` passes.

- `PRD-Magic-Camera-PWA.md` — the authoritative spec (scope, DB schema, API contract, storage, safety). Still the source of truth for *intent*.
- `README.md` — setup + deploy guide (Supabase SQL, env vars, Vercel).
- `supabase/schema.sql` — run once on a fresh Supabase project; creates tables, RLS, private buckets, seeds presets.
- `design/` — original design assets, **git-ignored**. Tokens are mirrored into `tailwind.config.js` + `src/app/globals.css`, which are the runtime source of truth.

## Commands

```bash
npm install
cp .env.example .env.local   # then fill in (see README "Environment variables")
npm run dev                  # localhost:3000
npm run build                # production build + type-check (the verification gate)
npm run start                # serve the build
```

No test framework is wired up. `npm run build` is the check that must stay green —
it type-checks the whole tree. There is a stray `package-lock.json` in a parent dir
(`/home/laudes`); `outputFileTracingRoot` in `next.config.mjs` pins tracing to this
project so Vercel/builds use the right root — don't remove it.

## Where things live

- `src/app/page.tsx` → `src/components/CameraApp.tsx` — the child flow is a single
  client-side **state machine** (`home → camera → preview → creating → result`), not
  routes. The captured photo Blob lives in memory across steps, so don't split these
  steps into separate pages.
- `src/app/gallery/page.tsx`, `src/app/parent/page.tsx` — separate routes. The child
  gallery is **local-first**: generated images are cached on-device in IndexedDB
  (`src/lib/localGallery.ts`), so it reads from the device (instant/offline) and migrates
  any server images into the cache once rather than re-downloading each open. Deleting
  there removes the Supabase copy (device-token DELETE) **and** the local cache entry.
- `src/app/api/**` — all server logic. Every route is `runtime = 'nodejs'`, most are
  `force-dynamic`. `images/generate` sets `maxDuration = 60`.
- `src/lib/**` — server libs (`supabaseAdmin`, `storage`, `openai`, `device`,
  `parentAuth`) and client libs (`clientDevice`, `imageCapture`, `generateFlow`,
  `supabaseBrowser`). Keep the `supabaseAdmin`/service-role import **out of** anything
  that ships to the browser.
- `public/` — `manifest.webmanifest`, `sw.js` (network-first nav, never caches `/api/`
  or cross-origin signed URLs; bump its `CACHE` constant when shipping PWA asset
  changes), `offline.html`, generated `icons/`.
- **PWA install:** `ServiceWorkerRegister.tsx` registers the SW **in production only**
  (disabled in `next dev` to avoid stale caches) — so install/`beforeinstallprompt`
  only work on the deployed HTTPS URL or `npm run build && npm run start`, never `npm
  run dev`. `InstallPrompt.tsx` renders an "Add to Home Screen" button on the child
  home: Chromium uses the captured `beforeinstallprompt`; iOS Safari (no install API)
  shows manual Share→Add-to-Home-Screen steps; it renders nothing once installed
  (`display-mode: standalone`).

## What this product is

A child-safe AI "toy camera" PWA for a 4-year-old, installed on an old Android phone. The child takes a photo → taps a large preset "magic" style → gets an AI-transformed image back in a private gallery. A PIN-gated parent mode controls cost, presets, and deletion. It must feel like a toy, never an AI tool.

## Architecture

```
Android PWA → Next.js on Vercel → Next.js API routes (server-only)
            → Supabase Postgres (metadata) + Supabase Storage (image binaries)
            → OpenAI Image API
```

Non-negotiable boundaries (these drive most design decisions):

- **The OpenAI key and Supabase service-role key live only in server-side API routes.** The browser never sees them. Image generation and generated-image upload happen server-side.
- **Image binaries live in Supabase Storage, not Postgres.** Two private buckets: `magic-originals`, `magic-generated`. Path convention: `/<device-id>/<image-id>/original.webp` and `.../generated.webp`.
- **Browser touches Storage only through short-lived signed URLs** — signed upload URL for the original, signed read URLs for gallery. No public buckets, ever.
- **Postgres is metadata-only**: `devices`, `parent_settings`, `presets`, `images`, `usage_logs`. Full DDL is in PRD §12 — treat it as the source of truth for the schema.

### Image generation pipeline (the core flow)

Drives the whole image lifecycle; see PRD §10.5 and the API contract in §13:

1. `POST /api/images/create-upload` — create `images` row (`status: pending`), return signed upload URL + path.
2. Client uploads original to `magic-originals` via the signed URL.
3. `POST /api/images/mark-uploaded` — `status: uploaded`.
4. `POST /api/images/generate` — server checks device daily limit, reads the preset prompt, calls OpenAI, uploads the result to `magic-generated`, sets `status: completed` (or `failed` + `error_message`).

Implementation note: `generate` runs **synchronously** and returns the signed result
URL in its own response (it sets `status: processing` then `completed`). `GET /api/images/:id`
exists as a status/poll fallback but the happy path doesn't need it. The orchestration
lives in `src/lib/generateFlow.ts` (client) calling create-upload → uploadToSignedUrl →
mark-uploaded → generate.

Status state machine: `pending → uploaded → processing → completed | failed`. Persist `failed` jobs with an error message rather than throwing them away. A failed generation does **not** burn quota — `countGenerationsToday` only counts `generation_success` usage_logs rows.

**Device identity (not in the PRD):** there is no auth/login. Each install generates a
random `device_code` in `localStorage` and calls `POST /api/device/register`, which
get-or-creates a `devices` row and returns an **HMAC-signed device token**
(`src/lib/deviceToken.ts`). The client stores that token and sends it as the
`x-device-token` header on every child endpoint; the server derives the *authoritative*
deviceId from the signature (never trust a client-supplied deviceId — that was an IDOR).
Child routes (`create-upload`, `mark-uploaded`, `generate`, `images/[id]` GET + DELETE,
`gallery` child scope) all 401 without a valid token and scope every query by the token's
deviceId. `DELETE /api/images/[id]` is authorized by **either** the owning device's token
(child gallery delete) **or** a parent session — both remove the DB row + storage objects.
Parent mode binds to the device via a separate HMAC-signed httpOnly cookie
(`src/lib/parentAuth.ts`), `sameSite: 'lax'`.

**Quota is race-safe:** `/generate` reserves a slot via the `increment_usage_if_allowed`
Postgres RPC (per-device `pg_advisory_xact_lock` + count-under-limit + insert, all atomic),
then refunds it on failure (`refundGenerationSlot`). Do not revert this to a JS
check-then-act — concurrent requests would blow past the daily limit. `create-upload` keeps
a cheap non-authoritative pre-check for UX only.

**Supabase key names:** the code accepts both legacy and new key formats —
`NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser), and
`SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` (server).

### Fail-closed cost control

The server **must** check eligibility before any OpenAI call (PRD §15). No generation if: device inactive, daily limit reached, preset disabled, or original image missing. Default daily limit is 10/device.

## Two modes, two different UIs

- **Child mode** — one obvious action per screen, big tactile buttons (≥72px tap targets), icon-first, minimal text, no scrolling where avoidable. **Never add a freeform prompt box, text input, sharing, links, or ads to child mode** — this is a safety requirement (PRD §14), not a preference. Presets are the only way a child influences generation.
- **Parent mode** — PIN-gated, reached via a hidden gesture: **3-second long-press on the home logo** (`HiddenParentAccess.tsx`). On first entry with no PIN set, the gate switches to "create PIN" (`/api/parent/setup`); afterwards it's "enter PIN" (`/api/parent/login`). Standard dashboard, destructive actions confirm, calmer palette.

## Preset prompts are safety-critical

The 6 initial presets (Superhero, Dinosaur World, Space Explorer, Storybook, Robot Toy, Fairy Castle) and their exact prompt text are in PRD §18. Every preset prompt must keep the subject recognisable and explicitly exclude horror/violence/weapons/danger/adult/disturbing content (PRD §14). When editing or adding presets, preserve these guardrail clauses.

## Design system

Tokens live in `tailwind.config.js` (colors, `rounded-toy`, `shadow-toy`) and CSS
variables + component classes (`.btn-primary`, `.preset-tile`, `.panel`, `.toy-card`,
`.animate-sparkle`) in `src/app/globals.css`. The `design/` originals are git-ignored —
edit the config/globals, not `design/`.

Palette: `camera-blue #71CCE2`, `camera-blue-light #94D6EB`, `magic-yellow #F6D42E` (primary buttons), `magic-yellow-light #F9DD53`, `charcoal #19222B` (text/frame), `slate #364653`, `soft-slate #505862`, `paper-white #FFF9E8`.

Feel: rounded toy panels, large pill buttons, slight 3D/tactile depth (`shadow-toy`), gentle motion only (button bounce, loading sparkle), and `prefers-reduced-motion` disables animation. Avoid fast flashing, complex animation, scary effects.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server only
OPENAI_API_KEY=              # server only
PARENT_PIN_SECRET=           # server only
```

Only `NEXT_PUBLIC_*` may reach the browser. Store the parent PIN as a hash (`parent_settings.parent_pin_hash`).

## Status vs PRD

PRD §19 milestones 1–4 are all implemented (pipeline, gallery + metadata, parent
controls, PWA install/icons). Deferred future-work (PRD §11/§22) that is *stored but
not yet active*: the auto-delete retention days are saved in `parent_settings` but no
scheduled cleanup job runs them yet. If asked to "finish" or extend, that scheduled
cleanup (a cron/Edge Function reading the retention settings) is the main open item.
