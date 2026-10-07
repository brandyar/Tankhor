import { SyncQueueItem } from './types';
import { CloudDirectusAdapter } from './cloudAdapter';
import { mediaManager } from '../utils/mediaManager';
import { isTauriEnvironment } from './sqlite/sqliteBase';

export class StorageSyncManager {
  private static QUEUE_KEY = 'tankhor_sync_queue';
  private static isSyncing = false;

  private static getItemKey(item: { collection: string; action: string; payload: any }): string {
    const payload = item.payload || {};
    const identity =
      payload.id ||
      payload.sku ||
      payload.code ||
      payload.order_number ||
      payload.purchase_number ||
      payload.tracking_code ||
      payload.slug ||
      payload.name ||
      '';
    return `${item.collection}:${item.action}:${identity || JSON.stringify(payload)}`;
  }

  public static getDeduplicatedQueue(): SyncQueueItem[] {
    // In Web Browser mode, changes are saved directly to Directus Cloud API in real-time.
    // An offline queue is only meant for native Desktop SQLite environments.
    if (!isTauriEnvironment() && typeof window !== 'undefined') {
      const raw = localStorage.getItem(this.QUEUE_KEY);
      if (raw) {
        localStorage.removeItem(this.QUEUE_KEY);
      }
      return [];
    }

    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.QUEUE_KEY) : null;
    if (!raw) return [];
    try {
      const parsed: SyncQueueItem[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const seen = new Set<string>();
      const deduplicated: SyncQueueItem[] = [];
      for (const item of parsed) {
        if (!item || !item.collection) continue;
        const key = this.getItemKey(item);
        if (!seen.has(key)) {
          seen.add(key);
          deduplicated.push(item);
        }
      }

      // If duplicate items were found and trimmed, persist the cleaned queue immediately
      if (typeof window !== 'undefined' && deduplicated.length !== parsed.length) {
        localStorage.setItem(this.QUEUE_KEY, JSON.stringify(deduplicated));
      }

      return deduplicated;
    } catch {
      return [];
    }
  }

  public static getQueue(): SyncQueueItem[] {
    return this.getDeduplicatedQueue();
  }

  public static enqueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>) {
    // Only queue offline mutations when running on Desktop SQLite offline environment
    if (!isTauriEnvironment()) {
      return;
    }

    // If a sync cycle is currently active, do not allow adapter catch blocks to re-enqueue items
    if (this.isSyncing) {
      return;
    }

    const queue = this.getDeduplicatedQueue();
    const itemKey = this.getItemKey(item);

    const existingIndex = queue.findIndex((q) => this.getItemKey(q) === itemKey);
    if (existingIndex !== -1) {
      // Update existing pending sync item with freshest payload
      queue[existingIndex] = {
        ...queue[existingIndex],
        ...item,
        timestamp: new Date().toISOString(),
      };
    } else {
      const newItem: SyncQueueItem = {
        ...item,
        id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      };
      queue.push(newItem);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
      window.dispatchEvent(new CustomEvent('tankhor_sync_queue_updated', { detail: queue.length }));
    }
  }

  public static clearQueue() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.QUEUE_KEY);
      window.dispatchEvent(new CustomEvent('tankhor_sync_queue_updated', { detail: 0 }));
    }
  }

  public static async syncLocalToCloud(
    cloudAdapter: CloudDirectusAdapter
  ): Promise<{ success: number; failed: number; mediaSynced: number; mediaFailed: number }> {
    if (this.isSyncing) {
      return { success: 0, failed: 0, mediaSynced: 0, mediaFailed: 0 };
    }

    // Enforce Pro plan for cloud sync
    const cachedUserRaw = typeof window !== 'undefined' ? localStorage.getItem('tankhor_cached_user_profile') : null;
    if (cachedUserRaw) {
      try {
        const cached = JSON.parse(cachedUserRaw);
        const activeOrg = cached.activeOrganization || cached.active_organization;
        if (activeOrg && activeOrg.plan === 'free') {
          throw new Error('همگام‌سازی ابری منحصراً برای سازمان‌های دارای اشتراک Pro در دسترس است.');
        }
      } catch (err: any) {
        if (err.message?.includes('اشتراک Pro')) throw err;
      }
    }

    this.isSyncing = true;
    let success = 0;
    let failed = 0;

    try {
      // 1. Sync pending local images to Directus Cloud Storage
      const mediaSyncRes = await mediaManager.syncPendingImagesToCloud();

      // 2. Sync database change queue (deduplicated)
      const queue = this.getDeduplicatedQueue();
      if (queue.length === 0) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tankhor_sync_queue_updated', { detail: 0 }));
        }
        return {
          success: 0,
          failed: 0,
          mediaSynced: mediaSyncRes.success,
          mediaFailed: mediaSyncRes.failed,
        };
      }

      const remaining: SyncQueueItem[] = [];

      const collectionPriority: Record<string, number> = {
        expense_categories: 1,
        categories: 1,
        financial_accounts: 1,
        warehouses: 1,
        suppliers: 1,
        customers: 1,
        brands: 1,
        collections: 1,
        seasons: 1,
        colors: 1,
        sizes: 1,
        size_groups: 1,
        products: 2,
        product_variants: 3,
        expenses: 4,
        orders: 4,
        purchase_orders: 4,
        treasury_transactions: 4,
        person_transactions: 4,
        cheques: 4,
        landed_costs: 4,
        landed_cost_allocations: 5,
      };

      const sortedQueue = [...queue].sort((a, b) => {
        const pa = collectionPriority[a.collection] || 10;
        const pb = collectionPriority[b.collection] || 10;
        return pa - pb;
      });

      for (const item of sortedQueue) {
        try {
          if (item.action === 'CREATE' || item.action === 'UPDATE') {
            let payload = item.payload;
            if (item.action === 'CREATE' || (payload?.id && typeof payload.id === 'number' && payload.id >= 1000000000)) {
              payload = { ...item.payload };
              delete payload.id;
            }

            if (item.collection === 'products') await cloudAdapter.saveProduct(payload);
            else if (item.collection === 'product_variants') await cloudAdapter.saveVariant(payload);
            else if (item.collection === 'categories') await cloudAdapter.saveCategory(payload);
            else if (item.collection === 'inventory_movements') await cloudAdapter.recordMovement(payload);
            else if (item.collection === 'orders') await cloudAdapter.saveOrder(payload);
            else if (item.collection === 'organization_users') await cloudAdapter.saveOrganizationUser(payload);
            else if (item.collection === 'expenses') await cloudAdapter.saveExpense(payload);
            else if (item.collection === 'expense_categories') await cloudAdapter.saveExpenseCategory(payload);
            else if (item.collection === 'financial_accounts') await cloudAdapter.saveFinancialAccount(payload);
            else if (item.collection === 'treasury_transactions') await cloudAdapter.saveTreasuryTransaction(payload);
            else if (item.collection === 'cheques') await cloudAdapter.saveCheque(payload);
            else if (item.collection === 'person_transactions') await cloudAdapter.savePersonTransaction(payload);
            else if (item.collection === 'landed_costs') await cloudAdapter.saveLandedCost(payload);
            else if (item.collection === 'landed_cost_allocations') await cloudAdapter.saveLandedCostAllocation(payload);
            else if (item.collection === 'customers') await cloudAdapter.saveCustomer(payload);
            else if (item.collection === 'suppliers') await cloudAdapter.saveSupplier(payload);
            else if (item.collection === 'purchase_orders') await cloudAdapter.savePurchaseOrder(payload);
            else if (item.collection === 'stock_transfers') await cloudAdapter.saveStockTransfer(payload);
            else if (item.collection === 'brands') await cloudAdapter.saveBrand(payload);
            else if (item.collection === 'collections') await cloudAdapter.saveCollection(payload);
            else if (item.collection === 'seasons') await cloudAdapter.saveSeason(payload);
            else if (item.collection === 'colors') await cloudAdapter.saveColor(payload);
            else if (item.collection === 'sizes') await cloudAdapter.saveSize(payload);
            else if (item.collection === 'size_groups') await cloudAdapter.saveSizeGroup(payload);
            else if (item.collection === 'warehouses') await cloudAdapter.saveWarehouse(payload);
            else if (item.collection === 'warehouse_locations') await cloudAdapter.saveLocation(payload);
          } else if (item.action === 'DELETE') {
            if (item.collection === 'products') await cloudAdapter.deleteProduct(item.payload.id);
            else if (item.collection === 'product_variants') await cloudAdapter.deleteVariant(item.payload.id);
            else if (item.collection === 'organization_users') await cloudAdapter.deleteOrganizationUser(item.payload.id);
            else if (item.collection === 'expenses') await cloudAdapter.deleteExpense(item.payload.id);
            else if (item.collection === 'expense_categories') await cloudAdapter.deleteExpenseCategory(item.payload.id);
            else if (item.collection === 'financial_accounts') await cloudAdapter.deleteFinancialAccount(item.payload.id);
            else if (item.collection === 'cheques') await cloudAdapter.deleteCheque(item.payload.id);
            else if (item.collection === 'landed_costs') await cloudAdapter.deleteLandedCost(item.payload.id);
            else if (item.collection === 'customers') await cloudAdapter.deleteCustomer(item.payload.id);
            else if (item.collection === 'suppliers') await cloudAdapter.deleteSupplier(item.payload.id);
          }
          success++;
        } catch (err: any) {
          console.error(`[SyncManager] Failed to sync item ${item.collection}:${item.action}:`, err?.message || err);
          failed++;
          const currentRetries = (item.retries || 0) + 1;
          if (currentRetries < 5) {
            remaining.push({ ...item, retries: currentRetries });
          } else {
            console.warn(`[SyncManager] Discarding persistently failing item ${item.collection}:${item.action} after 5 failed sync attempts.`);
          }
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(this.QUEUE_KEY, JSON.stringify(remaining));
        window.dispatchEvent(new CustomEvent('tankhor_sync_queue_updated', { detail: remaining.length }));
      }

      return {
        success,
        failed,
        mediaSynced: mediaSyncRes.success,
        mediaFailed: mediaSyncRes.failed,
      };
    } finally {
      this.isSyncing = false;
    }
  }
}
