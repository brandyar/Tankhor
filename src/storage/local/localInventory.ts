import { QueryParams } from '../types';
import { LocalStorageBase } from './localBase';
import { normalizeId } from '../../utils/formatters';
import {
  Warehouse,
  WarehouseLocation,
  InventoryItem,
  InventoryMovement,
  StockTransfer,
  StockTransferItem,
  ProductVariant,
  Product
} from '../../types';

export class LocalInventoryStorage {
  constructor(private base: LocalStorageBase) {}

  // Warehouses
  async getWarehouses(params?: QueryParams): Promise<Warehouse[]> {
    let items = this.base.getItem<Warehouse>('warehouses', []);
    items = this.base.filterByOrg(items, params);
    if (params?.status) {
      items = items.filter((w) => w.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((w) => w.name.toLowerCase().includes(q) || (w.code && w.code.toLowerCase().includes(q)));
    }
    return items;
  }

  async getWarehouseById(id: number): Promise<Warehouse | null> {
    const list = this.base.getItem<Warehouse>('warehouses', []);
    return list.find((w) => w.id === id) || null;
  }

  async saveWarehouse(wh: Partial<Warehouse>): Promise<Warehouse> {
    const list = this.base.getItem<Warehouse>('warehouses', []);
    let savedWh: Warehouse;
    if (wh.id) {
      const idx = list.findIndex((w) => w.id === wh.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...wh, id: wh.id, date_updated: new Date().toISOString() };
        savedWh = list[idx];
      } else {
        savedWh = { ...wh, id: wh.id, date_updated: new Date().toISOString() } as Warehouse;
        list.push(savedWh);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      savedWh = {
        id: newId,
        organization_id: this.base.getActiveOrgId() || 1,
        name: wh.name || 'انبار جدید',
        type: wh.type || 'warehouse',
        status: wh.status || 'active',
        is_default: false,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        ...wh,
      };
      list.push(savedWh);
    }
    this.base.setItem('warehouses', list);
    return savedWh;
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    const list = this.base.getItem<Warehouse>('warehouses', []);
    const filtered = list.filter((w) => w.id !== id);
    this.base.setItem('warehouses', filtered);
    return true;
  }

  // Locations
  async getLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    let items = this.base.getItem<WarehouseLocation>('warehouse_locations', []);
    if (params?.warehouse_id) {
      items = items.filter((l) => {
        const whId = typeof l.warehouse_id === 'number' ? l.warehouse_id : Number((l.warehouse_id as any)?.id || (l as any).warehouse_id);
        return whId === params.warehouse_id;
      });
    }
    if (params?.status) {
      items = items.filter((l) => l.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((l) => l.name.toLowerCase().includes(q) || (l.code && l.code.toLowerCase().includes(q)));
    }
    return items;
  }

  async getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.getLocations(params);
  }

  async getLocationsByWarehouseId(warehouseId: number): Promise<WarehouseLocation[]> {
    return this.getLocations({ warehouse_id: warehouseId });
  }

  async saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    const list = this.base.getItem<WarehouseLocation>('warehouse_locations', []);
    let savedLoc: WarehouseLocation;
    if (loc.id) {
      const idx = list.findIndex((l) => l.id === loc.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...loc, id: loc.id };
        savedLoc = list[idx];
      } else {
        savedLoc = { ...loc, id: loc.id } as WarehouseLocation;
        list.push(savedLoc);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      savedLoc = {
        id: newId,
        warehouse_id: loc.warehouse_id || 1,
        name: loc.name || 'موقعیت جدید',
        type: loc.type || 'shelf',
        status: loc.status || 'active',
        date_created: new Date().toISOString(),
        ...loc,
      };
      list.push(savedLoc);
    }
    this.base.setItem('warehouse_locations', list);
    return savedLoc;
  }

  async saveWarehouseLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.saveLocation(loc);
  }

  async deleteLocation(id: number): Promise<boolean> {
    const list = this.base.getItem<WarehouseLocation>('warehouse_locations', []);
    const filtered = list.filter((l) => l.id !== id);
    this.base.setItem('warehouse_locations', filtered);
    return true;
  }

  async deleteWarehouseLocation(id: number): Promise<boolean> {
    return this.deleteLocation(id);
  }

  // Inventory Items
  async getInventoryItems(params?: QueryParams): Promise<InventoryItem[]> {
    let items = this.base.getItem<InventoryItem>('inventory_items', []);
    items = this.base.filterByOrg(items, params);

    const variants = this.base.getItem<ProductVariant>('product_variants', []);
    const products = this.base.getItem<Product>('products', []);
    const warehouses = this.base.getItem<Warehouse>('warehouses', []);
    const locations = this.base.getItem<WarehouseLocation>('warehouse_locations', []);

    if (params?.warehouse_id) {
      items = items.filter((item) => {
        const whId = typeof item.warehouse_id === 'number' ? item.warehouse_id : Number((item.warehouse_id as any)?.id || (item as any).warehouse_id);
        return whId === params.warehouse_id;
      });
    }

    if (params?.variant_id) {
      items = items.filter((item) => {
        const vId = typeof item.variant_id === 'number' ? item.variant_id : Number((item.variant_id as any)?.id || (item as any).variant_id);
        return vId === params.variant_id;
      });
    }

    // Join related data
    return items.map((item) => {
      const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
      const wId = typeof item.warehouse_id === 'object' ? (item.warehouse_id as any)?.id : item.warehouse_id;
      const lId = typeof item.location_id === 'object' ? (item.location_id as any)?.id : item.location_id;

      const variant = variants.find((v) => v.id === vId);
      let prodTitle: string | undefined;
      let colName: string | undefined;
      let szName: string | undefined;

      if (variant) {
        const pId = typeof variant.product_id === 'object' ? (variant.product_id as any)?.id : variant.product_id;
        const prod = products.find((p) => p.id === pId);
        prodTitle = prod?.title;
        colName = variant.color_name;
        szName = variant.size_name;
      }

      const wh = warehouses.find((w) => w.id === wId);
      const loc = locations.find((l) => l.id === lId);

      return {
        ...item,
        sku: variant?.sku,
        product_title: prodTitle,
        color_name: colName,
        size_name: szName,
        warehouse_name: wh?.name,
        location_name: loc?.name,
        available_quantity: item.quantity - (item.reserved_quantity || 0),
      };
    });
  }

  async saveInventoryItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    const list = this.base.getItem<InventoryItem>('inventory_items', []);
    let savedItem: InventoryItem;

    if (item.id) {
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...item,
          id: item.id,
          available_quantity: (item.quantity ?? list[idx].quantity) - (item.reserved_quantity ?? list[idx].reserved_quantity ?? 0),
          updated_at: new Date().toISOString(),
        };
        savedItem = list[idx];
      } else {
        savedItem = {
          ...item,
          id: item.id,
          available_quantity: (item.quantity || 0) - (item.reserved_quantity || 0),
          updated_at: new Date().toISOString(),
        } as InventoryItem;
        list.push(savedItem);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      const qty = item.quantity || 0;
      const reserved = item.reserved_quantity || 0;
      savedItem = {
        id: newId,
        organization_id: this.base.getActiveOrgId() || 1,
        variant_id: item.variant_id || 0,
        warehouse_id: item.warehouse_id || 1,
        location_id: item.location_id,
        quantity: qty,
        reserved_quantity: reserved,
        available_quantity: qty - reserved,
        damaged_quantity: item.damaged_quantity || 0,
        reorder_point: item.reorder_point || 5,
        safety_stock: item.safety_stock || 2,
        updated_at: new Date().toISOString(),
        ...item,
      };
      list.push(savedItem);
    }
    this.base.setItem('inventory_items', list);
    return savedItem;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    const list = this.base.getItem<InventoryItem>('inventory_items', []);
    const filtered = list.filter((i) => i.id !== id);
    this.base.setItem('inventory_items', filtered);
    return true;
  }

  // Inventory Movements
  async getInventoryMovements(params?: QueryParams): Promise<InventoryMovement[]> {
    let items = this.base.getItem<InventoryMovement>('inventory_movements', []);
    items = this.base.filterByOrg(items, params);

    const variants = this.base.getItem<ProductVariant>('product_variants', []);
    const warehouses = this.base.getItem<Warehouse>('warehouses', []);

    if (params?.warehouse_id) {
      items = items.filter((m) => {
        const whId = typeof m.warehouse_id === 'number' ? m.warehouse_id : Number((m.warehouse_id as any)?.id || (m as any).warehouse_id);
        return whId === params.warehouse_id;
      });
    }

    if (params?.variant_id) {
      items = items.filter((m) => {
        const vId = typeof m.variant_id === 'number' ? m.variant_id : Number((m.variant_id as any)?.id || (m as any).variant_id);
        return vId === params.variant_id;
      });
    }

    return items
      .map((m) => {
        const vId = typeof m.variant_id === 'object' ? (m.variant_id as any)?.id : m.variant_id;
        const wId = typeof m.warehouse_id === 'object' ? (m.warehouse_id as any)?.id : m.warehouse_id;
        const variant = variants.find((v) => v.id === vId);
        const wh = warehouses.find((w) => w.id === wId);

        return {
          ...m,
          sku: variant?.sku,
          warehouse_name: wh?.name,
        };
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async saveInventoryMovement(mov: Partial<InventoryMovement>): Promise<InventoryMovement> {
    const list = this.base.getItem<InventoryMovement>('inventory_movements', []);
    const newId = this.base.generateUniqueId(list);

    const savedMov: InventoryMovement = {
      id: newId,
      organization_id: this.base.getActiveOrgId() || 1,
      variant_id: mov.variant_id || 0,
      warehouse_id: mov.warehouse_id || 1,
      location_id: mov.location_id,
      type: mov.type || 'adjustment',
      quantity: mov.quantity || 0,
      reference_type: mov.reference_type,
      reference_id: mov.reference_id,
      note: mov.note,
      user_id: mov.user_id,
      created_at: new Date().toISOString(),
      ...mov,
    };
    list.push(savedMov);
    this.base.setItem('inventory_movements', list);

    // Update inventory item quantity accordingly
    const invItems = this.base.getItem<InventoryItem>('inventory_items', []);
    const vId = typeof savedMov.variant_id === 'object' ? (savedMov.variant_id as any)?.id : savedMov.variant_id;
    const wId = typeof savedMov.warehouse_id === 'object' ? (savedMov.warehouse_id as any)?.id : savedMov.warehouse_id;

    let item = invItems.find((i) => {
      const ivId = typeof i.variant_id === 'object' ? (i.variant_id as any)?.id : i.variant_id;
      const iwId = typeof i.warehouse_id === 'object' ? (i.warehouse_id as any)?.id : i.warehouse_id;
      return ivId === vId && iwId === wId;
    });

    if (item) {
      if (savedMov.type === 'purchase' || savedMov.type === 'return' || savedMov.type === 'transfer_in') {
        item.quantity += savedMov.quantity;
      } else if (savedMov.type === 'sale' || savedMov.type === 'transfer_out' || savedMov.type === 'damage') {
        item.quantity -= savedMov.quantity;
      } else if (savedMov.type === 'adjustment') {
        item.quantity = savedMov.quantity;
      }
      item.available_quantity = item.quantity - (item.reserved_quantity || 0);
      item.updated_at = new Date().toISOString();
      this.base.setItem('inventory_items', invItems);
    } else {
      const newItemId = this.base.generateUniqueId(invItems);
      const qty = savedMov.type === 'adjustment' ? savedMov.quantity : savedMov.quantity;
      invItems.push({
        id: newItemId,
        organization_id: this.base.getActiveOrgId() || 1,
        variant_id: vId,
        warehouse_id: wId,
        location_id: savedMov.location_id,
        quantity: Math.max(0, qty),
        reserved_quantity: 0,
        available_quantity: Math.max(0, qty),
        damaged_quantity: 0,
        updated_at: new Date().toISOString(),
      });
      this.base.setItem('inventory_items', invItems);
    }

    return savedMov;
  }

  // Stock Transfers
  async getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    let items = this.base.getItem<StockTransfer>('stock_transfers', []);
    items = this.base.filterByOrg(items, params);

    const warehouses = this.base.getItem<Warehouse>('warehouses', []);

    return items.map((t) => {
      const fromWh = warehouses.find((w) => w.id === t.from_warehouse_id);
      const toWh = warehouses.find((w) => w.id === t.to_warehouse_id);
      return {
        ...t,
        from_warehouse_name: fromWh?.name,
        to_warehouse_name: toWh?.name,
      };
    });
  }

  async getStockTransferItems(transferId?: number): Promise<StockTransferItem[]> {
    let items = this.base.getItem<StockTransferItem>('stock_transfer_items', []);
    if (transferId) {
      items = items.filter((i) => {
        const tId = typeof i.transfer_id === 'number' ? i.transfer_id : Number((i.transfer_id as any)?.id || (i as any).transfer_id);
        return tId === transferId;
      });
    }
    return items;
  }

  async saveStockTransfer(transfer: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    const transfers = this.base.getItem<StockTransfer>('stock_transfers', []);
    const transferItems = this.base.getItem<StockTransferItem>('stock_transfer_items', []);
    let saved: StockTransfer;

    if (transfer.id) {
      const idx = transfers.findIndex((t) => t.id === transfer.id);
      if (idx !== -1) {
        transfers[idx] = { ...transfers[idx], ...transfer, id: transfer.id, date_updated: new Date().toISOString() };
        saved = transfers[idx];
      } else {
        saved = { ...transfer, id: transfer.id, date_updated: new Date().toISOString() } as StockTransfer;
        transfers.push(saved);
      }
    } else {
      const newId = this.base.generateUniqueId(transfers);
      saved = {
        id: newId,
        organization_id: this.base.getActiveOrgId() || 1,
        transfer_number: transfer.transfer_number || `TRF-${Date.now().toString().slice(-6)}`,
        from_warehouse_id: transfer.from_warehouse_id || 1,
        to_warehouse_id: transfer.to_warehouse_id || 1,
        status: transfer.status || 'draft',
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        ...transfer,
      };
      transfers.push(saved);
    }
    this.base.setItem('stock_transfers', transfers);

    if (items && items.length > 0) {
      const filtered = transferItems.filter((i) => {
        const tId = typeof i.transfer_id === 'number' ? i.transfer_id : Number((i.transfer_id as any)?.id || (i as any).transfer_id);
        return tId !== saved.id;
      });

      for (const item of items) {
        const newItemId = this.base.generateUniqueId(filtered);
        filtered.push({
          id: item.id || newItemId,
          organization_id: this.base.getActiveOrgId() || 1,
          transfer_id: saved.id,
          variant_id: item.variant_id || 0,
          quantity: item.quantity || 1,
          created_at: new Date().toISOString(),
          ...item,
        });
      }
      this.base.setItem('stock_transfer_items', filtered);
    }

    return saved;
  }

  async deleteStockTransfer(id: number): Promise<boolean> {
    const transfers = this.base.getItem<StockTransfer>('stock_transfers', []);
    this.base.setItem('stock_transfers', transfers.filter((t) => t.id !== id));
    const items = this.base.getItem<StockTransferItem>('stock_transfer_items', []);
    this.base.setItem('stock_transfer_items', items.filter((i) => {
      const tId = typeof i.transfer_id === 'number' ? i.transfer_id : Number((i.transfer_id as any)?.id || (i as any).transfer_id);
      return tId !== id;
    }));
    return true;
  }
}
