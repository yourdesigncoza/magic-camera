# PRD: Magic Camera PWA

## 1. Product Summary

**Product name:** Magic Camera  
**Product type:** Progressive Web App  
**Primary device:** Old Android smartphone  
**Primary user:** A 4-year-old child  
**Admin user:** Parent  
**Hosting:** Vercel  
**Storage/database:** Supabase Storage + minimal Supabase Postgres  
**AI provider:** OpenAI Image API via server-side API route

Magic Camera is a child-friendly PWA that turns an old Android phone into a playful AI camera. The child takes a photo, chooses a large preset “magic” style button, and receives a transformed generated image. The app must feel like a toy camera, not an AI tool.

The UI direction should borrow from the supplied toy camera reference: bright turquoise, warm yellow, dark charcoal, rounded panels, large tactile controls, and a soft child-safe visual language.

---

## 2. Product Goal

Build a safe, simple, installable PWA that allows a young child to:

1. Open the app from the Android home screen.
2. Tap a large **Take Photo** button.
3. Choose one of several parent-approved “magic” presets.
4. Wait while the app creates a transformed version.
5. View the result in a private gallery.

The parent can control prompts, daily usage limits, storage, and deletion.

---

## 3. Strategic Decision: Supabase Storage From Day One

Supabase Storage should be used from the start, even in the MVP.

Reason:

- The app handles child images, so storing them loosely in temporary server memory or public URLs is not ideal.
- Vercel serverless functions are not intended as persistent file storage.
- Supabase Storage gives a clean path for private buckets, signed URLs, gallery persistence, deletion, and future parent controls.
- Starting with Storage avoids having to rewrite the image pipeline later.

The database should remain minimal in the first version. Supabase Postgres is used only for metadata, settings, prompts, and usage limits.

---

## 4. Recommended Stack

```text
Android phone PWA
  ↓
Next.js app on Vercel
  ↓
Next.js API routes / server actions
  ↓
Supabase Postgres + Supabase Storage
  ↓
OpenAI Image API
```

### Frontend

- Next.js
- PWA manifest
- Service worker
- Mobile-first UI
- Installed on Android home screen

### Backend

- Next.js API routes hosted on Vercel
- Server-side OpenAI calls
- Server-side Supabase service role access
- No OpenAI API key exposed to frontend

### Storage

- Supabase Storage private bucket for original photos
- Supabase Storage private bucket for generated images
- Signed URLs for display
- Server-side upload for generated results

### Database

- Supabase Postgres
- Minimal schema:
  - `devices`
  - `presets`
  - `images`
  - `usage_logs`
  - `parent_settings`

---

## 5. Product Vision

The app should behave like a magical toy camera:

- No typing for the child
- No prompt box
- No social sharing
- No ads
- No public gallery
- No technical settings in child mode
- Big buttons and obvious choices
- Friendly visual feedback
- Forgiving error handling

The parent/admin area can be more functional but should remain simple.

---

## 6. User Personas

### 6.1 Child User

**Age:** 4  
**Capabilities:** taps buttons, recognises icons, may not read fluently  
**Needs:** large controls, predictable flows, no hidden complexity

### 6.2 Parent/Admin User

**Needs:**

- Control API cost
- Keep images private
- Manage prompt presets
- Delete images
- Limit daily usage
- Lock the app into child mode
- Use existing Vercel/Supabase workflow

---

## 7. MVP Scope

### Included

#### Child Mode

- Installable PWA
- Fullscreen mobile-first interface
- Camera capture
- Photo preview
- 4–6 large preset style buttons
- Loading animation
- Generated result screen
- Simple gallery
- Retake button

#### Parent Mode

- PIN-protected access
- Daily generation limit
- Enable/disable presets
- View gallery
- Delete images
- Toggle original photo storage
- Toggle auto-delete period
- View basic usage count

#### Backend

- Upload original image to Supabase Storage
- Create image metadata record
- Check device limit
- Fetch preset prompt
- Send image to OpenAI
- Store generated image in Supabase Storage
- Update image status
- Return signed URL to frontend

---

## 8. Out of Scope for MVP

Do not build initially:

- Native Android app
- Public sharing
- User registration
- Payments
- Multi-family accounts
- Social feed
- Freeform child prompts
- Complex prompt builder
- Voice commands
- Print ordering
- Advanced editing tools
- Analytics/ads/tracking

---

## 9. Core Child Flow

```text
Open PWA
↓
Tap “Take Photo”
↓
Camera opens
↓
Photo preview appears
↓
Tap magic preset
↓
Image uploads to Supabase Storage
↓
Backend creates AI image
↓
Generated image stored in Supabase Storage
↓
Result appears
↓
Image is visible in private gallery
```

---

## 10. Functional Requirements

### 10.1 PWA Installation

The app must be installable on Android.

Requirements:

- `manifest.webmanifest`
- App icons
- Theme colour matching turquoise brand colour
- `display: standalone` or `fullscreen`
- Offline fallback
- Service worker

Acceptance criteria:

- App can be added to Android home screen.
- App opens without normal browser chrome after installation.
- Camera flow works from installed PWA.

---

### 10.2 Child Home Screen

The child home screen must have:

- Large camera-style frame
- Big yellow **Take Photo** button
- Gallery button
- Optional “Ask Grown-Up” / parent access hidden behind long press or tap pattern

No text input should be shown.

Acceptance criteria:

- Child can start camera with one obvious action.
- Parent controls are not visible or not easily accessible.

---

### 10.3 Camera Capture

Requirements:

- Use device camera through browser camera APIs.
- Prefer rear camera by default.
- Allow simple front/rear toggle if needed.
- Capture still image.
- Compress image client-side before upload if possible.

Acceptance criteria:

- Child can take a photo.
- App shows a preview.
- If camera permission fails, show a friendly parent-facing message.

---

### 10.4 Preview and Magic Presets

After capture, show:

- Captured photo preview
- Large preset buttons
- Retake button

Initial presets:

- Superhero
- Dinosaur World
- Space Explorer
- Storybook
- Robot Toy
- Fairy Castle

Acceptance criteria:

- Child can select a preset with a single tap.
- No prompt typing exists in child mode.

---

### 10.5 Image Generation

Generation process:

1. Frontend requests a signed upload target.
2. Frontend uploads original to Supabase Storage.
3. Backend checks daily limit.
4. Backend creates/updates `images` record.
5. Backend reads the preset prompt.
6. Backend calls OpenAI image generation/editing.
7. Backend uploads generated result to Supabase Storage.
8. Backend marks job as `completed`.
9. Frontend polls or receives status.
10. Frontend displays signed result URL.

Acceptance criteria:

- Image generation happens server-side.
- API key is not exposed to the phone.
- Failed jobs are saved as `failed` with an error message.
- Usage count increments only for valid generation attempts, depending on chosen policy.

---

### 10.6 Gallery

Child gallery:

- Shows generated images only
- Latest first
- Large thumbnails
- Tap to view full result
- No delete by default

Parent gallery:

- Show generated image
- Optional original image
- Delete image
- Delete original only
- Delete generated only

Acceptance criteria:

- Gallery persists after closing the app.
- Images are loaded using signed URLs.
- No public bucket URLs are exposed.

---

### 10.7 Parent Mode

Access options:

- Long press logo for 3 seconds
- Tap top-right corner 5 times
- PIN screen

Parent functions:

- Set daily limit
- Enable/disable presets
- Edit preset prompts
- Delete images
- Toggle save originals
- Set auto-delete days
- View usage history

Acceptance criteria:

- Child cannot easily enter parent mode.
- Parent settings persist in Supabase.

---

## 11. Storage Requirements

### Buckets

```text
magic-originals
magic-generated
```

Both buckets should be private.

### Path convention

```text
/device-id/image-id/original.webp
/device-id/image-id/generated.webp
```

### Access rules

- Frontend should never receive Supabase service role key.
- Frontend uses short-lived signed upload URLs for originals.
- Frontend uses short-lived signed read URLs for gallery display.
- Generated images are uploaded server-side after OpenAI returns the result.

### Auto-delete policy

MVP can use a manual admin cleanup function. Later version can add a scheduled cleanup job.

Default retention:

```text
Originals: 30–90 days
Generated images: 90 days or keep until parent deletes
```

---

## 12. Database Requirements

The DB exists to remember app metadata, not to store the actual image binaries.

The actual files live in Supabase Storage. The DB stores:

- Which device created which image
- Which preset was used
- Where the original/generated files are stored
- Whether the generation succeeded or failed
- Usage counts
- Parent settings
- Prompt presets

### 12.1 `devices`

```sql
create table devices (
  id uuid primary key default gen_random_uuid(),
  device_name text,
  device_code text unique,
  is_active boolean default true,
  daily_limit int default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 12.2 `parent_settings`

```sql
create table parent_settings (
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
```

### 12.3 `presets`

```sql
create table presets (
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
```

### 12.4 `images`

```sql
create table images (
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
```

### 12.5 `usage_logs`

```sql
create table usage_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references devices(id) on delete cascade,
  image_id uuid references images(id) on delete set null,
  event_type text not null,
  created_at timestamptz default now()
);
```

---

## 13. API Endpoints

### `GET /api/presets`

Returns enabled presets for child mode.

### `POST /api/images/create-upload`

Creates an image record and returns a signed upload URL.

Request:

```json
{
  "deviceId": "uuid",
  "contentType": "image/webp"
}
```

Response:

```json
{
  "imageId": "uuid",
  "uploadUrl": "signed-upload-url",
  "path": "device-id/image-id/original.webp"
}
```

### `POST /api/images/mark-uploaded`

Marks original upload as complete.

### `POST /api/images/generate`

Starts generation.

Request:

```json
{
  "imageId": "uuid",
  "presetId": "uuid"
}
```

### `GET /api/images/:id`

Returns generation status and signed image URL when complete.

### `GET /api/gallery`

Returns recent generated images with signed thumbnail/display URLs.

### `DELETE /api/images/:id`

Parent-only delete.

### `POST /api/parent/login`

Validates PIN and returns parent session.

### `POST /api/parent/settings`

Updates parent settings.

---

## 14. Safety Requirements

Because this is for a 4-year-old, safety is a product requirement, not an enhancement.

Rules:

- No freeform prompt input in child mode
- No public sharing
- No social feed
- No comments
- No external links
- No ads
- No API keys on device
- No public image buckets
- Parent PIN required for settings/deletion
- Daily generation limit enforced server-side
- Prompt presets must remain child-safe

Prompt rules should include:

```text
child-friendly
warm
playful
safe for a 4-year-old
no horror
no violence
no weapons
no adult themes
no realistic injuries
no disturbing elements
```

---

## 15. Cost Control

Default MVP limits:

```text
Daily limit: 10 generations per device
Image output: webp or jpeg where supported
Image size: app-friendly, not maximum resolution
Save originals: yes initially
Original retention: 30 days
Generated retention: 90 days
```

Server must check usage before calling OpenAI.

The app should fail closed:

- If device is inactive, no generation.
- If daily limit reached, no generation.
- If preset disabled, no generation.
- If image missing, no generation.

---

## 16. Design Direction

The UI should use the supplied toy camera image as the visual reference.

### Palette

| Token | Hex | Usage |
|---|---:|---|
| `camera-blue` | `#71CCE2` | Main brand colour, panels, camera shell |
| `camera-blue-light` | `#94D6EB` | Highlights, secondary panels |
| `magic-yellow` | `#F6D42E` | Primary buttons, call-to-action areas |
| `magic-yellow-light` | `#F9DD53` | Button highlights |
| `charcoal` | `#19222B` | Text, frame, dark gallery background |
| `slate` | `#364653` | Secondary text, borders, shadow panels |
| `soft-slate` | `#505862` | Muted UI, disabled states |
| `paper-white` | `#FFF9E8` | Light surfaces |

### Visual language

- Rounded toy-like panels
- Large pill buttons
- Slight 3D/tactile feel
- Big icon-first buttons
- Soft shadows
- Minimal text
- High contrast
- Turquoise/yellow dominant

---

## 17. UI Screens

### 17.1 Child Home

Elements:

- App logo: Magic Camera
- Camera-frame style card
- Large yellow **Take Photo** button
- Smaller gallery button
- Hidden parent access gesture

### 17.2 Preview

Elements:

- Photo preview
- Retake button
- Grid of magic presets

### 17.3 Creating

Elements:

- Friendly animation
- Text: “Making magic...”
- No cancel required for MVP

### 17.4 Result

Elements:

- Generated image
- “Again” button
- “Gallery” button
- “Take another” button

### 17.5 Parent Dashboard

Elements:

- Usage today
- Daily limit setting
- Preset list
- Storage settings
- Gallery management

---

## 18. Initial Presets

### Superhero

```text
Turn the uploaded photo into a cheerful storybook superhero scene. Keep the main subject recognisable. Add a colourful cape, bright sky, and playful heroic energy. Safe for a 4-year-old. No weapons, fighting, danger, horror, or scary elements.
```

### Dinosaur World

```text
Transform the uploaded photo into a warm illustrated dinosaur adventure. Keep the main subject recognisable. Add friendly cartoon dinosaurs, soft jungle plants, sunshine, and playful colours. Safe for a 4-year-old. No scary dinosaurs, chasing, danger, or violence.
```

### Space Explorer

```text
Turn the uploaded photo into a cheerful space explorer scene. Keep the main subject recognisable. Add a cute space helmet, stars, planets, and a friendly little robot. Safe for a 4-year-old. No scary aliens, darkness, danger, or weapons.
```

### Storybook

```text
Transform the uploaded photo into a beautiful children’s storybook illustration. Keep the main subject recognisable. Use warm colours, soft texture, gentle lighting, and magical but safe details. No scary, violent, adult, or disturbing elements.
```

### Robot Toy

```text
Turn the uploaded photo into a playful robot toy workshop scene. Keep the main subject recognisable. Add cute friendly robots, colourful tools, buttons, and lights. Safe for a 4-year-old. No weapons, danger, horror, or sharp scary machinery.
```

### Fairy Castle

```text
Transform the uploaded photo into a cheerful fairy-tale castle scene. Keep the main subject recognisable. Add a bright castle, friendly animals, flowers, sparkles, and warm storybook colours. Safe for a 4-year-old. No scary witches, monsters, danger, or dark themes.
```

---

## 19. MVP Milestones

### Phase 1: Working Image Pipeline

- Next.js app on Vercel
- Supabase project created
- Private storage buckets
- Camera capture
- Upload original to Supabase Storage
- Generate image through server route
- Save generated image to Supabase Storage
- Display signed result URL

### Phase 2: Gallery and Metadata

- `images` table
- Gallery view
- Status tracking
- Failed job logging

### Phase 3: Parent Controls

- Parent PIN
- Daily limit
- Preset manager
- Delete image
- Storage settings

### Phase 4: Child Polish

- Full PWA install polish
- Toy-camera UI
- Better loading states
- Icons and animations
- Android home-screen setup

---

## 20. MVP Acceptance Criteria

The MVP is complete when:

1. The app installs on the Android phone as a PWA.
2. Child can take a photo.
3. Child can choose a preset.
4. Original photo uploads to private Supabase Storage.
5. Backend generates a transformed image.
6. Generated image uploads to private Supabase Storage.
7. Gallery persists after app restart.
8. Parent can delete images.
9. Parent can set daily generation limit.
10. API keys are never exposed client-side.
11. Child mode contains no freeform prompt box.
12. UI follows the turquoise/yellow toy-camera design direction.

---

## 21. Technical Notes for Build

### Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
PARENT_PIN_SECRET=
```

Only `NEXT_PUBLIC_*` variables may be exposed to the browser.

### Recommended image format

Use WebP where practical for uploads and generated display.

### Recommended frontend image compression

Before upload:

- Resize long side to a practical app limit.
- Convert to WebP or JPEG.
- Keep quality around 0.8.

### Recommended status flow

```text
pending → uploaded → processing → completed
pending → uploaded → processing → failed
```

---

## 22. Future Enhancements

- Voice labels for buttons
- Parent-approved custom presets
- Scheduled auto-delete job
- Simple printable image sheet
- Offline child gallery cache
- Multiple child profiles
- Better kiosk mode wrapper
- Local network mode for home-only use
- Optional photo book export

---

## 23. Final Recommendation

Build the first version as:

```text
Next.js PWA
+ Vercel
+ Supabase Storage from day one
+ Minimal Supabase Postgres metadata
+ Server-side OpenAI image generation
+ Android phone installed as a dedicated PWA
```

This gives the fastest route to a working child-safe prototype while avoiding a later rewrite of the storage/gallery pipeline.
