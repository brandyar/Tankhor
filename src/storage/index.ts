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

    // Check if user is on web and has pro or active session
    let isWebPro = false;
    if (!this.isTauri && typeof window !== 'undefined') {
      try {
        const cachedRaw = localStorage.getItem('tankhor_cached_user_profile');
        const token = localStorage.getItem('tankhor_directus_token');
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const activeOrg = cached.activeOrganization || cached.active_organization;
          if (activeOrg && activeOrg.plan === 'pro') {
            isWebPro = true;
          }
        }
        if (token) {
          isWebPro = true;
        }
      } catch {}
    }

    if (isWebPro) {
      this.activeAdapter = this.cloudAdapter;
      if (typeof window !== 'undefined') {
        localStorage.setItem('tankhor_storage_mode', 'cloud_synced');
      }
    } else {
      const storedMode = (typeof window !== 'undefined' ? localStorage.getItem('tankhor_storage_mode') as StorageMode : null) || 'local_offline';
      if (storedMode === 'cloud_synced') {
        this.activeAdapter = this.cloudAdapter;
      } else {
        this.activeAdapter = this.isTauri ? this.sqliteAdapter : this.localAdapter;
      }
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
    if (!this.isTauri && typeof window !== 'undefined') {
      // In web environment, if Pro or cloud authenticated, enforce cloud_synced (offline disabled)
      try {
        const cachedRaw = localStorage.getItem('tankhor_cached_user_profile');
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const activeOrg = cached.activeOrganization || cached.active_organization;
          if (activeOrg && activeOrg.plan === 'pro') {
            mode = 'cloud_synced';
          }
        }
      } catch {}
    }

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

      if (!isPro && this.isTauri) {
        console.warn('[StorageManager] Cloud sync denied: organization plan is not pro.');
        localStorage.setItem('tankhor_storage_mode', 'local_offline');
        this.activeAdapter = this.isTauri ? this.sqliteAdapter : this.localAdapter;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tankhor_storage_mode_changed', { detail: 'local_offline' }));
        }
        return;
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('tankhor_storage_mode', mode);
    }

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

  public async getWarehouses(params?: any) {
    return this.activeAdapter.getWarehouses(params);
  }

  public async getFinancialAccounts(params?: any) {
    return this.activeAdapter.getFinancialAccounts(params);
  }

  public async getProducts(params?: any) {
    return this.activeAdapter.getProducts(params);
  }

  public async saveTreasuryTransaction(transaction: any) {
    if (this.activeAdapter.saveTreasuryTransaction) {
      return this.activeAdapter.saveTreasuryTransaction(transaction);
    }
    throw new Error('saveTreasuryTransaction not supported by active adapter');
  }

  public async getProductVariants(params?: any) {
    return this.activeAdapter.getVariants(params);
  }

  public async getVariants(params?: any) {
    return this.activeAdapter.getVariants(params);
  }

  public async getInventoryItems(params?: any) {
    return this.activeAdapter.getInventoryItems(params);
  }

  public async getPosShifts(params?: any) {
    if (this.activeAdapter.getPosShifts) {
      return this.activeAdapter.getPosShifts(params);
    }
    return [];
  }

  public async getActivePosShift(userId?: string, warehouseId?: number) {
    if (this.activeAdapter.getActivePosShift) {
      return this.activeAdapter.getActivePosShift(userId, warehouseId);
    }
    return null;
  }

  public async savePosShift(shift: any) {
    if (this.activeAdapter.savePosShift) {
      return this.activeAdapter.savePosShift(shift);
    }
    throw new Error('savePosShift not supported by active adapter');
  }

  public async closePosShift(id: number, closingBalance: number | string, notes?: string) {
    if (this.activeAdapter.closePosShift) {
      return this.activeAdapter.closePosShift(id, closingBalance, notes);
    }
    throw new Error('closePosShift not supported by active adapter');
  }

  public async deletePosShift(id: number) {
    if (this.activeAdapter.deletePosShift) {
      return this.activeAdapter.deletePosShift(id);
    }
    return false;
  }

  // WooCommerce Integration delegation
  public async getWooCommerceSettings(params?: any) {
    if (this.activeAdapter.getWooCommerceSettings) {
      return this.activeAdapter.getWooCommerceSettings(params);
    }
    return null;
  }

  public async saveWooCommerceSettings(settings: any) {
    if (this.activeAdapter.saveWooCommerceSettings) {
      return this.activeAdapter.saveWooCommerceSettings(settings);
    }
    throw new Error('saveWooCommerceSettings not supported by active adapter');
  }

  public async getWooCommerceLogs(params?: any) {
    if (this.activeAdapter.getWooCommerceLogs) {
      return this.activeAdapter.getWooCommerceLogs(params);
    }
    return [];
  }

  public async addWooCommerceLog(log: any) {
    if (this.activeAdapter.addWooCommerceLog) {
      return this.activeAdapter.addWooCommerceLog(log);
    }
    return log;
  }

  public async getIntegrationMappings(params?: any) {
    if (this.activeAdapter.getIntegrationMappings) {
      return this.activeAdapter.getIntegrationMappings(params);
    }
    return [];
  }

  public async saveIntegrationMapping(mapping: any) {
    if (this.activeAdapter.saveIntegrationMapping) {
      return this.activeAdapter.saveIntegrationMapping(mapping);
    }
    return mapping;
  }

  public async submitFeedback(feedback: any) {
    if (this.activeAdapter.submitFeedback) {
      return this.activeAdapter.submitFeedback(feedback);
    }
    return feedback;
  }

  public async getFeedbacks(params?: any) {
    if (this.activeAdapter.getFeedbacks) {
      return this.activeAdapter.getFeedbacks(params);
    }
    return [];
  }

  // Production Module Delegation
  public async getRawMaterials(params?: any) {
    if (this.activeAdapter.getRawMaterials) {
      return this.activeAdapter.getRawMaterials(params);
    }
    return [];
  }

  public async getRawMaterialById(id: number) {
    if (this.activeAdapter.getRawMaterialById) {
      return this.activeAdapter.getRawMaterialById(id);
    }
    return null;
  }

  public async saveRawMaterial(material: any) {
    if (this.activeAdapter.saveRawMaterial) {
      return this.activeAdapter.saveRawMaterial(material);
    }
    throw new Error('saveRawMaterial not supported by active adapter');
  }

  public async deleteRawMaterial(id: number) {
    if (this.activeAdapter.deleteRawMaterial) {
      return this.activeAdapter.deleteRawMaterial(id);
    }
    return false;
  }

  public async getBillOfMaterials(params?: any) {
    if (this.activeAdapter.getBillOfMaterials) {
      return this.activeAdapter.getBillOfMaterials(params);
    }
    return [];
  }

  public async getBomByProductId(productId: number) {
    if (this.activeAdapter.getBomByProductId) {
      return this.activeAdapter.getBomByProductId(productId);
    }
    return null;
  }

  public async saveBillOfMaterials(bom: any, items?: any[]) {
    if (this.activeAdapter.saveBillOfMaterials) {
      return this.activeAdapter.saveBillOfMaterials(bom, items);
    }
    throw new Error('saveBillOfMaterials not supported by active adapter');
  }

  public async deleteBillOfMaterials(id: number) {
    if (this.activeAdapter.deleteBillOfMaterials) {
      return this.activeAdapter.deleteBillOfMaterials(id);
    }
    return false;
  }

  public async getContractors(params?: any) {
    if (this.activeAdapter.getContractors) {
      return this.activeAdapter.getContractors(params);
    }
    return [];
  }

  public async getContractorById(id: number) {
    if (this.activeAdapter.getContractorById) {
      return this.activeAdapter.getContractorById(id);
    }
    return null;
  }

  public async saveContractor(contractor: any) {
    if (this.activeAdapter.saveContractor) {
      return this.activeAdapter.saveContractor(contractor);
    }
    throw new Error('saveContractor not supported by active adapter');
  }

  public async deleteContractor(id: number) {
    if (this.activeAdapter.deleteContractor) {
      return this.activeAdapter.deleteContractor(id);
    }
    return false;
  }

  public async getProductionOrders(params?: any) {
    if (this.activeAdapter.getProductionOrders) {
      return this.activeAdapter.getProductionOrders(params);
    }
    return [];
  }

  public async getProductionOrderById(id: number) {
    if (this.activeAdapter.getProductionOrderById) {
      return this.activeAdapter.getProductionOrderById(id);
    }
    return null;
  }

  public async saveProductionOrder(order: any, items?: any[], stages?: any[]) {
    if (this.activeAdapter.saveProductionOrder) {
      return this.activeAdapter.saveProductionOrder(order, items, stages);
    }
    throw new Error('saveProductionOrder not supported by active adapter');
  }

  public async deleteProductionOrder(id: number) {
    if (this.activeAdapter.deleteProductionOrder) {
      return this.activeAdapter.deleteProductionOrder(id);
    }
    return false;
  }
}

export const storageManager = new StorageManagerSingleton();
export { BackupManager, SqliteStorageAdapter, isTauriEnvironment };

