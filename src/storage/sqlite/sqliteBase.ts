import Database from '@tauri-apps/plugin-sql';
import { QueryParams } from '../types';
import { normalizeId } from '../../utils/formatters';

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol.includes('tauri') ||
    Boolean((window as any).__TAURI__) ||
    Boolean((window as any).__TAURI_INTERNALS__) ||
    window.location.hostname === 'tauri.localhost'
  );
}

export const SQLITE_COLLECTIONS = [
  'organizations',
  'organization_users',
  'categories',
  'collections',
  'seasons',
  'colors',
  'size_groups',
  'sizes',
  'brands',
  'products',
  'product_variants',
  'warehouses',
  'warehouse_locations',
  'inventory_items',
  'inventory_movements',
  'customers',
  'orders',
  'order_items',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'stock_transfers',
  'stock_transfer_items',
  'size_guide_templates',
  'size_guide_measurements',
  'size_guide_values',
  'subscriptions',
  'system_modules',
  'organization_modules',
  'expense_categories',
  'expenses',
  'person_transactions',
  'financial_accounts',
  'treasury_transactions',
  'cheques',
  'landed_costs',
  'landed_cost_allocations',
  'pos_shifts',
  'woocommerce_settings',
  'woocommerce_logs',
  'woocommerce_mappings',
  'feedbacks',
] as const;

export class SqliteStorageBase {
  public db: Database | null = null;
  public dbInitPromise: Promise<Database | null> | null = null;
  public fallbackMemoryStore: Map<string, any[]> = new Map();
  public lastGeneratedId = 0;

  constructor() {
    this.initDatabase();

    if (typeof window !== 'undefined') {
      window.addEventListener('tankhor_data_restored', async (e: any) => {
        this.loadLocalStorageFallback();
        const isClear = e?.detail?.type === 'cleared';
        await this.syncAllFromLocalStorage(isClear);
      });
    }
  }

  /**
   * Initializes SQLite connection and ensures all schema tables exist.
   */
  public async initDatabase(): Promise<Database | null> {
    if (this.db) return this.db;
    if (this.dbInitPromise) return this.dbInitPromise;

    this.dbInitPromise = (async () => {
      if (!isTauriEnvironment()) {
        this.loadLocalStorageFallback();
        return null;
      }

      try {
        const db = await Database.load('sqlite:tankhor.db');
        this.db = db;

        for (const col of SQLITE_COLLECTIONS) {
          await db.execute(`
            CREATE TABLE IF NOT EXISTS ${col} (
              id INTEGER PRIMARY KEY,
              organization_id INTEGER,
              data TEXT NOT NULL,
              date_created TEXT DEFAULT CURRENT_TIMESTAMP,
              date_updated TEXT DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_${col}_org ON ${col} (organization_id);
          `);
        }

        await this.autoMigrateLocalStorageToSqlite(db);
        return db;
      } catch (err) {
        console.warn('[SqliteStorageAdapter] Failed to load Tauri SQLite plugin:', err);
        this.loadLocalStorageFallback();
        return null;
      }
    })();

    return this.dbInitPromise;
  }

  /**
   * Synchronizes all local data from localStorage directly into SQLite.
   * Ensures demo data seeding, backups, and restores are fully reflected in SQLite on Desktop.
   */
  public async syncAllFromLocalStorage(clearFirst = false): Promise<void> {
    const db = await this.initDatabase();
    if (!db || typeof window === 'undefined') {
      this.loadLocalStorageFallback();
      return;
    }

    try {
      for (const col of SQLITE_COLLECTIONS) {
        if (clearFirst) {
          try {
            await db.execute(`DELETE FROM ${col}`);
          } catch {}
        }
        const raw = localStorage.getItem(`tankhor_db_${col}`);
        if (raw) {
          try {
            const items: any[] = JSON.parse(raw);
            if (Array.isArray(items)) {
              for (const item of items) {
                if (item && item.id) {
                  const orgId = typeof item.organization_id === 'number' ? item.organization_id : (item.organization_id?.id || 1);
                  await db.execute(
                    `INSERT OR REPLACE INTO ${col} (id, organization_id, data, date_updated) VALUES ($1, $2, $3, datetime('now'))`,
                    [item.id, orgId, JSON.stringify(item)]
                  );
                }
              }
              this.fallbackMemoryStore.set(col, items);
            }
          } catch {}
        } else if (clearFirst) {
          this.fallbackMemoryStore.set(col, []);
        }
      }
    } catch (err) {
      console.warn('[SqliteStorageAdapter] syncAllFromLocalStorage error:', err);
    }
  }

  public loadLocalStorageFallback() {
    for (const col of SQLITE_COLLECTIONS) {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(`tankhor_db_${col}`);
        if (raw) {
          try {
            this.fallbackMemoryStore.set(col, JSON.parse(raw));
          } catch {
            this.fallbackMemoryStore.set(col, []);
          }
        } else {
          this.fallbackMemoryStore.set(col, []);
        }
      }
    }
  }

  public saveLocalStorageFallback(col: string, items: any[]) {
    this.fallbackMemoryStore.set(col, items);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`tankhor_db_${col}`, JSON.stringify(items));
      } catch {}
    }
  }

  public async autoMigrateLocalStorageToSqlite(db: Database) {
    try {
      const orgRows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM organizations');
      const count = orgRows[0]?.count || 0;
      if (count === 0 && typeof window !== 'undefined') {
        for (const col of SQLITE_COLLECTIONS) {
          const raw = localStorage.getItem(`tankhor_db_${col}`);
          if (raw) {
            try {
              const items: any[] = JSON.parse(raw);
              if (Array.isArray(items)) {
                for (const item of items) {
                  if (item && item.id) {
                    const orgId = typeof item.organization_id === 'number' ? item.organization_id : (item.organization_id?.id || 1);
                    await db.execute(
                      `INSERT OR REPLACE INTO ${col} (id, organization_id, data, date_updated) VALUES ($1, $2, $3, datetime('now'))`,
                      [item.id, orgId, JSON.stringify(item)]
                    );
                  }
                }
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('[SqliteStorageAdapter] Auto migration note:', err);
    }
  }

  async init(): Promise<void> {
    await this.initDatabase();
  }

  isInitialized(): boolean {
    return Boolean(this.db) || this.fallbackMemoryStore.size > 0;
  }

  public async getItems<T>(col: string, orgId?: number, isExplicitEmpty = false): Promise<T[]> {
    if (isExplicitEmpty) {
      return [];
    }
    const db = await this.initDatabase();
    if (db) {
      try {
        let rows: { data: string }[];
        if (orgId) {
          rows = await db.select<{ data: string }[]>(
            `SELECT data FROM ${col} WHERE organization_id = $1 OR organization_id IS NULL OR organization_id = 0`,
            [orgId]
          );
        } else {
          rows = await db.select<{ data: string }[]>(`SELECT data FROM ${col}`);
        }
        return rows.map((r) => JSON.parse(r.data) as T);
      } catch (err) {
        console.error(`[SqliteStorageAdapter] Error querying ${col}:`, err);
      }
    }

    const list = this.fallbackMemoryStore.get(col) || [];
    if (orgId) {
      return list.filter((item: any) => {
        const itemOrgId = typeof item.organization_id === 'number' ? item.organization_id : item.organization_id?.id;
        return Number(itemOrgId) === Number(orgId) || (!itemOrgId && (Number(orgId) === 1 || !orgId)) || String(itemOrgId) === String(orgId);
      });
    }
    return list;
  }

  public async getItemById<T extends { id?: number | string }>(col: string, id: number | string): Promise<T | null> {
    const normId = normalizeId(id) || Number(id);
    const db = await this.initDatabase();
    if (db) {
      try {
        const rows = await db.select<{ data: string }[]>(
          `SELECT data FROM ${col} WHERE id = $1`,
          [normId]
        );
        if (rows.length > 0) {
          return JSON.parse(rows[0].data) as T;
        }
      } catch (err) {
        console.error(`[SqliteStorageAdapter] Error querying ${col} by id ${id}:`, err);
      }
    }
    const list = this.fallbackMemoryStore.get(col) || [];
    return (list.find((x: any) => (normalizeId(x.id) || Number(x.id)) === normId || x.id === id) as T) || null;
  }

  public async saveItem<T extends { id?: number | string; organization_id?: any }>(col: string, item: T): Promise<T> {
    const db = await this.initDatabase();
    const orgId = typeof item.organization_id === 'number' ? item.organization_id : (item.organization_id?.id || 1);
    const normId = normalizeId(item.id) || Number(item.id) || 1;

    if (db) {
      try {
        await db.execute(
          `INSERT OR REPLACE INTO ${col} (id, organization_id, data, date_updated) VALUES ($1, $2, $3, datetime('now'))`,
          [normId, orgId, JSON.stringify(item)]
        );
      } catch (err) {
        console.error(`[SqliteStorageAdapter] Error saving to ${col}:`, err);
      }
    }

    const list = this.fallbackMemoryStore.get(col) || [];
    const idx = list.findIndex((x) => (normalizeId(x.id) || Number(x.id)) === normId || x.id === item.id);
    if (idx !== -1) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    this.saveLocalStorageFallback(col, list);

    return item;
  }

  public async deleteItem(col: string, id: number | string): Promise<boolean> {
    const normId = normalizeId(id) || Number(id);
    const db = await this.initDatabase();
    if (db) {
      try {
        await db.execute(`DELETE FROM ${col} WHERE id = $1`, [normId]);
      } catch (err) {
        console.error(`[SqliteStorageAdapter] Error deleting from ${col}:`, err);
      }
    }

    const list = this.fallbackMemoryStore.get(col) || [];
    const filtered = list.filter((x) => (normalizeId(x.id) || Number(x.id)) !== normId && x.id !== id);
    this.fallbackMemoryStore.set(col, filtered);
    this.saveLocalStorageFallback(col, filtered);
    return true;
  }

  public generateUniqueId(items: { id?: number | string }[]): number {
    const maxExisting = items.reduce(
      (max, item) => (typeof item.id === 'number' && Number.isFinite(item.id) && item.id > max ? item.id : max),
      0
    );
    const now = Date.now();
    const candidate = Math.max(maxExisting + 1, now, this.lastGeneratedId + 1);
    this.lastGeneratedId = candidate;
    return candidate;
  }

  public getActiveOrgId(params?: QueryParams): number | undefined {
    if (params && params.organization_id !== undefined && params.organization_id !== null) {
      const num = Number(params.organization_id);
      if (!isNaN(num) && num > 0) return num;
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tankhor_active_org_id');
      if (saved) {
        const num = Number(saved);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return undefined;
  }

  public isExplicitEmptyOrg(params?: QueryParams): boolean {
    return Boolean(params && 'organization_id' in params && !this.getActiveOrgId(params));
  }
}
