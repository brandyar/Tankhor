import { CloudStorageBase } from './cloudBase';
import { QueryParams } from '../types';
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

export class CloudInventoryStorage {
  constructor(private base: CloudStorageBase) {}

  // Warehouses & Locations
  async getWarehouses(params?: QueryParams): Promise<Warehouse[]> {
    try {
      return await this.base.client.getItems<Warehouse>('warehouses', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getWarehouses(params);
    }
  }

  async getWarehouseById(id: number): Promise<Warehouse | null> {
    try {
      return await this.base.client.getItemById<Warehouse>('warehouses', id);
    } catch {
      return this.base.localAdapter.getWarehouseById(id);
    }
  }

  async saveWarehouse(wh: Partial<Warehouse>): Promise<Warehouse> {
    try {
      if (wh.id) return await this.base.client.updateItem<Warehouse>('warehouses', wh.id, wh);
      return await this.base.client.createItem<Warehouse>('warehouses', wh);
    } catch {
      const saved = await this.base.localAdapter.saveWarehouse(wh);
      this.base.syncManager.enqueue({ action: wh.id ? 'UPDATE' : 'CREATE', collection: 'warehouses', payload: saved });
      return saved;
    }
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    try {
      return await this.base.client.deleteItem('warehouses', id);
    } catch {
      const res = await this.base.localAdapter.deleteWarehouse(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'warehouses', payload: { id } });
      return res;
    }
  }

  async getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    const filter: any = {};
    if (params?.warehouse_id) filter.warehouse_id = { _eq: params.warehouse_id };
    try {
      return await this.base.client.getItems<WarehouseLocation>('warehouse_locations', {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      });
    } catch {
      return this.base.localAdapter.getWarehouseLocations(params);
    }
  }

  async getLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.getWarehouseLocations(params);
  }

  async getLocationsByWarehouseId(warehouseId: number): Promise<WarehouseLocation[]> {
    return this.getWarehouseLocations({ warehouse_id: warehouseId });
  }

  async saveWarehouseLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    try {
      if (loc.id) return await this.base.client.updateItem<WarehouseLocation>('warehouse_locations', loc.id, loc);
      return await this.base.client.createItem<WarehouseLocation>('warehouse_locations', loc);
    } catch {
      const saved = await this.base.localAdapter.saveWarehouseLocation(loc);
      this.base.syncManager.enqueue({ action: loc.id ? 'UPDATE' : 'CREATE', collection: 'warehouse_locations', payload: saved });
      return saved;
    }
  }

  async saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.saveWarehouseLocation(loc);
  }

  async deleteWarehouseLocation(id: number): Promise<boolean> {
    try {
      return await this.base.client.deleteItem('warehouse_locations', id);
    } catch {
      const res = await this.base.localAdapter.deleteWarehouseLocation(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'warehouse_locations', payload: { id } });
      return res;
    }
  }

  async deleteLocation(id: number): Promise<boolean> {
    return this.deleteWarehouseLocation(id);
  }

  // Inventory Items
  async getInventoryItems(params?: QueryParams): Promise<InventoryItem[]> {
    const filter: any = {};
    if (params?.organization_id) filter.organization_id = { _eq: params.organization_id };
    if (params?.warehouse_id) filter.warehouse_id = { _eq: params.warehouse_id };
    if (params?.variant_id) filter.variant_id = { _eq: params.variant_id };

    try {
      const items = await this.base.client.getItems<InventoryItem>('inventory_items', {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        sort: '-id',
      });

      const [variants, products, colors, sizes, warehouses, locations] = await Promise.all([
        this.base.client.getItems<ProductVariant>('product_variants', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
        this.base.client.getItems<Product>('products', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
        this.base.client.getItems<Color>('colors', {}).catch(() => []),
        this.base.client.getItems<Size>('sizes', {}).catch(() => []),
        this.base.client.getItems<Warehouse>('warehouses', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
        this.base.client.getItems<WarehouseLocation>('warehouse_locations', {}).catch(() => []),
      ]);

      return items.map((item) => {
        const vId = typeof item.variant_id === 'number' ? item.variant_id : (item.variant_id as any)?.id;
        const wId = typeof item.warehouse_id === 'number' ? item.warehouse_id : (item.warehouse_id as any)?.id;
        const locId = typeof item.location_id === 'number' ? item.location_id : (item.location_id as any)?.id;

        const vObj = typeof item.variant_id === 'object' && item.variant_id !== null ? (item.variant_id as any) : null;
        const wObj = typeof item.warehouse_id === 'object' && item.warehouse_id !== null ? (item.warehouse_id as any) : null;
        const lObj = typeof item.location_id === 'object' && item.location_id !== null ? (item.location_id as any) : null;

        const variant = variants.find((v) => v.id === vId) || vObj;
        const prodId = variant ? (typeof variant.product_id === 'number' ? variant.product_id : (variant.product_id as any)?.id) : null;
        const product = prodId ? products.find((p) => p.id === prodId) : (typeof variant?.product_id === 'object' ? variant.product_id : null);

        const colorId = variant ? (typeof variant.color_id === 'number' ? variant.color_id : (variant.color_id as any)?.id) : null;
        const sizeId = variant ? (typeof variant.size_id === 'number' ? variant.size_id : (variant.size_id as any)?.id) : null;

        const color = colorId ? colors.find((c) => c.id === colorId) : (typeof variant?.color_id === 'object' ? variant.color_id : null);
        const size = sizeId ? sizes.find((s) => s.id === sizeId) : (typeof variant?.size_id === 'object' ? variant.size_id : null);
        const warehouse = warehouses.find((w) => w.id === wId) || wObj;
        const location = locations.find((l) => l.id === locId) || lObj;

        return {
          ...item,
          sku: variant?.sku || (vId ? `SKU-${vId}` : '-'),
          product_title: product?.title || variant?.product_title || 'محصول',
          color_name: color?.name || variant?.color_name || '-',
          size_name: size?.name || variant?.size_name || '-',
          warehouse_name: warehouse?.name || 'انبار مرکزی',
          location_name: location?.name || '-',
        };
      });
    } catch (err) {
      console.warn('[CloudInventoryStorage] Error fetching inventory items from cloud:', err);
      return this.base.localAdapter.getInventoryItems(params);
    }
  }

  async getInventoryItem(variantId: number, warehouseId: number): Promise<InventoryItem | null> {
    try {
      const items = await this.getInventoryItems({ variant_id: variantId, warehouse_id: warehouseId });
      return items.length > 0 ? items[0] : null;
    } catch {
      const localItems = await this.base.localAdapter.getInventoryItems({ variant_id: variantId, warehouse_id: warehouseId });
      return localItems.length > 0 ? localItems[0] : null;
    }
  }

  async saveInventoryItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    const payload: any = { ...item };
    delete payload.sku;
    delete payload.product_title;
    delete payload.color_name;
    delete payload.size_name;
    delete payload.warehouse_name;
    delete payload.location_name;

    payload.organization_id = this.base.cleanInt(payload.organization_id) || 1;
    payload.variant_id = this.base.cleanInt(payload.variant_id);
    payload.warehouse_id = this.base.cleanInt(payload.warehouse_id) || 1;
    payload.location_id = this.base.cleanInt(payload.location_id);
    payload.quantity = Math.max(0, Number(payload.quantity) || 0);
    payload.reserved_quantity = Math.max(0, Number(payload.reserved_quantity) || 0);
    payload.damaged_quantity = Math.max(0, Number(payload.damaged_quantity) || 0);
    payload.available_quantity = Math.max(0, payload.quantity - payload.reserved_quantity - payload.damaged_quantity);
    if (payload.reorder_point !== undefined) payload.reorder_point = Math.max(0, Number(payload.reorder_point) || 0);
    if (payload.safety_stock !== undefined) payload.safety_stock = Math.max(0, Number(payload.safety_stock) || 0);
    payload.updated_at = new Date().toISOString();

    const id = payload.id ? Number(payload.id) : undefined;
    delete payload.id;

    if (id) {
      return this.base.client.updateItem<InventoryItem>('inventory_items', id, payload);
    }
    return this.base.client.createItem<InventoryItem>('inventory_items', payload);
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    return this.base.client.deleteItem('inventory_items', id);
  }

  // Movements
  async getInventoryMovements(params?: QueryParams): Promise<InventoryMovement[]> {
    const filter: any = {};
    if (params?.organization_id) filter.organization_id = { _eq: params.organization_id };
    if (params?.warehouse_id) filter.warehouse_id = { _eq: params.warehouse_id };
    if (params?.variant_id) filter.variant_id = { _eq: params.variant_id };
    if (params?.type) filter.type = { _eq: params.type };

    try {
      const [movements, variants, warehouses] = await Promise.all([
        this.base.client.getItems<InventoryMovement>('inventory_movements', {
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          sort: '-created_at',
        }),
        this.base.client.getItems<ProductVariant>('product_variants', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
        this.base.client.getItems<Warehouse>('warehouses', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
      ]);

      return movements.map((m) => {
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
    } catch {
      return this.base.localAdapter.getInventoryMovements(params);
    }
  }

  async saveInventoryMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    return this.recordMovement(movement);
  }

  async recordMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    const payload: any = { ...movement };
    delete payload.sku;
    delete payload.warehouse_name;

    payload.organization_id = this.base.cleanInt(payload.organization_id) || 1;
    payload.variant_id = this.base.cleanInt(payload.variant_id);
    payload.warehouse_id = this.base.cleanInt(payload.warehouse_id) || 1;
    payload.location_id = this.base.cleanInt(payload.location_id);
    payload.quantity = Math.max(0, Number(payload.quantity) || 1);
    if (!payload.type) payload.type = 'adjustment';
    if (!payload.reference_type) payload.reference_type = 'manual';

    const savedMovement = await this.base.client.createItem<InventoryMovement>('inventory_movements', payload);

    try {
      const vId = payload.variant_id;
      const wId = payload.warehouse_id;
      const moveQty = payload.quantity;
      const moveType = payload.type;

      const existingItems = await this.base.client.getItems<InventoryItem>('inventory_items', {
        filter: {
          _and: [
            { variant_id: { _eq: vId } },
            { warehouse_id: { _eq: wId } },
          ],
        },
      }).catch(() => []);

      if (existingItems.length > 0) {
        const item = existingItems[0];
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

        const availableQty = Math.max(0, currentQty - currentReserved - currentDamaged);

        await this.base.client.updateItem<InventoryItem>('inventory_items', item.id, {
          quantity: currentQty,
          available_quantity: availableQty,
          damaged_quantity: currentDamaged,
          location_id: payload.location_id || item.location_id,
          updated_at: new Date().toISOString(),
        });
      } else {
        let initialQty = moveQty;
        let initialDamaged = 0;
        if (moveType === 'damage') {
          initialDamaged = moveQty;
          initialQty = 0;
        }
        await this.base.client.createItem<InventoryItem>('inventory_items', {
          organization_id: payload.organization_id,
          variant_id: vId,
          warehouse_id: wId,
          location_id: payload.location_id,
          quantity: initialQty,
          reserved_quantity: 0,
          available_quantity: initialQty,
          damaged_quantity: initialDamaged,
          reorder_point: 5,
          safety_stock: 2,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (invErr) {
      console.warn('[CloudInventoryStorage] Auto-adjust inventory item warning:', invErr);
    }

    return savedMovement;
  }

  // Stock Transfers
  async getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    try {
      return await this.base.client.getItems<StockTransfer>('stock_transfers', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getStockTransfers(params);
    }
  }

  async getStockTransferById(id: number): Promise<StockTransfer | null> {
    try {
      return await this.base.client.getItemById<StockTransfer>('stock_transfers', id);
    } catch {
      const list = await this.base.localAdapter.getStockTransfers();
      return list.find((st) => st.id === id) || null;
    }
  }

  async getStockTransferItems(transferId?: number): Promise<StockTransferItem[]> {
    try {
      return await this.base.client.getItems<StockTransferItem>('stock_transfer_items', {
        filter: transferId ? { transfer_id: { _eq: transferId } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getStockTransferItems(transferId);
    }
  }

  async saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    try {
      const payload: any = { ...st };
      let savedSt: StockTransfer;
      if (payload.id) {
        const id = payload.id;
        delete payload.id;
        savedSt = await this.base.client.updateItem<StockTransfer>('stock_transfers', id, payload);
      } else {
        delete payload.id;
        savedSt = await this.base.client.createItem<StockTransfer>('stock_transfers', payload);
      }

      if (items && items.length > 0) {
        for (const item of items) {
          const itemPayload: any = { ...item };
          delete itemPayload.id;
          await this.base.client.createItem<StockTransferItem>('stock_transfer_items', {
            ...itemPayload,
            transfer_id: savedSt.id,
            organization_id: savedSt.organization_id,
          });
        }
      }

      await this.base.localAdapter.saveStockTransfer(savedSt, items);
      return savedSt;
    } catch (err: any) {
      console.warn('[CloudInventoryStorage] saveStockTransfer failed, fallback to local:', err?.message || err);
      const saved = await this.base.localAdapter.saveStockTransfer(st, items);
      this.base.syncManager.enqueue({ action: st.id ? 'UPDATE' : 'CREATE', collection: 'stock_transfers', payload: saved });
      return saved;
    }
  }

  async deleteStockTransfer(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('stock_transfers', id);
      await this.base.localAdapter.deleteStockTransfer(id);
      return true;
    } catch (err: any) {
      console.warn('[CloudInventoryStorage] deleteStockTransfer failed, fallback to local:', err?.message || err);
      const res = await this.base.localAdapter.deleteStockTransfer(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'stock_transfers', payload: { id } });
      return res;
    }
  }
}
