import { isTauriEnvironment } from '../storage';
import pkg from '../../package.json';

export const APP_VERSION = pkg.version || '1.0.4';

export async function getCurrentAppVersion(): Promise<string> {
  if (isTauriEnvironment()) {
    try {
      const appPkg = '@tauri-apps/api/app';
      // @ts-ignore
      const { getVersion } = await import(/* @vite-ignore */ appPkg);
      const ver = await getVersion();
      if (ver) return ver;
    } catch (err) {
      console.warn('[Version] Failed to read Tauri app version dynamically:', err);
    }
  }
  return APP_VERSION;
}
