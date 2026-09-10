import Database from '@tauri-apps/plugin-sql';
import { IStorageProvider, QueryParams, StorageMode } from './types';
import { normalizeId } from '../utils/formatters';
import {
  Organization, OrganizationUser, Category, Collection, Season, Color, SizeGroup, Size, Brand,
  Product, ProductVariant, Warehouse, WarehouseLocation, InventoryItem,
  InventoryMovement, Customer, Order, OrderItem, Supplier, PurchaseOrder,
  PurchaseOrderItem, StockTransfer, StockTransferItem, SizeGuideTemplate,
  SizeGuideMeasurement, SizeGuideValue, Subscription, SystemModule, OrganizationModule,
  ExpenseCategory, Expense, PersonTransaction, ProfitLossSummary,
  FinancialAccount, FinancialAccountType, TreasuryTransaction, TreasuryTransactionType,
  Cheque, ChequeType, ChequeStatus,
  LandedCost, LandedCostAllocation, VatReportSummary
} from '../types';
import { DEFAULT_SYSTEM_MODULES } from '../utils/license';
import { directusClient } from '../api/directus';

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
] as const;

export class SqliteStorageAdapter implements IStorageProvider {
  public mode: StorageMode = 'local_offline';

  private db: Database | null = null;
  private dbInitPromise: Promise<Database | null> | null = null;
  private fallbackMemoryStore: Map<string, any[]> = new Map();
  private lastGeneratedId = 0;

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

  private loadLocalStorageFallback() {
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

  private saveLocalStorageFallback(col: string, items: any[]) {
    this.fallbackMemoryStore.set(col, items);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`tankhor_db_${col}`, JSON.stringify(items));
      } catch {}
    }
  }

  private async autoMigrateLocalStorageToSqlite(db: Database) {
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

  private async getItems<T>(col: string, orgId?: number, isExplicitEmpty = false): Promise<T[]> {
    if (isExplicitEmpty) {
      return [];
    }
    const db = await this.initDatabase();
    if (db) {
      try {
        let rows: { data: string }[];
        if (orgId) {
          rows = await db.select<{ data: string }[]>(
            `SELECT data FROM ${col} WHERE organization_id = $1`,
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
        return Number(itemOrgId) === Number(orgId);
      });
    }
    return list;
  }

  private async getItemById<T extends { id: number }>(col: string, id: number): Promise<T | null> {
    const db = await this.initDatabase();
    if (db) {
      try {
        const rows = await db.select<{ data: string }[]>(
          `SELECT data FROM ${col} WHERE id = $1`,
          [id]
        );
        if (rows.length > 0) {
          return JSON.parse(rows[0].data) as T;
        }
      } catch (err) {
        console.error(`[SqliteStorageAdapter] Error querying ${col} by id ${id}:`, err);
      }
    }
    const list = this.fallbackMemoryStore.get(col) || [];
    return (list.find((x: any) => x.id === id) as T) || null;
  }

  private async saveItem<T extends { id: number; organization_id?: any }>(col: string, item: T): Promise<T> {
    const db = await this.initDatabase();
    const orgId = typeof item.organization_id === 'number' ? item.organization_id : (item.organization_id?.id || 1);

    if (db) {
      try {
        await db.execute(
          `INSERT OR REPLACE INTO ${col} (id, organization_id, data, date_updated) VALUES ($1, $2, $3, datetime('now'))`,
          [item.id, orgId, JSON.stringify(item)]
        );
      } catch (err) {
        console.error(`[SqliteStorageAdapter] Error saving to ${col}:`, err);
      }
    }

    const list = this.fallbackMemoryStore.get(col) || [];
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx !== -1) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    this.saveLocalStorageFallback(col, list);

    return item;
  }

  private async deleteItem(col: string, id: number): Promise<boolean> {
    const db = await this.initDatabase();
    if (db) {
      try {
        await db.execute(`DELETE FROM ${col} WHERE id = $1`, [id]);
      } catch (err) {
        console.error(`[SqliteStorageAdapter] Error deleting from ${col}:`, err);
      }
    }

    const list = this.fallbackMemoryStore.get(col) || [];
    const filtered = list.filter((x) => x.id !== id);
    this.saveLocalStorageFallback(col, filtered);
    return true;
  }

  private generateUniqueId(items: { id: number }[]): number {
    const maxExisting = items.reduce(
      (max, item) => (typeof item.id === 'number' && Number.isFinite(item.id) && item.id > max ? item.id : max),
      0
    );
    const now = Date.now();
    const candidate = Math.max(maxExisting + 1, now, this.lastGeneratedId + 1);
    this.lastGeneratedId = candidate;
    return candidate;
  }

  private getActiveOrgId(params?: QueryParams): number | undefined {
    if (params && 'organization_id' in params) {
      if (params.organization_id !== undefined && params.organization_id !== null) {
        const num = Number(params.organization_id);
        if (!isNaN(num) && num > 0) return num;
      }
      return undefined;
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

  private isExplicitEmptyOrg(params?: QueryParams): boolean {
    return Boolean(params && 'organization_id' in params && !this.getActiveOrgId(params));
  }

  // ==========================================
  // Organizations
  // ==========================================
  async getOrganizations(): Promise<Organization[]> {
    if (typeof window !== 'undefined') {
      const cachedUserRaw = localStorage.getItem('tankhor_cached_user_profile');
      if (cachedUserRaw) {
        try {
          const cachedUser = JSON.parse(cachedUserRaw);
          if (Array.isArray(cachedUser.organizations) && cachedUser.organizations.length > 0) {
            return cachedUser.organizations;
          }
          if (cachedUser.activeOrganization || cachedUser.active_organization) {
            return [cachedUser.activeOrganization || cachedUser.active_organization];
          }
        } catch {}
      }
    }
    return this.getItems<Organization>('organizations');
  }

  async getOrganizationById(id: number): Promise<Organization | null> {
    const list = await this.getOrganizations();
    return list.find((o) => o.id === id) || null;
  }

  async saveOrganization(org: Partial<Organization>): Promise<Organization> {
    const list = await this.getOrganizations();
    if (org.id) {
      const found = list.find((o) => Number(o.id) === Number(org.id));
      if (found) {
        const updated: Organization = { ...found, ...org, date_updated: new Date().toISOString() };
        await this.saveItem('organizations', updated);
        return updated;
      }
    }

    const newOrg: Organization = {
      id: org.id || this.generateUniqueId(list),
      name: org.name || 'سازمان جدید',
      slug: org.slug || 'new-org',
      currency: org.currency || 'TOMAN',
      timezone: org.timezone || 'Asia/Tehran',
      plan: org.plan || 'free',
      status: org.status || 'active',
      date_created: new Date().toISOString(),
      ...org,
    };
    await this.saveItem('organizations', newOrg);
    return newOrg;
  }

  // ==========================================
  // Organization Users
  // ==========================================
  async getOrganizationUsers(params?: QueryParams): Promise<OrganizationUser[]> {
    const orgId = this.getActiveOrgId(params);
    if (!orgId) {
      return [];
    }
    const list = await this.getItems<OrganizationUser>('organization_users', orgId);
    return list;
  }

  async saveOrganizationUser(ouData: Partial<OrganizationUser>): Promise<OrganizationUser> {
    const list = await this.getItems<OrganizationUser>('organization_users');
    const activeOrgId = Number(ouData.organization_id || this.getActiveOrgId());
    let saved: OrganizationUser;

    if (ouData.id) {
      const existing = list.find((ou) => ou.id === ouData.id);
      if (existing) {
        saved = { ...existing, ...ouData, organization_id: activeOrgId };
      } else {
        saved = {
          id: ouData.id,
          organization_id: activeOrgId,
          user_id: ouData.user_id || `user_${Date.now()}`,
          role: ouData.role || 'viewer',
          status: ouData.status || 'active',
          date_joined: ouData.date_joined || new Date().toISOString(),
          first_name: ouData.first_name || '',
          last_name: ouData.last_name || '',
          email: ouData.email || '',
        };
      }
    } else {
      const nextId = list.reduce((max, ou) => Math.max(max, ou.id || 0), 0) + 1;
      saved = {
        id: nextId,
        organization_id: activeOrgId,
        user_id: ouData.user_id || `user_${Date.now()}`,
        role: ouData.role || 'viewer',
        status: ouData.status || 'active',
        date_joined: new Date().toISOString(),
        first_name: ouData.first_name || '',
        last_name: ouData.last_name || '',
        email: ouData.email || '',
      };
    }

    await this.saveItem('organization_users', saved);
    return saved;
  }

  async deleteOrganizationUser(id: number): Promise<boolean> {
    return this.deleteItem('organization_users', id);
  }

  // ==========================================
  // Products & Variants
  // ==========================================
  async getProducts(params?: QueryParams): Promise<Product[]> {
    const orgId = this.getActiveOrgId(params);
    let items = await this.getItems<Product>('products', orgId);

    if (params?.search) {
      const term = params.search.toLowerCase();
      items = items.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(term);
        const brandName = typeof p.brand === 'string' ? p.brand : p.brand?.name || (typeof p.brand_id === 'object' ? (p.brand_id as any)?.name : '');
        const brandMatch = brandName ? brandName.toLowerCase().includes(term) : false;
        return titleMatch || brandMatch;
      });
    }

    const variants = await this.getItems<ProductVariant>('product_variants', orgId);
    const inventoryItems = await this.getItems<InventoryItem>('inventory_items', orgId);

    return items.map((p) => {
      const pVariants = variants.filter((v) => normalizeId(v.product_id) === p.id);
      const pVariantIds = new Set(pVariants.map((v) => normalizeId(v.id)).filter(Boolean));
      const pInventory = inventoryItems.filter((i) => {
        const vId = normalizeId(i.variant_id);
        return vId !== undefined && pVariantIds.has(vId);
      });
      const totalStock = pInventory.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      return {
        ...p,
        variants_count: pVariants.length,
        total_stock: totalStock,
      };
    });
  }

  async getProductById(id: number): Promise<Product | null> {
    const products = await this.getProducts();
    return products.find((p) => p.id === id) || null;
  }

  async saveProduct(product: Partial<Product>): Promise<Product> {
    const list = await this.getItems<Product>('products');
    const pId = normalizeId(product.id);
    let saved: Product;

    if (pId) {
      const existing = list.find((p) => normalizeId(p.id) === pId);
      if (existing) {
        saved = {
          ...existing,
          ...product,
          id: pId,
          date_updated: new Date().toISOString(),
        };
      } else {
        saved = {
          organization_id: product.organization_id || 1,
          title: product.title || '',
          slug: product.slug || `prod-${pId}`,
          status: product.status || 'published',
          date_created: new Date().toISOString(),
          ...product,
          id: pId,
        };
      }
    } else {
      const newId = this.generateUniqueId(list);
      saved = {
        organization_id: product.organization_id || 1,
        title: product.title || '',
        slug: product.slug || `prod-${newId}`,
        status: product.status || 'published',
        date_created: new Date().toISOString(),
        ...product,
        id: newId,
      };
    }

    await this.saveItem('products', saved);
    return saved;
  }

  async deleteProduct(id: number): Promise<boolean> {
    await this.deleteItem('products', id);

    const variants = await this.getItems<ProductVariant>('product_variants');
    const removedVariantIds: number[] = [];
    for (const v of variants) {
      if (normalizeId(v.product_id) === id) {
        removedVariantIds.push(v.id);
        await this.deleteItem('product_variants', v.id);
      }
    }

    const inventoryList = await this.getItems<InventoryItem>('inventory_items');
    for (const inv of inventoryList) {
      const vId = normalizeId(inv.variant_id);
      if (vId && removedVariantIds.includes(vId)) {
        await this.deleteItem('inventory_items', inv.id);
      }
    }

    return true;
  }

  async getVariants(params?: QueryParams): Promise<ProductVariant[]> {
    const orgId = this.getActiveOrgId(params);
    const items = await this.getItems<ProductVariant>('product_variants', orgId);
    const products = await this.getItems<Product>('products', orgId);
    const colors = await this.getItems<Color>('colors', orgId);
    const sizes = await this.getItems<Size>('sizes', orgId);
    const inventoryItems = await this.getItems<InventoryItem>('inventory_items', orgId);

    return items.map((v) => {
      const vNormalizedId = normalizeId(v.id);
      const prodId = normalizeId(v.product_id);
      const colorId = normalizeId(v.color_id);
      const sizeId = normalizeId(v.size_id);

      const prod = products.find((p) => p.id === prodId);
      const color = colors.find((c) => c.id === colorId);
      const size = sizes.find((s) => s.id === sizeId);

      const vInv = inventoryItems.filter((i) => normalizeId(i.variant_id) === vNormalizedId);
      const totalStock = vInv.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      return {
        ...v,
        id: vNormalizedId || v.id,
        product_id: prodId || v.product_id,
        color_id: colorId,
        size_id: sizeId,
        product_title: prod?.title || v.product_title || 'محصول',
        color_name: color?.name || v.color_name || '-',
        size_name: size?.name || v.size_name || '-',
        stock_quantity: totalStock,
      };
    });
  }

  async getVariantsByProductId(productId: number): Promise<ProductVariant[]> {
    const all = await this.getVariants();
    return all.filter((v) => normalizeId(v.product_id) === productId);
  }

  async saveVariant(variant: Partial<ProductVariant>, warehouseId?: number, locationId?: number): Promise<ProductVariant> {
    const list = await this.getItems<ProductVariant>('product_variants');
    let saved: ProductVariant;
    const vId = normalizeId(variant.id);
    const colorId = normalizeId(variant.color_id);
    const sizeId = normalizeId(variant.size_id);
    const productId = normalizeId(variant.product_id);

    if (vId) {
      const existing = list.find((v) => normalizeId(v.id) === vId);
      if (existing) {
        saved = {
          ...existing,
          ...variant,
          id: vId,
          product_id: productId || existing.product_id,
          color_id: colorId,
          size_id: sizeId,
          date_updated: new Date().toISOString(),
        };
      } else {
        saved = {
          organization_id: variant.organization_id || 1,
          product_id: productId || 0,
          color_id: colorId,
          size_id: sizeId,
          sku: variant.sku || `SKU-${Date.now().toString().slice(-6)}`,
          status: 'published',
          ...variant,
          id: vId,
        };
      }
    } else {
      const newVarId = this.generateUniqueId(list);
      saved = {
        organization_id: variant.organization_id || 1,
        product_id: productId || 0,
        color_id: colorId,
        size_id: sizeId,
        sku: variant.sku || `SKU-${Date.now().toString().slice(-6)}`,
        status: 'published',
        date_created: new Date().toISOString(),
        ...variant,
        id: newVarId,
      };
    }

    await this.saveItem('product_variants', saved);

    if (variant.stock_quantity !== undefined && variant.stock_quantity !== null) {
      const inventoryList = await this.getItems<InventoryItem>('inventory_items');
      const qtyNum = Math.max(0, Number(variant.stock_quantity) || 0);

      const warehouses = await this.getItems<Warehouse>('warehouses');
      let targetWarehouseId = warehouseId;
      if (!targetWarehouseId || !warehouses.some((w) => w.id === targetWarehouseId)) {
        if (warehouses.length > 0) {
          targetWarehouseId = warehouses[0].id;
        } else {
          const defaultWarehouse = await this.saveWarehouse({
            name: 'انبار مرکزی',
            code: 'MAIN-WH',
            type: 'warehouse',
            status: 'active',
            organization_id: variant.organization_id || 1,
          });
          targetWarehouseId = defaultWarehouse.id;
        }
      }

      const invItem = inventoryList.find((i) => normalizeId(i.variant_id) === saved.id && i.warehouse_id === targetWarehouseId);
      if (invItem) {
        const oldQty = invItem.quantity || 0;
        await this.saveItem('inventory_items', { ...invItem, quantity: qtyNum });
        if (qtyNum !== oldQty) {
          await this.recordMovement({
            organization_id: variant.organization_id || 1,
            variant_id: saved.id,
            warehouse_id: targetWarehouseId,
            type: 'adjustment',
            quantity: Math.abs(qtyNum - oldQty),
            reference_type: 'manual',
          });
        }
      } else {
        const newInvId = this.generateUniqueId(inventoryList);
        await this.saveItem('inventory_items', {
          id: newInvId,
          organization_id: variant.organization_id || 1,
          variant_id: saved.id,
          warehouse_id: targetWarehouseId,
          location_id: locationId || undefined,
          quantity: qtyNum,
          reserved_quantity: 0,
        });
        if (qtyNum > 0) {
          await this.recordMovement({
            organization_id: variant.organization_id || 1,
            variant_id: saved.id,
            warehouse_id: targetWarehouseId,
            type: 'purchase',
            quantity: qtyNum,
            reference_type: 'manual',
          });
        }
      }
    }

    return saved;
  }

  async deleteVariant(id: number): Promise<boolean> {
    await this.deleteItem('product_variants', id);
    const inventoryList = await this.getItems<InventoryItem>('inventory_items');
    for (const inv of inventoryList) {
      if (normalizeId(inv.variant_id) === id) {
        await this.deleteItem('inventory_items', inv.id);
      }
    }
    return true;
  }

  // ==========================================
  // Catalog Attributes
  // ==========================================
  async getCategories(params?: QueryParams): Promise<Category[]> {
    return this.getItems<Category>('categories', this.getActiveOrgId(params));
  }
  async saveCategory(cat: Partial<Category>): Promise<Category> {
    const list = await this.getItems<Category>('categories');
    const validId = typeof cat.id === 'number' && cat.id > 0 ? cat.id : this.generateUniqueId(list);
    const saved: Category = {
      name: cat.name || 'دسته‌بندی جدید',
      slug: cat.slug || `cat-${validId}`,
      status: 'active',
      organization_id: cat.organization_id || 1,
      ...cat,
      id: validId,
    };
    await this.saveItem('categories', saved);
    return saved;
  }
  async deleteCategory(id: number): Promise<boolean> {
    return this.deleteItem('categories', id);
  }

  async getCollections(params?: QueryParams): Promise<Collection[]> {
    return this.getItems<Collection>('collections', this.getActiveOrgId(params));
  }
  async saveCollection(col: Partial<Collection>): Promise<Collection> {
    const list = await this.getItems<Collection>('collections');
    const validId = typeof col.id === 'number' && col.id > 0 ? col.id : this.generateUniqueId(list);
    const saved: Collection = {
      name: col.name || 'کالکشن جدید',
      slug: col.slug || `col-${validId}`,
      status: 'active',
      organization_id: col.organization_id || 1,
      ...col,
      id: validId,
    };
    await this.saveItem('collections', saved);
    return saved;
  }
  async deleteCollection(id: number): Promise<boolean> {
    return this.deleteItem('collections', id);
  }

  async getBrands(params?: QueryParams): Promise<Brand[]> {
    return this.getItems<Brand>('brands', this.getActiveOrgId(params));
  }
  async saveBrand(brand: Partial<Brand>): Promise<Brand> {
    const list = await this.getItems<Brand>('brands');
    const validId = typeof brand.id === 'number' && brand.id > 0 ? brand.id : this.generateUniqueId(list);
    const saved: Brand = {
      name: brand.name || 'برند جدید',
      status: 'active',
      organization_id: brand.organization_id || 1,
      ...brand,
      id: validId,
    };
    await this.saveItem('brands', saved);
    return saved;
  }
  async deleteBrand(id: number): Promise<boolean> {
    return this.deleteItem('brands', id);
  }

  async getSeasons(params?: QueryParams): Promise<Season[]> {
    return this.getItems<Season>('seasons', this.getActiveOrgId(params));
  }
  async saveSeason(season: Partial<Season>): Promise<Season> {
    const list = await this.getItems<Season>('seasons');
    const validId = typeof season.id === 'number' && season.id > 0 ? season.id : this.generateUniqueId(list);
    const saved: Season = {
      name: season.name || 'فصل جدید',
      status: 'active',
      organization_id: season.organization_id || 1,
      ...season,
      id: validId,
    };
    await this.saveItem('seasons', saved);
    return saved;
  }
  async deleteSeason(id: number): Promise<boolean> {
    return this.deleteItem('seasons', id);
  }

  async getColors(params?: QueryParams): Promise<Color[]> {
    return this.getItems<Color>('colors', this.getActiveOrgId(params));
  }
  async saveColor(color: Partial<Color>): Promise<Color> {
    const list = await this.getItems<Color>('colors');
    const validId = typeof color.id === 'number' && color.id > 0 ? color.id : this.generateUniqueId(list);
    const saved: Color = {
      name: color.name || 'رنگ جدید',
      hex: color.hex || '#000000',
      status: 'active',
      organization_id: color.organization_id || 1,
      ...color,
      id: validId,
    };
    await this.saveItem('colors', saved);
    return saved;
  }
  async deleteColor(id: number): Promise<boolean> {
    return this.deleteItem('colors', id);
  }

  async getSizeGroups(params?: QueryParams): Promise<SizeGroup[]> {
    return this.getItems<SizeGroup>('size_groups', this.getActiveOrgId(params));
  }
  async saveSizeGroup(group: Partial<SizeGroup>): Promise<SizeGroup> {
    const list = await this.getItems<SizeGroup>('size_groups');
    const validId = typeof group.id === 'number' && group.id > 0 ? group.id : this.generateUniqueId(list);
    const saved: SizeGroup = {
      name: group.name || 'گروه سایز جدید',
      category: group.category || 'apparel',
      status: 'active',
      organization_id: group.organization_id || 1,
      ...group,
      id: validId,
    };
    await this.saveItem('size_groups', saved);
    return saved;
  }
  async deleteSizeGroup(id: number): Promise<boolean> {
    return this.deleteItem('size_groups', id);
  }

  async getSizes(params?: QueryParams): Promise<Size[]> {
    return this.getItems<Size>('sizes', this.getActiveOrgId(params));
  }
  async saveSize(size: Partial<Size>): Promise<Size> {
    const list = await this.getItems<Size>('sizes');
    const validId = typeof size.id === 'number' && size.id > 0 ? size.id : this.generateUniqueId(list);
    const saved: Size = {
      name: size.name || 'سایز جدید',
      status: 'active',
      organization_id: size.organization_id || 1,
      ...size,
      id: validId,
    };
    await this.saveItem('sizes', saved);
    return saved;
  }
  async deleteSize(id: number): Promise<boolean> {
    return this.deleteItem('sizes', id);
  }

  // ==========================================
  // Warehouses & Locations
  // ==========================================
  async getWarehouses(params?: QueryParams): Promise<Warehouse[]> {
    return this.getItems<Warehouse>('warehouses', this.getActiveOrgId(params));
  }
  async saveWarehouse(wh: Partial<Warehouse>): Promise<Warehouse> {
    const list = await this.getItems<Warehouse>('warehouses');
    const validId = typeof wh.id === 'number' && wh.id > 0 ? wh.id : this.generateUniqueId(list);
    const saved: Warehouse = {
      name: wh.name || 'انبار جدید',
      type: wh.type || 'warehouse',
      status: 'active',
      organization_id: wh.organization_id || 1,
      ...wh,
      id: validId,
    };
    await this.saveItem('warehouses', saved);
    return saved;
  }
  async deleteWarehouse(id: number): Promise<boolean> {
    return this.deleteItem('warehouses', id);
  }

  async getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    const list = await this.getItems<WarehouseLocation>('warehouse_locations');
    if (params?.warehouse_id) {
      return list.filter((l) => {
        const wId = typeof l.warehouse_id === 'number' ? l.warehouse_id : (l.warehouse_id as any)?.id;
        return wId === params.warehouse_id;
      });
    }
    return list;
  }
  async getLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.getWarehouseLocations(params);
  }
  async getLocationsByWarehouseId(warehouseId: number): Promise<WarehouseLocation[]> {
    return this.getWarehouseLocations({ warehouse_id: warehouseId });
  }
  async saveWarehouseLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    const list = await this.getItems<WarehouseLocation>('warehouse_locations');
    const validId = typeof loc.id === 'number' && loc.id > 0 ? loc.id : this.generateUniqueId(list);
    const saved: WarehouseLocation = {
      name: loc.name || 'موقعیت جدید',
      warehouse_id: loc.warehouse_id || 1,
      type: loc.type || 'rack',
      status: 'active',
      ...loc,
      id: validId,
    };
    await this.saveItem('warehouse_locations', saved);
    return saved;
  }
  async saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.saveWarehouseLocation(loc);
  }
  async deleteWarehouseLocation(id: number): Promise<boolean> {
    return this.deleteItem('warehouse_locations', id);
  }

  // ==========================================
  // Inventory & Movements
  // ==========================================
  async getInventoryItems(params?: QueryParams): Promise<InventoryItem[]> {
    const orgId = this.getActiveOrgId(params);
    let items = await this.getItems<InventoryItem>('inventory_items', orgId);
    if (params?.warehouse_id) {
      items = items.filter((i) => {
        const wId = typeof i.warehouse_id === 'number' ? i.warehouse_id : (i.warehouse_id as any)?.id;
        return wId === params.warehouse_id;
      });
    }
    if (params?.variant_id) {
      items = items.filter((i) => {
        const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
        return vId === params.variant_id;
      });
    }

    const variants = await this.getItems<ProductVariant>('product_variants', orgId);
    const products = await this.getItems<Product>('products', orgId);
    const colors = await this.getItems<Color>('colors', orgId);
    const sizes = await this.getItems<Size>('sizes', orgId);
    const warehouses = await this.getItems<Warehouse>('warehouses', orgId);
    const locations = await this.getItems<WarehouseLocation>('warehouse_locations');

    return items.map((item) => {
      const vId = typeof item.variant_id === 'number' ? item.variant_id : (item.variant_id as any)?.id;
      const wId = typeof item.warehouse_id === 'number' ? item.warehouse_id : (item.warehouse_id as any)?.id;
      const locId = typeof item.location_id === 'number' ? item.location_id : (item.location_id as any)?.id;

      const variant = variants.find((v) => v.id === vId);
      const prodId = variant ? (typeof variant.product_id === 'number' ? variant.product_id : (variant.product_id as any)?.id) : null;
      const product = prodId ? products.find((p) => p.id === prodId) : null;

      const colorId = variant ? (typeof variant.color_id === 'number' ? variant.color_id : (variant.color_id as any)?.id) : null;
      const sizeId = variant ? (typeof variant.size_id === 'number' ? variant.size_id : (variant.size_id as any)?.id) : null;

      const color = colorId ? colors.find((c) => c.id === colorId) : null;
      const size = sizeId ? sizes.find((s) => s.id === sizeId) : null;
      const warehouse = warehouses.find((w) => w.id === wId);
      const location = locations.find((l) => l.id === locId);

      return {
        ...item,
        sku: variant?.sku || (vId ? `SKU-${vId}` : '-'),
        product_title: product?.title || 'محصول',
        color_name: color?.name || '-',
        size_name: size?.name || '-',
        warehouse_name: warehouse?.name || 'انبار مرکزی',
        location_name: location?.name || '-',
      };
    });
  }

  async saveInventoryItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    const list = await this.getItems<InventoryItem>('inventory_items');
    const validId = typeof item.id === 'number' && item.id > 0 ? item.id : this.generateUniqueId(list);
    const qty = Math.max(0, Number(item.quantity) || 0);
    const reserved = Math.max(0, Number(item.reserved_quantity) || 0);
    const damaged = Math.max(0, Number(item.damaged_quantity) || 0);
    const available = Math.max(0, qty - reserved - damaged);

    const saved: InventoryItem = {
      variant_id: item.variant_id || 0,
      warehouse_id: item.warehouse_id || 1,
      quantity: qty,
      reserved_quantity: reserved,
      damaged_quantity: damaged,
      available_quantity: available,
      organization_id: item.organization_id || 1,
      ...item,
      id: validId,
    };
    await this.saveItem('inventory_items', saved);
    return saved;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    return this.deleteItem('inventory_items', id);
  }

  async getInventoryMovements(params?: QueryParams): Promise<InventoryMovement[]> {
    const orgId = this.getActiveOrgId(params);
    let items = await this.getItems<InventoryMovement>('inventory_movements', orgId);
    if (params?.warehouse_id) {
      items = items.filter((m) => {
        const wId = typeof m.warehouse_id === 'number' ? m.warehouse_id : (m.warehouse_id as any)?.id;
        return wId === params.warehouse_id;
      });
    }
    if (params?.variant_id) {
      items = items.filter((m) => {
        const vId = typeof m.variant_id === 'number' ? m.variant_id : (m.variant_id as any)?.id;
        return vId === params.variant_id;
      });
    }
    if (params?.type) {
      items = items.filter((m) => m.type === params.type);
    }
    return items;
  }

  async recordMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    const list = await this.getItems<InventoryMovement>('inventory_movements');
    const validId = typeof movement.id === 'number' && movement.id > 0 ? movement.id : this.generateUniqueId(list);
    const saved: InventoryMovement = {
      organization_id: movement.organization_id || 1,
      variant_id: movement.variant_id || 1,
      warehouse_id: movement.warehouse_id || 1,
      type: movement.type || 'adjustment',
      quantity: Math.max(0, Number(movement.quantity) || 1),
      reference_type: movement.reference_type || 'manual',
      created_at: new Date().toISOString(),
      ...movement,
      id: validId,
    };
    await this.saveItem('inventory_movements', saved);
    return saved;
  }

  // ==========================================
  // Orders & Sales
  // ==========================================
  async getOrders(params?: QueryParams): Promise<Order[]> {
    return this.getItems<Order>('orders', this.getActiveOrgId(params));
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    const all = await this.getItems<OrderItem>('order_items');
    return all.filter((i) => {
      const itemOrderId = typeof i.order_id === 'object' ? (i.order_id as any)?.id : i.order_id;
      return Number(itemOrderId) === Number(orderId);
    });
  }

  async saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    const list = await this.getItems<Order>('orders');
    const validId = typeof order.id === 'number' && order.id > 0 ? order.id : this.generateUniqueId(list);
    const savedOrder: Order = {
      warehouse_id: order.warehouse_id || 1,
      order_number: order.order_number || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      status: order.status || 'draft',
      payment_status: order.payment_status || 'pending',
      currency: 'TOMAN',
      subtotal: order.subtotal || 0,
      discount: order.discount || 0,
      tax: order.tax || 0,
      total: order.total || 0,
      date_created: new Date().toISOString(),
      organization_id: order.organization_id || 1,
      ...order,
      id: validId,
    };
    await this.saveItem('orders', savedOrder);

    if (items && Array.isArray(items) && items.length > 0) {
      const allOrderItems = await this.getItems<OrderItem>('order_items');
      for (const itm of items) {
        const itmId = typeof itm.id === 'number' && itm.id > 0 ? itm.id : this.generateUniqueId(allOrderItems);
        const savedItem: OrderItem = {
          variant_id: itm.variant_id || 1,
          quantity: itm.quantity || 1,
          unit_price: itm.unit_price || 0,
          discount: itm.discount || 0,
          total: itm.total || ((itm.quantity || 1) * (itm.unit_price || 0)),
          created_at: new Date().toISOString(),
          ...itm,
          id: itmId,
          order_id: validId,
          organization_id: savedOrder.organization_id || 1,
        };
        await this.saveItem('order_items', savedItem);
      }
    }

    return savedOrder;
  }

  async deleteOrder(id: number): Promise<boolean> {
    await this.deleteItem('orders', id);
    const allOrderItems = await this.getItems<OrderItem>('order_items');
    for (const itm of allOrderItems) {
      const itemOrderId = typeof itm.order_id === 'object' ? (itm.order_id as any)?.id : itm.order_id;
      if (Number(itemOrderId) === Number(id)) {
        await this.deleteItem('order_items', itm.id);
      }
    }
    return true;
  }

  // ==========================================
  // Customers
  // ==========================================
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    return this.getItems<Customer>('customers', this.getActiveOrgId(params));
  }
  async saveCustomer(cust: Partial<Customer>): Promise<Customer> {
    const list = await this.getItems<Customer>('customers');
    const validId = typeof cust.id === 'number' && cust.id > 0 ? cust.id : this.generateUniqueId(list);
    const saved: Customer = {
      name: cust.name || 'مشتری جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      organization_id: cust.organization_id || 1,
      ...cust,
      id: validId,
    };
    await this.saveItem('customers', saved);
    return saved;
  }
  async deleteCustomer(id: number): Promise<boolean> {
    return this.deleteItem('customers', id);
  }

  // ==========================================
  // Suppliers & Purchasing
  // ==========================================
  async getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    return this.getItems<Supplier>('suppliers', this.getActiveOrgId(params));
  }
  async saveSupplier(sup: Partial<Supplier>): Promise<Supplier> {
    const list = await this.getItems<Supplier>('suppliers');
    const validId = typeof sup.id === 'number' && sup.id > 0 ? sup.id : this.generateUniqueId(list);
    const saved: Supplier = {
      name: sup.name || 'تامین‌کننده جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      organization_id: sup.organization_id || 1,
      ...sup,
      id: validId,
    };
    await this.saveItem('suppliers', saved);
    return saved;
  }
  async deleteSupplier(id: number): Promise<boolean> {
    return this.deleteItem('suppliers', id);
  }

  async getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    return this.getItems<PurchaseOrder>('purchase_orders', this.getActiveOrgId(params));
  }
  async getPurchaseOrderItems(purchaseOrderId?: number): Promise<PurchaseOrderItem[]> {
    let items = await this.getItems<PurchaseOrderItem>('purchase_order_items');
    if (purchaseOrderId) {
      items = items.filter((it) => {
        const poId = typeof it.purchase_order_id === 'object' ? (it.purchase_order_id as any)?.id : it.purchase_order_id;
        return Number(poId) === Number(purchaseOrderId);
      });
    }
    return items;
  }
  async savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    const list = await this.getItems<PurchaseOrder>('purchase_orders');
    const validId = typeof po.id === 'number' && po.id > 0 ? po.id : this.generateUniqueId(list);
    const saved: PurchaseOrder = {
      supplier_id: po.supplier_id || 1,
      warehouse_id: po.warehouse_id || 1,
      purchase_number: po.purchase_number || `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      status: po.status || 'draft',
      currency: 'TOMAN',
      subtotal: po.subtotal || 0,
      discount: po.discount || 0,
      tax: po.tax || 0,
      total: po.total || 0,
      date_created: new Date().toISOString(),
      organization_id: po.organization_id || 1,
      ...po,
      id: validId,
    };
    await this.saveItem('purchase_orders', saved);

    if (items && Array.isArray(items) && items.length > 0) {
      const allPoItems = await this.getItems<PurchaseOrderItem>('purchase_order_items');
      for (const itm of items) {
        const itmId = typeof itm.id === 'number' && itm.id > 0 ? itm.id : this.generateUniqueId(allPoItems);
        await this.saveItem('purchase_order_items', {
          variant_id: itm.variant_id || 1,
          quantity_ordered: itm.quantity_ordered || 1,
          quantity_received: itm.quantity_received || 0,
          unit_cost: itm.unit_cost || 0,
          ...itm,
          id: itmId,
          purchase_order_id: validId,
        });
      }
    }
    return saved;
  }
  async deletePurchaseOrder(id: number): Promise<boolean> {
    await this.deleteItem('purchase_orders', id);
    const allPoItems = await this.getItems<PurchaseOrderItem>('purchase_order_items');
    for (const itm of allPoItems) {
      const poId = typeof itm.purchase_order_id === 'object' ? (itm.purchase_order_id as any)?.id : itm.purchase_order_id;
      if (Number(poId) === Number(id)) {
        await this.deleteItem('purchase_order_items', itm.id);
      }
    }
    return true;
  }

  // ==========================================
  // Stock Transfers
  // ==========================================
  async getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    return this.getItems<StockTransfer>('stock_transfers', this.getActiveOrgId(params));
  }
  async saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    const list = await this.getItems<StockTransfer>('stock_transfers');
    const validId = typeof st.id === 'number' && st.id > 0 ? st.id : this.generateUniqueId(list);
    const saved: StockTransfer = {
      from_warehouse_id: st.from_warehouse_id || 1,
      to_warehouse_id: st.to_warehouse_id || 2,
      transfer_number: st.transfer_number || `TRF-${Math.floor(1000 + Math.random() * 9000)}`,
      status: st.status || 'draft',
      date_created: new Date().toISOString(),
      organization_id: st.organization_id || 1,
      ...st,
      id: validId,
    };
    await this.saveItem('stock_transfers', saved);

    if (items && Array.isArray(items) && items.length > 0) {
      const allTransferItems = await this.getItems<StockTransferItem>('stock_transfer_items');
      for (const itm of items) {
        const itmId = typeof itm.id === 'number' && itm.id > 0 ? itm.id : this.generateUniqueId(allTransferItems);
        await this.saveItem('stock_transfer_items', {
          variant_id: itm.variant_id || 1,
          quantity: itm.quantity || 1,
          ...itm,
          id: itmId,
          transfer_id: validId,
        });
      }
    }
    return saved;
  }
  async deleteStockTransfer(id: number): Promise<boolean> {
    await this.deleteItem('stock_transfers', id);
    const allTransferItems = await this.getItems<StockTransferItem>('stock_transfer_items');
    for (const itm of allTransferItems) {
      const tId = typeof itm.transfer_id === 'object' ? (itm.transfer_id as any)?.id : itm.transfer_id;
      if (Number(tId) === Number(id)) {
        await this.deleteItem('stock_transfer_items', itm.id);
      }
    }
    return true;
  }

  // ==========================================
  // Size Guides
  // ==========================================
  async getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    return this.getItems<SizeGuideTemplate>('size_guide_templates', this.getActiveOrgId(params));
  }
  async saveSizeGuideTemplate(tpl: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    const list = await this.getItems<SizeGuideTemplate>('size_guide_templates');
    const validId = typeof tpl.id === 'number' && tpl.id > 0 ? tpl.id : this.generateUniqueId(list);
    const saved: SizeGuideTemplate = {
      name: tpl.name || 'قالب راهنمای سایز جدید',
      type: tpl.type || 'apparel',
      unit: tpl.unit || 'cm',
      status: 'active',
      date_created: new Date().toISOString(),
      organization_id: tpl.organization_id || 1,
      ...tpl,
      id: validId,
    };
    await this.saveItem('size_guide_templates', saved);
    return saved;
  }
  async deleteSizeGuideTemplate(id: number): Promise<boolean> {
    return this.deleteItem('size_guide_templates', id);
  }

  async getSizeGuideMeasurements(templateId: number): Promise<SizeGuideMeasurement[]> {
    const all = await this.getItems<SizeGuideMeasurement>('size_guide_measurements');
    return all.filter((m) => normalizeId(m.template_id) === templateId);
  }
  async saveSizeGuideMeasurement(meas: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement> {
    const list = await this.getItems<SizeGuideMeasurement>('size_guide_measurements');
    const validId = typeof meas.id === 'number' && meas.id > 0 ? meas.id : this.generateUniqueId(list);
    const saved: SizeGuideMeasurement = {
      name: meas.name || 'اندازه جدید',
      template_id: meas.template_id || 1,
      unit: meas.unit || 'cm',
      type: meas.type || 'width',
      status: 'active',
      ...meas,
      id: validId,
    };
    await this.saveItem('size_guide_measurements', saved);
    return saved;
  }
  async deleteSizeGuideMeasurement(id: number): Promise<boolean> {
    return this.deleteItem('size_guide_measurements', id);
  }

  async getSizeGuideValues(templateId: number): Promise<SizeGuideValue[]> {
    const all = await this.getItems<SizeGuideValue>('size_guide_values');
    return all.filter((v) => normalizeId(v.template_id) === templateId);
  }
  async saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue> {
    const list = await this.getItems<SizeGuideValue>('size_guide_values');
    const validId = typeof val.id === 'number' && val.id > 0 ? val.id : this.generateUniqueId(list);
    const saved: SizeGuideValue = {
      template_id: val.template_id || 1,
      size_id: val.size_id || 1,
      measurement_id: val.measurement_id || 1,
      value: val.value || 0,
      ...val,
      id: validId,
    };
    await this.saveItem('size_guide_values', saved);
    return saved;
  }
  async deleteSizeGuideValue(id: number): Promise<boolean> {
    return this.deleteItem('size_guide_values', id);
  }

  // Subscriptions
  async getSubscriptions(params?: QueryParams): Promise<Subscription[]> {
    const orgId = this.getActiveOrgId(params);
    const list = await this.getItems<Subscription>('subscriptions', orgId);
    return list.sort((a, b) => new Date(b.date_created || b.start_date || 0).getTime() - new Date(a.date_created || a.start_date || 0).getTime());
  }

  async getActiveSubscription(organizationId: number): Promise<Subscription | null> {
    const list = await this.getSubscriptions({ organization_id: organizationId });
    const now = new Date();
    for (const sub of list) {
      if (sub.end_date && new Date(sub.end_date) > now) {
        return sub;
      }
    }
    return null;
  }

  async saveSubscription(sub: Partial<Subscription>): Promise<Subscription> {
    const list = await this.getItems<Subscription>('subscriptions');
    const validId = typeof sub.id === 'number' && sub.id > 0 ? sub.id : this.generateUniqueId(list);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(sub.organization_id) });
    const saved: Subscription = {
      organization_id: orgId || 1,
      start_date: sub.start_date || new Date().toISOString(),
      end_date: sub.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      transaction_amount: sub.transaction_amount || '',
      Transaction_id: sub.Transaction_id || String(Date.now()),
      date_created: sub.date_created || new Date().toISOString(),
      ...sub,
      id: validId,
    };
    await this.saveItem('subscriptions', saved);
    return saved;
  }

  // System & Organization Modules
  async getSystemModules(params?: QueryParams): Promise<SystemModule[]> {
    try {
      // If network is available, fetch live dynamic prices & metadata from Directus
      if (typeof window !== 'undefined' && window.navigator?.onLine !== false) {
        const liveItems = await directusClient.getSystemModules(params).catch(() => []);
        if (liveItems && liveItems.length > 0) {
          for (const m of liveItems) {
            await this.saveItem('system_modules', m);
          }
          let filtered = liveItems;
          if (params?.status) {
            filtered = filtered.filter((m) => m.status === params.status);
          }
          return filtered;
        }
      }
    } catch {
      // offline fallback to SQLite cache
    }

    let list = await this.getItems<SystemModule>('system_modules');
    if (!list || list.length === 0) {
      list = [...DEFAULT_SYSTEM_MODULES];
      for (const m of list) {
        await this.saveItem('system_modules', m);
      }
    }
    if (params?.status) {
      list = list.filter((m) => m.status === params.status);
    }
    return list;
  }

  async getOrganizationModules(params?: QueryParams): Promise<OrganizationModule[]> {
    const orgId = this.getActiveOrgId(params);
    let list = await this.getItems<OrganizationModule>('organization_modules', orgId);
    if (params?.status) {
      list = list.filter((m) => m.status === params.status);
    }
    return list;
  }

  async saveOrganizationModule(mod: Partial<OrganizationModule>): Promise<OrganizationModule> {
    const list = await this.getItems<OrganizationModule>('organization_modules');
    const validId = typeof mod.id === 'number' && mod.id > 0 ? mod.id : this.generateUniqueId(list);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(mod.organization_id) });

    const existing = list.find(
      (m) => normalizeId(m.organization_id) === (orgId || 1) && m.slug === mod.slug
    );

    const saved: OrganizationModule = {
      organization_id: orgId || 1,
      slug: mod.slug || 'barcode',
      module_id: mod.module_id || 1,
      license_type: mod.license_type || 'lifetime',
      status: mod.status || 'active',
      license_token: mod.license_token || null,
      hardware_id: mod.hardware_id || null,
      starts_at: mod.starts_at || new Date().toISOString(),
      expires_at: mod.expires_at || null,
      ...existing,
      ...mod,
      id: existing ? existing.id : validId,
    };

    await this.saveItem('organization_modules', saved);
    return saved;
  }

  async deleteOrganizationModule(id: number): Promise<boolean> {
    return this.deleteItem('organization_modules', id);
  }

  // ==========================================
  // Accounting & Financials (Phase 1)
  // ==========================================

  private getDefaultExpenseCategories(orgId: number): ExpenseCategory[] {
    const defaults = [
      { title: 'اجاره محل و دفتر', code: 'EXP-101', icon: 'Building' },
      { title: 'حقوق و دستمزد پرسنل', code: 'EXP-102', icon: 'Users' },
      { title: 'حمل، نقل و باربری', code: 'EXP-103', icon: 'Truck' },
      { title: 'تبلیغات و بازاریابی', code: 'EXP-104', icon: 'Megaphone' },
      { title: 'ملزومات، بسته بندی و کارتن', code: 'EXP-105', icon: 'Package' },
      { title: 'قبوض آب، برق، گاز و اینترنت', code: 'EXP-106', icon: 'Zap' },
      { title: 'پذیرایی و ملزومات مصرفی', code: 'EXP-107', icon: 'Coffee' },
      { title: 'سایر هزینه‌های عمومی', code: 'EXP-199', icon: 'HelpCircle' },
    ];
    const now = new Date().toISOString();
    return defaults.map((d, index) => ({
      id: index + 1,
      organization_id: orgId,
      title: d.title,
      code: d.code,
      icon: d.icon,
      status: 'active' as const,
      date_created: now,
    }));
  }

  async getExpenseCategories(params?: QueryParams): Promise<ExpenseCategory[]> {
    const orgId = this.getActiveOrgId(params) || 1;
    let items = await this.getItems<ExpenseCategory>('expense_categories', orgId);

    if (items.length === 0) {
      const defaults = this.getDefaultExpenseCategories(orgId);
      for (const cat of defaults) {
        await this.saveItem('expense_categories', cat);
      }
      items = defaults;
    }

    if (params?.status) {
      items = items.filter((c) => c.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((c) => c.title.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q)));
    }
    return items;
  }

  async saveExpenseCategory(cat: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    const list = await this.getItems<ExpenseCategory>('expense_categories');
    const validId = typeof cat.id === 'number' && cat.id > 0 ? cat.id : this.generateUniqueId(list);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(cat.organization_id) }) || 1;

    const saved: ExpenseCategory = {
      id: validId,
      organization_id: orgId,
      title: cat.title || 'سرفصل جدید',
      code: cat.code || `EXP-${Math.floor(100 + Math.random() * 900)}`,
      icon: cat.icon || 'Tag',
      status: cat.status || 'active',
      date_created: new Date().toISOString(),
      ...cat,
    };

    await this.saveItem('expense_categories', saved);
    return saved;
  }

  async deleteExpenseCategory(id: number): Promise<boolean> {
    return this.deleteItem('expense_categories', id);
  }

  async getExpenses(params?: QueryParams): Promise<Expense[]> {
    const orgId = this.getActiveOrgId(params) || 1;
    let items = await this.getItems<Expense>('expenses', orgId);
    const categories = await this.getExpenseCategories({ organization_id: orgId });

    const enriched = items.map((exp) => {
      const catId = typeof exp.category_id === 'number' ? exp.category_id : (exp.category_id as any)?.id;
      const cat = categories.find((c) => c.id === catId);
      return {
        ...exp,
        category_title: cat?.title || exp.category_title || 'سایر هزینه‌ها',
        category_code: cat?.code || exp.category_code,
        category_icon: cat?.icon || exp.category_icon || 'Receipt',
      };
    });

    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((e) => e.title.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q)));
    }
    if (params?.category_id) {
      return enriched.filter((e) => {
        const catId = typeof e.category_id === 'number' ? e.category_id : (e.category_id as any)?.id;
        return Number(catId) === Number(params.category_id);
      });
    }

    return enriched;
  }

  async saveExpense(exp: Partial<Expense>): Promise<Expense> {
    const list = await this.getItems<Expense>('expenses');
    const validId = typeof exp.id === 'number' && exp.id > 0 ? exp.id : this.generateUniqueId(list);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(exp.organization_id) }) || 1;

    const saved: Expense = {
      id: validId,
      organization_id: orgId,
      category_id: exp.category_id || 1,
      title: exp.title || 'هزینه جدید',
      amount: Math.max(0, Number(exp.amount) || 0),
      expense_date: exp.expense_date || new Date().toISOString(),
      payment_method: exp.payment_method || 'cash',
      notes: exp.notes || '',
      date_created: new Date().toISOString(),
      ...exp,
    };

    await this.saveItem('expenses', saved);
    return saved;
  }

  async deleteExpense(id: number): Promise<boolean> {
    return this.deleteItem('expenses', id);
  }

  async getPersonTransactions(params?: QueryParams): Promise<PersonTransaction[]> {
    const orgId = this.getActiveOrgId(params) || 1;
    let items = await this.getItems<PersonTransaction>('person_transactions', orgId);

    const customers = await this.getCustomers({ organization_id: orgId });
    const suppliers = await this.getSuppliers({ organization_id: orgId });
    const orders = await this.getOrders({ organization_id: orgId });
    const purchaseOrders = await this.getPurchaseOrders({ organization_id: orgId });

    const enriched = items.map((tx) => {
      let partyName = tx.party_name || '';
      if (!partyName) {
        if (tx.party_type === 'customer' && tx.customer_id) {
          const cId = typeof tx.customer_id === 'number' ? tx.customer_id : (tx.customer_id as any)?.id;
          const cust = customers.find((c) => c.id === cId);
          partyName = cust?.name || `مشتری #${cId}`;
        } else if (tx.party_type === 'supplier' && tx.supplier_id) {
          const sId = typeof tx.supplier_id === 'number' ? tx.supplier_id : (tx.supplier_id as any)?.id;
          const sup = suppliers.find((s) => s.id === sId);
          partyName = sup?.name || `تامین‌کننده #${sId}`;
        }
      }

      let orderNumber = tx.order_number;
      if (!orderNumber && tx.order_id) {
        const oId = typeof tx.order_id === 'number' ? tx.order_id : (tx.order_id as any)?.id;
        const ord = orders.find((o) => o.id === oId);
        orderNumber = ord?.order_number;
      }

      let purchaseNumber = tx.purchase_number;
      if (!purchaseNumber && tx.purchase_order_id) {
        const pId = typeof tx.purchase_order_id === 'number' ? tx.purchase_order_id : (tx.purchase_order_id as any)?.id;
        const po = purchaseOrders.find((p) => p.id === pId);
        purchaseNumber = po?.purchase_number;
      }

      return {
        ...tx,
        party_name: partyName,
        order_number: orderNumber,
        purchase_number: purchaseNumber,
      };
    });

    if (params?.type) {
      return enriched.filter((tx) => tx.party_type === params.type || tx.type === params.type);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((tx) => (tx.party_name && tx.party_name.toLowerCase().includes(q)) || (tx.description && tx.description.toLowerCase().includes(q)) || (tx.reference_number && tx.reference_number.toLowerCase().includes(q)));
    }

    return enriched;
  }

  async savePersonTransaction(tx: Partial<PersonTransaction>): Promise<PersonTransaction> {
    const list = await this.getItems<PersonTransaction>('person_transactions');
    const validId = typeof tx.id === 'number' && tx.id > 0 ? tx.id : this.generateUniqueId(list);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(tx.organization_id) }) || 1;

    const saved: PersonTransaction = {
      id: validId,
      organization_id: orgId,
      party_type: tx.party_type || 'customer',
      customer_id: tx.customer_id || null,
      supplier_id: tx.supplier_id || null,
      type: tx.type || 'debtor',
      transaction_type: tx.transaction_type || 'cash_payment',
      amount: Math.max(0, Number(tx.amount) || 0),
      transaction_date: tx.transaction_date || new Date().toISOString(),
      status: tx.status || 'cleared',
      reference_number: tx.reference_number || `TX-${Math.floor(1000 + Math.random() * 9000)}`,
      description: tx.description || '',
      date_created: new Date().toISOString(),
      ...tx,
    };

    await this.saveItem('person_transactions', saved);

    // Auto-recalculate customer / supplier balance
    if (saved.party_type === 'customer' && saved.customer_id) {
      const cId = typeof saved.customer_id === 'number' ? saved.customer_id : (saved.customer_id as any)?.id;
      const customers = await this.getCustomers();
      const customer = customers.find((c) => c.id === cId);
      if (customer) {
        const allTxs = await this.getItems<PersonTransaction>('person_transactions');
        const partyTxs = allTxs.filter((t) => {
          const tCId = typeof t.customer_id === 'number' ? t.customer_id : (t.customer_id as any)?.id;
          return t.party_type === 'customer' && tCId === cId && t.status !== 'cancelled';
        });
        const currentBalance = partyTxs.reduce((sum, t) => {
          const amt = Number(t.amount) || 0;
          return t.type === 'debtor' ? sum + amt : sum - amt;
        }, 0);
        customer.balance = currentBalance;
        await this.saveCustomer(customer);
      }
    } else if (saved.party_type === 'supplier' && saved.supplier_id) {
      const sId = typeof saved.supplier_id === 'number' ? saved.supplier_id : (saved.supplier_id as any)?.id;
      const suppliers = await this.getSuppliers();
      const supplier = suppliers.find((s) => s.id === sId);
      if (supplier) {
        const allTxs = await this.getItems<PersonTransaction>('person_transactions');
        const partyTxs = allTxs.filter((t) => {
          const tSId = typeof t.supplier_id === 'number' ? t.supplier_id : (t.supplier_id as any)?.id;
          return t.party_type === 'supplier' && tSId === sId && t.status !== 'cancelled';
        });
        const currentBalance = partyTxs.reduce((sum, t) => {
          const amt = Number(t.amount) || 0;
          return t.type === 'creditor' ? sum + amt : sum - amt;
        }, 0);
        supplier.balance = currentBalance;
        await this.saveSupplier(supplier);
      }
    }

    return saved;
  }

  async deletePersonTransaction(id: number): Promise<boolean> {
    return this.deleteItem('person_transactions', id);
  }

  async getProfitLossSummary(params?: QueryParams): Promise<ProfitLossSummary> {
    const orgId = this.getActiveOrgId(params) || 1;
    const orders = await this.getOrders({ organization_id: orgId });
    const orderItems = await this.getItems<OrderItem>('order_items');
    const variants = await this.getVariants({ organization_id: orgId });
    const expenses = await this.getExpenses({ organization_id: orgId });
    const categories = await this.getExpenseCategories({ organization_id: orgId });

    const validOrders = orders.filter((o) => o.status !== 'cancelled');
    const totalRevenue = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    let totalCogs = 0;
    validOrders.forEach((o) => {
      const items = orderItems.filter((it) => {
        const itOrderId = typeof it.order_id === 'object' ? (it.order_id as any)?.id : it.order_id;
        return Number(itOrderId) === Number(o.id);
      });
      items.forEach((it) => {
        const vId = typeof it.variant_id === 'object' ? (it.variant_id as any)?.id : it.variant_id;
        const variant = variants.find((v) => v.id === Number(vId));
        const unitCost = Number(variant?.cost) || 0;
        const qty = Number(it.quantity) || 1;
        totalCogs += unitCost * qty;
      });
    });

    const grossProfit = totalRevenue - totalCogs;
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const catMap = new Map<number, { title: string; amount: number }>();
    categories.forEach((c) => {
      catMap.set(c.id, { title: c.title, amount: 0 });
    });
    expenses.forEach((e) => {
      const cId = typeof e.category_id === 'number' ? e.category_id : (e.category_id as any)?.id || 1;
      const existing = catMap.get(cId) || { title: e.category_title || 'سایر', amount: 0 };
      existing.amount += Number(e.amount) || 0;
      catMap.set(cId, existing);
    });

    const expensesByCategory = Array.from(catMap.entries())
      .map(([catId, data]) => ({
        categoryId: catId,
        title: data.title,
        amount: data.amount,
        percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
      }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period: params?.type || 'all',
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMarginPercent,
      totalExpenses,
      expensesByCategory,
      netProfit,
      netMarginPercent,
      ordersCount: validOrders.length,
      expensesCount: expenses.length,
    };
  }

  // ==========================================
  // Phase 2: Financial Accounts & Treasury
  // ==========================================

  private getDefaultFinancialAccounts(orgId: number): FinancialAccount[] {
    const now = new Date().toISOString();
    return [
      {
        id: 1,
        organization_id: orgId,
        name: 'صندوق نقدی مرکزی',
        type: 'cashbox',
        initial_balance: 0,
        current_balance: 0,
        is_default: true,
        status: 'active',
        date_created: now,
      },
      {
        id: 2,
        organization_id: orgId,
        name: 'حساب جاری بانک ملت',
        type: 'bank',
        bank_name: 'بانک ملت',
        account_number: '1234567890',
        card_number: '6104337890123456',
        shaba_number: 'IR120120000000012345678901',
        initial_balance: 0,
        current_balance: 0,
        is_default: false,
        status: 'active',
        date_created: now,
      },
      {
        id: 3,
        organization_id: orgId,
        name: 'کارتخوان فروشگاه (POS)',
        type: 'pos',
        bank_name: 'به‌پرداخت ملت',
        pos_terminal_id: '99887766',
        initial_balance: 0,
        current_balance: 0,
        is_default: false,
        status: 'active',
        date_created: now,
      },
    ];
  }

  async getFinancialAccounts(params?: QueryParams): Promise<FinancialAccount[]> {
    const orgId = this.getActiveOrgId(params) || 1;
    let items = await this.getItems<FinancialAccount>('financial_accounts', orgId);

    if (items.length === 0) {
      const defaults = this.getDefaultFinancialAccounts(orgId);
      for (const acc of defaults) {
        await this.saveItem('financial_accounts', acc);
      }
      items = defaults;
    }

    if (params?.status) {
      items = items.filter((a) => a.status === params.status);
    }
    if (params?.type) {
      items = items.filter((a) => a.type === params.type);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.bank_name && a.bank_name.toLowerCase().includes(q)) ||
        (a.account_number && a.account_number.includes(q)) ||
        (a.card_number && a.card_number.includes(q))
      );
    }
    return items;
  }

  async getFinancialAccountById(id: number): Promise<FinancialAccount | null> {
    const list = await this.getFinancialAccounts();
    return list.find((a) => a.id === id) || null;
  }

  async saveFinancialAccount(account: Partial<FinancialAccount>): Promise<FinancialAccount> {
    const list = await this.getItems<FinancialAccount>('financial_accounts');
    const validId = typeof account.id === 'number' && account.id > 0 ? account.id : this.generateUniqueId(list);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(account.organization_id) }) || 1;

    if (account.is_default) {
      for (const a of list) {
        if (a.organization_id === orgId && a.is_default && a.id !== validId) {
          a.is_default = false;
          await this.saveItem('financial_accounts', a);
        }
      }
    }

    const saved: FinancialAccount = {
      id: validId,
      organization_id: orgId,
      name: account.name || 'حساب جدید',
      type: account.type || 'cashbox',
      bank_name: account.bank_name || null,
      account_number: account.account_number || null,
      card_number: account.card_number || null,
      shaba_number: account.shaba_number || null,
      pos_terminal_id: account.pos_terminal_id || null,
      initial_balance: Number(account.initial_balance) || 0,
      current_balance: Number(account.current_balance ?? account.initial_balance) || 0,
      is_default: Boolean(account.is_default),
      status: account.status || 'active',
      date_created: new Date().toISOString(),
      ...account,
    };

    await this.saveItem('financial_accounts', saved);
    return saved;
  }

  async deleteFinancialAccount(id: number): Promise<boolean> {
    return this.deleteItem('financial_accounts', id);
  }

  async getTreasuryTransactions(params?: QueryParams): Promise<TreasuryTransaction[]> {
    const orgId = this.getActiveOrgId(params) || 1;
    let items = await this.getItems<TreasuryTransaction>('treasury_transactions', orgId);
    const accounts = await this.getFinancialAccounts({ organization_id: orgId });

    const enriched = items.map((tx) => {
      const srcId = typeof tx.source_account_id === 'object' ? (tx.source_account_id as any)?.id : tx.source_account_id;
      const dstId = typeof tx.destination_account_id === 'object' ? (tx.destination_account_id as any)?.id : tx.destination_account_id;
      const src = accounts.find((a) => a.id === Number(srcId));
      const dst = accounts.find((a) => a.id === Number(dstId));
      return {
        ...tx,
        source_account_name: src?.name,
        destination_account_name: dst?.name,
      };
    });

    if (params?.type) {
      return enriched.filter((t) => t.type === params.type);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((t) =>
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.tracking_code && t.tracking_code.toLowerCase().includes(q))
      );
    }

    return enriched.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }

  async saveTreasuryTransaction(tx: Partial<TreasuryTransaction>): Promise<TreasuryTransaction> {
    const list = await this.getItems<TreasuryTransaction>('treasury_transactions');
    const validId = typeof tx.id === 'number' && tx.id > 0 ? tx.id : this.generateUniqueId(list);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(tx.organization_id) }) || 1;
    const amount = Math.max(0, Number(tx.amount) || 0);

    const saved: TreasuryTransaction = {
      id: validId,
      organization_id: orgId,
      source_account_id: tx.source_account_id || null,
      destination_account_id: tx.destination_account_id || null,
      type: tx.type || 'deposit',
      amount,
      tracking_code: tx.tracking_code || `TRX-${Date.now().toString().slice(-6)}`,
      transaction_date: tx.transaction_date || new Date().toISOString(),
      person_transaction_id: tx.person_transaction_id || null,
      expense_id: tx.expense_id || null,
      description: tx.description || '',
      receipt_attachment: tx.receipt_attachment || null,
      date_created: new Date().toISOString(),
      ...tx,
    };

    // Update account balances
    if (saved.type === 'deposit' && saved.destination_account_id) {
      const dstId = typeof saved.destination_account_id === 'object' ? (saved.destination_account_id as any)?.id : saved.destination_account_id;
      const acc = await this.getFinancialAccountById(Number(dstId));
      if (acc) {
        acc.current_balance = (Number(acc.current_balance) || 0) + amount;
        await this.saveFinancialAccount(acc);
      }
    } else if (saved.type === 'withdrawal' && saved.source_account_id) {
      const srcId = typeof saved.source_account_id === 'object' ? (saved.source_account_id as any)?.id : saved.source_account_id;
      const acc = await this.getFinancialAccountById(Number(srcId));
      if (acc) {
        acc.current_balance = (Number(acc.current_balance) || 0) - amount;
        await this.saveFinancialAccount(acc);
      }
    } else if (saved.type === 'transfer') {
      if (saved.source_account_id) {
        const srcId = typeof saved.source_account_id === 'object' ? (saved.source_account_id as any)?.id : saved.source_account_id;
        const acc = await this.getFinancialAccountById(Number(srcId));
        if (acc) {
          acc.current_balance = (Number(acc.current_balance) || 0) - amount;
          await this.saveFinancialAccount(acc);
        }
      }
      if (saved.destination_account_id) {
        const dstId = typeof saved.destination_account_id === 'object' ? (saved.destination_account_id as any)?.id : saved.destination_account_id;
        const acc = await this.getFinancialAccountById(Number(dstId));
        if (acc) {
          acc.current_balance = (Number(acc.current_balance) || 0) + amount;
          await this.saveFinancialAccount(acc);
        }
      }
    }

    await this.saveItem('treasury_transactions', saved);
    return saved;
  }

  async deleteTreasuryTransaction(id: number): Promise<boolean> {
    return this.deleteItem('treasury_transactions', id);
  }

  // ==========================================
  // Phase 2: Cheques Management
  // ==========================================

  async getCheques(params?: QueryParams): Promise<Cheque[]> {
    const orgId = this.getActiveOrgId(params) || 1;
    let items = await this.getItems<Cheque>('cheques', orgId);
    const customers = await this.getCustomers({ organization_id: orgId });
    const suppliers = await this.getSuppliers({ organization_id: orgId });
    const accounts = await this.getFinancialAccounts({ organization_id: orgId });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = items.map((chk) => {
      const cId = typeof chk.customer_id === 'object' ? (chk.customer_id as any)?.id : chk.customer_id;
      const sId = typeof chk.supplier_id === 'object' ? (chk.supplier_id as any)?.id : chk.supplier_id;
      const tId = typeof chk.target_account_id === 'object' ? (chk.target_account_id as any)?.id : chk.target_account_id;

      const cust = customers.find((c) => c.id === Number(cId));
      const supp = suppliers.find((s) => s.id === Number(sId));
      const acc = accounts.find((a) => a.id === Number(tId));

      let daysUntilDue = 0;
      let isOverdue = false;

      if (chk.due_date) {
        const dueDate = new Date(chk.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const diffMs = dueDate.getTime() - today.getTime();
        daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        isOverdue = daysUntilDue < 0 && chk.status !== 'cleared' && chk.status !== 'cancelled';
      }

      return {
        ...chk,
        customer_name: cust?.name,
        supplier_name: supp?.name,
        target_account_name: acc?.name,
        days_until_due: daysUntilDue,
        is_overdue: isOverdue,
      };
    });

    if (params?.status) {
      return enriched.filter((c) => c.status === params.status);
    }
    if (params?.type) {
      return enriched.filter((c) => c.type === params.type);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((c) =>
        c.sayad_id.includes(q) ||
        c.cheque_number.includes(q) ||
        c.drawer_name.toLowerCase().includes(q) ||
        c.bank_name.toLowerCase().includes(q)
      );
    }

    return enriched.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }

  async getChequeById(id: number): Promise<Cheque | null> {
    const list = await this.getCheques();
    return list.find((c) => c.id === id) || null;
  }

  async saveCheque(cheque: Partial<Cheque>): Promise<Cheque> {
    const list = await this.getItems<Cheque>('cheques');
    const validId = typeof cheque.id === 'number' && cheque.id > 0 ? cheque.id : this.generateUniqueId(list);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(cheque.organization_id) }) || 1;

    const saved: Cheque = {
      id: validId,
      organization_id: orgId,
      type: cheque.type || 'received',
      sayad_id: cheque.sayad_id || '',
      cheque_number: cheque.cheque_number || '',
      bank_name: cheque.bank_name || 'بانک ملت',
      branch_name: cheque.branch_name || null,
      account_number: cheque.account_number || null,
      drawer_name: cheque.drawer_name || '',
      customer_id: cheque.customer_id ? Number(normalizeId(cheque.customer_id)) : null,
      supplier_id: cheque.supplier_id ? Number(normalizeId(cheque.supplier_id)) : null,
      amount: Math.max(0, Number(cheque.amount) || 0),
      issue_date: cheque.issue_date || new Date().toISOString().split('T')[0],
      due_date: cheque.due_date || new Date().toISOString().split('T')[0],
      status: cheque.status || 'registered',
      target_account_id: cheque.target_account_id ? Number(normalizeId(cheque.target_account_id)) : null,
      alert_days_before: Number(cheque.alert_days_before) || 3,
      image_front: cheque.image_front || null,
      image_back: cheque.image_back || null,
      notes: cheque.notes || '',
      date_created: new Date().toISOString(),
      ...cheque,
    };

    await this.saveItem('cheques', saved);
    return saved;
  }

  async deleteCheque(id: number): Promise<boolean> {
    return this.deleteItem('cheques', id);
  }

  async updateChequeStatus(id: number, status: ChequeStatus, targetAccountId?: number): Promise<Cheque> {
    const chk = await this.getChequeById(id);
    if (!chk) {
      throw new Error(`Cheque with id ${id} not found`);
    }

    const prevStatus = chk.status;
    chk.status = status;
    if (targetAccountId) {
      chk.target_account_id = targetAccountId;
    }

    if (status === 'cleared' && prevStatus !== 'cleared' && chk.target_account_id) {
      const accId = typeof chk.target_account_id === 'object' ? (chk.target_account_id as any)?.id : chk.target_account_id;
      const acc = await this.getFinancialAccountById(Number(accId));
      if (acc) {
        if (chk.type === 'received') {
          acc.current_balance = (Number(acc.current_balance) || 0) + Number(chk.amount);
        } else if (chk.type === 'issued') {
          acc.current_balance = (Number(acc.current_balance) || 0) - Number(chk.amount);
        }
        await this.saveFinancialAccount(acc);
      }
    }

    await this.saveItem('cheques', chk);
    return chk;
  }

  // ==========================================
  // Phase 3: Landed Cost & Tax / VAT Reports
  // ==========================================

  async getLandedCosts(params?: QueryParams): Promise<LandedCost[]> {
    const orgId = this.getActiveOrgId(params) || 1;
    let list = await this.getItems<LandedCost>('landed_costs', orgId);
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((item) => item.title?.toLowerCase().includes(q) || item.cost_type?.toLowerCase().includes(q));
    }

    const purchaseOrders = await this.getItems<PurchaseOrder>('purchase_orders', orgId);
    const suppliers = await this.getItems<Supplier>('suppliers', orgId);
    const allocations = await this.getItems<LandedCostAllocation>('landed_cost_allocations');

    return list.map((cost) => {
      const poId = typeof cost.purchase_order_id === 'object' ? (cost.purchase_order_id as any)?.id : cost.purchase_order_id;
      const po = purchaseOrders.find((p) => p.id === Number(poId));
      let supName = '';
      if (po) {
        const supId = typeof po.supplier_id === 'object' ? (po.supplier_id as any)?.id : po.supplier_id;
        const sup = suppliers.find((s) => s.id === Number(supId));
        supName = sup?.name || po.supplier_name || '';
      }

      const costAllocations = allocations.filter((a) => {
        const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
        return Number(cId) === cost.id;
      });

      return {
        ...cost,
        purchase_number: po?.purchase_number || '',
        supplier_name: supName,
        purchase_total: po?.total || 0,
        allocations_count: costAllocations.length,
      };
    });
  }

  async getLandedCostById(id: number): Promise<LandedCost | null> {
    const list = await this.getLandedCosts();
    return list.find((item) => item.id === id) || null;
  }

  async saveLandedCost(cost: Partial<LandedCost>, allocations?: Partial<LandedCostAllocation>[]): Promise<LandedCost> {
    const isNew = !cost.id;
    let savedCost: LandedCost;

    if (isNew) {
      const all = await this.getItems<LandedCost>('landed_costs');
      const newId = this.generateUniqueId(all);
      savedCost = {
        id: newId,
        organization_id: cost.organization_id || 1,
        purchase_order_id: cost.purchase_order_id || 0,
        cost_type: cost.cost_type || 'freight',
        title: cost.title || '',
        amount: Number(cost.amount) || 0,
        allocation_method: cost.allocation_method || 'by_value',
        expense_id: cost.expense_id || null,
        date_applied: cost.date_applied || new Date().toISOString().slice(0, 10),
        date_created: new Date().toISOString(),
      };
    } else {
      const existing = await this.getItemById<LandedCost>('landed_costs', cost.id!);
      if (!existing) throw new Error(`Landed cost with id ${cost.id} not found`);
      savedCost = {
        ...existing,
        ...cost,
        amount: Number(cost.amount !== undefined ? cost.amount : existing.amount),
      };
    }

    await this.saveItem('landed_costs', savedCost);

    if (allocations && allocations.length > 0) {
      const allAllocations = await this.getItems<LandedCostAllocation>('landed_cost_allocations');
      for (const alloc of allocations) {
        const allocId = alloc.id || this.generateUniqueId(allAllocations);
        const item: LandedCostAllocation = {
          id: allocId,
          landed_cost_id: savedCost.id,
          purchase_order_item_id: alloc.purchase_order_item_id || 0,
          allocated_amount: Number(alloc.allocated_amount) || 0,
          effective_unit_cost: Number(alloc.effective_unit_cost) || 0,
        };
        await this.saveItem('landed_cost_allocations', item);
      }
    }

    return savedCost;
  }

  async deleteLandedCost(id: number): Promise<boolean> {
    await this.deleteItem('landed_costs', id);
    const allocations = await this.getItems<LandedCostAllocation>('landed_cost_allocations');
    for (const alloc of allocations) {
      const cId = typeof alloc.landed_cost_id === 'object' ? (alloc.landed_cost_id as any)?.id : alloc.landed_cost_id;
      if (Number(cId) === id) {
        await this.deleteItem('landed_cost_allocations', alloc.id);
      }
    }
    return true;
  }

  async getLandedCostAllocations(landedCostId?: number, purchaseOrderId?: number): Promise<LandedCostAllocation[]> {
    let allocations = await this.getItems<LandedCostAllocation>('landed_cost_allocations');
    if (landedCostId) {
      allocations = allocations.filter((a) => {
        const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
        return Number(cId) === landedCostId;
      });
    }

    const poItems = await this.getItems<PurchaseOrderItem>('purchase_order_items');
    const variants = await this.getItems<ProductVariant>('product_variants');
    const products = await this.getItems<Product>('products');

    return allocations.map((alloc) => {
      const item = poItems.find((pi) => pi.id === alloc.purchase_order_item_id);
      let variant: ProductVariant | undefined;
      let product: Product | undefined;
      if (item) {
        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
        variant = variants.find((v) => v.id === Number(vId));
        if (variant) {
          const pId = typeof variant.product_id === 'object' ? (variant.product_id as any)?.id : variant.product_id;
          product = products.find((p) => p.id === Number(pId));
        }
      }

      return {
        ...alloc,
        variant_id: variant?.id,
        sku: variant?.sku || '',
        product_title: product?.title || '',
        variant_name: variant ? `${product?.title || ''} - ${variant.sku || ''}` : '',
        quantity: item?.quantity_ordered || item?.quantity_received || 1,
        base_unit_cost: item?.unit_cost || 0,
        base_total: item?.total || 0,
      };
    });
  }

  async saveLandedCostAllocation(allocation: Partial<LandedCostAllocation>): Promise<LandedCostAllocation> {
    const isNew = !allocation.id;
    let saved: LandedCostAllocation;

    if (isNew) {
      const all = await this.getItems<LandedCostAllocation>('landed_cost_allocations');
      saved = {
        id: this.generateUniqueId(all),
        landed_cost_id: allocation.landed_cost_id || 0,
        purchase_order_item_id: allocation.purchase_order_item_id || 0,
        allocated_amount: Number(allocation.allocated_amount) || 0,
        effective_unit_cost: Number(allocation.effective_unit_cost) || 0,
      };
    } else {
      const existing = await this.getItemById<LandedCostAllocation>('landed_cost_allocations', allocation.id!);
      if (!existing) throw new Error(`Allocation with id ${allocation.id} not found`);
      saved = { ...existing, ...allocation };
    }

    await this.saveItem('landed_cost_allocations', saved);
    return saved;
  }

  async applyLandedCostToVariants(landedCostId: number): Promise<{ updatedVariantsCount: number }> {
    const allocations = await this.getLandedCostAllocations(landedCostId);
    if (!allocations || allocations.length === 0) {
      return { updatedVariantsCount: 0 };
    }

    let updatedCount = 0;
    for (const alloc of allocations) {
      if (alloc.variant_id && alloc.effective_unit_cost > 0) {
        const variant = await this.getItemById<ProductVariant>('product_variants', alloc.variant_id);
        if (variant) {
          variant.buy_price = Math.round(Number(alloc.effective_unit_cost));
          await this.saveItem('product_variants', variant);
          updatedCount++;
        }
      }
    }

    return { updatedVariantsCount: updatedCount };
  }

  async getVatReport(params?: { organizationId?: number; year?: number; quarter?: 1 | 2 | 3 | 4 }): Promise<VatReportSummary> {
    const orgId = params?.organizationId || 1;
    const year = params?.year || 1403;
    const quarter = params?.quarter || 1;

    let orders = await this.getItems<Order>('orders', orgId);
    let purchaseOrders = await this.getItems<PurchaseOrder>('purchase_orders', orgId);
    const customers = await this.getItems<Customer>('customers', orgId);
    const suppliers = await this.getItems<Supplier>('suppliers', orgId);

    orders = orders.filter((o) => o.status !== 'cancelled');
    purchaseOrders = purchaseOrders.filter((p) => p.status !== 'cancelled');

    const salesTaxable = orders.reduce((sum, o) => sum + (Number(o.subtotal) || Number(o.total) || 0), 0);
    const salesVat = orders.reduce((sum, o) => sum + (Number(o.tax) || 0), 0);

    const purchasesTaxable = purchaseOrders.reduce((sum, p) => sum + (Number(p.subtotal) || Number(p.total) || 0), 0);
    const purchasesVat = purchaseOrders.reduce((sum, p) => sum + (Number(p.tax) || 0), 0);

    const netVatPayable = salesVat - purchasesVat;

    const quarterLabels: Record<number, string> = {
      1: `بهار ${year}`,
      2: `تابستان ${year}`,
      3: `پاییز ${year}`,
      4: `زمستان ${year}`,
    };

    const salesInvoices = orders.map((o) => {
      const custId = typeof o.customer_id === 'object' ? (o.customer_id as any)?.id : o.customer_id;
      const cust = customers.find((c) => c.id === Number(custId));
      return {
        id: o.id,
        orderNumber: o.order_number,
        customerName: cust?.name || o.customer_name || 'مشتری متفرقه',
        nationalId: cust?.phone || '',
        date: o.date_created || '',
        subtotal: Number(o.subtotal) || Number(o.total) || 0,
        vatAmount: Number(o.tax) || 0,
        total: Number(o.total) || 0,
      };
    });

    const purchaseInvoices = purchaseOrders.map((p) => {
      const supId = typeof p.supplier_id === 'object' ? (p.supplier_id as any)?.id : p.supplier_id;
      const sup = suppliers.find((s) => s.id === Number(supId));
      return {
        id: p.id,
        purchaseNumber: p.purchase_number,
        supplierName: sup?.name || p.supplier_name || 'تامین‌کننده',
        economicCode: sup?.phone || '',
        date: p.date_created || '',
        subtotal: Number(p.subtotal) || Number(p.total) || 0,
        vatAmount: Number(p.tax) || 0,
        total: Number(p.total) || 0,
      };
    });

    return {
      year,
      quarter,
      periodLabel: quarterLabels[quarter] || `فصل ${quarter} سال ${year}`,
      salesTaxableAmount: salesTaxable,
      salesVatAmount: salesVat,
      purchasesTaxableAmount: purchasesTaxable,
      purchasesVatAmount: purchasesVat,
      netVatPayable,
      vatRate: 10,
      ordersCount: orders.length,
      purchasesCount: purchaseOrders.length,
      salesInvoices,
      purchaseInvoices,
    };
  }
}
