import { IStorageProvider, StorageMode } from './types';
import { LocalOfflineAdapter } from './localAdapter';
import { CloudDirectusAdapter } from './cloudAdapter';

class StorageManagerSingleton {
  private activeAdapter: IStorageProvider;
  private localAdapter: LocalOfflineAdapter;
  private cloudAdapter: CloudDirectusAdapter;

  constructor() {
    this.localAdapter = new LocalOfflineAdapter();
    this.cloudAdapter = new CloudDirectusAdapter();

    const storedMode = (localStorage.getItem('tankhor_storage_mode') as StorageMode) || 'local_offline';
    this.activeAdapter = storedMode === 'cloud_synced' ? this.cloudAdapter : this.localAdapter;
  }

  public getAdapter(): IStorageProvider {
    return this.activeAdapter;
  }

  public getMode(): StorageMode {
    return this.activeAdapter.mode;
  }

  public setMode(mode: StorageMode) {
    localStorage.setItem('tankhor_storage_mode', mode);
    this.activeAdapter = mode === 'cloud_synced' ? this.cloudAdapter : this.localAdapter;
  }

  public getLocalAdapter(): LocalOfflineAdapter {
    return this.localAdapter;
  }

  public getCloudAdapter(): CloudDirectusAdapter {
    return this.cloudAdapter;
  }
}

export const storageManager = new StorageManagerSingleton();
