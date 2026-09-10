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

export class LocalOfflineAdapter implements IStorageProvider {
  public mode: StorageMode = 'local_offline';

  private getItem<T>(key: string, defaultValue: T[]): T[] {
    const raw = localStorage.getItem(`tankhor_db_${key}`);
    if (!raw) {
      this.setItem(key, defaultValue);
      return defaultValue;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  setItem<T>(key: string, data: T[]) {
    localStorage.setItem(`tankhor_db_${key}`, JSON.stringify(data));
  }

  private lastGeneratedId = 0;

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

  private filterByOrg<T extends { organization_id?: any }>(items: T[], params?: QueryParams): T[] {
    const hasExplicitOrgParam = params && 'organization_id' in params;
    const orgId = this.getActiveOrgId(params);

    if (hasExplicitOrgParam && !orgId) {
      return [];
    }

    if (orgId) {
      return items.filter((item) => {
        const itemOrgId = typeof item.organization_id === 'number'
          ? item.organization_id
          : Number((item.organization_id as any)?.id || item.organization_id);
        return itemOrgId === orgId;
      });
    }

    return items;
  }

  constructor() {
    this.seedSampleDataIfEmpty();
  }

  private seedSampleDataIfEmpty() {
    // Clean architecture: Do NOT inject default mock data for products, categories, or attributes.
    // The system relies on actual user inputs or live Directus data.
  }

  // Organizations
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
    return this.getItem<Organization>('organizations', []);
  }

  async getOrganizationById(id: number): Promise<Organization | null> {
    const list = await this.getOrganizations();
    return list.find((o) => o.id === id) || null;
  }

  async saveOrganization(org: Partial<Organization>): Promise<Organization> {
    let list = await this.getOrganizations();
    if (org.id) {
      const idx = list.findIndex((o) => Number(o.id) === Number(org.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...org, date_updated: new Date().toISOString() };
        this.setItem('organizations', list);
        return list[idx];
      }
    }

    // If saving a real organization and only default placeholder exists, purge placeholder
    if (org.name && org.name !== 'سازمان اصلی' && list.length === 1 && list[0].slug === 'main-org') {
      list = [];
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
    list.push(newOrg);
    this.setItem('organizations', list);
    return newOrg;
  }

  // Organization Users & Roles
  async getOrganizationUsers(params?: QueryParams): Promise<OrganizationUser[]> {
    const allUsers = this.getItem<OrganizationUser>('organization_users', []);
    const orgId = this.getActiveOrgId(params);

    if (!orgId) return [];

    const list = allUsers.filter((ou) => {
      const oId = typeof ou.organization_id === 'number' ? ou.organization_id : (ou.organization_id as any)?.id;
      return Number(oId) === Number(orgId);
    });

    return list;
  }

  async saveOrganizationUser(ouData: Partial<OrganizationUser>): Promise<OrganizationUser> {
    const list = this.getItem<OrganizationUser>('organization_users', []);
    const activeOrgId = Number(ouData.organization_id || this.getActiveOrgId());
    let saved: OrganizationUser;

    if (ouData.id) {
      const idx = list.findIndex((ou) => ou.id === ouData.id);
      if (idx !== -1) {
        saved = {
          ...list[idx],
          ...ouData,
          organization_id: activeOrgId,
        };
        list[idx] = saved;
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
        list.push(saved);
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
      list.push(saved);
    }

    this.setItem('organization_users', list);
    return saved;
  }

  async deleteOrganizationUser(id: number): Promise<boolean> {
    const list = this.getItem<OrganizationUser>('organization_users', []);
    const filtered = list.filter((ou) => ou.id !== id);
    if (filtered.length !== list.length) {
      this.setItem('organization_users', filtered);
      return true;
    }
    return false;
  }

  // Products & Variants
  async getProducts(params?: QueryParams): Promise<Product[]> {
    let items = this.getItem<Product>('products', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((p) => {
        const pOrgId = typeof p.organization_id === 'number' ? p.organization_id : Number((p.organization_id as any)?.id || (p as any).organization_id);
        return pOrgId === orgId;
      });
    }
    if (params?.search) {
      const term = params.search.toLowerCase();
      items = items.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(term);
        const brandName = typeof p.brand === 'string' ? p.brand : p.brand?.name || (typeof p.brand_id === 'object' ? (p.brand_id as any)?.name : '');
        const brandMatch = brandName ? brandName.toLowerCase().includes(term) : false;
        return titleMatch || brandMatch;
      });
    }

    const variants = this.getItem<ProductVariant>('product_variants', []);
    const inventoryItems = this.getItem<InventoryItem>('inventory_items', []);

    return items.map((p) => {
      const pVariants = variants.filter((v) => {
        const pId = normalizeId(v.product_id);
        return pId === p.id;
      });
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
    const list = await this.getProducts();
    return list.find((p) => p.id === id) || null;
  }

  async saveProduct(product: Partial<Product>): Promise<Product> {
    const list = this.getItem<Product>('products', []);
    if (product.id) {
      const idx = list.findIndex((p) => p.id === product.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...product, date_updated: new Date().toISOString() };
        this.setItem('products', list);
        return list[idx];
      }
    }
    const newProduct: Product = {
      id: this.generateUniqueId(list),
      organization_id: product.organization_id || 1,
      title: product.title || 'محصول جدید',
      status: product.status || 'published',
      date_created: new Date().toISOString(),
      variants_count: 0,
      total_stock: 0,
      ...product,
    };
    list.unshift(newProduct);
    this.setItem('products', list);
    return newProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    let list = this.getItem<Product>('products', []);
    list = list.filter((p) => p.id !== id);
    this.setItem('products', list);

    // Clean up associated variants, inventory & movements
    const variants = this.getItem<ProductVariant>('product_variants', []);
    const removedVariantIds: number[] = [];
    const remainingVariants = variants.filter((v) => {
      const pId = typeof v.product_id === 'number' ? v.product_id : (v.product_id as any)?.id;
      if (pId === id) {
        removedVariantIds.push(v.id);
        return false;
      }
      return true;
    });
    this.setItem('product_variants', remainingVariants);

    let inventoryList = this.getItem<InventoryItem>('inventory_items', []);
    inventoryList = inventoryList.filter((i) => {
      const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
      return !removedVariantIds.includes(vId);
    });
    this.setItem('inventory_items', inventoryList);

    let movementsList = this.getItem<InventoryMovement>('inventory_movements', []);
    movementsList = movementsList.filter((m) => {
      const vId = typeof m.variant_id === 'number' ? m.variant_id : (m.variant_id as any)?.id;
      return !removedVariantIds.includes(vId);
    });
    this.setItem('inventory_movements', movementsList);

    return true;
  }

  async getVariants(params?: QueryParams): Promise<ProductVariant[]> {
    let items = this.getItem<ProductVariant>('product_variants', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((v) => {
        const vOrgId = typeof v.organization_id === 'number' ? v.organization_id : Number((v.organization_id as any)?.id || (v as any).organization_id);
        return vOrgId === orgId;
      });
    }
    const products = this.getItem<Product>('products', []);
    const colors = this.getItem<Color>('colors', []);
    const sizes = this.getItem<Size>('sizes', []);
    const inventoryItems = this.getItem<InventoryItem>('inventory_items', []);

    return items.map((v) => {
      const vNormalizedId = normalizeId(v.id);
      const prodId = normalizeId(v.product_id);
      const colorId = normalizeId(v.color_id);
      const sizeId = normalizeId(v.size_id);

      const prod = products.find((p) => p.id === prodId);
      const color = colors.find((c) => c.id === colorId);
      const size = sizes.find((s) => s.id === sizeId);

      const vInv = inventoryItems.filter((i) => {
        const vId = normalizeId(i.variant_id);
        return vId === vNormalizedId;
      });
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
    const variants = this.getItem<ProductVariant>('product_variants', []).filter((v) => {
      const pId = normalizeId(v.product_id);
      return pId === productId;
    });
    const inventoryItems = this.getItem<InventoryItem>('inventory_items', []);
    const colors = this.getItem<Color>('colors', []);
    const sizes = this.getItem<Size>('sizes', []);
    const products = this.getItem<Product>('products', []);
    const prod = products.find((p) => p.id === productId);

    return variants.map((v) => {
      const vNormalizedId = normalizeId(v.id);
      const vInv = inventoryItems.filter((i) => {
        const vId = normalizeId(i.variant_id);
        return vId === vNormalizedId;
      });
      const totalStock = vInv.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      const cId = normalizeId(v.color_id);
      const sId = normalizeId(v.size_id);

      const matchedColor = colors.find((c) => c.id === cId);
      const matchedSize = sizes.find((s) => s.id === sId);

      return {
        ...v,
        id: vNormalizedId || v.id,
        product_id: productId,
        color_id: cId,
        size_id: sId,
        product_title: prod?.title || 'محصول',
        color_name: matchedColor?.name || v.color_name || '-',
        size_name: matchedSize?.name || v.size_name || '-',
        stock_quantity: totalStock,
      };
    });
  }

  async saveVariant(variant: Partial<ProductVariant>, warehouseId?: number, locationId?: number): Promise<ProductVariant> {
    const list = this.getItem<ProductVariant>('product_variants', []);
    let saved: ProductVariant;
    const vId = normalizeId(variant.id);
    const colorId = normalizeId(variant.color_id);
    const sizeId = normalizeId(variant.size_id);
    const productId = normalizeId(variant.product_id);

    if (vId) {
      const idx = list.findIndex((v) => normalizeId(v.id) === vId);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...variant,
          id: vId,
          product_id: productId || list[idx].product_id,
          color_id: colorId,
          size_id: sizeId,
          date_updated: new Date().toISOString(),
        };
        saved = list[idx];
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
        list.unshift(saved);
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
      list.unshift(saved);
    }
    this.setItem('product_variants', list);

    if (variant.stock_quantity !== undefined && variant.stock_quantity !== null) {
      const inventoryList = this.getItem<InventoryItem>('inventory_items', []);
      const qtyNum = Math.max(0, Number(variant.stock_quantity) || 0);

      // Resolve warehouse
      const warehouses = this.getItem<Warehouse>('warehouses', []);
      let targetWarehouseId = warehouseId;
      if (!targetWarehouseId || !warehouses.some((w) => w.id === targetWarehouseId)) {
        if (warehouses.length > 0) {
          targetWarehouseId = warehouses[0].id;
        } else {
          const newWh: Warehouse = {
            id: 1,
            organization_id: saved.organization_id || 1,
            name: 'انبار مرکزی',
            code: 'MAIN',
            type: 'warehouse',
            status: 'active',
          };
          warehouses.push(newWh);
          this.setItem('warehouses', warehouses);
          targetWarehouseId = 1;
        }
      }

      const invIdx = inventoryList.findIndex((i) => {
        const itemVId = normalizeId(i.variant_id);
        return itemVId === saved.id;
      });

      if (invIdx !== -1) {
        const item = inventoryList[invIdx];
        const reserved = Number(item.reserved_quantity) || 0;
        const damaged = Number(item.damaged_quantity) || 0;
        inventoryList[invIdx].quantity = qtyNum;
        inventoryList[invIdx].available_quantity = Math.max(0, qtyNum - reserved - damaged);
        if (locationId) {
          inventoryList[invIdx].location_id = locationId;
        }
        inventoryList[invIdx].updated_at = new Date().toISOString();
      } else {
        inventoryList.push({
          id: this.generateUniqueId(inventoryList),
          organization_id: saved.organization_id || 1,
          variant_id: saved.id,
          warehouse_id: targetWarehouseId || 1,
          location_id: locationId || undefined,
          quantity: qtyNum,
          reserved_quantity: 0,
          available_quantity: qtyNum,
          damaged_quantity: 0,
          reorder_point: 5,
          safety_stock: 2,
          updated_at: new Date().toISOString(),
        });

        // Record initial movement log
        const movementsList = this.getItem<InventoryMovement>('inventory_movements', []);
        movementsList.unshift({
          id: this.generateUniqueId(movementsList),
          organization_id: saved.organization_id || 1,
          variant_id: saved.id,
          warehouse_id: targetWarehouseId || 1,
          location_id: locationId || undefined,
          type: 'adjustment',
          quantity: qtyNum,
          reference_type: 'manual',
          reference_id: `INIT-${saved.id}`,
          note: 'موجودی اولیه هنگام ایجاد متغیر کالا',
          created_at: new Date().toISOString(),
        });
        this.setItem('inventory_movements', movementsList);
      }
      this.setItem('inventory_items', inventoryList);
    }

    return saved;
  }

  async deleteVariant(id: number): Promise<boolean> {
    let list = this.getItem<ProductVariant>('product_variants', []);
    list = list.filter((v) => v.id !== id);
    this.setItem('product_variants', list);

    let inventoryList = this.getItem<InventoryItem>('inventory_items', []);
    inventoryList = inventoryList.filter((i) => {
      const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
      return vId !== id;
    });
    this.setItem('inventory_items', inventoryList);

    let movementsList = this.getItem<InventoryMovement>('inventory_movements', []);
    movementsList = movementsList.filter((m) => {
      const vId = typeof m.variant_id === 'number' ? m.variant_id : (m.variant_id as any)?.id;
      return vId !== id;
    });
    this.setItem('inventory_movements', movementsList);

    return true;
  }

  // Catalog Attributes
  async getCategories(params?: QueryParams): Promise<Category[]> {
    let items = this.getItem<Category>('categories', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((c) => {
        const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
        return cOrgId === orgId;
      });
    }
    return items;
  }

  async saveCategory(cat: Partial<Category>): Promise<Category> {
    const list = await this.getCategories();
    if (cat.id) {
      const idx = list.findIndex((c) => c.id === cat.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...cat };
        this.setItem('categories', list);
        return list[idx];
      }
    }
    const newCat: Category = {
      id: this.generateUniqueId(list),
      organization_id: cat.organization_id || this.getActiveOrgId() || 1,
      name: cat.name || 'دسته‌بندی جدید',
      slug: cat.slug || 'cat-new',
      status: 'active',
      ...cat,
    };
    list.push(newCat);
    this.setItem('categories', list);
    return newCat;
  }

  async deleteCategory(id: number): Promise<boolean> {
    let list = await this.getCategories();
    list = list.filter((c) => c.id !== id);
    this.setItem('categories', list);
    return true;
  }

  async getCollections(params?: QueryParams): Promise<Collection[]> {
    let items = this.getItem<Collection>('collections', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((c) => {
        const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
        return cOrgId === orgId;
      });
    }
    return items;
  }

  async saveCollection(col: Partial<Collection>): Promise<Collection> {
    const list = await this.getCollections();
    if (col.id) {
      const idx = list.findIndex((c) => c.id === col.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...col };
        this.setItem('collections', list);
        return list[idx];
      }
    }
    const newCol: Collection = {
      id: this.generateUniqueId(list),
      organization_id: col.organization_id || this.getActiveOrgId() || 1,
      name: col.name || 'مجموعه جدید',
      slug: col.slug || 'col-new',
      status: 'active',
      ...col,
    };
    list.push(newCol);
    this.setItem('collections', list);
    return newCol;
  }

  async deleteCollection(id: number): Promise<boolean> {
    let list = await this.getCollections();
    list = list.filter((c) => c.id !== id);
    this.setItem('collections', list);
    return true;
  }

  async getBrands(params?: QueryParams): Promise<Brand[]> {
    let items = this.getItem<Brand>('brands', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((b) => {
        const bOrgId = typeof b.organization_id === 'number' ? b.organization_id : Number((b.organization_id as any)?.id || (b as any).organization_id);
        return bOrgId === orgId;
      });
    }
    return items;
  }

  async saveBrand(brand: Partial<Brand>): Promise<Brand> {
    const list = await this.getBrands();
    if (brand.id) {
      const idx = list.findIndex((b) => b.id === brand.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...brand, date_updated: new Date().toISOString() };
        this.setItem('brands', list);
        return list[idx];
      }
    }
    const newBrand: Brand = {
      id: this.generateUniqueId(list),
      organization_id: brand.organization_id || this.getActiveOrgId() || 1,
      name: brand.name || 'برند جدید',
      code: brand.code || '',
      status: 'active',
      date_created: new Date().toISOString(),
      ...brand,
    };
    list.push(newBrand);
    this.setItem('brands', list);
    return newBrand;
  }

  async deleteBrand(id: number): Promise<boolean> {
    let list = await this.getBrands();
    list = list.filter((b) => b.id !== id);
    this.setItem('brands', list);
    return true;
  }

  async getSeasons(params?: QueryParams): Promise<Season[]> {
    let items = this.getItem<Season>('seasons', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((s) => {
        const sOrgId = typeof s.organization_id === 'number' ? s.organization_id : Number((s.organization_id as any)?.id || (s as any).organization_id);
        return sOrgId === orgId;
      });
    }
    return items;
  }

  async saveSeason(season: Partial<Season>): Promise<Season> {
    const list = await this.getSeasons();
    if (season.id) {
      const idx = list.findIndex((s) => s.id === season.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...season };
        this.setItem('seasons', list);
        return list[idx];
      }
    }
    const newSeason: Season = {
      id: this.generateUniqueId(list),
      organization_id: season.organization_id || this.getActiveOrgId() || 1,
      name: season.name || 'فصل جدید',
      status: 'active',
      ...season,
    };
    list.push(newSeason);
    this.setItem('seasons', list);
    return newSeason;
  }

  async deleteSeason(id: number): Promise<boolean> {
    let list = await this.getSeasons();
    list = list.filter((s) => s.id !== id);
    this.setItem('seasons', list);
    return true;
  }

  async getColors(params?: QueryParams): Promise<Color[]> {
    let items = this.getItem<Color>('colors', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((c) => {
        const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
        return cOrgId === orgId;
      });
    }
    return items;
  }

  async saveColor(color: Partial<Color>): Promise<Color> {
    const list = await this.getColors();
    if (color.id) {
      const idx = list.findIndex((c) => c.id === color.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...color };
        this.setItem('colors', list);
        return list[idx];
      }
    }
    const newColor: Color = {
      id: this.generateUniqueId(list),
      organization_id: color.organization_id || this.getActiveOrgId() || 1,
      name: color.name || 'رنگ جدید',
      hex: color.hex || '#000000',
      status: 'active',
      ...color,
    };
    list.push(newColor);
    this.setItem('colors', list);
    return newColor;
  }

  async deleteColor(id: number): Promise<boolean> {
    let list = await this.getColors();
    list = list.filter((c) => c.id !== id);
    this.setItem('colors', list);
    return true;
  }

  async getSizeGroups(params?: QueryParams): Promise<SizeGroup[]> {
    let items = this.getItem<SizeGroup>('size_groups', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((g) => {
        const gOrgId = typeof g.organization_id === 'number' ? g.organization_id : Number((g.organization_id as any)?.id || (g as any).organization_id);
        return gOrgId === orgId;
      });
    }
    return items;
  }

  async saveSizeGroup(group: Partial<SizeGroup>): Promise<SizeGroup> {
    const list = await this.getSizeGroups();
    if (group.id) {
      const idx = list.findIndex((g) => g.id === group.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...group };
        this.setItem('size_groups', list);
        return list[idx];
      }
    }
    const newGroup: SizeGroup = {
      id: this.generateUniqueId(list),
      organization_id: group.organization_id || this.getActiveOrgId() || 1,
      name: group.name || 'گروه سایز جدید',
      category: group.category || 'apparel',
      status: 'active',
      ...group,
    };
    list.push(newGroup);
    this.setItem('size_groups', list);
    return newGroup;
  }

  async deleteSizeGroup(id: number): Promise<boolean> {
    let list = await this.getSizeGroups();
    list = list.filter((g) => g.id !== id);
    this.setItem('size_groups', list);
    return true;
  }

  async getSizes(params?: QueryParams): Promise<Size[]> {
    let items = this.getItem<Size>('sizes', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((s) => {
        const sOrgId = typeof s.organization_id === 'number' ? s.organization_id : Number((s.organization_id as any)?.id || (s as any).organization_id);
        return sOrgId === orgId;
      });
    }
    return items;
  }

  async saveSize(size: Partial<Size>): Promise<Size> {
    const list = await this.getSizes();
    if (size.id) {
      const idx = list.findIndex((s) => s.id === size.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...size };
        this.setItem('sizes', list);
        return list[idx];
      }
    }
    const newSize: Size = {
      id: this.generateUniqueId(list),
      organization_id: size.organization_id || this.getActiveOrgId() || 1,
      name: size.name || 'سایز جدید',
      status: 'active',
      ...size,
    };
    list.push(newSize);
    this.setItem('sizes', list);
    return newSize;
  }

  async deleteSize(id: number): Promise<boolean> {
    let list = await this.getSizes();
    list = list.filter((s) => s.id !== id);
    this.setItem('sizes', list);
    return true;
  }

  // Warehouses & Locations
  async getWarehouses(params?: QueryParams): Promise<Warehouse[]> {
    let items = this.getItem<Warehouse>('warehouses', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((w) => {
        const wOrgId = typeof w.organization_id === 'number' ? w.organization_id : Number((w.organization_id as any)?.id || (w as any).organization_id);
        return wOrgId === orgId;
      });
    }
    return items;
  }

  async saveWarehouse(wh: Partial<Warehouse>): Promise<Warehouse> {
    const list = await this.getWarehouses();
    if (wh.id) {
      const idx = list.findIndex((w) => w.id === wh.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...wh };
        this.setItem('warehouses', list);
        return list[idx];
      }
    }
    const newWh: Warehouse = {
      id: this.generateUniqueId(list),
      organization_id: wh.organization_id || 1,
      name: wh.name || 'انبار جدید',
      type: wh.type || 'warehouse',
      status: 'active',
      ...wh,
    };
    list.push(newWh);
    this.setItem('warehouses', list);
    return newWh;
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    let list = await this.getWarehouses();
    list = list.filter((w) => w.id !== id);
    this.setItem('warehouses', list);
    return true;
  }

  async getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    let items = this.getItem<WarehouseLocation>('warehouse_locations', []);
    if (params?.warehouse_id) {
      items = items.filter((l) => {
        const wId = typeof l.warehouse_id === 'number' ? l.warehouse_id : l.warehouse_id.id;
        return wId === params.warehouse_id;
      });
    }
    return items;
  }

  async getLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.getWarehouseLocations(params);
  }

  async getLocationsByWarehouseId(warehouseId: number): Promise<WarehouseLocation[]> {
    return this.getWarehouseLocations({ warehouse_id: warehouseId });
  }

  async saveWarehouseLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    const list = await this.getLocations();
    if (loc.id) {
      const idx = list.findIndex((l) => l.id === loc.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...loc };
        this.setItem('warehouse_locations', list);
        return list[idx];
      }
    }
    const newLoc: WarehouseLocation = {
      id: this.generateUniqueId(list),
      warehouse_id: loc.warehouse_id || 1,
      name: loc.name || 'جایگاه جدید',
      type: loc.type || 'rack',
      status: 'active',
      ...loc,
    };
    list.push(newLoc);
    this.setItem('warehouse_locations', list);
    return newLoc;
  }

  async saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.saveWarehouseLocation(loc);
  }

  async deleteWarehouseLocation(id: number): Promise<boolean> {
    let list = await this.getLocations();
    list = list.filter((l) => l.id !== id);
    this.setItem('warehouse_locations', list);
    return true;
  }

  // Inventory
  async getInventoryItems(params?: QueryParams): Promise<InventoryItem[]> {
    let items = this.getItem<InventoryItem>('inventory_items', []);
    if (params?.organization_id) {
      items = items.filter((i) => i.organization_id === params.organization_id);
    }
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

    const variants = this.getItem<ProductVariant>('product_variants', []);
    const products = this.getItem<Product>('products', []);
    const colors = this.getItem<Color>('colors', []);
    const sizes = this.getItem<Size>('sizes', []);
    const warehouses = this.getItem<Warehouse>('warehouses', []);
    const locations = this.getItem<WarehouseLocation>('warehouse_locations', []);

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
    const list = this.getItem<InventoryItem>('inventory_items', []);
    const qty = Math.max(0, Number(item.quantity) || 0);
    const reserved = Math.max(0, Number(item.reserved_quantity) || 0);
    const damaged = Math.max(0, Number(item.damaged_quantity) || 0);
    const available = Math.max(0, qty - reserved - damaged);

    if (item.id) {
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...item,
          quantity: qty,
          reserved_quantity: reserved,
          damaged_quantity: damaged,
          available_quantity: available,
          updated_at: new Date().toISOString(),
        };
        this.setItem('inventory_items', list);
        return list[idx];
      }
    }
    const newItem: InventoryItem = {
      id: this.generateUniqueId(list),
      organization_id: item.organization_id || 1,
      variant_id: item.variant_id || 0,
      warehouse_id: item.warehouse_id || 1,
      quantity: qty,
      reserved_quantity: reserved,
      available_quantity: available,
      damaged_quantity: damaged,
      reorder_point: item.reorder_point || 5,
      safety_stock: item.safety_stock || 2,
      updated_at: new Date().toISOString(),
      ...item,
    };
    list.unshift(newItem);
    this.setItem('inventory_items', list);
    return newItem;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    let list = this.getItem<InventoryItem>('inventory_items', []);
    list = list.filter((i) => i.id !== id);
    this.setItem('inventory_items', list);
    return true;
  }

  async getInventoryMovements(params?: QueryParams): Promise<InventoryMovement[]> {
    let items = this.getItem<InventoryMovement>('inventory_movements', []);
    if (params?.organization_id) {
      items = items.filter((m) => m.organization_id === params.organization_id);
    }
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

    const variants = this.getItem<ProductVariant>('product_variants', []);
    const warehouses = this.getItem<Warehouse>('warehouses', []);

    return items.map((m) => {
      const vId = typeof m.variant_id === 'number' ? m.variant_id : (m.variant_id as any)?.id;
      const wId = typeof m.warehouse_id === 'number' ? m.warehouse_id : (m.warehouse_id as any)?.id;
      const variant = variants.find((v) => v.id === vId);
      const warehouse = warehouses.find((w) => w.id === wId);

      return {
        ...m,
        sku: variant?.sku || m.sku || (vId ? `VAR-#${vId}` : '-'),
        warehouse_name: warehouse?.name || m.warehouse_name || 'انبار مرکزی',
      };
    });
  }

  async recordMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    const list = this.getItem<InventoryMovement>('inventory_movements', []);
    const newMov: InventoryMovement = {
      id: this.generateUniqueId(list),
      organization_id: movement.organization_id || 1,
      variant_id: movement.variant_id || 1,
      warehouse_id: movement.warehouse_id || 1,
      type: movement.type || 'adjustment',
      quantity: Math.max(0, Number(movement.quantity) || 1),
      reference_type: movement.reference_type || 'manual',
      created_at: new Date().toISOString(),
      ...movement,
    };
    list.unshift(newMov);
    this.setItem('inventory_movements', list);

    // Auto-update inventory items balance
    const inventoryList = this.getItem<InventoryItem>('inventory_items', []);
    const vId = typeof newMov.variant_id === 'number' ? newMov.variant_id : (newMov.variant_id as any)?.id;
    const wId = typeof newMov.warehouse_id === 'number' ? newMov.warehouse_id : (newMov.warehouse_id as any)?.id;
    const moveQty = newMov.quantity;
    const moveType = newMov.type;

    const invIdx = inventoryList.findIndex((i) => {
      const itemVid = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
      const itemWid = typeof i.warehouse_id === 'number' ? i.warehouse_id : (i.warehouse_id as any)?.id;
      return itemVid === vId && itemWid === wId;
    });

    if (invIdx !== -1) {
      const item = inventoryList[invIdx];
      let currentQty = Number(item.quantity) || 0;
      let currentDamaged = Number(item.damaged_quantity) || 0;
      let currentReserved = Number(item.reserved_quantity) || 0;

      if (moveType === 'purchase' || moveType === 'transfer_in' || moveType === 'return') {
        currentQty += moveQty;
      } else if (moveType === 'sale' || moveType === 'transfer_out') {
        currentQty = Math.max(0, currentQty - moveQty);
      } else if (moveType === 'damage') {
        currentDamaged += moveQty;
        currentQty = Math.max(0, currentQty - moveQty);
      } else if (moveType === 'adjustment') {
        currentQty = moveQty;
      }

      inventoryList[invIdx].quantity = currentQty;
      inventoryList[invIdx].damaged_quantity = currentDamaged;
      inventoryList[invIdx].available_quantity = Math.max(0, currentQty - currentReserved - currentDamaged);
      inventoryList[invIdx].updated_at = new Date().toISOString();
    } else {
      let initialQty = moveQty;
      let initialDamaged = 0;
      if (moveType === 'damage') {
        initialDamaged = moveQty;
        initialQty = 0;
      }
      inventoryList.unshift({
        id: this.generateUniqueId(inventoryList),
        organization_id: newMov.organization_id || 1,
        variant_id: vId,
        warehouse_id: wId,
        location_id: newMov.location_id ? Number(newMov.location_id) : undefined,
        quantity: initialQty,
        reserved_quantity: 0,
        available_quantity: initialQty,
        damaged_quantity: initialDamaged,
        reorder_point: 5,
        safety_stock: 2,
        updated_at: new Date().toISOString(),
      });
    }
    this.setItem('inventory_items', inventoryList);

    return newMov;
  }

  // Orders
  async getOrders(params?: QueryParams): Promise<Order[]> {
    let items = this.getItem<Order>('orders', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((o) => {
        const oOrgId = typeof o.organization_id === 'number' ? o.organization_id : Number((o.organization_id as any)?.id || (o as any).organization_id);
        return oOrgId === orgId;
      });
    }
    return items;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    const items = this.getItem<OrderItem>('order_items', []);
    return items.filter((it) => {
      const itemOrderId = typeof it.order_id === 'object' ? (it.order_id as any)?.id : it.order_id;
      return Number(itemOrderId) === Number(orderId);
    });
  }

  async saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    const list = await this.getOrders();
    let savedOrder: Order;
    if (order.id) {
      const idx = list.findIndex((o) => o.id === order.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...order, id: order.id };
        savedOrder = list[idx];
        this.setItem('orders', list);
      } else {
        savedOrder = { ...order, id: order.id } as Order;
      }
    } else {
      const newId = this.generateUniqueId(list);
      savedOrder = {
        organization_id: order.organization_id || this.getActiveOrgId() || 1,
        warehouse_id: order.warehouse_id || 1,
        order_number: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        status: order.status || 'draft',
        payment_status: order.payment_status || 'pending',
        currency: 'TOMAN',
        subtotal: order.subtotal || 0,
        discount: order.discount || 0,
        tax: order.tax || 0,
        total: order.total || 0,
        date_created: new Date().toISOString(),
        ...order,
        id: newId,
      };
      list.unshift(savedOrder);
      this.setItem('orders', list);
    }

    if (items && items.length > 0) {
      const allOrderItems = this.getItem<OrderItem>('order_items', []);
      const filtered = allOrderItems.filter((it) => {
        const itemOrderId = typeof it.order_id === 'object' ? (it.order_id as any)?.id : it.order_id;
        return Number(itemOrderId) !== Number(savedOrder.id);
      });

      items.forEach((item) => {
        const itmId = typeof item.id === 'number' && item.id > 0 ? item.id : this.generateUniqueId(filtered);
        filtered.push({
          organization_id: savedOrder.organization_id || this.getActiveOrgId() || 1,
          order_id: savedOrder.id,
          variant_id: item.variant_id || 1,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          discount: item.discount || 0,
          total: item.total || 0,
          created_at: new Date().toISOString(),
          ...item,
          id: itmId,
        });
      });
      this.setItem('order_items', filtered);
    }

    return savedOrder;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const list = this.getItem<Order>('orders', []);
    const filtered = list.filter((o) => o.id !== id);
    this.setItem('orders', filtered);

    const allOrderItems = this.getItem<OrderItem>('order_items', []);
    const filteredItems = allOrderItems.filter((it) => {
      const itemOrderId = typeof it.order_id === 'object' ? (it.order_id as any)?.id : it.order_id;
      return Number(itemOrderId) !== Number(id);
    });
    this.setItem('order_items', filteredItems);
    return true;
  }

  // Customers
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    let items = this.getItem<Customer>('customers', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((c) => {
        const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
        return cOrgId === orgId;
      });
    }
    return items;
  }

  async saveCustomer(cust: Partial<Customer>): Promise<Customer> {
    const list = await this.getCustomers();
    if (cust.id) {
      const idx = list.findIndex((c) => c.id === cust.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...cust, id: cust.id };
        this.setItem('customers', list);
        return list[idx];
      }
    }
    const newCust: Customer = {
      organization_id: cust.organization_id || this.getActiveOrgId() || 1,
      name: cust.name || 'مشتری جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      ...cust,
      id: this.generateUniqueId(list),
    };
    list.push(newCust);
    this.setItem('customers', list);
    return newCust;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const list = this.getItem<Customer>('customers', []);
    const filtered = list.filter((c) => c.id !== id);
    this.setItem('customers', filtered);
    return true;
  }

  // Suppliers & Purchase Orders
  async getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    let items = this.getItem<Supplier>('suppliers', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((s) => {
        const sOrgId = typeof s.organization_id === 'number' ? s.organization_id : Number((s.organization_id as any)?.id || (s as any).organization_id);
        return sOrgId === orgId;
      });
    }
    return items;
  }

  async saveSupplier(sup: Partial<Supplier>): Promise<Supplier> {
    const list = await this.getSuppliers();
    if (sup.id) {
      const idx = list.findIndex((s) => s.id === sup.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...sup, id: sup.id };
        this.setItem('suppliers', list);
        return list[idx];
      }
    }
    const newSup: Supplier = {
      organization_id: sup.organization_id || this.getActiveOrgId() || 1,
      name: sup.name || 'تامین‌کننده جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      ...sup,
      id: this.generateUniqueId(list),
    };
    list.push(newSup);
    this.setItem('suppliers', list);
    return newSup;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    const list = this.getItem<Supplier>('suppliers', []);
    const filtered = list.filter((s) => s.id !== id);
    this.setItem('suppliers', filtered);
    return true;
  }

  async getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    let items = this.getItem<PurchaseOrder>('purchase_orders', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((p) => {
        const pOrgId = typeof p.organization_id === 'number' ? p.organization_id : Number((p.organization_id as any)?.id || (p as any).organization_id);
        return pOrgId === orgId;
      });
    }
    return items;
  }

  async getPurchaseOrderItems(purchaseOrderId?: number): Promise<PurchaseOrderItem[]> {
    let items = this.getItem<PurchaseOrderItem>('purchase_order_items', []);
    if (purchaseOrderId) {
      items = items.filter((it) => {
        const poId = typeof it.purchase_order_id === 'object' ? (it.purchase_order_id as any)?.id : it.purchase_order_id;
        return Number(poId) === Number(purchaseOrderId);
      });
    }
    return items;
  }

  async savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    const list = await this.getPurchaseOrders();
    let savedPo: PurchaseOrder;
    if (po.id) {
      const idx = list.findIndex((p) => p.id === po.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...po, id: po.id };
        savedPo = list[idx];
        this.setItem('purchase_orders', list);
      } else {
        savedPo = { ...po, id: po.id } as PurchaseOrder;
      }
    } else {
      const newId = this.generateUniqueId(list);
      savedPo = {
        organization_id: po.organization_id || this.getActiveOrgId() || 1,
        supplier_id: po.supplier_id || 1,
        warehouse_id: po.warehouse_id || 1,
        purchase_number: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
        status: po.status || 'draft',
        currency: 'TOMAN',
        subtotal: po.subtotal || 0,
        discount: po.discount || 0,
        tax: po.tax || 0,
        total: po.total || 0,
        date_created: new Date().toISOString(),
        ...po,
        id: newId,
      };
      list.unshift(savedPo);
      this.setItem('purchase_orders', list);
    }

    if (items && items.length > 0) {
      const allPoItems = this.getItem<PurchaseOrderItem>('purchase_order_items', []);
      const filtered = allPoItems.filter((it) => {
        const poId = typeof it.purchase_order_id === 'object' ? (it.purchase_order_id as any)?.id : it.purchase_order_id;
        return Number(poId) !== Number(savedPo.id);
      });

      items.forEach((item) => {
        const itmId = typeof item.id === 'number' && item.id > 0 ? item.id : this.generateUniqueId(filtered);
        const qty = Number(item.quantity_ordered) || 1;
        const cost = Number(item.unit_cost) || 0;
        const total = item.total !== undefined ? Number(item.total) : qty * cost;
        filtered.push({
          organization_id: savedPo.organization_id || this.getActiveOrgId() || 1,
          purchase_order_id: savedPo.id,
          variant_id: item.variant_id || 1,
          quantity_ordered: qty,
          quantity_received: Number(item.quantity_received) || 0,
          unit_cost: cost,
          total,
          ...item,
          id: itmId,
        } as PurchaseOrderItem);
      });
      this.setItem('purchase_order_items', filtered);
    }

    return savedPo;
  }

  async deletePurchaseOrder(id: number): Promise<boolean> {
    const list = this.getItem<PurchaseOrder>('purchase_orders', []);
    const filtered = list.filter((p) => p.id !== id);
    this.setItem('purchase_orders', filtered);

    const allPoItems = this.getItem<PurchaseOrderItem>('purchase_order_items', []);
    const filteredItems = allPoItems.filter((it) => {
      const poId = typeof it.purchase_order_id === 'object' ? (it.purchase_order_id as any)?.id : it.purchase_order_id;
      return Number(poId) !== Number(id);
    });
    this.setItem('purchase_order_items', filteredItems);
    return true;
  }

  // Stock Transfers
  async getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    let items = this.getItem<StockTransfer>('stock_transfers', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((s) => {
        const sOrgId = typeof s.organization_id === 'number' ? s.organization_id : Number((s.organization_id as any)?.id || (s as any).organization_id);
        return sOrgId === orgId;
      });
    }
    return items;
  }

  async saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    const list = await this.getStockTransfers();
    let savedSt: StockTransfer;
    if (st.id) {
      const idx = list.findIndex((s) => s.id === st.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...st, id: st.id };
        savedSt = list[idx];
        this.setItem('stock_transfers', list);
      } else {
        savedSt = { ...st, id: st.id } as StockTransfer;
      }
    } else {
      const newId = this.generateUniqueId(list);
      savedSt = {
        organization_id: st.organization_id || this.getActiveOrgId() || 1,
        from_warehouse_id: st.from_warehouse_id || 1,
        to_warehouse_id: st.to_warehouse_id || 2,
        transfer_number: `TRF-${Math.floor(1000 + Math.random() * 9000)}`,
        status: st.status || 'draft',
        date_created: new Date().toISOString(),
        ...st,
        id: newId,
      };
      list.unshift(savedSt);
      this.setItem('stock_transfers', list);
    }

    if (items && items.length > 0) {
      const allTransferItems = this.getItem<StockTransferItem>('stock_transfer_items', []);
      const filtered = allTransferItems.filter((it) => {
        const tId = typeof it.transfer_id === 'object' ? (it.transfer_id as any)?.id : it.transfer_id;
        return Number(tId) !== Number(savedSt.id);
      });

      items.forEach((item) => {
        const itmId = typeof item.id === 'number' && item.id > 0 ? item.id : this.generateUniqueId(filtered);
        filtered.push({
          organization_id: savedSt.organization_id || this.getActiveOrgId() || 1,
          transfer_id: savedSt.id,
          variant_id: item.variant_id || 1,
          quantity: item.quantity || 1,
          ...item,
          id: itmId,
        });
      });
      this.setItem('stock_transfer_items', filtered);
    }

    return savedSt;
  }

  async deleteStockTransfer(id: number): Promise<boolean> {
    const list = this.getItem<StockTransfer>('stock_transfers', []);
    const filtered = list.filter((s) => s.id !== id);
    this.setItem('stock_transfers', filtered);

    const allTransferItems = this.getItem<StockTransferItem>('stock_transfer_items', []);
    const filteredItems = allTransferItems.filter((it) => {
      const tId = typeof it.transfer_id === 'object' ? (it.transfer_id as any)?.id : it.transfer_id;
      return Number(tId) !== Number(id);
    });
    this.setItem('stock_transfer_items', filteredItems);
    return true;
  }

  // Size Guides
  async getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    let items = this.getItem<SizeGuideTemplate>('size_guide_templates', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((t) => {
        const tOrgId = typeof t.organization_id === 'number' ? t.organization_id : Number((t.organization_id as any)?.id || (t as any).organization_id);
        return tOrgId === orgId;
      });
    }
    return items;
  }

  async saveSizeGuideTemplate(tpl: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    const list = await this.getSizeGuideTemplates();
    if (tpl.id) {
      const idx = list.findIndex((t) => t.id === tpl.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...tpl };
        this.setItem('size_guide_templates', list);
        return list[idx];
      }
    }
    const newTpl: SizeGuideTemplate = {
      id: this.generateUniqueId(list),
      organization_id: tpl.organization_id || this.getActiveOrgId() || 1,
      name: tpl.name || 'قالب راهنمای سایز جدید',
      type: tpl.type || 'apparel',
      unit: tpl.unit || 'cm',
      status: 'active',
      date_created: new Date().toISOString(),
      ...tpl,
    };
    list.push(newTpl);
    this.setItem('size_guide_templates', list);
    return newTpl;
  }

  async deleteSizeGuideTemplate(id: number): Promise<boolean> {
    const list = await this.getSizeGuideTemplates();
    const updated = list.filter((t) => t.id !== id);
    this.setItem('size_guide_templates', updated);
    return true;
  }

  async getSizeGuideMeasurements(templateId: number): Promise<SizeGuideMeasurement[]> {
    const list = this.getItem<SizeGuideMeasurement>('size_guide_measurements', []);
    return list.filter((m) => m.template_id === templateId);
  }

  async saveSizeGuideMeasurement(meas: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement> {
    const list = this.getItem<SizeGuideMeasurement>('size_guide_measurements', []);
    if (meas.id) {
      const idx = list.findIndex((m) => m.id === meas.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...meas };
        this.setItem('size_guide_measurements', list);
        return list[idx];
      }
    }
    const newMeas: SizeGuideMeasurement = {
      id: this.generateUniqueId(list),
      template_id: meas.template_id || 1,
      name: meas.name || 'اندازه جدید',
      unit: meas.unit || 'cm',
      type: meas.type || 'width',
      status: 'active',
      ...meas,
    };
    list.push(newMeas);
    this.setItem('size_guide_measurements', list);
    return newMeas;
  }

  async deleteSizeGuideMeasurement(id: number): Promise<boolean> {
    const list = this.getItem<SizeGuideMeasurement>('size_guide_measurements', []);
    const updated = list.filter((m) => m.id !== id);
    this.setItem('size_guide_measurements', updated);
    return true;
  }

  async getSizeGuideValues(templateId: number): Promise<SizeGuideValue[]> {
    const list = this.getItem<SizeGuideValue>('size_guide_values', []);
    return list.filter((v) => v.template_id === templateId);
  }

  async saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue> {
    const list = this.getItem<SizeGuideValue>('size_guide_values', []);
    if (val.id) {
      const idx = list.findIndex((v) => v.id === val.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...val };
        this.setItem('size_guide_values', list);
        return list[idx];
      }
    }
    const newVal: SizeGuideValue = {
      id: this.generateUniqueId(list),
      template_id: val.template_id || 1,
      size_id: val.size_id || 1,
      measurement_id: val.measurement_id || 1,
      value: val.value || 0,
      ...val,
    };
    list.push(newVal);
    this.setItem('size_guide_values', list);
    return newVal;
  }

  async deleteSizeGuideValue(id: number): Promise<boolean> {
    const list = this.getItem<SizeGuideValue>('size_guide_values', []);
    const updated = list.filter((v) => v.id !== id);
    this.setItem('size_guide_values', updated);
    return true;
  }

  // Subscriptions
  async getSubscriptions(params?: QueryParams): Promise<Subscription[]> {
    const list = this.getItem<Subscription>('subscriptions', []);
    const orgId = this.getActiveOrgId(params);
    let filtered = list;
    if (orgId) {
      filtered = filtered.filter((s) => normalizeId(s.organization_id) === orgId);
    }
    return filtered.sort((a, b) => new Date(b.date_created || b.start_date || 0).getTime() - new Date(a.date_created || a.start_date || 0).getTime());
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
    const list = this.getItem<Subscription>('subscriptions', []);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(sub.organization_id) });
    if (sub.id) {
      const idx = list.findIndex((s) => s.id === sub.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...sub, date_updated: new Date().toISOString() };
        this.setItem('subscriptions', list);
        return list[idx];
      }
    }
    const newSub: Subscription = {
      id: this.generateUniqueId(list),
      organization_id: orgId || 1,
      start_date: sub.start_date || new Date().toISOString(),
      end_date: sub.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      transaction_amount: sub.transaction_amount || '',
      Transaction_id: sub.Transaction_id || String(Date.now()),
      date_created: new Date().toISOString(),
      ...sub,
    };
    list.unshift(newSub);
    this.setItem('subscriptions', list);
    return newSub;
  }

  // System & Organization Modules
  async getSystemModules(params?: QueryParams): Promise<SystemModule[]> {
    try {
      if (typeof window !== 'undefined' && window.navigator?.onLine !== false) {
        const liveItems = await directusClient.getSystemModules(params).catch(() => []);
        if (liveItems && liveItems.length > 0) {
          this.setItem('system_modules', liveItems);
          let filtered = liveItems;
          if (params?.status) {
            filtered = filtered.filter((m) => m.status === params.status);
          }
          return filtered;
        }
      }
    } catch {
      // offline fallback to localStorage cache
    }

    let list = this.getItem<SystemModule>('system_modules', []);
    if (!list || list.length === 0) {
      list = [...DEFAULT_SYSTEM_MODULES];
      this.setItem('system_modules', list);
    }
    if (params?.status) {
      list = list.filter((m) => m.status === params.status);
    }
    return list;
  }

  async getOrganizationModules(params?: QueryParams): Promise<OrganizationModule[]> {
    const list = this.getItem<OrganizationModule>('organization_modules', []);
    const orgId = this.getActiveOrgId(params);
    let filtered = list;
    if (orgId) {
      filtered = filtered.filter((m) => normalizeId(m.organization_id) === orgId);
    }
    if (params?.status) {
      filtered = filtered.filter((m) => m.status === params.status);
    }
    return filtered;
  }

  async saveOrganizationModule(mod: Partial<OrganizationModule>): Promise<OrganizationModule> {
    const list = this.getItem<OrganizationModule>('organization_modules', []);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(mod.organization_id) });

    if (mod.id) {
      const idx = list.findIndex((m) => m.id === mod.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...mod };
        this.setItem('organization_modules', list);
        return list[idx];
      }
    }

    // Check if duplicate active license exists for this org and slug
    const existingIdx = list.findIndex(
      (m) => normalizeId(m.organization_id) === (orgId || 1) && m.slug === mod.slug
    );

    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...mod,
        status: mod.status || 'active',
      };
      this.setItem('organization_modules', list);
      return list[existingIdx];
    }

    const newMod: OrganizationModule = {
      id: this.generateUniqueId(list),
      slug: mod.slug || 'barcode',
      organization_id: orgId || 1,
      module_id: mod.module_id || 1,
      license_type: mod.license_type || 'lifetime',
      status: mod.status || 'active',
      license_token: mod.license_token || null,
      hardware_id: mod.hardware_id || null,
      starts_at: mod.starts_at || new Date().toISOString(),
      expires_at: mod.expires_at || null,
      ...mod,
    };

    list.unshift(newMod);
    this.setItem('organization_modules', list);
    return newMod;
  }

  async deleteOrganizationModule(id: number): Promise<boolean> {
    const list = this.getItem<OrganizationModule>('organization_modules', []);
    const updated = list.filter((m) => m.id !== id);
    this.setItem('organization_modules', updated);
    return true;
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
    let items = this.getItem<ExpenseCategory>('expense_categories', []);
    const orgId = this.getActiveOrgId(params) || 1;

    // Filter by org
    items = items.filter((c) => {
      const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || c.organization_id);
      return cOrgId === orgId;
    });

    if (items.length === 0) {
      const defaults = this.getDefaultExpenseCategories(orgId);
      const allList = this.getItem<ExpenseCategory>('expense_categories', []);
      allList.push(...defaults);
      this.setItem('expense_categories', allList);
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
    const all = this.getItem<ExpenseCategory>('expense_categories', []);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(cat.organization_id) }) || 1;

    if (cat.id) {
      const idx = all.findIndex((c) => c.id === cat.id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...cat, id: cat.id };
        this.setItem('expense_categories', all);
        return all[idx];
      }
    }

    const newCat: ExpenseCategory = {
      id: this.generateUniqueId(all),
      organization_id: orgId,
      title: cat.title || 'سرفصل جدید',
      code: cat.code || `EXP-${Math.floor(100 + Math.random() * 900)}`,
      icon: cat.icon || 'Tag',
      status: cat.status || 'active',
      date_created: new Date().toISOString(),
      ...cat,
    };

    all.unshift(newCat);
    this.setItem('expense_categories', all);
    return newCat;
  }

  async deleteExpenseCategory(id: number): Promise<boolean> {
    const all = this.getItem<ExpenseCategory>('expense_categories', []);
    const filtered = all.filter((c) => c.id !== id);
    this.setItem('expense_categories', filtered);
    return true;
  }

  async getExpenses(params?: QueryParams): Promise<Expense[]> {
    let items = this.getItem<Expense>('expenses', []);
    const orgId = this.getActiveOrgId(params);

    if (orgId) {
      items = items.filter((e) => {
        const eOrgId = typeof e.organization_id === 'number' ? e.organization_id : Number((e.organization_id as any)?.id || e.organization_id);
        return eOrgId === orgId;
      });
    }

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
    const all = this.getItem<Expense>('expenses', []);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(exp.organization_id) }) || 1;

    if (exp.id) {
      const idx = all.findIndex((e) => e.id === exp.id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...exp, id: exp.id };
        this.setItem('expenses', all);
        return all[idx];
      }
    }

    const newExp: Expense = {
      id: this.generateUniqueId(all),
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

    all.unshift(newExp);
    this.setItem('expenses', all);
    return newExp;
  }

  async deleteExpense(id: number): Promise<boolean> {
    const all = this.getItem<Expense>('expenses', []);
    const filtered = all.filter((e) => e.id !== id);
    this.setItem('expenses', filtered);
    return true;
  }

  async getPersonTransactions(params?: QueryParams): Promise<PersonTransaction[]> {
    let items = this.getItem<PersonTransaction>('person_transactions', []);
    const orgId = this.getActiveOrgId(params);

    if (orgId) {
      items = items.filter((tx) => {
        const txOrgId = typeof tx.organization_id === 'number' ? tx.organization_id : Number((tx.organization_id as any)?.id || tx.organization_id);
        return txOrgId === orgId;
      });
    }

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
    const all = this.getItem<PersonTransaction>('person_transactions', []);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(tx.organization_id) }) || 1;

    let savedTx: PersonTransaction;
    if (tx.id) {
      const idx = all.findIndex((t) => t.id === tx.id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...tx, id: tx.id };
        savedTx = all[idx];
        this.setItem('person_transactions', all);
      } else {
        savedTx = { ...tx, id: tx.id } as PersonTransaction;
      }
    } else {
      savedTx = {
        id: this.generateUniqueId(all),
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
      all.unshift(savedTx);
      this.setItem('person_transactions', all);
    }

    // Auto-recalculate customer / supplier balance
    if (savedTx.party_type === 'customer' && savedTx.customer_id) {
      const cId = typeof savedTx.customer_id === 'number' ? savedTx.customer_id : (savedTx.customer_id as any)?.id;
      const customers = this.getItem<Customer>('customers', []);
      const cIdx = customers.findIndex((c) => c.id === cId);
      if (cIdx !== -1) {
        // Calculate balance: debtor transactions (+) minus creditor transactions (-)
        const partyTxs = all.filter((t) => {
          const tCId = typeof t.customer_id === 'number' ? t.customer_id : (t.customer_id as any)?.id;
          return t.party_type === 'customer' && tCId === cId && t.status !== 'cancelled';
        });
        const currentBalance = partyTxs.reduce((sum, t) => {
          const amt = Number(t.amount) || 0;
          return t.type === 'debtor' ? sum + amt : sum - amt;
        }, 0);
        customers[cIdx].balance = currentBalance;
        this.setItem('customers', customers);
      }
    } else if (savedTx.party_type === 'supplier' && savedTx.supplier_id) {
      const sId = typeof savedTx.supplier_id === 'number' ? savedTx.supplier_id : (savedTx.supplier_id as any)?.id;
      const suppliers = this.getItem<Supplier>('suppliers', []);
      const sIdx = suppliers.findIndex((s) => s.id === sId);
      if (sIdx !== -1) {
        // Calculate balance for supplier: creditor invoices (+) minus debtor payments (-)
        const partyTxs = all.filter((t) => {
          const tSId = typeof t.supplier_id === 'number' ? t.supplier_id : (t.supplier_id as any)?.id;
          return t.party_type === 'supplier' && tSId === sId && t.status !== 'cancelled';
        });
        const currentBalance = partyTxs.reduce((sum, t) => {
          const amt = Number(t.amount) || 0;
          return t.type === 'creditor' ? sum + amt : sum - amt;
        }, 0);
        suppliers[sIdx].balance = currentBalance;
        this.setItem('suppliers', suppliers);
      }
    }

    return savedTx;
  }

  async deletePersonTransaction(id: number): Promise<boolean> {
    const all = this.getItem<PersonTransaction>('person_transactions', []);
    const filtered = all.filter((t) => t.id !== id);
    this.setItem('person_transactions', filtered);
    return true;
  }

  async getProfitLossSummary(params?: QueryParams): Promise<ProfitLossSummary> {
    const orgId = this.getActiveOrgId(params) || 1;
    const orders = await this.getOrders({ organization_id: orgId });
    const orderItems = this.getItem<OrderItem>('order_items', []);
    const variants = await this.getVariants({ organization_id: orgId });
    const expenses = await this.getExpenses({ organization_id: orgId });
    const categories = await this.getExpenseCategories({ organization_id: orgId });

    // Filter valid completed/confirmed orders (exclude cancelled/draft if needed, or include valid sales)
    const validOrders = orders.filter((o) => o.status !== 'cancelled');

    // 1. Total Sales Revenue
    const totalRevenue = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // 2. Cost of Goods Sold (COGS) based on variant cost
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

    // 3. Gross Profit
    const grossProfit = totalRevenue - totalCogs;
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // 4. Operating Expenses
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Group expenses by category
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

    // 5. Net Profit
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
    let items = this.getItem<FinancialAccount>('financial_accounts', []);
    const orgId = this.getActiveOrgId(params) || 1;

    if (items.length === 0) {
      items = this.getDefaultFinancialAccounts(orgId);
      this.setItem('financial_accounts', items);
    }

    if (orgId) {
      items = items.filter((a) => {
        const aOrgId = typeof a.organization_id === 'number' ? a.organization_id : Number((a.organization_id as any)?.id || (a as any).organization_id);
        return aOrgId === orgId;
      });
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
    const list = this.getItem<FinancialAccount>('financial_accounts', []);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(account.organization_id) }) || 1;

    let savedAcc: FinancialAccount;
    if (account.id) {
      const idx = list.findIndex((a) => a.id === account.id);
      if (idx !== -1) {
        // If set as default, unset previous default in same org
        if (account.is_default) {
          list.forEach((a) => {
            if (a.organization_id === orgId) a.is_default = false;
          });
        }
        list[idx] = { ...list[idx], ...account, id: account.id };
        savedAcc = list[idx];
      } else {
        savedAcc = { ...account, id: account.id } as FinancialAccount;
        list.push(savedAcc);
      }
    } else {
      const newId = this.generateUniqueId(list);
      if (account.is_default) {
        list.forEach((a) => {
          if (a.organization_id === orgId) a.is_default = false;
        });
      }
      savedAcc = {
        id: newId,
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
      list.push(savedAcc);
    }

    this.setItem('financial_accounts', list);
    return savedAcc;
  }

  async deleteFinancialAccount(id: number): Promise<boolean> {
    const list = this.getItem<FinancialAccount>('financial_accounts', []);
    const filtered = list.filter((a) => a.id !== id);
    this.setItem('financial_accounts', filtered);
    return true;
  }

  async getTreasuryTransactions(params?: QueryParams): Promise<TreasuryTransaction[]> {
    let items = this.getItem<TreasuryTransaction>('treasury_transactions', []);
    const orgId = this.getActiveOrgId(params);
    const accounts = await this.getFinancialAccounts({ organization_id: orgId });

    if (orgId) {
      items = items.filter((t) => {
        const tOrgId = typeof t.organization_id === 'number' ? t.organization_id : Number((t.organization_id as any)?.id || (t as any).organization_id);
        return tOrgId === orgId;
      });
    }

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
    const list = this.getItem<TreasuryTransaction>('treasury_transactions', []);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(tx.organization_id) }) || 1;
    const accounts = this.getItem<FinancialAccount>('financial_accounts', []);

    const newId = typeof tx.id === 'number' && tx.id > 0 ? tx.id : this.generateUniqueId(list);
    const amount = Math.max(0, Number(tx.amount) || 0);

    const savedTx: TreasuryTransaction = {
      id: newId,
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
    if (savedTx.type === 'deposit' && savedTx.destination_account_id) {
      const dstId = typeof savedTx.destination_account_id === 'object' ? (savedTx.destination_account_id as any)?.id : savedTx.destination_account_id;
      const accIdx = accounts.findIndex((a) => a.id === Number(dstId));
      if (accIdx !== -1) {
        accounts[accIdx].current_balance = (Number(accounts[accIdx].current_balance) || 0) + amount;
      }
    } else if (savedTx.type === 'withdrawal' && savedTx.source_account_id) {
      const srcId = typeof savedTx.source_account_id === 'object' ? (savedTx.source_account_id as any)?.id : savedTx.source_account_id;
      const accIdx = accounts.findIndex((a) => a.id === Number(srcId));
      if (accIdx !== -1) {
        accounts[accIdx].current_balance = (Number(accounts[accIdx].current_balance) || 0) - amount;
      }
    } else if (savedTx.type === 'transfer') {
      if (savedTx.source_account_id) {
        const srcId = typeof savedTx.source_account_id === 'object' ? (savedTx.source_account_id as any)?.id : savedTx.source_account_id;
        const srcIdx = accounts.findIndex((a) => a.id === Number(srcId));
        if (srcIdx !== -1) {
          accounts[srcIdx].current_balance = (Number(accounts[srcIdx].current_balance) || 0) - amount;
        }
      }
      if (savedTx.destination_account_id) {
        const dstId = typeof savedTx.destination_account_id === 'object' ? (savedTx.destination_account_id as any)?.id : savedTx.destination_account_id;
        const dstIdx = accounts.findIndex((a) => a.id === Number(dstId));
        if (dstIdx !== -1) {
          accounts[dstIdx].current_balance = (Number(accounts[dstIdx].current_balance) || 0) + amount;
        }
      }
    }

    this.setItem('financial_accounts', accounts);

    const existingIdx = list.findIndex((t) => t.id === savedTx.id);
    if (existingIdx !== -1) {
      list[existingIdx] = savedTx;
    } else {
      list.unshift(savedTx);
    }
    this.setItem('treasury_transactions', list);

    return savedTx;
  }

  async deleteTreasuryTransaction(id: number): Promise<boolean> {
    const list = this.getItem<TreasuryTransaction>('treasury_transactions', []);
    const filtered = list.filter((t) => t.id !== id);
    this.setItem('treasury_transactions', filtered);
    return true;
  }

  // ==========================================
  // Phase 2: Cheques Management
  // ==========================================

  async getCheques(params?: QueryParams): Promise<Cheque[]> {
    let items = this.getItem<Cheque>('cheques', []);
    const orgId = this.getActiveOrgId(params);
    const customers = await this.getCustomers({ organization_id: orgId });
    const suppliers = await this.getSuppliers({ organization_id: orgId });
    const accounts = await this.getFinancialAccounts({ organization_id: orgId });

    if (orgId) {
      items = items.filter((c) => {
        const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
        return cOrgId === orgId;
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = items.map((chk) => {
      const cId = typeof chk.customer_id === 'object' ? (chk.customer_id as any)?.id : chk.customer_id;
      const sId = typeof chk.supplier_id === 'object' ? (chk.supplier_id as any)?.id : chk.supplier_id;
      const tId = typeof chk.target_account_id === 'object' ? (chk.target_account_id as any)?.id : chk.target_account_id;

      const cust = customers.find((c) => c.id === cId);
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
    const list = this.getItem<Cheque>('cheques', []);
    const orgId = this.getActiveOrgId({ organization_id: normalizeId(cheque.organization_id) }) || 1;

    let savedChk: Cheque;
    if (cheque.id) {
      const idx = list.findIndex((c) => c.id === cheque.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...cheque, id: cheque.id };
        savedChk = list[idx];
      } else {
        savedChk = { ...cheque, id: cheque.id } as Cheque;
        list.push(savedChk);
      }
    } else {
      const newId = this.generateUniqueId(list);
      savedChk = {
        id: newId,
        organization_id: orgId,
        type: cheque.type || 'received',
        sayad_id: cheque.sayad_id || '',
        cheque_number: cheque.cheque_number || '',
        bank_name: cheque.bank_name || 'بانک ملت',
        branch_name: cheque.branch_name || null,
        account_number: cheque.account_number || null,
        drawer_name: cheque.drawer_name || '',
        customer_id: cheque.customer_id || null,
        supplier_id: cheque.supplier_id || null,
        amount: Math.max(0, Number(cheque.amount) || 0),
        issue_date: cheque.issue_date || new Date().toISOString().split('T')[0],
        due_date: cheque.due_date || new Date().toISOString().split('T')[0],
        status: cheque.status || 'registered',
        target_account_id: cheque.target_account_id || null,
        alert_days_before: Number(cheque.alert_days_before) || 3,
        image_front: cheque.image_front || null,
        image_back: cheque.image_back || null,
        notes: cheque.notes || '',
        date_created: new Date().toISOString(),
        ...cheque,
      };
      list.push(savedChk);
    }

    this.setItem('cheques', list);
    return savedChk;
  }

  async deleteCheque(id: number): Promise<boolean> {
    const list = this.getItem<Cheque>('cheques', []);
    const filtered = list.filter((c) => c.id !== id);
    this.setItem('cheques', filtered);
    return true;
  }

  async updateChequeStatus(id: number, status: ChequeStatus, targetAccountId?: number): Promise<Cheque> {
    const list = this.getItem<Cheque>('cheques', []);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error(`Cheque with id ${id} not found`);
    }

    const chk = list[idx];
    const prevStatus = chk.status;
    chk.status = status;
    if (targetAccountId) {
      chk.target_account_id = targetAccountId;
    }

    // If cheque is newly cleared and target account is present, credit/debit account
    if (status === 'cleared' && prevStatus !== 'cleared' && chk.target_account_id) {
      const accounts = this.getItem<FinancialAccount>('financial_accounts', []);
      const accId = typeof chk.target_account_id === 'object' ? (chk.target_account_id as any)?.id : chk.target_account_id;
      const accIdx = accounts.findIndex((a) => a.id === Number(accId));
      if (accIdx !== -1) {
        if (chk.type === 'received') {
          accounts[accIdx].current_balance = (Number(accounts[accIdx].current_balance) || 0) + Number(chk.amount);
        } else if (chk.type === 'issued') {
          accounts[accIdx].current_balance = (Number(accounts[accIdx].current_balance) || 0) - Number(chk.amount);
        }
        this.setItem('financial_accounts', accounts);
      }
    }

    this.setItem('cheques', list);
    return chk;
  }

  // ==========================================
  // Phase 3: Landed Cost & Tax / VAT Reports
  // ==========================================

  async getLandedCosts(params?: QueryParams): Promise<LandedCost[]> {
    let list = this.getItem<LandedCost>('landed_costs', []);
    const orgId = this.getActiveOrgId(params);
    if (orgId) {
      list = list.filter((item) => {
        const itemOrgId = typeof item.organization_id === 'object' ? (item.organization_id as any)?.id : item.organization_id;
        return Number(itemOrgId) === orgId;
      });
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((item) => item.title?.toLowerCase().includes(q) || item.cost_type?.toLowerCase().includes(q));
    }

    const purchaseOrders = this.getItem<PurchaseOrder>('purchase_orders', []);
    const suppliers = this.getItem<Supplier>('suppliers', []);
    const allocations = this.getItem<LandedCostAllocation>('landed_cost_allocations', []);

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
    const list = this.getItem<LandedCost>('landed_costs', []);
    const isNew = !cost.id;
    let savedCost: LandedCost;

    if (isNew) {
      const newId = this.generateUniqueId(list);
      savedCost = {
        id: newId,
        organization_id: cost.organization_id || this.getActiveOrgId() || 1,
        purchase_order_id: cost.purchase_order_id || 0,
        cost_type: cost.cost_type || 'freight',
        title: cost.title || '',
        amount: Number(cost.amount) || 0,
        allocation_method: cost.allocation_method || 'by_value',
        expense_id: cost.expense_id || null,
        date_applied: cost.date_applied || new Date().toISOString().slice(0, 10),
        date_created: new Date().toISOString(),
      };
      list.push(savedCost);
    } else {
      const idx = list.findIndex((c) => c.id === cost.id);
      if (idx === -1) throw new Error(`Landed cost with id ${cost.id} not found`);
      savedCost = {
        ...list[idx],
        ...cost,
        amount: Number(cost.amount !== undefined ? cost.amount : list[idx].amount),
      };
      list[idx] = savedCost;
    }

    this.setItem('landed_costs', list);

    if (allocations && allocations.length > 0) {
      let allAllocations = this.getItem<LandedCostAllocation>('landed_cost_allocations', []);
      allAllocations = allAllocations.filter((a) => {
        const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
        return Number(cId) !== savedCost.id;
      });

      for (const alloc of allocations) {
        const allocId = this.generateUniqueId(allAllocations);
        allAllocations.push({
          id: alloc.id || allocId,
          landed_cost_id: savedCost.id,
          purchase_order_item_id: alloc.purchase_order_item_id || 0,
          allocated_amount: Number(alloc.allocated_amount) || 0,
          effective_unit_cost: Number(alloc.effective_unit_cost) || 0,
        });
      }
      this.setItem('landed_cost_allocations', allAllocations);
    }

    return savedCost;
  }

  async deleteLandedCost(id: number): Promise<boolean> {
    const list = this.getItem<LandedCost>('landed_costs', []);
    this.setItem('landed_costs', list.filter((c) => c.id !== id));

    const allocations = this.getItem<LandedCostAllocation>('landed_cost_allocations', []);
    this.setItem('landed_cost_allocations', allocations.filter((a) => {
      const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
      return Number(cId) !== id;
    }));

    return true;
  }

  async getLandedCostAllocations(landedCostId?: number, purchaseOrderId?: number): Promise<LandedCostAllocation[]> {
    let allocations = this.getItem<LandedCostAllocation>('landed_cost_allocations', []);
    if (landedCostId) {
      allocations = allocations.filter((a) => {
        const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
        return Number(cId) === landedCostId;
      });
    }

    const poItems = this.getItem<PurchaseOrderItem>('purchase_order_items', []);
    const variants = this.getItem<ProductVariant>('product_variants', []);
    const products = this.getItem<Product>('products', []);

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
    const list = this.getItem<LandedCostAllocation>('landed_cost_allocations', []);
    const isNew = !allocation.id;
    let saved: LandedCostAllocation;

    if (isNew) {
      const newId = this.generateUniqueId(list);
      saved = {
        id: newId,
        landed_cost_id: allocation.landed_cost_id || 0,
        purchase_order_item_id: allocation.purchase_order_item_id || 0,
        allocated_amount: Number(allocation.allocated_amount) || 0,
        effective_unit_cost: Number(allocation.effective_unit_cost) || 0,
      };
      list.push(saved);
    } else {
      const idx = list.findIndex((a) => a.id === allocation.id);
      if (idx === -1) throw new Error(`Allocation with id ${allocation.id} not found`);
      saved = {
        ...list[idx],
        ...allocation,
      };
      list[idx] = saved;
    }

    this.setItem('landed_cost_allocations', list);
    return saved;
  }

  async applyLandedCostToVariants(landedCostId: number): Promise<{ updatedVariantsCount: number }> {
    const allocations = await this.getLandedCostAllocations(landedCostId);
    if (!allocations || allocations.length === 0) {
      return { updatedVariantsCount: 0 };
    }

    const variants = this.getItem<ProductVariant>('product_variants', []);
    let updatedCount = 0;

    for (const alloc of allocations) {
      if (alloc.variant_id && alloc.effective_unit_cost > 0) {
        const vIdx = variants.findIndex((v) => v.id === alloc.variant_id);
        if (vIdx !== -1) {
          variants[vIdx].buy_price = Math.round(Number(alloc.effective_unit_cost));
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      this.setItem('product_variants', variants);
    }

    return { updatedVariantsCount: updatedCount };
  }

  async getVatReport(params?: { organizationId?: number; year?: number; quarter?: 1 | 2 | 3 | 4 }): Promise<VatReportSummary> {
    const orgId = params?.organizationId || this.getActiveOrgId() || 1;
    const year = params?.year || 1403;
    const quarter = params?.quarter || 1;

    let orders = this.getItem<Order>('orders', []);
    let purchaseOrders = this.getItem<PurchaseOrder>('purchase_orders', []);
    const customers = this.getItem<Customer>('customers', []);
    const suppliers = this.getItem<Supplier>('suppliers', []);

    orders = orders.filter((o) => {
      const oOrg = typeof o.organization_id === 'object' ? (o.organization_id as any)?.id : o.organization_id;
      return Number(oOrg) === orgId && o.status !== 'cancelled';
    });

    purchaseOrders = purchaseOrders.filter((p) => {
      const pOrg = typeof p.organization_id === 'object' ? (p.organization_id as any)?.id : p.organization_id;
      return Number(pOrg) === orgId && p.status !== 'cancelled';
    });

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
