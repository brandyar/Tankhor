import { IStorageProvider, QueryParams, StorageMode } from './types';
import {
  Organization, Category, Collection, Season, Color, SizeGroup, Size, Brand,
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

  constructor() {
    this.seedSampleDataIfEmpty();
  }

  private seedSampleDataIfEmpty() {
    // Clean architecture: Do NOT inject default mock data for products, categories, or attributes.
    // The system relies on actual user inputs or live Directus data.
    if (!localStorage.getItem('tankhor_db_organizations')) {
      const defaultOrg: Organization = {
        id: 1,
        name: 'سازمان اصلی',
        slug: 'main-org',
        currency: 'TOMAN',
        timezone: 'Asia/Tehran',
        plan: 'free',
        status: 'active',
        date_created: new Date().toISOString(),
      };
      this.setItem('organizations', [defaultOrg]);
    }
  }

  // Organizations
  async getOrganizations(): Promise<Organization[]> {
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

  // Products & Variants
  async getProducts(params?: QueryParams): Promise<Product[]> {
    let items = this.getItem<Product>('products', []);
    if (params?.organization_id) {
      items = items.filter((p) => p.organization_id === params.organization_id);
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
        const pId = typeof v.product_id === 'number' ? v.product_id : (v.product_id as any)?.id;
        return pId === p.id;
      });
      const pVariantIds = new Set(pVariants.map((v) => v.id));
      const pInventory = inventoryItems.filter((i) => {
        const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
        return pVariantIds.has(vId);
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
    if (params?.organization_id) {
      items = items.filter((v) => v.organization_id === params.organization_id);
    }
    const products = this.getItem<Product>('products', []);
    const colors = this.getItem<Color>('colors', []);
    const sizes = this.getItem<Size>('sizes', []);
    const inventoryItems = this.getItem<InventoryItem>('inventory_items', []);

    return items.map((v) => {
      const prodId = typeof v.product_id === 'number' ? v.product_id : (v.product_id as any)?.id;
      const colorId = typeof v.color_id === 'number' ? v.color_id : (v.color_id as any)?.id;
      const sizeId = typeof v.size_id === 'number' ? v.size_id : (v.size_id as any)?.id;

      const prod = products.find((p) => p.id === prodId);
      const color = colors.find((c) => c.id === colorId);
      const size = sizes.find((s) => s.id === sizeId);

      const vInv = inventoryItems.filter((i) => {
        const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
        return vId === v.id;
      });
      const totalStock = vInv.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      return {
        ...v,
        product_title: prod?.title || v.product_title || 'محصول',
        color_name: color?.name || v.color_name || '-',
        size_name: size?.name || v.size_name || '-',
        stock_quantity: totalStock,
      };
    });
  }

  async getVariantsByProductId(productId: number): Promise<ProductVariant[]> {
    const variants = this.getItem<ProductVariant>('product_variants', []).filter((v) => {
      const pId = typeof v.product_id === 'number' ? v.product_id : (v.product_id as any)?.id;
      return pId === productId;
    });
    const inventoryItems = this.getItem<InventoryItem>('inventory_items', []);
    const colors = this.getItem<Color>('colors', []);
    const sizes = this.getItem<Size>('sizes', []);
    const products = this.getItem<Product>('products', []);
    const prod = products.find((p) => p.id === productId);

    return variants.map((v) => {
      const vInv = inventoryItems.filter((i) => {
        const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
        return vId === v.id;
      });
      const totalStock = vInv.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      const cId = typeof v.color_id === 'number' ? v.color_id : (v.color_id as any)?.id;
      const sId = typeof v.size_id === 'number' ? v.size_id : (v.size_id as any)?.id;

      const matchedColor = colors.find((c) => c.id === cId);
      const matchedSize = sizes.find((s) => s.id === sId);

      return {
        ...v,
        product_title: prod?.title || 'محصول',
        color_name: matchedColor?.name || v.color_name || '-',
        size_name: matchedSize?.name || v.size_name || '-',
        stock_quantity: totalStock,
      };
    });
  }

  async saveVariant(variant: Partial<ProductVariant>, warehouseId?: number): Promise<ProductVariant> {
    const list = this.getItem<ProductVariant>('product_variants', []);
    let saved: ProductVariant;

    if (variant.id) {
      const idx = list.findIndex((v) => v.id === variant.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...variant, date_updated: new Date().toISOString() };
        saved = list[idx];
      } else {
        saved = {
          id: variant.id,
          organization_id: variant.organization_id || 1,
          product_id: variant.product_id || 0,
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
        product_id: variant.product_id || 0,
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
        const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
        return vId === saved.id;
      });

      if (invIdx !== -1) {
        const item = inventoryList[invIdx];
        const reserved = Number(item.reserved_quantity) || 0;
        const damaged = Number(item.damaged_quantity) || 0;
        inventoryList[invIdx].quantity = qtyNum;
        inventoryList[invIdx].available_quantity = Math.max(0, qtyNum - reserved - damaged);
        inventoryList[invIdx].updated_at = new Date().toISOString();
      } else {
        inventoryList.push({
          id: this.generateUniqueId(inventoryList),
          organization_id: saved.organization_id || 1,
          variant_id: saved.id,
          warehouse_id: targetWarehouseId || 1,
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
    return this.getItem<Category>('categories', []);
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
      organization_id: cat.organization_id || 1,
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
    return this.getItem<Collection>('collections', []);
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
      organization_id: col.organization_id || 1,
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
    return this.getItem<Brand>('brands', []);
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
      organization_id: brand.organization_id || 1,
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
    return this.getItem<Season>('seasons', []);
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
      organization_id: season.organization_id || 1,
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
    return this.getItem<Color>('colors', []);
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
      organization_id: color.organization_id || 1,
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
    return this.getItem<SizeGroup>('size_groups', []);
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
      organization_id: group.organization_id || 1,
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
    return this.getItem<Size>('sizes', []);
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
      organization_id: size.organization_id || 1,
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
    return this.getItem<Warehouse>('warehouses', []);
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
    return this.getItem<Order>('orders', []);
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
        list[idx] = { ...list[idx], ...order };
        savedOrder = list[idx];
        this.setItem('orders', list);
      } else {
        savedOrder = { id: order.id, ...order } as Order;
      }
    } else {
      savedOrder = {
        id: this.generateUniqueId(list),
        organization_id: order.organization_id || 1,
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
        filtered.push({
          id: this.generateUniqueId(filtered),
          organization_id: savedOrder.organization_id || 1,
          order_id: savedOrder.id,
          variant_id: item.variant_id || 1,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          discount: item.discount || 0,
          total: item.total || 0,
          created_at: new Date().toISOString(),
          ...item,
        });
      });
      this.setItem('order_items', filtered);
    }

    return savedOrder;
  }

  // Customers
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    return this.getItem<Customer>('customers', []);
  }

  async saveCustomer(cust: Partial<Customer>): Promise<Customer> {
    const list = await this.getCustomers();
    if (cust.id) {
      const idx = list.findIndex((c) => c.id === cust.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...cust };
        this.setItem('customers', list);
        return list[idx];
      }
    }
    const newCust: Customer = {
      id: this.generateUniqueId(list),
      organization_id: cust.organization_id || 1,
      name: cust.name || 'مشتری جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      ...cust,
    };
    list.push(newCust);
    this.setItem('customers', list);
    return newCust;
  }

  // Suppliers & Purchase Orders
  async getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    return this.getItem<Supplier>('suppliers', []);
  }

  async saveSupplier(sup: Partial<Supplier>): Promise<Supplier> {
    const list = await this.getSuppliers();
    if (sup.id) {
      const idx = list.findIndex((s) => s.id === sup.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...sup };
        this.setItem('suppliers', list);
        return list[idx];
      }
    }
    const newSup: Supplier = {
      id: this.generateUniqueId(list),
      organization_id: sup.organization_id || 1,
      name: sup.name || 'تامین‌کننده جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      ...sup,
    };
    list.push(newSup);
    this.setItem('suppliers', list);
    return newSup;
  }

  async getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    return this.getItem<PurchaseOrder>('purchase_orders', []);
  }

  async savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    const list = await this.getPurchaseOrders();
    let savedPo: PurchaseOrder;
    if (po.id) {
      const idx = list.findIndex((p) => p.id === po.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...po };
        savedPo = list[idx];
        this.setItem('purchase_orders', list);
      } else {
        savedPo = { id: po.id, ...po } as PurchaseOrder;
      }
    } else {
      savedPo = {
        id: this.generateUniqueId(list),
        organization_id: po.organization_id || 1,
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
      };
      list.unshift(savedPo);
      this.setItem('purchase_orders', list);
    }
    return savedPo;
  }

  // Stock Transfers
  async getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    return this.getItem<StockTransfer>('stock_transfers', []);
  }

  async saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    const list = await this.getStockTransfers();
    let savedSt: StockTransfer;
    if (st.id) {
      const idx = list.findIndex((s) => s.id === st.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...st };
        savedSt = list[idx];
        this.setItem('stock_transfers', list);
      } else {
        savedSt = { id: st.id, ...st } as StockTransfer;
      }
    } else {
      savedSt = {
        id: this.generateUniqueId(list),
        organization_id: st.organization_id || 1,
        from_warehouse_id: st.from_warehouse_id || 1,
        to_warehouse_id: st.to_warehouse_id || 2,
        transfer_number: `TRF-${Math.floor(1000 + Math.random() * 9000)}`,
        status: st.status || 'draft',
        date_created: new Date().toISOString(),
        ...st,
      };
      list.unshift(savedSt);
      this.setItem('stock_transfers', list);
    }
    return savedSt;
  }

  // Size Guides
  async getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    return this.getItem<SizeGuideTemplate>('size_guide_templates', []);
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
      organization_id: tpl.organization_id || 1,
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
