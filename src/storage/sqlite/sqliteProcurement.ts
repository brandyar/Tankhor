import { QueryParams } from '../types';
import { SqliteStorageBase } from './sqliteBase';
import {
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  InventoryItem,
  InventoryMovement,
} from '../../types';
import { normalizeId } from '../../utils/formatters';

export class SqliteProcurementStorage {
  constructor(private base: SqliteStorageBase) {}

  // ==========================================
  // Suppliers
  // ==========================================
  async getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    return this.base.getItems<Supplier>('suppliers', this.base.getActiveOrgId(params));
  }

  async getSupplierById(id: number): Promise<Supplier | null> {
    const list = await this.getSuppliers();
    return list.find((s) => s.id === id) || null;
  }

  async saveSupplier(sup: Partial<Supplier>): Promise<Supplier> {
    const list = await this.base.getItems<Supplier>('suppliers');
    const validId = typeof sup.id === 'number' && sup.id > 0 ? sup.id : this.base.generateUniqueId(list);
    const saved: Supplier = {
      name: sup.name || 'تامین‌کننده جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      organization_id: sup.organization_id || 1,
      ...sup,
      id: validId,
    };
    await this.base.saveItem('suppliers', saved);
    return saved;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    return this.base.deleteItem('suppliers', id);
  }

  // ==========================================
  // Purchase Orders & Items
  // ==========================================
  async getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    return this.base.getItems<PurchaseOrder>('purchase_orders', this.base.getActiveOrgId(params));
  }

  async getPurchaseOrderById(id: number): Promise<PurchaseOrder | null> {
    const list = await this.getPurchaseOrders();
    return list.find((p) => p.id === id) || null;
  }

  async getPurchaseOrderItems(purchaseOrderId?: number): Promise<PurchaseOrderItem[]> {
    let items = await this.base.getItems<PurchaseOrderItem>('purchase_order_items');
    if (purchaseOrderId) {
      items = items.filter((it) => {
        const poId = typeof it.purchase_order_id === 'object' ? (it.purchase_order_id as any)?.id : it.purchase_order_id;
        return Number(poId) === Number(purchaseOrderId);
      });
    }
    return items;
  }

  async savePurchaseOrderItem(item: Partial<PurchaseOrderItem>): Promise<PurchaseOrderItem> {
    const all = await this.base.getItems<PurchaseOrderItem>('purchase_order_items');
    const validId = typeof item.id === 'number' && item.id > 0 ? item.id : this.base.generateUniqueId(all);
    const qty = item.quantity_ordered || 1;
    const unitCost = item.unit_cost || 0;
    const savedItem: PurchaseOrderItem = {
      organization_id: item.organization_id || this.base.getActiveOrgId() || 1,
      purchase_order_id: item.purchase_order_id || 1,
      variant_id: item.variant_id || 1,
      quantity_ordered: qty,
      quantity_received: item.quantity_received || 0,
      unit_cost: unitCost,
      total: item.total ?? (qty * unitCost),
      ...item,
      id: validId,
    };
    await this.base.saveItem('purchase_order_items', savedItem);
    return savedItem;
  }

  async deletePurchaseOrderItem(id: number): Promise<boolean> {
    return this.base.deleteItem('purchase_order_items', id);
  }

  async savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    const list = await this.base.getItems<PurchaseOrder>('purchase_orders');
    const validId = typeof po.id === 'number' && po.id > 0 ? po.id : this.base.generateUniqueId(list);
    const orgId = po.organization_id || this.base.getActiveOrgId() || 1;

    const previousPo = po.id ? list.find((p) => p.id === po.id) : null;

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
      organization_id: orgId,
      ...po,
      id: validId,
    };
    await this.base.saveItem('purchase_orders', saved);

    let savedItems: PurchaseOrderItem[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      const allPoItems = await this.base.getItems<PurchaseOrderItem>('purchase_order_items');
      for (const itm of items) {
        const itmId = typeof itm.id === 'number' && itm.id > 0 ? itm.id : this.base.generateUniqueId(allPoItems);
        const qty = itm.quantity_ordered || 1;
        const unitCost = itm.unit_cost || 0;
        const savedItem: PurchaseOrderItem = {
          organization_id: itm.organization_id || orgId || 1,
          variant_id: itm.variant_id || 1,
          quantity_ordered: qty,
          quantity_received: itm.quantity_received || 0,
          unit_cost: unitCost,
          total: itm.total ?? (qty * unitCost),
          ...itm,
          id: itmId,
          purchase_order_id: validId,
        };
        await this.base.saveItem('purchase_order_items', savedItem);
        savedItems.push(savedItem);
      }
    } else if (validId) {
      savedItems = await this.getPurchaseOrderItems(validId);
    }

    // Inventory side-effects: Stock receipt upon 'received'
    const isNowReceived = saved.status === 'received';
    const wasReceived = previousPo && previousPo.status === 'received';
    const isNowCancelled = saved.status === 'cancelled';
    const targetWarehouseId = typeof saved.warehouse_id === 'object' ? (saved.warehouse_id as any)?.id : (saved.warehouse_id || 1);

    if ((!wasReceived && isNowReceived) || (previousPo === null && isNowReceived)) {
      const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
      const movementList = await this.base.getItems<InventoryMovement>('inventory_movements');

      for (const itm of savedItems) {
        const vId = typeof itm.variant_id === 'object' ? (itm.variant_id as any)?.id : itm.variant_id;
        const qty = Number(itm.quantity_received) || Number(itm.quantity_ordered) || 1;

        const inv = inventoryList.find((i) => normalizeId(i.variant_id) === normalizeId(vId) && Number(i.warehouse_id) === Number(targetWarehouseId));
        if (inv) {
          inv.quantity = (Number(inv.quantity) || 0) + qty;
          await this.base.saveItem('inventory_items', inv);
        } else {
          const newInvId = this.base.generateUniqueId(inventoryList);
          await this.base.saveItem('inventory_items', {
            id: newInvId,
            organization_id: orgId,
            variant_id: vId,
            warehouse_id: targetWarehouseId,
            quantity: qty,
            reserved_quantity: 0,
          });
        }

        const movId = this.base.generateUniqueId(movementList);
        await this.base.saveItem('inventory_movements', {
          id: movId,
          organization_id: orgId,
          variant_id: vId,
          warehouse_id: targetWarehouseId,
          type: 'purchase',
          quantity: qty,
          reference_type: 'purchase_order',
          reference_id: String(saved.id),
          created_at: new Date().toISOString(),
        });
      }
    } else if (wasReceived && isNowCancelled) {
      // Rollback received stock
      const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
      const movementList = await this.base.getItems<InventoryMovement>('inventory_movements');

      for (const itm of savedItems) {
        const vId = typeof itm.variant_id === 'object' ? (itm.variant_id as any)?.id : itm.variant_id;
        const qty = Number(itm.quantity_received) || Number(itm.quantity_ordered) || 1;

        const inv = inventoryList.find((i) => normalizeId(i.variant_id) === normalizeId(vId) && Number(i.warehouse_id) === Number(targetWarehouseId));
        if (inv) {
          inv.quantity = Math.max(0, (Number(inv.quantity) || 0) - qty);
          await this.base.saveItem('inventory_items', inv);
        }

        const movId = this.base.generateUniqueId(movementList);
        await this.base.saveItem('inventory_movements', {
          id: movId,
          organization_id: orgId,
          variant_id: vId,
          warehouse_id: targetWarehouseId,
          type: 'return',
          quantity: qty,
          reference_type: 'purchase_order',
          reference_id: String(saved.id),
          created_at: new Date().toISOString(),
        });
      }
    }

    return saved;
  }

  async deletePurchaseOrder(id: number): Promise<boolean> {
    const list = await this.base.getItems<PurchaseOrder>('purchase_orders');
    const po = list.find((p) => p.id === id);

    if (po && po.status === 'received') {
      // Rollback stock
      const poItems = await this.getPurchaseOrderItems(id);
      const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
      const movementList = await this.base.getItems<InventoryMovement>('inventory_movements');
      const targetWarehouseId = typeof po.warehouse_id === 'object' ? (po.warehouse_id as any)?.id : (po.warehouse_id || 1);

      for (const itm of poItems) {
        const vId = typeof itm.variant_id === 'object' ? (itm.variant_id as any)?.id : itm.variant_id;
        const qty = Number(itm.quantity_received) || Number(itm.quantity_ordered) || 1;

        const inv = inventoryList.find((i) => normalizeId(i.variant_id) === normalizeId(vId) && Number(i.warehouse_id) === Number(targetWarehouseId));
        if (inv) {
          inv.quantity = Math.max(0, (Number(inv.quantity) || 0) - qty);
          await this.base.saveItem('inventory_items', inv);
        }

        const movId = this.base.generateUniqueId(movementList);
        await this.base.saveItem('inventory_movements', {
          id: movId,
          organization_id: po.organization_id || 1,
          variant_id: vId,
          warehouse_id: targetWarehouseId,
          type: 'return',
          quantity: qty,
          reference_type: 'purchase_order',
          reference_id: String(po.id),
          created_at: new Date().toISOString(),
        });
      }
    }

    await this.base.deleteItem('purchase_orders', id);
    const allPoItems = await this.base.getItems<PurchaseOrderItem>('purchase_order_items');
    for (const itm of allPoItems) {
      const poId = typeof itm.purchase_order_id === 'object' ? (itm.purchase_order_id as any)?.id : itm.purchase_order_id;
      if (Number(poId) === Number(id)) {
        await this.base.deleteItem('purchase_order_items', itm.id);
      }
    }
    return true;
  }
}
