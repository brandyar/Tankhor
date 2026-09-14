import { SyncQueueItem } from './types';
import { CloudDirectusAdapter } from './cloudAdapter';
import { mediaManager } from '../utils/mediaManager';

export class StorageSyncManager {
  private static QUEUE_KEY = 'tankhor_sync_queue';

  public static getQueue(): SyncQueueItem[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.QUEUE_KEY) : null;
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static enqueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>) {
    const queue = this.getQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    queue.push(newItem);
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
        if (err.message.includes('اشتراک Pro')) throw err;
      }
    }

    // 1. Sync pending local images to Directus Cloud Storage
    const mediaSyncRes = await mediaManager.syncPendingImagesToCloud();

    // 2. Sync database change queue
    const queue = this.getQueue();
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

    let success = 0;
    let failed = 0;
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
          if (item.collection === 'products') await cloudAdapter.saveProduct(item.payload);
          else if (item.collection === 'product_variants') await cloudAdapter.saveVariant(item.payload);
          else if (item.collection === 'categories') await cloudAdapter.saveCategory(item.payload);
          else if (item.collection === 'inventory_movements') await cloudAdapter.recordMovement(item.payload);
          else if (item.collection === 'orders') await cloudAdapter.saveOrder(item.payload);
          else if (item.collection === 'organization_users') await cloudAdapter.saveOrganizationUser(item.payload);
          else if (item.collection === 'expenses') await cloudAdapter.saveExpense(item.payload);
          else if (item.collection === 'expense_categories') await cloudAdapter.saveExpenseCategory(item.payload);
          else if (item.collection === 'financial_accounts') await cloudAdapter.saveFinancialAccount(item.payload);
          else if (item.collection === 'treasury_transactions') await cloudAdapter.saveTreasuryTransaction(item.payload);
          else if (item.collection === 'cheques') await cloudAdapter.saveCheque(item.payload);
          else if (item.collection === 'person_transactions') await cloudAdapter.savePersonTransaction(item.payload);
          else if (item.collection === 'landed_costs') await cloudAdapter.saveLandedCost(item.payload);
          else if (item.collection === 'landed_cost_allocations') await cloudAdapter.saveLandedCostAllocation(item.payload);
          else if (item.collection === 'customers') await cloudAdapter.saveCustomer(item.payload);
          else if (item.collection === 'suppliers') await cloudAdapter.saveSupplier(item.payload);
          else if (item.collection === 'purchase_orders') await cloudAdapter.savePurchaseOrder(item.payload);
          else if (item.collection === 'stock_transfers') await cloudAdapter.saveStockTransfer(item.payload);
          else if (item.collection === 'brands') await cloudAdapter.saveBrand(item.payload);
          else if (item.collection === 'collections') await cloudAdapter.saveCollection(item.payload);
          else if (item.collection === 'seasons') await cloudAdapter.saveSeason(item.payload);
          else if (item.collection === 'colors') await cloudAdapter.saveColor(item.payload);
          else if (item.collection === 'sizes') await cloudAdapter.saveSize(item.payload);
          else if (item.collection === 'size_groups') await cloudAdapter.saveSizeGroup(item.payload);
          else if (item.collection === 'warehouses') await cloudAdapter.saveWarehouse(item.payload);
          else if (item.collection === 'warehouse_locations') await cloudAdapter.saveLocation(item.payload);
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
      } catch (err) {
        console.error(`[SyncManager] Failed to sync item ${item.id}:`, err);
        failed++;
        remaining.push(item);
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
  }
}
