import { isTauriEnvironment } from '../storage';

type ConfirmHandler = (message: string, title?: string) => Promise<boolean>;

let globalConfirmHandler: ConfirmHandler | null = null;

export function registerConfirmHandler(handler: ConfirmHandler) {
  globalConfirmHandler = handler;
}

export async function confirmAction(message: string, title: string = 'تایید عملیات'): Promise<boolean> {
  // 1. In Tauri Desktop environment, try native Tauri dialog first
  if (isTauriEnvironment()) {
    try {
      const pluginName = '@tauri-apps/plugin-dialog';
      // @ts-ignore
      const pluginDialog = await import(/* @vite-ignore */ pluginName).catch(() => null);
      if (pluginDialog && typeof pluginDialog.confirm === 'function') {
        return await pluginDialog.confirm(message, { title, kind: 'warning' });
      }
      const apiDialogName = '@tauri-apps/api/dialog';
      // @ts-ignore
      const apiDialog = await import(/* @vite-ignore */ apiDialogName).catch(() => null);
      if (apiDialog && typeof apiDialog.confirm === 'function') {
        return await apiDialog.confirm(message, title);
      }
    } catch (err) {
      console.warn('[confirmAction] Tauri dialog call failed:', err);
    }
  }

  // 2. If global React Confirm Modal handler is registered, use UI Modal
  if (globalConfirmHandler) {
    try {
      return await globalConfirmHandler(message, title);
    } catch (err) {
      console.warn('[confirmAction] UI confirm handler error:', err);
    }
  }

  // 3. Fallback to standard window.confirm if available
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    try {
      const res = window.confirm(message);
      // In Tauri webview where window.confirm is disabled and returns false without prompting,
      // fallback to true if in Tauri environment
      if (!res && isTauriEnvironment()) {
        return true;
      }
      return res;
    } catch {
      return true;
    }
  }

  return true;
}
