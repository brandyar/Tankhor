import { QueryParams } from '../types';
import { LocalStorageBase } from './localBase';
import { normalizeId } from '../../utils/formatters';
import {
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  ProductVariant,
  Warehouse,
  PersonTransaction,
  InventoryMovement,
  InventoryItem
} from '../../types';

export class LocalProcurementStorage {
  constructor(private base: LocalStorageBase) {}

  // Suppliers
  async getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    let items = this.base.getItem<Supplier>('suppliers', []);
    items = this.base.filterByOrg(items, params);

    const purchaseOrders = this.base.getItem<PurchaseOrder>('purchase_orders', []);
    const personTxs = this.base.getItem<PersonTransaction>('person_transactions', []);

    if (params?.status) {
      items = items.filter((s) => s.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    }

    return items.map((supplier) => {
      const supOrders = purchaseOrders.filter((po) => {
        const supId = typeof po.supplier_id === 'object' ? (po.supplier_id as any)?.id : po.supplier_id;
        return Number(supId) === supplier.id && po.status !== 'cancelled';
      });

      let calculatedBalance = 0;
      const supTxs = personTxs.filter((tx) => {
        const supId = typeof tx.supplier_id === 'object' ? (tx.supplier_id as any)?.id : tx.supplier_id;
        return Number(supId) === supplier.id || tx.party_type === 'supplier';
      });

      if (supTxs.length > 0) {
        supTxs.forEach((tx) => {
          if (tx.type === 'creditor' || tx.transaction_type === 'purchase_invoice') {
            calculatedBalance += Number(tx.credit_amount || tx.amount) || 0;
          } else if (tx.type === 'debtor' || tx.transaction_type === 'cash_payment' || tx.transaction_type === 'payment') {
            calculatedBalance -= Number(tx.debit_amount || tx.amount) || 0;
          }
        });
      } else {
        calculatedBalance = Number(supplier.balance) || 0;
      }

      return {
        ...supplier,
        balance: calculatedBalance,
      };
    });
  }

  async getSupplierById(id: number): Promise<Supplier | null> {
    const list = await this.getSuppliers();
    return list.find((s) => s.id === id) || null;
  }

  async saveSupplier(supplier: Partial<Supplier>): Promise<Supplier> {
    const list = this.base.getItem<Supplier>('suppliers', []);
    let savedSupplier: Supplier;

    if (supplier.id) {
      const idx = list.findIndex((s) => s.id === supplier.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...supplier, id: supplier.id };
        savedSupplier = list[idx];
      } else {
        savedSupplier = { ...supplier, id: supplier.id } as Supplier;
        list.push(savedSupplier);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      savedSupplier = {
        id: newId,
        organization_id: this.base.getActiveOrgId() || 1,
        name: supplier.name || 'تامین‌کننده جدید',
        status: supplier.status || 'active',
        balance: Number(supplier.balance) || 0,
        date_created: new Date().toISOString(),
        ...supplier,
      };
      list.push(savedSupplier);
    }
    this.base.setItem('suppliers', list);
    return savedSupplier;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    const list = this.base.getItem<Supplier>('suppliers', []);
    const filtered = list.filter((s) => s.id !== id);
    this.base.setItem('suppliers', filtered);
    return true;
  }

  // Purchase Orders
  async getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    let items = this.base.getItem<PurchaseOrder>('purchase_orders', []);
    items = this.base.filterByOrg(items, params);

    const suppliers = this.base.getItem<Supplier>('suppliers', []);
    const warehouses = this.base.getItem<Warehouse>('warehouses', []);

    if (params?.status) {
      items = items.filter((po) => po.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((po) =>
        po.purchase_number.toLowerCase().includes(q) ||
        (po.supplier_name && po.supplier_name.toLowerCase().includes(q))
      );
    }

    return items
      .map((po) => {
        const sId = typeof po.supplier_id === 'object' ? (po.supplier_id as any)?.id : po.supplier_id;
        const wId = typeof po.warehouse_id === 'object' ? (po.warehouse_id as any)?.id : po.warehouse_id;
        const sup = suppliers.find((s) => s.id === sId);
        const wh = warehouses.find((w) => w.id === wId);

        return {
          ...po,
          supplier_name: sup?.name || po.supplier_name,
          warehouse_name: wh?.name,
        };
      })
      .sort((a, b) => new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime());
  }

  async getPurchaseOrderById(id: number): Promise<PurchaseOrder | null> {
    const list = await this.getPurchaseOrders();
    return list.find((po) => po.id === id) || null;
  }

  async savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    const purchaseOrders = this.base.getItem<PurchaseOrder>('purchase_orders', []);
    const poItems = this.base.getItem<PurchaseOrderItem>('purchase_order_items', []);
    const existingPo = po.id ? purchaseOrders.find((p) => p.id === po.id) : null;
    const oldStatus = existingPo?.status;

    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = Number(po.discount) || 0;

    if (items && items.length > 0) {
      items.forEach((item) => {
        const qty = item.quantity_ordered || 0;
        const cost = item.unit_cost || 0;
        subtotal += qty * cost;
      });
    } else if (po.subtotal !== undefined) {
      subtotal = Number(po.subtotal) || 0;
    }

    totalTax = Number(po.tax) || 0;
    const calculatedTotal = po.total !== undefined ? Number(po.total) : subtotal - totalDiscount + totalTax;

    let savedPo: PurchaseOrder;
    if (po.id) {
      const idx = purchaseOrders.findIndex((p) => p.id === po.id);
      if (idx !== -1) {
        purchaseOrders[idx] = {
          ...purchaseOrders[idx],
          ...po,
          id: po.id,
          subtotal,
          tax: totalTax,
          discount: totalDiscount,
          total: calculatedTotal,
          date_updated: new Date().toISOString(),
        };
        savedPo = purchaseOrders[idx];
      } else {
        savedPo = {
          ...po,
          id: po.id,
          subtotal,
          tax: totalTax,
          discount: totalDiscount,
          total: calculatedTotal,
          date_updated: new Date().toISOString(),
        } as PurchaseOrder;
        purchaseOrders.push(savedPo);
      }
    } else {
      const newId = this.base.generateUniqueId(purchaseOrders);
      savedPo = {
        id: newId,
        organization_id: this.base.getActiveOrgId() || 1,
        supplier_id: po.supplier_id || 1,
        warehouse_id: po.warehouse_id || 1,
        purchase_number: po.purchase_number || `PO-${Date.now().toString().slice(-6)}`,
        status: po.status || 'draft',
        currency: po.currency || 'IRR',
        subtotal,
        discount: totalDiscount,
        tax: totalTax,
        total: calculatedTotal,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        ...po,
      };
      purchaseOrders.push(savedPo);
    }
    this.base.setItem('purchase_orders', purchaseOrders);

    // Save purchase order items
    let savedPoItems: PurchaseOrderItem[] = [];
    if (items && items.length > 0) {
      const filtered = poItems.filter((i) => {
        const pId = typeof i.purchase_order_id === 'number' ? i.purchase_order_id : Number((i.purchase_order_id as any)?.id || (i as any).purchase_order_id);
        return pId !== savedPo.id;
      });

      for (const item of items) {
        const newItemId = this.base.generateUniqueId(filtered);
        const qtyOrdered = item.quantity_ordered || 1;
        const unitCost = item.unit_cost || 0;
        const totalCost = item.total || qtyOrdered * unitCost;

        const newItem: PurchaseOrderItem = {
          id: item.id || newItemId,
          organization_id: this.base.getActiveOrgId() || 1,
          purchase_order_id: savedPo.id,
          variant_id: item.variant_id || 0,
          quantity_ordered: qtyOrdered,
          quantity_received: item.quantity_received ?? (savedPo.status === 'received' ? qtyOrdered : 0),
          unit_cost: unitCost,
          total: totalCost,
          created_at: new Date().toISOString(),
          ...item,
        };
        filtered.push(newItem);
        savedPoItems.push(newItem);
      }
      this.base.setItem('purchase_order_items', filtered);
    } else {
      savedPoItems = poItems.filter((i) => {
        const pId = typeof i.purchase_order_id === 'number' ? i.purchase_order_id : Number((i.purchase_order_id as any)?.id || (i as any).purchase_order_id);
        return pId === savedPo.id;
      });
    }

    // Handle inventory & accounting side effects when status becomes 'received'
    const newStatus = savedPo.status;
    if (newStatus === 'received' && oldStatus !== 'received') {
      const movements = this.base.getItem<InventoryMovement>('inventory_movements', []);
      const invItems = this.base.getItem<InventoryItem>('inventory_items', []);
      const wId = typeof savedPo.warehouse_id === 'object' ? (savedPo.warehouse_id as any)?.id : savedPo.warehouse_id;

      for (const item of savedPoItems) {
        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
        const qty = item.quantity_received || item.quantity_ordered || 1;

        // Record stock movement
        const movId = this.base.generateUniqueId(movements);
        movements.push({
          id: movId,
          organization_id: this.base.getActiveOrgId() || 1,
          variant_id: vId,
          warehouse_id: wId,
          type: 'purchase',
          quantity: qty,
          reference_type: 'purchase_order',
          reference_id: String(savedPo.id),
          note: `دریافت فاکتور خرید ${savedPo.purchase_number}`,
          created_at: new Date().toISOString(),
        });

        // Update inventory item
        const invIdx = invItems.findIndex((ii) => {
          const ivId = typeof ii.variant_id === 'object' ? (ii.variant_id as any)?.id : ii.variant_id;
          const iwId = typeof ii.warehouse_id === 'object' ? (ii.warehouse_id as any)?.id : ii.warehouse_id;
          return ivId === vId && iwId === wId;
        });

        if (invIdx !== -1) {
          invItems[invIdx].quantity += qty;
          invItems[invIdx].available_quantity = invItems[invIdx].quantity - (invItems[invIdx].reserved_quantity || 0);
          invItems[invIdx].updated_at = new Date().toISOString();
        } else {
          const newItemId = this.base.generateUniqueId(invItems);
          invItems.push({
            id: newItemId,
            organization_id: this.base.getActiveOrgId() || 1,
            variant_id: vId,
            warehouse_id: wId,
            quantity: qty,
            reserved_quantity: 0,
            available_quantity: qty,
            damaged_quantity: 0,
            updated_at: new Date().toISOString(),
          });
        }
      }

      this.base.setItem('inventory_movements', movements);
      this.base.setItem('inventory_items', invItems);

      // Person Transaction (Supplier Ledger - Payable)
      const personTxs = this.base.getItem<PersonTransaction>('person_transactions', []);
      const supId = typeof savedPo.supplier_id === 'object' ? (savedPo.supplier_id as any)?.id : savedPo.supplier_id;
      const existingTx = personTxs.find((tx) => tx.purchase_order_id === savedPo.id || (tx.reference_code === savedPo.purchase_number && tx.transaction_type === 'purchase_invoice'));

      if (!existingTx) {
        const txId = this.base.generateUniqueId(personTxs);
        personTxs.push({
          id: txId,
          organization_id: this.base.getActiveOrgId() || 1,
          party_type: 'supplier',
          supplier_id: supId,
          transaction_type: 'purchase_invoice',
          type: 'creditor',
          amount: savedPo.total,
          debit_amount: 0,
          credit_amount: savedPo.total,
          balance_after: 0,
          purchase_order_id: savedPo.id,
          reference_code: savedPo.purchase_number,
          transaction_date: savedPo.date_created || new Date().toISOString(),
          description: `فاکتور خرید ${savedPo.purchase_number}`,
          date_created: new Date().toISOString(),
        });
        this.base.setItem('person_transactions', personTxs);
      }
    }

    // Rollback if changed from received to cancelled
    if (oldStatus === 'received' && newStatus === 'cancelled') {
      const movements = this.base.getItem<InventoryMovement>('inventory_movements', []);
      const invItems = this.base.getItem<InventoryItem>('inventory_items', []);
      const wId = typeof savedPo.warehouse_id === 'object' ? (savedPo.warehouse_id as any)?.id : savedPo.warehouse_id;

      for (const item of savedPoItems) {
        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
        const qty = item.quantity_received || item.quantity_ordered || 1;

        const movId = this.base.generateUniqueId(movements);
        movements.push({
          id: movId,
          organization_id: this.base.getActiveOrgId() || 1,
          variant_id: vId,
          warehouse_id: wId,
          type: 'adjustment',
          quantity: -qty,
          reference_type: 'purchase_order',
          reference_id: String(savedPo.id),
          note: `لغو سفارش خرید ${savedPo.purchase_number}`,
          created_at: new Date().toISOString(),
        });

        const invIdx = invItems.findIndex((ii) => {
          const ivId = typeof ii.variant_id === 'object' ? (ii.variant_id as any)?.id : ii.variant_id;
          const iwId = typeof ii.warehouse_id === 'object' ? (ii.warehouse_id as any)?.id : ii.warehouse_id;
          return ivId === vId && iwId === wId;
        });

        if (invIdx !== -1) {
          invItems[invIdx].quantity = Math.max(0, invItems[invIdx].quantity - qty);
          invItems[invIdx].available_quantity = invItems[invIdx].quantity - (invItems[invIdx].reserved_quantity || 0);
          invItems[invIdx].updated_at = new Date().toISOString();
        }
      }

      this.base.setItem('inventory_movements', movements);
      this.base.setItem('inventory_items', invItems);
    }

    return savedPo;
  }

  async deletePurchaseOrder(id: number): Promise<boolean> {
    const list = this.base.getItem<PurchaseOrder>('purchase_orders', []);
    const target = list.find((p) => p.id === id);
    if (target && target.status === 'received') {
      await this.savePurchaseOrder({ ...target, status: 'cancelled' });
    }
    this.base.setItem('purchase_orders', list.filter((p) => p.id !== id));
    const items = this.base.getItem<PurchaseOrderItem>('purchase_order_items', []);
    this.base.setItem('purchase_order_items', items.filter((i) => {
      const pId = typeof i.purchase_order_id === 'number' ? i.purchase_order_id : Number((i.purchase_order_id as any)?.id || (i as any).purchase_order_id);
      return pId !== id;
    }));
    return true;
  }

  async getPurchaseOrderItems(purchaseOrderId?: number): Promise<PurchaseOrderItem[]> {
    let items = this.base.getItem<PurchaseOrderItem>('purchase_order_items', []);
    const variants = this.base.getItem<ProductVariant>('product_variants', []);

    if (purchaseOrderId) {
      items = items.filter((i) => {
        const pId = typeof i.purchase_order_id === 'number' ? i.purchase_order_id : Number((i.purchase_order_id as any)?.id || (i as any).purchase_order_id);
        return pId === purchaseOrderId;
      });
    }

    return items.map((item) => {
      const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
      const variant = variants.find((v) => v.id === vId);
      return {
        ...item,
        variant_sku: variant?.sku,
      };
    });
  }

  async savePurchaseOrderItem(item: Partial<PurchaseOrderItem>): Promise<PurchaseOrderItem> {
    const list = this.base.getItem<PurchaseOrderItem>('purchase_order_items', []);
    let saved: PurchaseOrderItem;

    if (item.id) {
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...item, id: item.id };
        saved = list[idx];
      } else {
        saved = { ...item, id: item.id } as PurchaseOrderItem;
        list.push(saved);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      const qtyOrdered = item.quantity_ordered || 1;
      const unitCost = item.unit_cost || 0;
      saved = {
        id: newId,
        organization_id: this.base.getActiveOrgId() || 1,
        purchase_order_id: item.purchase_order_id || 0,
        variant_id: item.variant_id || 0,
        quantity_ordered: qtyOrdered,
        quantity_received: item.quantity_received || 0,
        unit_cost: unitCost,
        total: item.total || qtyOrdered * unitCost,
        created_at: new Date().toISOString(),
        ...item,
      };
      list.push(saved);
    }

    this.base.setItem('purchase_order_items', list);
    return saved;
  }

  async deletePurchaseOrderItem(id: number): Promise<boolean> {
    const list = this.base.getItem<PurchaseOrderItem>('purchase_order_items', []);
    const filtered = list.filter((i) => i.id !== id);
    this.base.setItem('purchase_order_items', filtered);
    return true;
  }
}
