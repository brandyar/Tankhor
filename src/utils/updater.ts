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

export async function checkDesktopUpdate(): Promise<AppUpdateInfo> {
  if (!isTauriEnvironment()) {
    return { available: false };
  }

  try {
    const updaterPkg = '@tauri-apps/plugin-updater';
    // @ts-ignore
    const { check } = await import(/* @vite-ignore */ updaterPkg);
    const update = await check();

    if (update && update.available) {
      return {
        available: true,
        version: update.version,
        currentVersion: update.currentVersion,
        body: update.body,
        date: update.date,
        updateObj: update,
      };
    }
    return { available: false };
  } catch (err: any) {
    console.warn('[Updater] Check failed:', err);
    return {
      available: false,
      error: err?.message || String(err),
    };
  }
}

export async function downloadAndInstallUpdate(
  updateObj: any,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  if (!updateObj) return;

  let downloaded = 0;
  let contentLength = 0;

  await updateObj.downloadAndInstall((event: any) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data.contentLength || 0;
        if (onProgress) onProgress(0, contentLength);
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        if (onProgress) onProgress(downloaded, contentLength);
        break;
      case 'Finished':
        if (onProgress) onProgress(contentLength, contentLength);
        break;
    }
  });

  // Relaunch the application after installation
  try {
    const processPkg = '@tauri-apps/plugin-process';
    // @ts-ignore
    const { relaunch } = await import(/* @vite-ignore */ processPkg);
    await relaunch();
  } catch (err) {
    console.error('[Updater] Failed to relaunch application automatically:', err);
  }
}
