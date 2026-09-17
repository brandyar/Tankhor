import { QueryParams } from '../types';
import { SqliteStorageBase } from './sqliteBase';
import {
  Warehouse,
  WarehouseLocation,
  InventoryItem,
  InventoryMovement,
  StockTransfer,
  StockTransferItem,
  ProductVariant,
  Product,
  Color,
  Size,
} from '../../types';

export class SqliteInventoryStorage {
  constructor(private base: SqliteStorageBase) {}

  // ==========================================
  // Warehouses
  // ==========================================
  async getWarehouses(params?: QueryParams): Promise<Warehouse[]> {
    return this.base.getItems<Warehouse>('warehouses', this.base.getActiveOrgId(params));
  }

  async getWarehouseById(id: number): Promise<Warehouse | null> {
    const list = await this.getWarehouses();
    return list.find((w) => w.id === id) || null;
  }

  async saveWarehouse(wh: Partial<Warehouse>): Promise<Warehouse> {
    const list = await this.base.getItems<Warehouse>('warehouses');
    const validId = typeof wh.id === 'number' && wh.id > 0 ? wh.id : this.base.generateUniqueId(list);
    const saved: Warehouse = {
      name: wh.name || 'انبار جدید',
      type: wh.type || 'warehouse',
      status: 'active',
      organization_id: wh.organization_id || 1,
      ...wh,
      id: validId,
    };
    await this.base.saveItem('warehouses', saved);
    return saved;
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    return this.base.deleteItem('warehouses', id);
  }

  // ==========================================
  // Warehouse Locations
  // ==========================================
  async getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    const list = await this.base.getItems<WarehouseLocation>('warehouse_locations');
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
    const list = await this.base.getItems<WarehouseLocation>('warehouse_locations');
    const validId = typeof loc.id === 'number' && loc.id > 0 ? loc.id : this.base.generateUniqueId(list);
    const saved: WarehouseLocation = {
      name: loc.name || 'موقعیت جدید',
      warehouse_id: loc.warehouse_id || 1,
      type: loc.type || 'rack',
      status: 'active',
      ...loc,
      id: validId,
    };
    await this.base.saveItem('warehouse_locations', saved);
    return saved;
  }

  async saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.saveWarehouseLocation(loc);
  }

  async deleteWarehouseLocation(id: number): Promise<boolean> {
    return this.base.deleteItem('warehouse_locations', id);
  }

  async deleteLocation(id: number): Promise<boolean> {
    return this.deleteWarehouseLocation(id);
  }

  // ==========================================
  // Inventory Items
  // ==========================================
  async getInventoryItems(params?: QueryParams): Promise<InventoryItem[]> {
    const orgId = this.base.getActiveOrgId(params);
    let items = await this.base.getItems<InventoryItem>('inventory_items', orgId);
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

    const variants = await this.base.getItems<ProductVariant>('product_variants', orgId);
    const products = await this.base.getItems<Product>('products', orgId);
    const colors = await this.base.getItems<Color>('colors', orgId);
    const sizes = await this.base.getItems<Size>('sizes', orgId);
    const warehouses = await this.base.getItems<Warehouse>('warehouses', orgId);
    const locations = await this.base.getItems<WarehouseLocation>('warehouse_locations');

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

  async getInventoryItem(variantId: number, warehouseId: number): Promise<InventoryItem | null> {
    const list = await this.getInventoryItems({ variant_id: variantId, warehouse_id: warehouseId });
    return list[0] || null;
  }

  async saveInventoryItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    const list = await this.base.getItems<InventoryItem>('inventory_items');
    const validId = typeof item.id === 'number' && item.id > 0 ? item.id : this.base.generateUniqueId(list);
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
    await this.base.saveItem('inventory_items', saved);
    return saved;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    return this.base.deleteItem('inventory_items', id);
  }

  // ==========================================
  // Inventory Movements
  // ==========================================
  async getInventoryMovements(params?: QueryParams): Promise<InventoryMovement[]> {
    const orgId = this.base.getActiveOrgId(params);
    let items = await this.base.getItems<InventoryMovement>('inventory_movements', orgId);
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

  async saveInventoryMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    const list = await this.base.getItems<InventoryMovement>('inventory_movements');
    const validId = typeof movement.id === 'number' && movement.id > 0 ? movement.id : this.base.generateUniqueId(list);
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
    await this.base.saveItem('inventory_movements', saved);
    return saved;
  }

  async recordMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    return this.saveInventoryMovement(movement);
  }

  // ==========================================
  // Stock Transfers
  // ==========================================
  async getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    return this.base.getItems<StockTransfer>('stock_transfers', this.base.getActiveOrgId(params));
  }

  async getStockTransferById(id: number): Promise<StockTransfer | null> {
    const list = await this.getStockTransfers();
    return list.find((st) => st.id === id) || null;
  }

  async getStockTransferItems(transferId?: number): Promise<StockTransferItem[]> {
    const all = await this.base.getItems<StockTransferItem>('stock_transfer_items');
    if (transferId) {
      return all.filter((it) => {
        const tId = typeof it.transfer_id === 'object' ? (it.transfer_id as any)?.id : it.transfer_id;
        return Number(tId) === Number(transferId);
      });
    }
    return all;
  }

  async saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    const list = await this.base.getItems<StockTransfer>('stock_transfers');
    const validId = typeof st.id === 'number' && st.id > 0 ? st.id : this.base.generateUniqueId(list);
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
    await this.base.saveItem('stock_transfers', saved);

    if (items && Array.isArray(items) && items.length > 0) {
      const allTransferItems = await this.base.getItems<StockTransferItem>('stock_transfer_items');
      for (const itm of items) {
        const itmId = typeof itm.id === 'number' && itm.id > 0 ? itm.id : this.base.generateUniqueId(allTransferItems);
        await this.base.saveItem('stock_transfer_items', {
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
    await this.base.deleteItem('stock_transfers', id);
    const allTransferItems = await this.base.getItems<StockTransferItem>('stock_transfer_items');
    for (const itm of allTransferItems) {
      const tId = typeof itm.transfer_id === 'object' ? (itm.transfer_id as any)?.id : itm.transfer_id;
      if (Number(tId) === Number(id)) {
        await this.base.deleteItem('stock_transfer_items', itm.id);
      }
    }
    return true;
  }
}
