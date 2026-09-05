/**
 * TANKHOR (تن‌خور) - Media & Image File Manager
 * Handles hybrid desktop filesystem storage (Tauri @tauri-apps/plugin-fs),
 * local offline caching, and background cloud sync queues.
 */

import { isTauriEnvironment } from '../storage';
import { compressImage, CompressedImageResult } from './imageCompressor';
import { directusClient } from '../api/directus';

export interface LocalMediaItem {
  id: string; // filename e.g. "prod_img_1720000000_abc12.webp" or UUID
  fileName: string;
  relativePath: string; // "media/prod_img_1720000000_abc12.webp"
  mimeType: string;
  size: number;
  dataUrl?: string;
  cloudAssetId?: string;
  synced: boolean;
  createdAt: string;
}

export interface MediaUploadQueueItem {
  mediaId: string;
  fileName: string;
  mimeType: string;
  productId?: number;
  dataUrl?: string; // base64 fallback for cloud sync
  timestamp: string;
  status: 'pending' | 'uploading' | 'synced' | 'failed';
  error?: string;
}

const MEDIA_QUEUE_KEY = 'tankhor_media_upload_queue';
const LOCAL_MEDIA_INDEX_KEY = 'tankhor_local_media_index';
const MEDIA_DIR_NAME = 'media';

class MediaManager {
  private mediaDirReady = false;
  private inMemoryCache = new Map<string, string>(); // mediaId/filename -> objectUrl or dataUrl

  /**
   * Ensures the application media directory exists in Tauri AppDataDir.
   */
  private async ensureMediaDirectory(): Promise<void> {
    if (this.mediaDirReady) return;
    if (!isTauriEnvironment()) {
      this.mediaDirReady = true;
      return;
    }

    try {
      const { mkdir, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const dirExists = await exists(MEDIA_DIR_NAME, { baseDir: BaseDirectory.AppData });
      if (!dirExists) {
        await mkdir(MEDIA_DIR_NAME, { baseDir: BaseDirectory.AppData, recursive: true });
      }
      this.mediaDirReady = true;
    } catch (err) {
      console.warn('[MediaManager] Failed to create media directory in AppData, fallback to memory/cache:', err);
    }
  }

  /**
   * Saves a product/category image.
   * Compresses it first, saves to local disk (Tauri AppData) or Indexed/Local Storage,
   * enqueues for cloud sync, and returns a safe media reference (mediaId or filename).
   */
  public async saveImage(
    file: File | Blob,
    options?: { productId?: number; customName?: string }
  ): Promise<{ mediaId: string; displayUrl: string; compressed: CompressedImageResult }> {
    // 1. Auto-compress and resize image
    const compressed = await compressImage(file, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.82,
      targetFormat: 'image/webp',
    });

    const ext = compressed.format === 'image/webp' ? 'webp' : 'jpg';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const fileName = options?.customName
      ? `${options.customName}.${ext}`
      : `media_${timestamp}_${randomSuffix}.${ext}`;
    const relativePath = `${MEDIA_DIR_NAME}/${fileName}`;

    let displayUrl = compressed.dataUrl;

    // 2. If in Desktop Tauri, save binary to Local File System
    if (isTauriEnvironment()) {
      try {
        await this.ensureMediaDirectory();
        const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
        const uint8Array = new Uint8Array(await compressed.blob.arrayBuffer());

        await writeFile(relativePath, uint8Array, {
          baseDir: BaseDirectory.AppData,
        });

        console.log(`[MediaManager] Successfully wrote image to AppData/${relativePath}`);
      } catch (fsErr) {
        console.warn('[MediaManager] Tauri FS write error, storing dataUrl fallback:', fsErr);
      }
    }

    // 3. Cache dataUrl in memory for instant local rendering
    this.inMemoryCache.set(fileName, compressed.dataUrl);

    // 4. Save to Local Media Index
    this.saveLocalMediaRecord({
      id: fileName,
      fileName,
      relativePath,
      mimeType: compressed.format,
      size: compressed.compressedSize,
      dataUrl: compressed.dataUrl.length < 500000 ? compressed.dataUrl : undefined,
      synced: false,
      createdAt: new Date().toISOString(),
    });

    // 5. Enqueue for background cloud sync
    this.enqueueForCloudSync({
      mediaId: fileName,
      fileName,
      mimeType: compressed.format,
      productId: options?.productId,
      dataUrl: compressed.dataUrl,
      timestamp: new Date().toISOString(),
      status: 'pending',
    });

    return {
      mediaId: fileName,
      displayUrl,
      compressed,
    };
  }

  /**
   * Resolves a media identifier (fileName, directus file ID, dataUrl, or http URL)
   * to a renderable image src URL.
   */
  public async getDisplayUrl(mediaRef?: string | null): Promise<string> {
    if (!mediaRef) return '';

    // Direct HTTP or Data URL
    if (mediaRef.startsWith('data:') || mediaRef.startsWith('http://') || mediaRef.startsWith('https://')) {
      return mediaRef;
    }

    // Check memory cache
    if (this.inMemoryCache.has(mediaRef)) {
      return this.inMemoryCache.get(mediaRef)!;
    }

    // If on Desktop Tauri and this is a local media file (e.g. media_123.webp)
    if (isTauriEnvironment() && (mediaRef.includes('media_') || mediaRef.endsWith('.webp') || mediaRef.endsWith('.jpg') || mediaRef.endsWith('.png'))) {
      try {
        const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
        const relativePath = mediaRef.startsWith(MEDIA_DIR_NAME) ? mediaRef : `${MEDIA_DIR_NAME}/${mediaRef}`;
        const bytes = await readFile(relativePath, { baseDir: BaseDirectory.AppData });
        
        const mime = mediaRef.endsWith('.webp') ? 'image/webp' : mediaRef.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const blob = new Blob([bytes], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        
        this.inMemoryCache.set(mediaRef, objectUrl);
        return objectUrl;
      } catch (readErr) {
        console.warn(`[MediaManager] Failed to read local file AppData/${mediaRef}:`, readErr);
      }
    }

    // Check localStorage fallback index
    const localRecords = this.getLocalMediaIndex();
    const found = localRecords.find((r) => r.id === mediaRef || r.fileName === mediaRef);
    if (found && found.dataUrl) {
      this.inMemoryCache.set(mediaRef, found.dataUrl);
      return found.dataUrl;
    }

    // If not local or is a Directus Cloud Asset UUID, resolve via API asset URL
    return directusClient.getAssetUrl(mediaRef);
  }

  /**
   * Synchronous URL resolver with fallback for initial render.
   */
  public getDisplayUrlSync(mediaRef?: string | null): string {
    if (!mediaRef) return '';
    if (mediaRef.startsWith('data:') || mediaRef.startsWith('http://') || mediaRef.startsWith('https://')) {
      return mediaRef;
    }
    if (this.inMemoryCache.has(mediaRef)) {
      return this.inMemoryCache.get(mediaRef)!;
    }
    return directusClient.getAssetUrl(mediaRef);
  }

  // --- Cloud Sync Queue Management ---

  public getQueue(): MediaUploadQueueItem[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(MEDIA_QUEUE_KEY) : null;
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private enqueueForCloudSync(item: MediaUploadQueueItem) {
    const queue = this.getQueue();
    // Avoid duplicate queue entries for the same mediaId
    const filtered = queue.filter((q) => q.mediaId !== item.mediaId);
    filtered.push(item);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MEDIA_QUEUE_KEY, JSON.stringify(filtered));
      } catch (storageErr) {
        // If quota exceeded, strip heavy dataUrls from older items
        const stripped = filtered.map((q, idx) => (idx < filtered.length - 1 ? { ...q, dataUrl: undefined } : q));
        try {
          localStorage.setItem(MEDIA_QUEUE_KEY, JSON.stringify(stripped));
        } catch {}
      }
    }
  }

  public clearQueue() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MEDIA_QUEUE_KEY);
    }
  }

  /**
   * Synchronizes all queued images to Directus Cloud Storage.
   */
  public async syncPendingImagesToCloud(): Promise<{ success: number; failed: number }> {
    const queue = this.getQueue();
    const pending = queue.filter((q) => q.status === 'pending' || q.status === 'failed');
    if (pending.length === 0) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;
    const updatedQueue: MediaUploadQueueItem[] = [...queue];

    for (const item of pending) {
      const idx = updatedQueue.findIndex((q) => q.mediaId === item.mediaId);
      if (idx !== -1) updatedQueue[idx].status = 'uploading';

      try {
        let fileBlob: Blob | null = null;

        // Try reading from Tauri FS first
        if (isTauriEnvironment()) {
          try {
            const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
            const relativePath = `${MEDIA_DIR_NAME}/${item.fileName}`;
            const bytes = await readFile(relativePath, { baseDir: BaseDirectory.AppData });
            fileBlob = new Blob([bytes], { type: item.mimeType || 'image/webp' });
          } catch {}
        }

        // Fallback to dataUrl from item or memory cache
        if (!fileBlob) {
          const dataUrl = item.dataUrl || this.inMemoryCache.get(item.mediaId);
          if (dataUrl && dataUrl.startsWith('data:')) {
            const res = await fetch(dataUrl);
            fileBlob = await res.blob();
          }
        }

        if (!fileBlob) {
          throw new Error('Image binary data not found on disk or memory.');
        }

        const fileToUpload = new File([fileBlob], item.fileName, { type: item.mimeType || 'image/webp' });
        const uploadRes = await directusClient.uploadFile(fileToUpload);

        if (uploadRes && uploadRes.id) {
          if (idx !== -1) {
            updatedQueue[idx].status = 'synced';
          }
          this.updateLocalMediaRecordSyncStatus(item.mediaId, uploadRes.id);
          success++;
        } else {
          throw new Error('Upload response missing file asset ID');
        }
      } catch (err: any) {
        console.error(`[MediaManager] Failed to sync image ${item.fileName} to cloud:`, err);
        if (idx !== -1) {
          updatedQueue[idx].status = 'failed';
          updatedQueue[idx].error = err.message || String(err);
        }
        failed++;
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(MEDIA_QUEUE_KEY, JSON.stringify(updatedQueue));
    }

    return { success, failed };
  }

  // --- Local Media Index Record Helpers ---

  private getLocalMediaIndex(): LocalMediaItem[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_MEDIA_INDEX_KEY) : null;
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveLocalMediaRecord(record: LocalMediaItem) {
    const list = this.getLocalMediaIndex();
    const filtered = list.filter((r) => r.id !== record.id);
    filtered.unshift(record);
    // Keep last 100 media records in index
    const trimmed = filtered.slice(0, 100);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_MEDIA_INDEX_KEY, JSON.stringify(trimmed));
      } catch {}
    }
  }

  private updateLocalMediaRecordSyncStatus(mediaId: string, cloudAssetId: string) {
    const list = this.getLocalMediaIndex();
    const found = list.find((r) => r.id === mediaId || r.fileName === mediaId);
    if (found) {
      found.synced = true;
      found.cloudAssetId = cloudAssetId;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LOCAL_MEDIA_INDEX_KEY, JSON.stringify(list));
        } catch {}
      }
    }
  }
}

export const mediaManager = new MediaManager();
