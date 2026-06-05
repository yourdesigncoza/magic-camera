'use client';

import { supabaseBrowser } from './supabaseBrowser';
import { authHeaders } from './clientDevice';

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
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data } as { res: Response; data: Record<string, unknown> };
}

// create-upload → upload original to private bucket → mark-uploaded.
// Returns the new imageId. Device identity travels via the x-device-token header.
async function uploadOriginal(image: { blob: Blob; contentType: string }): Promise<string> {
  const create = await postJson('/api/images/create-upload', {
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

  const { error } = await supabaseBrowser()
    .storage.from(bucket)
    .uploadToSignedUrl(path, token, image.blob, { contentType: image.contentType });
  if (error) throw new FlowError('Could not send the photo. Try again.', 'upload');

  await postJson('/api/images/mark-uploaded', { imageId });
  return imageId;
}

export interface GenerateOutcome {
  imageId: string;
  url: string;
  title?: string;
}

// Generate using a chosen preset.
export async function runGeneration(
  image: { blob: Blob; contentType: string },
  presetId: string,
): Promise<GenerateOutcome> {
  const imageId = await uploadOriginal(image);
  const gen = await postJson('/api/images/generate', { imageId, presetId });
  if (gen.res.status === 429) {
    throw new FlowError('You have used all your magic for today!', 'limit');
  }
  if (!gen.res.ok || gen.data.status === 'failed' || !gen.data.url) {
    throw new FlowError('Magic did not work this time. Try again!', 'generate');
  }
  return { imageId, url: gen.data.url as string };
}

// "Surprise Me": the server invents a custom style from the photo, then generates.
export async function runSurprise(
  image: { blob: Blob; contentType: string },
): Promise<GenerateOutcome> {
  const imageId = await uploadOriginal(image);
  const gen = await postJson('/api/images/surprise', { imageId });
  if (gen.res.status === 429) {
    throw new FlowError('You have used all your magic for today!', 'limit');
  }
  if (!gen.res.ok || gen.data.status === 'failed' || !gen.data.url) {
    throw new FlowError('Magic did not work this time. Try again!', 'surprise');
  }
  return {
    imageId,
    url: gen.data.url as string,
    title: (gen.data.title as string) || 'Surprise',
  };
}

// Re-edit an existing result into a 9:16 wallpaper. Returns an inline data URL.
export async function makeWallpaper(imageId: string): Promise<string> {
  const gen = await postJson('/api/images/wallpaper', { imageId });
  if (gen.res.status === 429) {
    throw new FlowError('You have used all your magic for today!', 'limit');
  }
  if (!gen.res.ok || !gen.data.url) {
    throw new FlowError('Could not make a wallpaper. Try again!', 'wallpaper');
  }
  return gen.data.url as string;
}
