import { isTauriEnvironment } from '../storage';

/**
 * Opens an external URL in the user's default system browser (for Desktop/Tauri)
 * or opens a new browser tab (for Web).
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;

  if (isTauriEnvironment()) {
    try {
      // 1. Try @tauri-apps/plugin-opener (Tauri v2 standard)
      const opener = await import('@tauri-apps/plugin-opener').catch(() => null);
      if (opener && typeof opener.openUrl === 'function') {
        await opener.openUrl(url);
        return true;
      }
    } catch (e) {
      console.warn('[Desktop] @tauri-apps/plugin-opener error, trying fallback:', e);
    }

    try {
      // 2. Try window.__TAURI__.core or shell
      if (typeof window !== 'undefined' && (window as any).__TAURI__?.opener?.openUrl) {
        await (window as any).__TAURI__.opener.openUrl(url);
        return true;
      }
    } catch (e) {
      console.warn('[Desktop] window.__TAURI__ opener error:', e);
    }
  }

  // 3. Web or standard fallback
  if (typeof window !== 'undefined') {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w || w.closed || typeof w.closed === 'undefined') {
      window.location.href = url;
    }
    return true;
  }

  return false;
}
