import { SyncQueueItem } from './types';
import { CloudDirectusAdapter } from './cloudAdapter';

export class StorageSyncManager {
  private static QUEUE_KEY = 'tankhor_sync_queue';

  public static getQueue(): SyncQueueItem[] {
    const raw = localStorage.getItem(this.QUEUE_KEY);
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
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  }

  public static clearQueue() {
    localStorage.removeItem(this.QUEUE_KEY);
  }

  public static async syncLocalToCloud(cloudAdapter: CloudDirectusAdapter): Promise<{ success: number; failed: number }> {
    const queue = this.getQueue();
    if (queue.length === 0) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;
    const remaining: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.action === 'CREATE' || item.action === 'UPDATE') {
          if (item.collection === 'products') await cloudAdapter.saveProduct(item.payload);
          else if (item.collection === 'product_variants') await cloudAdapter.saveVariant(item.payload);
          else if (item.collection === 'categories') await cloudAdapter.saveCategory(item.payload);
          else if (item.collection === 'inventory_movements') await cloudAdapter.recordMovement(item.payload);
          else if (item.collection === 'orders') await cloudAdapter.saveOrder(item.payload);
          else if (item.collection === 'organization_users') await cloudAdapter.saveOrganizationUser(item.payload);
        } else if (item.action === 'DELETE') {
          if (item.collection === 'products') await cloudAdapter.deleteProduct(item.payload.id);
          else if (item.collection === 'product_variants') await cloudAdapter.deleteVariant(item.payload.id);
          else if (item.collection === 'organization_users') await cloudAdapter.deleteOrganizationUser(item.payload.id);
        }
        success++;
      } catch (err) {
        console.error(`[SyncManager] Failed to sync item ${item.id}:`, err);
        failed++;
        remaining.push(item);
      }
    }

    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(remaining));
    return { success, failed };
  }
}
