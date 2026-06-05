'use client';

// Save a generated image to the phone. On mobile this opens the native share
// sheet (so the user can pick "Save Image" / "Save to Photos"); on desktop or
// where sharing files isn't supported it falls back to a normal download, and
// if even that's blocked (e.g. CORS on the signed URL) it opens the image so the
// user can long-press to save.
export async function saveImage(
  url: string,
  filename = `magic-${Date.now()}.png`,
): Promise<void> {
  let blob: Blob;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    blob = await res.blob();
  } catch {
    window.open(url, '_blank');
    return;
  }

  const type = blob.type || 'image/png';
  const file = new File([blob], filename, { type });

  // Prefer the share sheet on mobile — it offers "Save to Photos".
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Magic Camera' });
      return;
    } catch (err) {
      // User cancelled — don't fall through to a download.
      if (err instanceof Error && err.name === 'AbortError') return;
      // Otherwise fall through to the download path.
    }
  }

  // Fallback: trigger a download via an object URL.
  triggerDownload(blob, filename);
}

// Directly download the image file to the device (no share sheet). On mobile
// this saves to the Downloads folder; desktop saves to the default location.
export async function downloadImage(
  url: string,
  filename = `magic-${Date.now()}.webp`,
): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    triggerDownload(await res.blob(), filename);
  } catch {
    window.open(url, '_blank'); // CORS-blocked: open so the user can long-press save
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}
