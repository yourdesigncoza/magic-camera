'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { registerDevice, authHeaders } from '@/lib/clientDevice';
import { saveImage } from '@/lib/saveImage';
import {
  listLocalImages,
  cacheImageFromUrl,
  deleteLocalImage,
  isSupported,
  LocalImage,
} from '@/lib/localGallery';

interface Item {
  id: string;
  url: string; // object URL (local blob) or remote URL fallback
  presetEmoji: string | null;
  presetLabel: string | null;
}

interface ServerItem {
  id: string;
  url: string | null;
  presetLabel: string | null;
  presetEmoji: string | null;
  createdAt: string;
}

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const objectUrls = useRef<string[]>([]);

  const openImage = (item: Item) => {
    setConfirmDelete(false);
    setActive(item);
  };

  const closeImage = () => {
    setConfirmDelete(false);
    setActive(null);
  };

  const handleDelete = async () => {
    if (!active) return;
    setDeleting(true);
    try {
      // Remove from Supabase (DB row + storage objects). 404 = already gone.
      const res = await fetch(`/api/images/${active.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 404) {
        setDeleting(false);
        return; // leave the image in place on a real failure
      }
      // Remove from the on-device cache and the grid.
      await deleteLocalImage(active.id).catch(() => {});
      URL.revokeObjectURL(active.url);
      objectUrls.current = objectUrls.current.filter((u) => u !== active.url);
      setItems((prev) => prev.filter((i) => i.id !== active.id));
      closeImage();
    } finally {
      setDeleting(false);
    }
  };

  // Build display items from local blobs, tracking object URLs for cleanup.
  const toItems = (local: LocalImage[]): Item[] => {
    // Revoke any previously-created URLs before making new ones.
    objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrls.current = [];
    return local.map((img) => {
      const url = URL.createObjectURL(img.blob);
      objectUrls.current.push(url);
      return {
        id: img.id,
        url,
        presetEmoji: img.presetEmoji,
        presetLabel: img.presetLabel,
      };
    });
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isSupported()) {
        setLoading(false);
        return;
      }
      // 1. Show whatever is already on the device — instant, no network.
      const local = await listLocalImages();
      if (!cancelled) {
        setItems(toItems(local));
        setLoading(false);
      }

      // 2. One-time migration: pull any server images not yet cached locally,
      //    then they live on-device and never re-download.
      try {
        await registerDevice();
        const res = await fetch('/api/gallery?scope=child', { headers: authHeaders() });
        const data = await res.json();
        const server: ServerItem[] = data.items ?? [];
        let added = false;
        for (const s of server) {
          if (!s.url) continue;
          try {
            const cached = await cacheImageFromUrl(s.id, s.url, {
              presetLabel: s.presetLabel,
              presetEmoji: s.presetEmoji,
              createdAt: s.createdAt,
            });
            if (cached) added = true;
          } catch {
            /* skip images that fail to download */
          }
        }
        if (added && !cancelled) {
          setItems(toItems(await listLocalImages()));
        }
      } catch {
        /* offline or unauthorized — local images are enough */
      }
    })();

    return () => {
      cancelled = true;
      objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrls.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-dvh bg-charcoal p-4 no-select">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-paper-white">🖼️ My Gallery</h1>
        <Link href="/" className="btn-secondary !min-h-[52px] px-5">
          🏠 Home
        </Link>
      </div>

      {loading ? (
        <div className="mt-20 text-center text-camera-blue-light">
          <span className="text-4xl animate-sparkle">✨</span>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-4 text-center text-camera-blue-light">
          <span className="text-6xl">📸</span>
          <p className="text-lg font-bold">No magic photos yet!</p>
          <Link href="/" className="btn-primary max-w-xs">
            Take a photo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => openImage(item)}
              className="overflow-hidden rounded-toy bg-camera-blue-light shadow-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.presetLabel ?? 'Magic photo'}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/95 p-4"
          onClick={closeImage}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.url}
            alt={active.presetLabel ?? 'Magic photo'}
            className="max-h-[64dvh] w-auto rounded-toy-lg object-contain"
          />
          <div
            className="mt-6 flex w-full max-w-xs flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {confirmDelete ? (
              <>
                <p className="text-center font-bold text-paper-white">
                  Delete this photo?
                </p>
                <button
                  className="btn-primary !bg-red-500 !text-white"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : '🗑️ Yes, delete'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Keep it
                </button>
              </>
            ) : (
              <>
                <button className="btn-primary" onClick={() => saveImage(active.url)}>
                  📤 Share Image
                </button>
                <button
                  className="btn-secondary !bg-red-100 !text-red-700"
                  onClick={() => setConfirmDelete(true)}
                >
                  🗑️ Delete
                </button>
                <button className="btn-secondary" onClick={closeImage}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
