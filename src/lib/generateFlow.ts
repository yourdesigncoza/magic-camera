'use client';

import { supabaseBrowser } from './supabaseBrowser';

export class FlowError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data } as { res: Response; data: Record<string, unknown> };
}

export interface GenerateOutcome {
  imageId: string;
  url: string;
}

// Full child-flow pipeline: create-upload → upload original → mark-uploaded → generate.
export async function runGeneration(
  deviceId: string,
  image: { blob: Blob; contentType: string },
  presetId: string,
): Promise<GenerateOutcome> {
  // 1. Ask the server for an image record + signed upload target.
  const create = await postJson('/api/images/create-upload', {
    deviceId,
    contentType: image.contentType,
  });
  if (create.res.status === 429) {
    throw new FlowError('You have used all your magic for today!', 'limit');
  }
  if (!create.res.ok) {
    throw new FlowError('Could not start. Ask a grown-up.', 'create');
  }

  const imageId = create.data.imageId as string;
  const bucket = create.data.bucket as string;
  const path = create.data.path as string;
  const token = create.data.uploadToken as string;

  // 2. Upload the original directly to the private bucket via the signed URL.
  const { error: uploadError } = await supabaseBrowser()
    .storage.from(bucket)
    .uploadToSignedUrl(path, token, image.blob, { contentType: image.contentType });
  if (uploadError) {
    throw new FlowError('Could not send the photo. Try again.', 'upload');
  }

  // 3. Mark the original as uploaded.
  await postJson('/api/images/mark-uploaded', { imageId });

  // 4. Run server-side generation (synchronous; may take up to ~60s).
  const gen = await postJson('/api/images/generate', { imageId, presetId });
  if (gen.res.status === 429) {
    throw new FlowError('You have used all your magic for today!', 'limit');
  }
  if (!gen.res.ok || gen.data.status === 'failed' || !gen.data.url) {
    throw new FlowError('Magic did not work this time. Try again!', 'generate');
  }

  return { imageId, url: gen.data.url as string };
}
