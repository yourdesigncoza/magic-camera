# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

This repo is **pre-implementation**. It currently contains only specification and design assets — no application code, no `package.json`, no git repo yet:

- `PRD-Magic-Camera-PWA.md` — the authoritative spec. Read it before building anything; it defines scope, DB schema, API contract, storage layout, and safety rules.
- `design/` — visual system (`design-system.md`, `design-tokens.json`, `magic-camera-theme.css`, `tailwind-theme-snippet.js`, `child-home-wireframe.svg`).
- `README.md` — one-paragraph package summary.

When scaffolding the app, build it as a **Next.js PWA** (App Router) at the repo root, matching the stack in PRD §4 and §23. There is no build/test tooling yet — establish it during scaffolding.

## What this product is

A child-safe AI "toy camera" PWA for a 4-year-old, installed on an old Android phone. The child takes a photo → taps a large preset "magic" style → gets an AI-transformed image back in a private gallery. A PIN-gated parent mode controls cost, presets, and deletion. It must feel like a toy, never an AI tool.

## Architecture (intended)

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
5. Client polls `GET /api/images/:id` for status + signed result URL.

Status state machine: `pending → uploaded → processing → completed | failed`. Persist `failed` jobs with an error message rather than throwing them away.

### Fail-closed cost control

The server **must** check eligibility before any OpenAI call (PRD §15). No generation if: device inactive, daily limit reached, preset disabled, or original image missing. Default daily limit is 10/device.

## Two modes, two different UIs

- **Child mode** — one obvious action per screen, big tactile buttons (≥72px tap targets), icon-first, minimal text, no scrolling where avoidable. **Never add a freeform prompt box, text input, sharing, links, or ads to child mode** — this is a safety requirement (PRD §14), not a preference. Presets are the only way a child influences generation.
- **Parent mode** — PIN-gated (entered via a hidden gesture: long-press logo 3s or tap top-right 5×). Standard dashboard. Destructive actions require confirmation. Calmer palette (paper-white surfaces, yellow reserved for save/confirm).

## Preset prompts are safety-critical

The 6 initial presets (Superhero, Dinosaur World, Space Explorer, Storybook, Robot Toy, Fairy Castle) and their exact prompt text are in PRD §18. Every preset prompt must keep the subject recognisable and explicitly exclude horror/violence/weapons/danger/adult/disturbing content (PRD §14). When editing or adding presets, preserve these guardrail clauses.

## Design system

Use the tokens, don't reinvent them. Tailwind extension snippet is ready in `design/tailwind-theme-snippet.js`; CSS variables in `design/magic-camera-theme.css`; raw values in `design/design-tokens.json`.

Palette: `camera-blue #71CCE2`, `camera-blue-light #94D6EB`, `magic-yellow #F6D42E` (primary buttons), `magic-yellow-light #F9DD53`, `charcoal #19222B` (text/frame), `slate #364653`, `soft-slate #505862`, `paper-white #FFF9E8`.

Feel: rounded toy panels, large pill buttons, slight 3D/tactile depth (`shadow.toy` token), gentle motion only (button bounce, loading sparkle). Avoid fast flashing, complex animation, scary effects.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server only
OPENAI_API_KEY=              # server only
PARENT_PIN_SECRET=           # server only
```

Only `NEXT_PUBLIC_*` may reach the browser. Store the parent PIN as a hash (`parent_settings.parent_pin_hash`).

## Build order

Follow the PRD §19 milestones — Phase 1 proves the image pipeline end-to-end (capture → upload → generate → store → display signed URL) before gallery (Phase 2), parent controls (Phase 3), or PWA/child polish (Phase 4). Don't build parent UI before the pipeline works.
