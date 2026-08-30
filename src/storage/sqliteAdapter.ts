import Database from '@tauri-apps/plugin-sql';
import { IStorageProvider, QueryParams, StorageMode } from './types';
import { normalizeId } from '../utils/formatters';
import {
  Organization, OrganizationUser, Category, Collection, Season, Color, SizeGroup, Size, Brand,
  Product, ProductVariant, Warehouse, WarehouseLocation, InventoryItem,
  InventoryMovement, Customer, Order, OrderItem, Supplier, PurchaseOrder,
  PurchaseOrderItem, StockTransfer, StockTransferItem, SizeGuideTemplate,
  SizeGuideMeasurement, SizeGuideValue
} from '../types';

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
      window.addEventListener('tankhor_data_restored', () => {
        this.loadLocalStorageFallback();
        if (this.db) {
          this.autoMigrateLocalStorageToSqlite(this.db);
        }
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

  private async getItems<T>(col: string, orgId?: number): Promise<T[]> {
    const db = await this.initDatabase();
    if (db) {
      try {
        let rows: { data: string }[];
        if (orgId) {
          rows = await db.select<{ data: string }[]>(
            `SELECT data FROM ${col} WHERE organization_id = $1 OR organization_id IS NULL`,
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
        return !itemOrgId || Number(itemOrgId) === Number(orgId);
      });
    }
    return list;
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
    if (params?.organization_id) return Number(params.organization_id);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tankhor_active_org_id');
      if (saved) {
        const num = Number(saved);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return undefined;
  }

  // ==========================================
  // Organizations
  // ==========================================
  async getOrganizations(): Promise<Organization[]> {
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
    const list = await this.getItems<OrganizationUser>('organization_users', orgId);

    if (list.length === 0 && orgId) {
      const all = await this.getItems<OrganizationUser>('organization_users');
      const nextId = all.reduce((max, ou) => Math.max(max, ou.id || 0), 0) + 1;
      const defaultOwner: OrganizationUser = {
        id: nextId,
        organization_id: Number(orgId),
        user_id: `local_owner_admin_${orgId}`,
        role: 'owner',
        status: 'active',
        date_joined: new Date().toISOString(),
        first_name: 'مدیر',
        last_name: 'سازمان',
        email: 'owner@tankhor.com',
      };
      await this.saveItem('organization_users', defaultOwner);
      return [defaultOwner];
    }
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
          id: pId,
          organization_id: product.organization_id || 1,
          title: product.title || '',
          slug: product.slug || `prod-${pId}`,
          status: product.status || 'published',
          date_created: new Date().toISOString(),
          ...product,
        };
      }
    } else {
      const newId = this.generateUniqueId(list);
      saved = {
        id: newId,
        organization_id: product.organization_id || 1,
        title: product.title || '',
        slug: product.slug || `prod-${newId}`,
        status: product.status || 'published',
        date_created: new Date().toISOString(),
        ...product,
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
          id: vId,
          organization_id: variant.organization_id || 1,
          product_id: productId || 0,
          color_id: colorId,
          size_id: sizeId,
          sku: variant.sku || `SKU-${Date.now().toString().slice(-6)}`,
          status: 'published',
          ...variant,
        };
      }
    } else {
      saved = {
        id: this.generateUniqueId(list),
        organization_id: variant.organization_id || 1,
        product_id: productId || 0,
        color_id: colorId,
        size_id: sizeId,
        sku: variant.sku || `SKU-${Date.now().toString().slice(-6)}`,
        status: 'published',
        date_created: new Date().toISOString(),
        ...variant,
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
    const id = cat.id || this.generateUniqueId(list);
    const saved: Category = {
      id,
      name: cat.name || 'دسته‌بندی جدید',
      slug: cat.slug || `cat-${id}`,
      status: 'active',
      organization_id: cat.organization_id || 1,
      ...cat,
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
    const id = col.id || this.generateUniqueId(list);
    const saved: Collection = {
      id,
      name: col.name || 'کالکشن جدید',
      slug: col.slug || `col-${id}`,
      status: 'active',
      organization_id: col.organization_id || 1,
      ...col,
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
    const id = brand.id || this.generateUniqueId(list);
    const saved: Brand = { id, name: brand.name || 'برند جدید', status: 'active', organization_id: brand.organization_id || 1, ...brand };
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
    const id = season.id || this.generateUniqueId(list);
    const saved: Season = { id, name: season.name || 'فصل جدید', status: 'active', organization_id: season.organization_id || 1, ...season };
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
    const id = color.id || this.generateUniqueId(list);
    const saved: Color = { id, name: color.name || 'رنگ جدید', hex: color.hex || '#000000', status: 'active', organization_id: color.organization_id || 1, ...color };
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
    const id = group.id || this.generateUniqueId(list);
    const saved: SizeGroup = { id, name: group.name || 'گروه سایز جدید', category: group.category || 'apparel', status: 'active', organization_id: group.organization_id || 1, ...group };
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
    const id = size.id || this.generateUniqueId(list);
    const saved: Size = { id, name: size.name || 'سایز جدید', status: 'active', organization_id: size.organization_id || 1, ...size };
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
    const id = wh.id || this.generateUniqueId(list);
    const saved: Warehouse = {
      id,
      name: wh.name || 'انبار جدید',
      type: wh.type || 'warehouse',
      status: 'active',
      organization_id: wh.organization_id || 1,
      ...wh,
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
    const id = loc.id || this.generateUniqueId(list);
    const saved: WarehouseLocation = {
      id,
      name: loc.name || 'موقعیت جدید',
      warehouse_id: loc.warehouse_id || 1,
      type: loc.type || 'rack',
      status: 'active',
      ...loc,
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
    const id = item.id || this.generateUniqueId(list);
    const qty = Math.max(0, Number(item.quantity) || 0);
    const reserved = Math.max(0, Number(item.reserved_quantity) || 0);
    const damaged = Math.max(0, Number(item.damaged_quantity) || 0);
    const available = Math.max(0, qty - reserved - damaged);

    const saved: InventoryItem = {
      id,
      variant_id: item.variant_id || 0,
      warehouse_id: item.warehouse_id || 1,
      quantity: qty,
      reserved_quantity: reserved,
      damaged_quantity: damaged,
      available_quantity: available,
      organization_id: item.organization_id || 1,
      ...item,
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
    const id = movement.id || this.generateUniqueId(list);
    const saved: InventoryMovement = {
      id,
      organization_id: movement.organization_id || 1,
      variant_id: movement.variant_id || 1,
      warehouse_id: movement.warehouse_id || 1,
      type: movement.type || 'adjustment',
      quantity: Math.max(0, Number(movement.quantity) || 1),
      reference_type: movement.reference_type || 'manual',
      created_at: new Date().toISOString(),
      ...movement,
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
    const id = order.id || this.generateUniqueId(list);
    const savedOrder: Order = {
      id,
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
    };
    await this.saveItem('orders', savedOrder);

    if (items && Array.isArray(items) && items.length > 0) {
      const allOrderItems = await this.getItems<OrderItem>('order_items');
      for (const itm of items) {
        const itmId = itm.id || this.generateUniqueId(allOrderItems);
        await this.saveItem('order_items', {
          id: itmId,
          order_id: id,
          variant_id: itm.variant_id || 1,
          quantity: itm.quantity || 1,
          unit_price: itm.unit_price || 0,
          discount: itm.discount || 0,
          total: itm.total || ((itm.quantity || 1) * (itm.unit_price || 0)),
          created_at: new Date().toISOString(),
          ...itm,
        });
      }
    }

    return savedOrder;
  }

  // ==========================================
  // Customers
  // ==========================================
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    return this.getItems<Customer>('customers', this.getActiveOrgId(params));
  }
  async saveCustomer(cust: Partial<Customer>): Promise<Customer> {
    const list = await this.getItems<Customer>('customers');
    const id = cust.id || this.generateUniqueId(list);
    const saved: Customer = {
      id,
      name: cust.name || 'مشتری جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      organization_id: cust.organization_id || 1,
      ...cust,
    };
    await this.saveItem('customers', saved);
    return saved;
  }

  // ==========================================
  // Suppliers & Purchasing
  // ==========================================
  async getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    return this.getItems<Supplier>('suppliers', this.getActiveOrgId(params));
  }
  async saveSupplier(sup: Partial<Supplier>): Promise<Supplier> {
    const list = await this.getItems<Supplier>('suppliers');
    const id = sup.id || this.generateUniqueId(list);
    const saved: Supplier = {
      id,
      name: sup.name || 'تامین‌کننده جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      organization_id: sup.organization_id || 1,
      ...sup,
    };
    await this.saveItem('suppliers', saved);
    return saved;
  }

  async getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    return this.getItems<PurchaseOrder>('purchase_orders', this.getActiveOrgId(params));
  }
  async savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    const list = await this.getItems<PurchaseOrder>('purchase_orders');
    const id = po.id || this.generateUniqueId(list);
    const saved: PurchaseOrder = {
      id,
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
    };
    await this.saveItem('purchase_orders', saved);

    if (items && Array.isArray(items) && items.length > 0) {
      const allPoItems = await this.getItems<PurchaseOrderItem>('purchase_order_items');
      for (const itm of items) {
        const itmId = itm.id || this.generateUniqueId(allPoItems);
        await this.saveItem('purchase_order_items', {
          id: itmId,
          purchase_order_id: id,
          variant_id: itm.variant_id || 1,
          quantity_ordered: itm.quantity_ordered || 1,
          quantity_received: itm.quantity_received || 0,
          unit_cost: itm.unit_cost || 0,
          ...itm,
        });
      }
    }
    return saved;
  }

  // ==========================================
  // Stock Transfers
  // ==========================================
  async getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    return this.getItems<StockTransfer>('stock_transfers', this.getActiveOrgId(params));
  }
  async saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    const list = await this.getItems<StockTransfer>('stock_transfers');
    const id = st.id || this.generateUniqueId(list);
    const saved: StockTransfer = {
      id,
      from_warehouse_id: st.from_warehouse_id || 1,
      to_warehouse_id: st.to_warehouse_id || 2,
      transfer_number: st.transfer_number || `TRF-${Math.floor(1000 + Math.random() * 9000)}`,
      status: st.status || 'draft',
      date_created: new Date().toISOString(),
      organization_id: st.organization_id || 1,
      ...st,
    };
    await this.saveItem('stock_transfers', saved);

    if (items && Array.isArray(items) && items.length > 0) {
      const allTransferItems = await this.getItems<StockTransferItem>('stock_transfer_items');
      for (const itm of items) {
        const itmId = itm.id || this.generateUniqueId(allTransferItems);
        await this.saveItem('stock_transfer_items', {
          id: itmId,
          transfer_id: id,
          variant_id: itm.variant_id || 1,
          quantity: itm.quantity || 1,
          ...itm,
        });
      }
    }
    return saved;
  }

  // ==========================================
  // Size Guides
  // ==========================================
  async getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    return this.getItems<SizeGuideTemplate>('size_guide_templates', this.getActiveOrgId(params));
  }
  async saveSizeGuideTemplate(tpl: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    const list = await this.getItems<SizeGuideTemplate>('size_guide_templates');
    const id = tpl.id || this.generateUniqueId(list);
    const saved: SizeGuideTemplate = {
      id,
      name: tpl.name || 'قالب راهنمای سایز جدید',
      type: tpl.type || 'apparel',
      unit: tpl.unit || 'cm',
      status: 'active',
      date_created: new Date().toISOString(),
      organization_id: tpl.organization_id || 1,
      ...tpl,
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
    const id = meas.id || this.generateUniqueId(list);
    const saved: SizeGuideMeasurement = {
      id,
      name: meas.name || 'اندازه جدید',
      template_id: meas.template_id || 1,
      unit: meas.unit || 'cm',
      type: meas.type || 'width',
      status: 'active',
      ...meas,
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
    const id = val.id || this.generateUniqueId(list);
    const saved: SizeGuideValue = {
      id,
      template_id: val.template_id || 1,
      size_id: val.size_id || 1,
      measurement_id: val.measurement_id || 1,
      value: val.value || 0,
      ...val,
    };
    await this.saveItem('size_guide_values', saved);
    return saved;
  }
  async deleteSizeGuideValue(id: number): Promise<boolean> {
    return this.deleteItem('size_guide_values', id);
  }
}
