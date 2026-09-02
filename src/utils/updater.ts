import { isTauriEnvironment } from '../storage';

export interface AppUpdateInfo {
  available: boolean;
  version?: string;
  currentVersion?: string;
  body?: string;
  date?: string;
  updateObj?: any;
  error?: string;
}

type UpdateListener = (info: AppUpdateInfo) => void;
const listeners: Set<UpdateListener> = new Set();
let cachedUpdateInfo: AppUpdateInfo | null = null;

export function onUpdateAvailable(listener: UpdateListener): () => void {
  listeners.add(listener);
  if (cachedUpdateInfo && cachedUpdateInfo.available) {
    listener(cachedUpdateInfo);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function triggerUpdateModal(info: AppUpdateInfo) {
  cachedUpdateInfo = info;
  listeners.forEach((listener) => {
    try {
      listener(info);
    } catch (e) {
      console.error('[Updater] Listener execution error:', e);
    }
  });
}

/**
 * Checks for updates using @tauri-apps/plugin-updater and notifies listeners if available.
 * Supports intelligent fallback targets for Windows and macOS.
 */
export async function checkDesktopUpdate(options?: { target?: string }): Promise<AppUpdateInfo> {
  if (!isTauriEnvironment()) {
    console.info('[Updater] Not in Tauri environment, skipping update check.');
    return { available: false };
  }

  try {
    console.log('[Updater] Checking for desktop updates via @tauri-apps/plugin-updater...');
    const updaterModule = await import('@tauri-apps/plugin-updater');
    
    if (!updaterModule || typeof updaterModule.check !== 'function') {
      throw new Error('ماژول بروزرسانی (Updater) در این بیلد در دسترس نیست.');
    }

    // Attempt default check first
    let update: any = null;
    let lastError: any = null;

    try {
      update = await updaterModule.check(options);
    } catch (checkErr: any) {
      lastError = checkErr;
      console.warn('[Updater] Standard check encountered issue, attempting target fallbacks:', checkErr);
      
      // If error mentions platforms or target, try explicit platform targets
      const errMsg = String(checkErr?.message || checkErr).toLowerCase();
      if (errMsg.includes('platform') || errMsg.includes('target') || errMsg.includes('fallback') || errMsg.includes('not found')) {
        const fallbackTargets = [
          'windows-x86_64-nsis',
          'windows-x86_64',
          'windows-x86_64-msi',
          'darwin-universal',
          'darwin-aarch64',
          'darwin-x86_64'
        ];

        for (const target of fallbackTargets) {
          try {
            console.log(`[Updater] Trying fallback target: ${target}`);
            const fallbackResult = await updaterModule.check({ target });
            if (fallbackResult) {
              update = fallbackResult;
              lastError = null;
              break;
            }
          } catch (fbErr) {
            // continue trying other targets
          }
        }
      }
    }

    if (lastError && !update) {
      throw lastError;
    }

    console.log('[Updater] Check result:', update);

    if (update && update.available) {
      const updateInfo: AppUpdateInfo = {
        available: true,
        version: update.version,
        currentVersion: update.currentVersion,
        body: update.body,
        date: update.date,
        updateObj: update,
      };

      triggerUpdateModal(updateInfo);
      return updateInfo;
    }

    return { available: false };
  } catch (err: any) {
    console.error('[Updater] Check failed with error:', err);
    const errorMsg = err?.message || String(err);
    return {
      available: false,
      error: errorMsg,
    };
  }
}

/**
 * Downloads and installs the given update object, emitting progress events.
 */
export async function downloadAndInstallUpdate(
  updateObj: any,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  if (!updateObj) {
    throw new Error('شیء بروزرسانی نامعتبر است.');
  }

  let downloaded = 0;
  let contentLength = 0;

  console.log('[Updater] Starting downloadAndInstall...');

  try {
    await updateObj.downloadAndInstall((event: any) => {
      console.log('[Updater] Download event:', event);
      switch (event.event) {
        case 'Started':
          contentLength = event.data?.contentLength || 0;
          if (onProgress) onProgress(0, contentLength);
          break;
        case 'Progress':
          downloaded += event.data?.chunkLength || 0;
          if (onProgress) onProgress(downloaded, contentLength);
          break;
        case 'Finished':
          if (onProgress) onProgress(contentLength || downloaded, contentLength || downloaded);
          break;
      }
    });
  } catch (downloadErr: any) {
    console.error('[Updater] Error during updateObj.downloadAndInstall:', downloadErr);
    const rawMsg = downloadErr?.message || String(downloadErr);
    throw new Error(rawMsg);
  }

  console.log('[Updater] Update downloaded and installed. Triggering relaunch...');

  // Relaunch the application after installation
  try {
    const processModule = await import('@tauri-apps/plugin-process');
    if (processModule && typeof processModule.relaunch === 'function') {
      await processModule.relaunch();
    }
  } catch (err: any) {
    console.warn('[Updater] Auto relaunch failed (will require manual restart):', err);
    // Don't fail the whole installation if only relaunch had an issue
  }
}
