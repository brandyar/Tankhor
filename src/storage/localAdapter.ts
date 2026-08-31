import { IStorageProvider, QueryParams, StorageMode } from './types';
import { normalizeId } from '../utils/formatters';
import {
  Organization, OrganizationUser, Category, Collection, Season, Color, SizeGroup, Size, Brand,
  Product, ProductVariant, Warehouse, WarehouseLocation, InventoryItem,
  InventoryMovement, Customer, Order, OrderItem, Supplier, PurchaseOrder,
  PurchaseOrderItem, StockTransfer, StockTransferItem, SizeGuideTemplate,
  SizeGuideMeasurement, SizeGuideValue
} from '../types';

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

  private setItem<T>(key: string, data: T[]) {
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

    let list = allUsers;
    if (orgId) {
      list = allUsers.filter((ou) => {
        const oId = typeof ou.organization_id === 'number' ? ou.organization_id : (ou.organization_id as any)?.id;
        return Number(oId) === Number(orgId);
      });
    }

    // Default owner user if array is empty
    if (list.length === 0 && orgId) {
      const nextId = allUsers.reduce((max, ou) => Math.max(max, ou.id || 0), 0) + 1;
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
      this.setItem('organization_users', [...allUsers, defaultOwner]);
      return [defaultOwner];
    }
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
}
