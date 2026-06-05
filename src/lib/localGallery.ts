'use client';

// On-device gallery cache (IndexedDB). Generated images are stored as blobs on
// the phone so the gallery loads instantly and offline, without re-downloading
// from Supabase every time it's opened.

const DB_NAME = 'magic-camera';
const STORE = 'gallery';
const VERSION = 1;

export interface LocalImage {
  id: string;
  blob: Blob;
  presetLabel: string | null;
  presetEmoji: string | null;
  createdAt: string; // ISO
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function putLocalImage(rec: LocalImage): Promise<void> {
  await tx('readwrite', (s) => s.put(rec));
}

export async function hasLocalImage(id: string): Promise<boolean> {
  const key = await tx<IDBValidKey | undefined>('readonly', (s) => s.getKey(id));
  return key !== undefined;
}

export async function listLocalImages(): Promise<LocalImage[]> {
  const all = await tx<LocalImage[]>('readonly', (s) => s.getAll());
  return (all ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteLocalImage(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

// Download an image once and store it locally. Returns true if it was newly
// cached, false if it was already present (no-op).
export async function cacheImageFromUrl(
  id: string,
  url: string,
  meta: { presetLabel?: string | null; presetEmoji?: string | null; createdAt?: string },
): Promise<boolean> {
  if (!url) return false;
  if (await hasLocalImage(id)) return false;
  const res = await fetch(url);
  if (!res.ok) throw new Error('image fetch failed');
  const blob = await res.blob();
  await putLocalImage({
    id,
    blob,
    presetLabel: meta.presetLabel ?? null,
    presetEmoji: meta.presetEmoji ?? null,
    createdAt: meta.createdAt ?? new Date().toISOString(),
  });
  return true;
}

export function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}
