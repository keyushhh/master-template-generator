/**
 * Uploaded video files, in IndexedDB.
 *
 * Decks live in localStorage, which is a ~5MB string store - a single demo clip
 * is larger than every deck in the library put together. So a video shape stores
 * only an asset id and the bytes live here; nothing else about deck persistence
 * changes.
 */

const DB_NAME = 'wozku-media';
const DB_VERSION = 1;
const STORE = 'videos';

/** Refused above this - PowerPoint chokes on very large embedded media, and the browser would too. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export interface VideoAsset {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: number;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('media store write failed'));
        t.oncomplete = () => db.close();
      })
  );
}

function mintAssetId(): string {
  return `vid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class VideoTooLargeError extends Error {
  constructor(readonly size: number) {
    super(`Video is ${(size / (1024 * 1024)).toFixed(0)}MB; the limit is ${MAX_VIDEO_BYTES / (1024 * 1024)}MB.`);
  }
}

export async function putVideo(file: File): Promise<VideoAsset> {
  if (file.size > MAX_VIDEO_BYTES) throw new VideoTooLargeError(file.size);
  const asset: VideoAsset = {
    id: mintAssetId(),
    name: file.name,
    type: file.type || 'video/mp4',
    size: file.size,
    addedAt: Date.now(),
    blob: file,
  };
  await tx('readwrite', (s) => s.put(asset) as IDBRequest<IDBValidKey>);
  return asset;
}

export async function getVideo(id: string): Promise<VideoAsset | null> {
  try {
    return (await tx('readonly', (s) => s.get(id) as IDBRequest<VideoAsset | undefined>)) ?? null;
  } catch {
    return null;
  }
}

export async function deleteVideo(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
  } catch {
    // A leftover blob is harmless; failing a delete shouldn't break an edit.
  }
  const url = urlCache.get(id);
  if (url) { URL.revokeObjectURL(url); urlCache.delete(id); }
}

const urlCache = new Map<string, string>();

/** A blob URL for a stored asset, cached so re-renders don't leak a URL per frame. */
export async function videoUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const asset = await getVideo(id);
  if (!asset) return null;
  const url = URL.createObjectURL(asset.blob);
  urlCache.set(id, url);
  return url;
}
