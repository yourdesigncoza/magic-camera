'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { registerDevice, authHeaders } from '@/lib/clientDevice';

interface GalleryItem {
  id: string;
  url: string | null;
  presetEmoji: string | null;
  presetLabel: string | null;
}

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<GalleryItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await registerDevice(); // ensures the device token is present
        const res = await fetch('/api/gallery?scope=child', { headers: authHeaders() });
        const data = await res.json();
        setItems((data.items ?? []).filter((i: GalleryItem) => i.url));
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
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
              onClick={() => setActive(item)}
              className="overflow-hidden rounded-toy bg-camera-blue-light shadow-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url!}
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
          onClick={() => setActive(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.url!}
            alt={active.presetLabel ?? 'Magic photo'}
            className="max-h-[80dvh] w-auto rounded-toy-lg object-contain"
          />
          <button className="btn-primary mt-6 max-w-xs" onClick={() => setActive(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
