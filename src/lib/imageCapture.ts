'use client';

// Resize the long side to MAX_SIDE and encode as WebP (fallback JPEG) for a
// small, app-friendly upload. Keeps cost + bandwidth low (PRD §15, §21).
const MAX_SIDE = 1024;
const QUALITY = 0.8;

export interface CapturedImage {
  blob: Blob;
  previewUrl: string;
  contentType: string;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<{ blob: Blob; type: string }> {
  return new Promise((resolve, reject) => {
    const tryType = (type: string, fallback: () => void) =>
      canvas.toBlob(
        (b) => (b ? resolve({ blob: b, type }) : fallback()),
        type,
        QUALITY,
      );
    tryType('image/webp', () =>
      tryType('image/jpeg', () => reject(new Error('Could not encode image'))),
    );
  });
}

// Draw a video frame (or image) into a downscaled canvas.
function drawScaled(
  source: HTMLVideoElement | HTMLImageElement,
  sw: number,
  sh: number,
): HTMLCanvasElement {
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

export async function captureFromVideo(video: HTMLVideoElement): Promise<CapturedImage> {
  const canvas = drawScaled(video, video.videoWidth, video.videoHeight);
  const { blob, type } = await canvasToBlob(canvas);
  return { blob, previewUrl: URL.createObjectURL(blob), contentType: type };
}

// Fallback path: process a file from <input type="file" capture="environment">.
export async function captureFromFile(file: File): Promise<CapturedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read photo'));
      el.src = url;
    });
    const canvas = drawScaled(img, img.naturalWidth, img.naturalHeight);
    const { blob, type } = await canvasToBlob(canvas);
    return { blob, previewUrl: URL.createObjectURL(blob), contentType: type };
  } finally {
    URL.revokeObjectURL(url);
  }
}
