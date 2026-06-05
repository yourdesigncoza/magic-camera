'use client';

import { useCallback, useEffect, useState } from 'react';

interface Item {
  id: string;
  url: string | null;
  originalUrl: string | null;
  presetLabel: string | null;
  createdAt: string;
}

export default function ParentGallery({ deviceId }: { deviceId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gallery?deviceId=${deviceId}&scope=parent`);
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const del = async (id: string, scope: 'all' | 'original' | 'generated') => {
    const label =
      scope === 'all'
        ? 'Delete this photo and its original?'
        : scope === 'original'
          ? 'Delete the original photo only?'
          : 'Delete the generated image only?';
    if (!window.confirm(label)) return;
    await fetch(`/api/images/${id}?scope=${scope}`, { method: 'DELETE' });
    await load();
  };

  if (loading) {
    return <p className="text-sm text-soft-slate">Loading gallery…</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-soft-slate">No images yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-toy bg-white p-3 shadow-soft">
          <div className="flex gap-3">
            {item.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={item.presetLabel ?? 'Generated'}
                className="h-24 w-24 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-paper-white text-xs text-soft-slate">
                no result
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-charcoal">
                {item.presetLabel ?? 'Photo'}
              </p>
              <p className="text-xs text-soft-slate">
                {new Date(item.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-soft-slate">
                Original: {item.originalUrl ? 'kept' : 'none'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-paper-white px-3 py-2 text-xs font-bold text-slate"
              onClick={() => del(item.id, 'generated')}
            >
              Delete result
            </button>
            <button
              className="rounded-lg bg-paper-white px-3 py-2 text-xs font-bold text-slate disabled:opacity-40"
              disabled={!item.originalUrl}
              onClick={() => del(item.id, 'original')}
            >
              Delete original
            </button>
            <button
              className="rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700"
              onClick={() => del(item.id, 'all')}
            >
              Delete both
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
