import { IStorageProvider, StorageMode } from './types';
import { LocalOfflineAdapter } from './localAdapter';
import { CloudDirectusAdapter } from './cloudAdapter';
import { SqliteStorageAdapter, isTauriEnvironment } from './sqliteAdapter';
import { BackupManager } from './backupManager';

class StorageManagerSingleton {
  private activeAdapter: IStorageProvider;
  private localAdapter: LocalOfflineAdapter;
  private sqliteAdapter: SqliteStorageAdapter;
  private cloudAdapter: CloudDirectusAdapter;
  private isTauri: boolean;

  constructor() {
    this.localAdapter = new LocalOfflineAdapter();
    this.sqliteAdapter = new SqliteStorageAdapter();
    this.cloudAdapter = new CloudDirectusAdapter();
    this.isTauri = isTauriEnvironment();

    const storedMode = (localStorage.getItem('tankhor_storage_mode') as StorageMode) || 'local_offline';
    if (storedMode === 'cloud_synced') {
      this.activeAdapter = this.cloudAdapter;
    } else {
      this.activeAdapter = this.isTauri ? this.sqliteAdapter : this.localAdapter;
    }
  }

  public getAdapter(): IStorageProvider {
    return this.activeAdapter;
  }

  public getMode(): StorageMode {
    return this.activeAdapter.mode;
  }

  public isDesktopSqlite(): boolean {
    return this.isTauri && this.activeAdapter === this.sqliteAdapter;
  }

  public setMode(mode: StorageMode) {
    if (mode === 'cloud_synced') {
      let isPro = false;
      try {
        const cachedRaw = typeof window !== 'undefined' ? localStorage.getItem('tankhor_cached_user_profile') : null;
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const activeOrg = cached.activeOrganization || cached.active_organization;
          if (activeOrg && activeOrg.plan === 'pro') {
            isPro = true;
          }
        }
      } catch {}

      if (!isPro) {
        console.warn('[StorageManager] Cloud sync denied: organization plan is not pro.');
        localStorage.setItem('tankhor_storage_mode', 'local_offline');
        this.activeAdapter = this.isTauri ? this.sqliteAdapter : this.localAdapter;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tankhor_storage_mode_changed', { detail: 'local_offline' }));
        }
        return;
      }
    }

    localStorage.setItem('tankhor_storage_mode', mode);
    if (mode === 'cloud_synced') {
      this.activeAdapter = this.cloudAdapter;
    } else {
      this.activeAdapter = this.isTauri ? this.sqliteAdapter : this.localAdapter;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tankhor_storage_mode_changed', { detail: mode }));
    }
  }

  public getLocalAdapter(): LocalOfflineAdapter {
    return this.localAdapter;
  }

  public getSqliteAdapter(): SqliteStorageAdapter {
    return this.sqliteAdapter;
  }

  public getCloudAdapter(): CloudDirectusAdapter {
    return this.cloudAdapter;
  }
}

export const storageManager = new StorageManagerSingleton();
export { BackupManager, SqliteStorageAdapter, isTauriEnvironment };

