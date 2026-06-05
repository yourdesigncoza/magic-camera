# Magic Camera PWA — Package

This package contains the updated PRD and starter design files for the child-friendly Magic Camera PWA.

## Files

- `PRD-Magic-Camera-PWA.md` — full updated product requirements document
- `design/design-system.md` — visual direction, layout principles, component notes
- `design/design-tokens.json` — colour, radius, spacing, typography tokens
- `design/magic-camera-theme.css` — CSS variables and starter utility classes
- `design/tailwind-theme-snippet.js` — Tailwind colour/theme extension snippet
- `design/child-home-wireframe.svg` — simple child-mode UI wireframe

## Core stack

- Next.js PWA on Vercel
- Supabase Storage from day one
- Minimal Supabase Postgres tables for image metadata, presets and usage limits
- OpenAI image generation/editing via server-side Vercel routes
