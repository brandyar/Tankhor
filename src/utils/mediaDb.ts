/**
 * TANKHOR (تن‌خور) - IndexedDB Local Media Store
 * Provides robust client-side binary and dataUrl storage for images,
 * bypassing localStorage 5MB size limits and surviving browser reloads.
 */

const DB_NAME = 'tankhor_media_storage_db';
const STORE_NAME = 'media_files';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in current environment'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          dbPromise = null;
          reject(request.error);
        };
      } catch (e) {
        dbPromise = null;
        reject(e);
      }
    });
  }
  return dbPromise;
}

export interface StoredMediaRecord {
  id: string; // filename e.g. media_123.webp or UUID
  dataUrl: string;
  mimeType: string;
  updatedAt: number;
}

export async function saveMediaToIndexedDb(id: string, dataUrl: string, mimeType: string): Promise<void> {
  if (!id || !dataUrl) return;
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredMediaRecord = {
        id,
        dataUrl,
        mimeType,
        updatedAt: Date.now(),
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[mediaDb] Error saving to IndexedDB:', err);
  }
}

export async function getMediaFromIndexedDb(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        resolve(req.result?.dataUrl || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
