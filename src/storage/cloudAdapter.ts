import { IStorageProvider, QueryParams, StorageMode } from './types';
import { directusClient } from '../api/directus';
import { LocalOfflineAdapter } from './localAdapter';
import { StorageSyncManager } from './syncManager';
import {
  Organization, Category, Collection, Season, Color, SizeGroup, Size, Brand,
  Product, ProductVariant, Warehouse, WarehouseLocation, InventoryItem,
  InventoryMovement, Customer, Order, OrderItem, Supplier, PurchaseOrder,
  PurchaseOrderItem, StockTransfer, StockTransferItem, SizeGuideTemplate,
  SizeGuideMeasurement, SizeGuideValue
} from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanUuid(val: any): string | null {
  if (typeof val === 'string' && UUID_REGEX.test(val.trim())) {
    return val.trim();
  }
  return null;
}

function cleanInt(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (isNaN(num) || num <= 0) return null;
  return Math.floor(num);
}

export class CloudDirectusAdapter implements IStorageProvider {
  public mode: StorageMode = 'cloud_synced';
  private localAdapter = new LocalOfflineAdapter();

  // Organizations
  async getOrganizations(): Promise<Organization[]> {
    try {
      let orgs = await directusClient.getOrganizations();
      if (!Array.isArray(orgs) || orgs.length === 0) {
        orgs = await directusClient.getItems<Organization>('organizations');
      }

      const validOrgs: Organization[] = (Array.isArray(orgs) ? orgs : [])
        .filter((o: any) => o && typeof o === 'object' && o.id && o.name);

      if (validOrgs.length > 0) {
        // Cache to local adapter for offline resilience
        for (const org of validOrgs) {
          await this.localAdapter.saveOrganization(org);
        }
        return validOrgs;
      }
      return await this.localAdapter.getOrganizations();
    } catch (err: any) {
      console.warn('[CloudDirectusAdapter] getOrganizations fallback:', err?.message || err);
      return await this.localAdapter.getOrganizations();
    }
  }

  async getOrganizationById(id: number): Promise<Organization | null> {
    try {
      const org = await directusClient.getItemById<Organization>('organizations', id);
      if (org && org.id && org.name) {
        await this.localAdapter.saveOrganization(org);
        return org;
      }
      return await this.localAdapter.getOrganizationById(id);
    } catch {
      return await this.localAdapter.getOrganizationById(id);
    }
  }

  async saveOrganization(org: Partial<Organization>): Promise<Organization> {
    try {
      if (org.id) {
        return await directusClient.updateItem<Organization>('organizations', org.id, org);
      }
      return await directusClient.createOrganization({
        name: org.name || 'سازمان جدید',
        slug: org.slug,
        currency: org.currency,
        timezone: org.timezone,
        plan: org.plan,
      });
    } catch (err: any) {
      console.warn('[CloudDirectusAdapter] Cloud saveOrganization failed, falling back to local adapter:', err?.message || err);
      const saved = await this.localAdapter.saveOrganization(org);
      StorageSyncManager.enqueue({ action: org.id ? 'UPDATE' : 'CREATE', collection: 'organizations', payload: saved });
      return saved;
    }
  }

  // Products & Variants
  async getProducts(params?: QueryParams): Promise<Product[]> {
    const query: any = { sort: '-id' };
    if (params?.organization_id) {
      query.filter = { organization_id: { _eq: params.organization_id } };
    }
    try {
      const products = await directusClient.getItems<Product>('products', query);
      const [variants, inventoryItems] = await Promise.all([
        directusClient.getItems<ProductVariant>('product_variants', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
        directusClient.getItems<InventoryItem>('inventory_items', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
      ]);

      return products.map((p) => {
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
    } catch {
      return this.localAdapter.getProducts(params);
    }
  }

  async getProductById(id: number): Promise<Product | null> {
    try {
      return await directusClient.getItemById<Product>('products', id);
    } catch {
      return this.localAdapter.getProductById(id);
    }
  }

  async saveProduct(product: Partial<Product>): Promise<Product> {
    const payload: any = { ...product };
    delete payload.variants_count;
    delete payload.total_stock;
    delete payload.brand;
    delete payload.category;
    delete payload.collection;
    delete payload.season;
    delete payload.size_guide_template;
    delete payload.variants;

    payload.main_image = cleanUuid(payload.main_image);
    payload.brand_id = cleanInt(payload.brand_id);
    payload.category_id = cleanInt(payload.category_id);
    payload.collection_id = cleanInt(payload.collection_id);
    payload.season_id = cleanInt(payload.season_id);
    payload.size_guide_template_id = cleanInt(payload.size_guide_template_id);
    payload.sort = Number(payload.sort) || 0;
    if (!payload.status) payload.status = 'published';

    const id = payload.id ? Number(payload.id) : undefined;
    delete payload.id;

    try {
      if (id) {
        return await directusClient.updateItem<Product>('products', id, payload);
      }
      return await directusClient.createItem<Product>('products', payload);
    } catch (err: any) {
      console.error('[CloudDirectusAdapter] Cloud saveProduct failed:', err?.message || err);
      throw err;
    }
  }

  async deleteProduct(id: number): Promise<boolean> {
    try {
      return await directusClient.deleteItem('products', id);
    } catch (err: any) {
      console.error('[CloudDirectusAdapter] Cloud deleteProduct failed:', err?.message || err);
      throw err;
    }
  }

  async getVariants(params?: QueryParams): Promise<ProductVariant[]> {
    const query: any = { sort: '-id' };
    if (params?.organization_id) {
      query.filter = { organization_id: { _eq: params.organization_id } };
    }
    return directusClient.getItems<ProductVariant>('product_variants', query);
  }

  async getVariantsByProductId(productId: number): Promise<ProductVariant[]> {
    try {
      const variants = await directusClient.getItems<ProductVariant>('product_variants', {
        filter: { product_id: { _eq: productId } },
      });
      const [inventoryItems, colors, sizes] = await Promise.all([
        directusClient.getItems<InventoryItem>('inventory_items', {}).catch(() => []),
        directusClient.getItems<Color>('colors', {}).catch(() => []),
        directusClient.getItems<Size>('sizes', {}).catch(() => []),
      ]);

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
          color_name: matchedColor?.name || v.color_name,
          size_name: matchedSize?.name || v.size_name,
          stock_quantity: totalStock,
        };
      });
    } catch {
      return this.localAdapter.getVariantsByProductId(productId);
    }
  }

  async saveVariant(variant: Partial<ProductVariant>, warehouseId: number = 1): Promise<ProductVariant> {
    const payload: any = { ...variant };
    const stockQty = payload.stock_quantity;
    delete payload.stock_quantity;
    delete payload.color_name;
    delete payload.size_name;
    delete payload.product_title;
    delete payload.color;
    delete payload.size;
    delete payload.product;
    delete payload._tempId;

    payload.image = cleanUuid(payload.image);
    payload.color_id = cleanInt(payload.color_id);
    payload.size_id = cleanInt(payload.size_id);
    payload.product_id = Number(payload.product_id);
    payload.price = payload.price !== undefined && payload.price !== '' ? Number(payload.price) : 0;
    payload.cost = payload.cost !== undefined && payload.cost !== '' ? Number(payload.cost) : 0;
    payload.sort = Number(payload.sort) || 0;
    if (!payload.status) payload.status = 'published';

    const id = payload.id ? Number(payload.id) : undefined;
    delete payload.id;

    try {
      let saved: ProductVariant;
      if (id) {
        saved = await directusClient.updateItem<ProductVariant>('product_variants', id, payload);
      } else {
        saved = await directusClient.createItem<ProductVariant>('product_variants', payload);
      }

      if (stockQty !== undefined && stockQty !== null) {
        const qtyNum = Math.max(0, Number(stockQty) || 0);
        const existingInventory = await directusClient.getItems<InventoryItem>('inventory_items', {
          filter: { variant_id: { _eq: saved.id } },
        }).catch(() => []);

        if (existingInventory.length > 0) {
          await directusClient.updateItem<InventoryItem>('inventory_items', existingInventory[0].id, {
            quantity: qtyNum,
            available_quantity: qtyNum,
          }).catch((err) => {
            console.warn('[CloudDirectusAdapter] Update inventory failed:', err?.message || err);
          });
        } else {
          // Resolve effective warehouse for this organization
          let targetWarehouseId = warehouseId;
          const warehouses = await directusClient.getItems<Warehouse>('warehouses', {}).catch(() => []);
          const orgWh = warehouses.find(w => Number(w.organization_id) === Number(saved.organization_id)) || warehouses[0];
          if (orgWh && orgWh.id) {
            targetWarehouseId = orgWh.id;
          } else {
            try {
              const newWh = await directusClient.createItem<Warehouse>('warehouses', {
                organization_id: saved.organization_id,
                name: 'انبار اصلی',
                code: 'MAIN',
                type: 'warehouse',
                status: 'active',
              });
              targetWarehouseId = newWh.id;
            } catch (whErr) {
              console.warn('[CloudDirectusAdapter] Auto-create warehouse failed:', whErr);
            }
          }

          await directusClient.createItem<InventoryItem>('inventory_items', {
            organization_id: saved.organization_id,
            variant_id: saved.id,
            warehouse_id: targetWarehouseId,
            quantity: qtyNum,
            reserved_quantity: 0,
            available_quantity: qtyNum,
            damaged_quantity: 0,
          }).catch((err) => {
            console.warn('[CloudDirectusAdapter] Create inventory failed:', err?.message || err);
          });
        }
      }

      return { ...saved, stock_quantity: stockQty !== undefined ? Number(stockQty) : 0 };
    } catch (err: any) {
      console.error('[CloudDirectusAdapter] Cloud saveVariant failed:', err?.message || err);
      throw err;
    }
  }

  async deleteVariant(id: number): Promise<boolean> {
    try {
      // Delete associated inventory items first if any
      const inventoryItems = await directusClient.getItems<InventoryItem>('inventory_items', {
        filter: { variant_id: { _eq: id } },
      }).catch(() => []);
      for (const inv of inventoryItems) {
        await directusClient.deleteItem('inventory_items', inv.id).catch(() => null);
      }
      return await directusClient.deleteItem('product_variants', id);
    } catch (err: any) {
      console.error('[CloudDirectusAdapter] Cloud deleteVariant failed:', err?.message || err);
      throw err;
    }
  }

  // Catalog Attributes
  async getCategories(params?: QueryParams): Promise<Category[]> {
    const query: any = { sort: 'name' };
    if (params?.organization_id) {
      query.filter = { organization_id: { _eq: params.organization_id } };
    }
    try {
      return await directusClient.getItems<Category>('categories', query);
    } catch {
      return this.localAdapter.getCategories(params);
    }
  }

  async saveCategory(cat: Partial<Category>): Promise<Category> {
    try {
      if (cat.id) return await directusClient.updateItem<Category>('categories', cat.id, cat);
      return await directusClient.createItem<Category>('categories', cat);
    } catch {
      const saved = await this.localAdapter.saveCategory(cat);
      StorageSyncManager.enqueue({ action: cat.id ? 'UPDATE' : 'CREATE', collection: 'categories', payload: saved });
      return saved;
    }
  }

  async deleteCategory(id: number): Promise<boolean> {
    try {
      return await directusClient.deleteItem('categories', id);
    } catch {
      const res = await this.localAdapter.deleteCategory(id);
      StorageSyncManager.enqueue({ action: 'DELETE', collection: 'categories', payload: { id } });
      return res;
    }
  }

  async getCollections(params?: QueryParams): Promise<Collection[]> {
    try {
      return await directusClient.getItems<Collection>('collections', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.localAdapter.getCollections(params);
    }
  }

  async saveCollection(col: Partial<Collection>): Promise<Collection> {
    try {
      if (col.id) return await directusClient.updateItem<Collection>('collections', col.id, col);
      return await directusClient.createItem<Collection>('collections', col);
    } catch {
      const saved = await this.localAdapter.saveCollection(col);
      StorageSyncManager.enqueue({ action: col.id ? 'UPDATE' : 'CREATE', collection: 'collections', payload: saved });
      return saved;
    }
  }

  async deleteCollection(id: number): Promise<boolean> {
    try {
      return await directusClient.deleteItem('collections', id);
    } catch {
      const res = await this.localAdapter.deleteCollection(id);
      StorageSyncManager.enqueue({ action: 'DELETE', collection: 'collections', payload: { id } });
      return res;
    }
  }

  async getBrands(params?: QueryParams): Promise<Brand[]> {
    try {
      return await directusClient.getItems<Brand>('brands', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.localAdapter.getBrands(params);
    }
  }

  async saveBrand(brand: Partial<Brand>): Promise<Brand> {
    try {
      if (brand.id) return await directusClient.updateItem<Brand>('brands', brand.id, brand);
      return await directusClient.createItem<Brand>('brands', brand);
    } catch {
      const saved = await this.localAdapter.saveBrand(brand);
      StorageSyncManager.enqueue({ action: brand.id ? 'UPDATE' : 'CREATE', collection: 'brands', payload: saved });
      return saved;
    }
  }

  async deleteBrand(id: number): Promise<boolean> {
    try {
      return await directusClient.deleteItem('brands', id);
    } catch {
      const res = await this.localAdapter.deleteBrand(id);
      StorageSyncManager.enqueue({ action: 'DELETE', collection: 'brands', payload: { id } });
      return res;
    }
  }

  async getSeasons(params?: QueryParams): Promise<Season[]> {
    try {
      return await directusClient.getItems<Season>('seasons', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.localAdapter.getSeasons(params);
    }
  }

  async saveSeason(season: Partial<Season>): Promise<Season> {
    try {
      if (season.id) return await directusClient.updateItem<Season>('seasons', season.id, season);
      return await directusClient.createItem<Season>('seasons', season);
    } catch {
      const saved = await this.localAdapter.saveSeason(season);
      StorageSyncManager.enqueue({ action: season.id ? 'UPDATE' : 'CREATE', collection: 'seasons', payload: saved });
      return saved;
    }
  }

  async deleteSeason(id: number): Promise<boolean> {
    try {
      return await directusClient.deleteItem('seasons', id);
    } catch {
      const res = await this.localAdapter.deleteSeason(id);
      StorageSyncManager.enqueue({ action: 'DELETE', collection: 'seasons', payload: { id } });
      return res;
    }
  }

  async getColors(params?: QueryParams): Promise<Color[]> {
    try {
      return await directusClient.getItems<Color>('colors', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.localAdapter.getColors(params);
    }
  }

  async saveColor(color: Partial<Color>): Promise<Color> {
    try {
      if (color.id) return await directusClient.updateItem<Color>('colors', color.id, color);
      return await directusClient.createItem<Color>('colors', color);
    } catch {
      const saved = await this.localAdapter.saveColor(color);
      StorageSyncManager.enqueue({ action: color.id ? 'UPDATE' : 'CREATE', collection: 'colors', payload: saved });
      return saved;
    }
  }

  async deleteColor(id: number): Promise<boolean> {
    try {
      return await directusClient.deleteItem('colors', id);
    } catch {
      const res = await this.localAdapter.deleteColor(id);
      StorageSyncManager.enqueue({ action: 'DELETE', collection: 'colors', payload: { id } });
      return res;
    }
  }

  async getSizeGroups(params?: QueryParams): Promise<SizeGroup[]> {
    try {
      return await directusClient.getItems<SizeGroup>('size_groups', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.localAdapter.getSizeGroups(params);
    }
  }

  async saveSizeGroup(group: Partial<SizeGroup>): Promise<SizeGroup> {
    try {
      if (group.id) return await directusClient.updateItem<SizeGroup>('size_groups', group.id, group);
      return await directusClient.createItem<SizeGroup>('size_groups', group);
    } catch {
      const saved = await this.localAdapter.saveSizeGroup(group);
      StorageSyncManager.enqueue({ action: group.id ? 'UPDATE' : 'CREATE', collection: 'size_groups', payload: saved });
      return saved;
    }
  }

  async deleteSizeGroup(id: number): Promise<boolean> {
    try {
      return await directusClient.deleteItem('size_groups', id);
    } catch {
      const res = await this.localAdapter.deleteSizeGroup(id);
      StorageSyncManager.enqueue({ action: 'DELETE', collection: 'size_groups', payload: { id } });
      return res;
    }
  }

  async getSizes(params?: QueryParams): Promise<Size[]> {
    try {
      return await directusClient.getItems<Size>('sizes', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.localAdapter.getSizes(params);
    }
  }

  async saveSize(size: Partial<Size>): Promise<Size> {
    try {
      if (size.id) return await directusClient.updateItem<Size>('sizes', size.id, size);
      return await directusClient.createItem<Size>('sizes', size);
    } catch {
      const saved = await this.localAdapter.saveSize(size);
      StorageSyncManager.enqueue({ action: size.id ? 'UPDATE' : 'CREATE', collection: 'sizes', payload: saved });
      return saved;
    }
  }

  async deleteSize(id: number): Promise<boolean> {
    try {
      return await directusClient.deleteItem('sizes', id);
    } catch {
      const res = await this.localAdapter.deleteSize(id);
      StorageSyncManager.enqueue({ action: 'DELETE', collection: 'sizes', payload: { id } });
      return res;
    }
  }

  // Warehouses & Locations
  async getWarehouses(params?: QueryParams): Promise<Warehouse[]> {
    return directusClient.getItems<Warehouse>('warehouses', {
      filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
    });
  }

  async saveWarehouse(wh: Partial<Warehouse>): Promise<Warehouse> {
    if (wh.id) return directusClient.updateItem<Warehouse>('warehouses', wh.id, wh);
    return directusClient.createItem<Warehouse>('warehouses', wh);
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    return directusClient.deleteItem('warehouses', id);
  }

  async getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    const filter: any = {};
    if (params?.warehouse_id) filter.warehouse_id = { _eq: params.warehouse_id };
    return directusClient.getItems<WarehouseLocation>('warehouse_locations', {
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });
  }

  async getLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.getWarehouseLocations(params);
  }

  async getLocationsByWarehouseId(warehouseId: number): Promise<WarehouseLocation[]> {
    return this.getWarehouseLocations({ warehouse_id: warehouseId });
  }

  async saveWarehouseLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    if (loc.id) return directusClient.updateItem<WarehouseLocation>('warehouse_locations', loc.id, loc);
    return directusClient.createItem<WarehouseLocation>('warehouse_locations', loc);
  }

  async saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.saveWarehouseLocation(loc);
  }

  async deleteWarehouseLocation(id: number): Promise<boolean> {
    return directusClient.deleteItem('warehouse_locations', id);
  }

  // Inventory
  async getInventoryItems(params?: QueryParams): Promise<InventoryItem[]> {
    return directusClient.getItems<InventoryItem>('inventory_items', {
      filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
    });
  }

  async saveInventoryItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    if (item.id) {
      return directusClient.updateItem<InventoryItem>('inventory_items', item.id, item);
    }
    return directusClient.createItem<InventoryItem>('inventory_items', item);
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    return directusClient.deleteItem('inventory_items', id);
  }

  async getInventoryMovements(params?: QueryParams): Promise<InventoryMovement[]> {
    return directusClient.getItems<InventoryMovement>('inventory_movements', {
      filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      sort: '-created_at',
    });
  }

  async recordMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    return directusClient.createItem<InventoryMovement>('inventory_movements', movement);
  }

  // Orders
  async getOrders(params?: QueryParams): Promise<Order[]> {
    return directusClient.getItems<Order>('orders', {
      filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      sort: '-date_created',
    });
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return directusClient.getItems<OrderItem>('order_items', {
      filter: { order_id: { _eq: orderId } },
    });
  }

  async saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    let savedOrder: Order;
    if (order.id) {
      savedOrder = await directusClient.updateItem<Order>('orders', order.id, order);
    } else {
      savedOrder = await directusClient.createItem<Order>('orders', order);
    }

    if (items && items.length > 0) {
      for (const item of items) {
        await directusClient.createItem<OrderItem>('order_items', {
          ...item,
          order_id: savedOrder.id,
          organization_id: savedOrder.organization_id,
        });
      }
    }
    return savedOrder;
  }

  // Customers
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    return directusClient.getItems<Customer>('customers', {
      filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
    });
  }

  async saveCustomer(cust: Partial<Customer>): Promise<Customer> {
    if (cust.id) return directusClient.updateItem<Customer>('customers', cust.id, cust);
    return directusClient.createItem<Customer>('customers', cust);
  }

  // Suppliers & Purchase Orders
  async getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    return directusClient.getItems<Supplier>('suppliers', {
      filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
    });
  }

  async saveSupplier(sup: Partial<Supplier>): Promise<Supplier> {
    if (sup.id) return directusClient.updateItem<Supplier>('suppliers', sup.id, sup);
    return directusClient.createItem<Supplier>('suppliers', sup);
  }

  async getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    return directusClient.getItems<PurchaseOrder>('purchase_orders', {
      filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
    });
  }

  async savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    let savedPo: PurchaseOrder;
    if (po.id) {
      savedPo = await directusClient.updateItem<PurchaseOrder>('purchase_orders', po.id, po);
    } else {
      savedPo = await directusClient.createItem<PurchaseOrder>('purchase_orders', po);
    }

    if (items && items.length > 0) {
      for (const item of items) {
        await directusClient.createItem<PurchaseOrderItem>('purchase_order_items', {
          ...item,
          purchase_order_id: savedPo.id,
          organization_id: savedPo.organization_id,
        });
      }
    }
    return savedPo;
  }

  // Stock Transfers
  async getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    return directusClient.getItems<StockTransfer>('stock_transfers', {
      filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
    });
  }

  async saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    let savedSt: StockTransfer;
    if (st.id) {
      savedSt = await directusClient.updateItem<StockTransfer>('stock_transfers', st.id, st);
    } else {
      savedSt = await directusClient.createItem<StockTransfer>('stock_transfers', st);
    }

    if (items && items.length > 0) {
      for (const item of items) {
        await directusClient.createItem<StockTransferItem>('stock_transfer_items', {
          ...item,
          transfer_id: savedSt.id,
          organization_id: savedSt.organization_id,
        });
      }
    }
    return savedSt;
  }

  // Size Guides
  async getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    return directusClient.getItems<SizeGuideTemplate>('size_guide_templates', {
      filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
    });
  }

  async saveSizeGuideTemplate(tpl: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    if (tpl.id) return directusClient.updateItem<SizeGuideTemplate>('size_guide_templates', tpl.id, tpl);
    return directusClient.createItem<SizeGuideTemplate>('size_guide_templates', tpl);
  }

  async deleteSizeGuideTemplate(id: number): Promise<boolean> {
    await directusClient.deleteItem('size_guide_templates', id);
    return true;
  }

  async getSizeGuideMeasurements(templateId: number): Promise<SizeGuideMeasurement[]> {
    return directusClient.getItems<SizeGuideMeasurement>('size_guide_measurements', {
      filter: { template_id: { _eq: templateId } },
    });
  }

  async saveSizeGuideMeasurement(meas: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement> {
    if (meas.id) return directusClient.updateItem<SizeGuideMeasurement>('size_guide_measurements', meas.id, meas);
    return directusClient.createItem<SizeGuideMeasurement>('size_guide_measurements', meas);
  }

  async deleteSizeGuideMeasurement(id: number): Promise<boolean> {
    await directusClient.deleteItem('size_guide_measurements', id);
    return true;
  }

  async getSizeGuideValues(templateId: number): Promise<SizeGuideValue[]> {
    return directusClient.getItems<SizeGuideValue>('size_guide_values', {
      filter: { template_id: { _eq: templateId } },
    });
  }

  async saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue> {
    if (val.id) return directusClient.updateItem<SizeGuideValue>('size_guide_values', val.id, val);
    return directusClient.createItem<SizeGuideValue>('size_guide_values', val);
  }

  async deleteSizeGuideValue(id: number): Promise<boolean> {
    await directusClient.deleteItem('size_guide_values', id);
    return true;
  }
}
