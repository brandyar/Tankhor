import { QueryParams } from '../types';
import { SqliteStorageBase } from './sqliteBase';
import {
  Customer,
  Order,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  FinancialAccount,
  TreasuryTransaction,
  InventoryItem,
  InventoryMovement,
  PersonTransaction,
} from '../../types';
import { normalizeId } from '../../utils/formatters';

export class SqliteSalesStorage {
  constructor(private base: SqliteStorageBase) {}

  // ==========================================
  // Customers
  // ==========================================
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    return this.base.getItems<Customer>('customers', this.base.getActiveOrgId(params));
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    const list = await this.getCustomers();
    return list.find((c) => c.id === id) || null;
  }

  async saveCustomer(cust: Partial<Customer>): Promise<Customer> {
    const list = await this.base.getItems<Customer>('customers');
    const validId = typeof cust.id === 'number' && cust.id > 0 ? cust.id : this.base.generateUniqueId(list);
    const saved: Customer = {
      name: cust.name || 'مشتری جدید',
      status: 'active',
      date_created: new Date().toISOString(),
      organization_id: cust.organization_id || 1,
      ...cust,
      id: validId,
    };
    await this.base.saveItem('customers', saved);
    return saved;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    return this.base.deleteItem('customers', id);
  }

  // ==========================================
  // Orders & Sales
  // ==========================================
  async getOrders(params?: QueryParams): Promise<Order[]> {
    return this.base.getItems<Order>('orders', this.base.getActiveOrgId(params));
  }

  async getOrderById(id: number): Promise<Order | null> {
    const list = await this.getOrders();
    return list.find((o) => o.id === id) || null;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    const all = await this.base.getItems<OrderItem>('order_items');
    return all.filter((i) => {
      const itemOrderId = typeof i.order_id === 'object' ? (i.order_id as any)?.id : i.order_id;
      return Number(itemOrderId) === Number(orderId);
    });
  }

  async saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    const list = await this.base.getItems<Order>('orders');
    const validId = typeof order.id === 'number' && order.id > 0 ? order.id : this.base.generateUniqueId(list);
    const orgId = order.organization_id || this.base.getActiveOrgId() || 1;

    const previousOrder = order.id ? list.find((o) => o.id === order.id) : null;

    const savedOrder: Order = {
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
      organization_id: orgId,
      ...order,
      id: validId,
    };
    await this.base.saveItem('orders', savedOrder);

    let savedItems: OrderItem[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      const allOrderItems = await this.base.getItems<OrderItem>('order_items');
      for (const itm of items) {
        const itmId = typeof itm.id === 'number' && itm.id > 0 ? itm.id : this.base.generateUniqueId(allOrderItems);
        const savedItem: OrderItem = {
          variant_id: itm.variant_id || 1,
          quantity: itm.quantity || 1,
          unit_price: itm.unit_price || 0,
          discount: itm.discount || 0,
          total: itm.total || ((itm.quantity || 1) * (itm.unit_price || 0)),
          created_at: new Date().toISOString(),
          ...itm,
          id: itmId,
          order_id: validId,
          organization_id: savedOrder.organization_id || 1,
        };
        await this.base.saveItem('order_items', savedItem);
        savedItems.push(savedItem);
      }
    } else if (validId) {
      savedItems = await this.getOrderItems(validId);
    }

    // Handle inventory side effects on status changes
    const isNew = !previousOrder;
    const isNowConfirmedOrCompleted = savedOrder.status === 'confirmed' || savedOrder.status === 'completed';
    const wasConfirmedOrCompleted =
      previousOrder &&
      (previousOrder.status === 'confirmed' ||
        previousOrder.status === 'completed' ||
        previousOrder.status === 'partially_returned' ||
        previousOrder.status === 'returned');
    const isNowCancelled = savedOrder.status === 'cancelled';

    const targetWarehouseId = typeof savedOrder.warehouse_id === 'object' ? (savedOrder.warehouse_id as any)?.id : (savedOrder.warehouse_id || 1);

    if ((isNew && isNowConfirmedOrCompleted) || (!wasConfirmedOrCompleted && isNowConfirmedOrCompleted)) {
      // Deduct stock
      const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
      const movementList = await this.base.getItems<InventoryMovement>('inventory_movements');

      for (const itm of savedItems) {
        const vId = typeof itm.variant_id === 'object' ? (itm.variant_id as any)?.id : itm.variant_id;
        const normVId = normalizeId(vId);
        if (!normVId) continue;
        const targetWhNorm = normalizeId(targetWarehouseId);
        const qty = Number(itm.quantity) || 1;

        const inv = inventoryList.find((i) => normalizeId(i.variant_id) === normVId && (targetWhNorm ? normalizeId(i.warehouse_id) === targetWhNorm : true));
        if (inv) {
          inv.quantity = Math.max(0, (Number(inv.quantity) || 0) - qty);
          inv.available_quantity = Math.max(0, inv.quantity - (Number(inv.reserved_quantity) || 0) - (Number(inv.damaged_quantity) || 0));
          inv.updated_at = new Date().toISOString();
          await this.base.saveItem('inventory_items', inv);
        }

        const movId = this.base.generateUniqueId(movementList);
        await this.base.saveItem('inventory_movements', {
          id: movId,
          organization_id: orgId,
          variant_id: normVId,
          warehouse_id: targetWarehouseId,
          type: 'sale',
          quantity: qty,
          reference_type: 'order',
          reference_id: String(savedOrder.id),
          created_at: new Date().toISOString(),
        });
      }
    } else if (wasConfirmedOrCompleted && isNowCancelled) {
      // Rollback stock
      const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
      const movementList = await this.base.getItems<InventoryMovement>('inventory_movements');

      for (const itm of savedItems) {
        const vId = typeof itm.variant_id === 'object' ? (itm.variant_id as any)?.id : itm.variant_id;
        const normVId = normalizeId(vId);
        if (!normVId) continue;
        const targetWhNorm = normalizeId(targetWarehouseId);
        const qty = Number(itm.quantity) || 1;

        const inv = inventoryList.find((i) => normalizeId(i.variant_id) === normVId && (targetWhNorm ? normalizeId(i.warehouse_id) === targetWhNorm : true));
        if (inv) {
          inv.quantity = (Number(inv.quantity) || 0) + qty;
          inv.available_quantity = Math.max(0, inv.quantity - (Number(inv.reserved_quantity) || 0) - (Number(inv.damaged_quantity) || 0));
          inv.updated_at = new Date().toISOString();
          await this.base.saveItem('inventory_items', inv);
        }

        const movId = this.base.generateUniqueId(movementList);
        await this.base.saveItem('inventory_movements', {
          id: movId,
          organization_id: orgId,
          variant_id: normVId,
          warehouse_id: targetWarehouseId,
          type: 'return',
          quantity: qty,
          reference_type: 'order',
          reference_id: String(savedOrder.id),
          created_at: new Date().toISOString(),
        });
      }
    }

    // Automatically reconcile order with treasury to guarantee instant visibility in accounting
    try {
      const targetOrg = Number(savedOrder.organization_id) || this.base.getActiveOrgId() || 1;
      await this.reconcileOrdersWithTreasury(targetOrg);
    } catch (rErr) {
      console.warn('[SqliteSalesStorage] Auto-reconcile after saveOrder warning:', rErr);
    }

    return savedOrder;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const list = await this.base.getItems<Order>('orders');
    const order = list.find((o) => o.id === id);

    if (order && (order.status === 'confirmed' || order.status === 'completed')) {
      // Rollback stock
      const orderItems = await this.getOrderItems(id);
      const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
      const movementList = await this.base.getItems<InventoryMovement>('inventory_movements');
      const targetWarehouseId = typeof order.warehouse_id === 'object' ? (order.warehouse_id as any)?.id : (order.warehouse_id || 1);

      for (const itm of orderItems) {
        const vId = typeof itm.variant_id === 'object' ? (itm.variant_id as any)?.id : itm.variant_id;
        const normVId = normalizeId(vId);
        if (!normVId) continue;
        const targetWhNorm = normalizeId(targetWarehouseId);
        const qty = Number(itm.quantity) || 1;

        const inv = inventoryList.find((i) => normalizeId(i.variant_id) === normVId && (targetWhNorm ? normalizeId(i.warehouse_id) === targetWhNorm : true));
        if (inv) {
          inv.quantity = (Number(inv.quantity) || 0) + qty;
          inv.available_quantity = Math.max(0, inv.quantity - (Number(inv.reserved_quantity) || 0) - (Number(inv.damaged_quantity) || 0));
          inv.updated_at = new Date().toISOString();
          await this.base.saveItem('inventory_items', inv);
        }

        const movId = this.base.generateUniqueId(movementList);
        await this.base.saveItem('inventory_movements', {
          id: movId,
          organization_id: order.organization_id || 1,
          variant_id: normVId,
          warehouse_id: targetWarehouseId,
          type: 'return',
          quantity: qty,
          reference_type: 'order',
          reference_id: String(order.id),
          created_at: new Date().toISOString(),
        });
      }
    }

    await this.base.deleteItem('orders', id);
    const allOrderItems = await this.base.getItems<OrderItem>('order_items');
    for (const itm of allOrderItems) {
      const itemOrderId = typeof itm.order_id === 'object' ? (itm.order_id as any)?.id : itm.order_id;
      if (Number(itemOrderId) === Number(id)) {
        await this.base.deleteItem('order_items', itm.id);
      }
    }
    return true;
  }

  async saveOrderItem(item: Partial<OrderItem>): Promise<OrderItem> {
    const all = await this.base.getItems<OrderItem>('order_items');
    const existing = item.id ? all.find((i) => Number(i.id) === Number(item.id)) : undefined;
    const validId =
      typeof item.id === 'number' && item.id > 0 ? item.id : this.base.generateUniqueId(all);
    const saved: OrderItem = {
      organization_id: existing?.organization_id || item.organization_id || this.base.getActiveOrgId() || 1,
      order_id: existing?.order_id || item.order_id || 0,
      variant_id: existing?.variant_id || item.variant_id || 0,
      quantity: item.quantity ?? existing?.quantity ?? 1,
      unit_price: item.unit_price ?? existing?.unit_price ?? 0,
      discount: item.discount ?? existing?.discount ?? 0,
      total: item.total ?? existing?.total ?? 0,
      returned_quantity: item.returned_quantity ?? existing?.returned_quantity ?? 0,
      created_at: existing?.created_at || new Date().toISOString(),
      ...existing,
      ...item,
      id: validId,
    };
    await this.base.saveItem('order_items', saved);
    return saved;
  }

  // ==========================================
  // Order Returns & Exchanges
  // ==========================================
  async getOrderReturns(params?: QueryParams & { order_id?: number; reason?: string }): Promise<OrderReturn[]> {
    const orgId = this.base.getActiveOrgId(params);
    let list = await this.base.getItems<OrderReturn>('order_returns', orgId);
    const [orders, customers, warehouses, allItems] = await Promise.all([
      this.base.getItems<Order>('orders', orgId),
      this.base.getItems<Customer>('customers', orgId),
      this.base.getItems<any>('warehouses', orgId),
      this.base.getItems<OrderReturnItem>('order_return_items', orgId),
    ]);

    if (params?.order_id) {
      list = list.filter((r) => {
        const oid = typeof r.original_order_id === 'object' ? (r.original_order_id as any)?.id : r.original_order_id;
        return Number(oid) === Number(params.order_id);
      });
    }
    if (params?.type && params.type !== 'all') {
      list = list.filter((r) => r.type === params.type);
    }
    if (params?.status && params.status !== 'all') {
      list = list.filter((r) => r.status === params.status);
    }
    if (params?.reason && params.reason !== 'all') {
      list = list.filter((r) => r.reason === params.reason);
    }
    if (params?.warehouse_id) {
      list = list.filter((r) => {
        const wId = typeof r.warehouse_id === 'object' ? (r.warehouse_id as any)?.id : r.warehouse_id;
        return Number(wId) === Number(params.warehouse_id);
      });
    }

    let mapped = list.map((ret) => {
      const oId = typeof ret.original_order_id === 'object' ? (ret.original_order_id as any)?.id : ret.original_order_id;
      const cId = typeof ret.customer_id === 'object' ? (ret.customer_id as any)?.id : ret.customer_id;
      const wId = typeof ret.warehouse_id === 'object' ? (ret.warehouse_id as any)?.id : ret.warehouse_id;
      const ord = orders.find((o) => Number(o.id) === Number(oId));
      const cust = customers.find((c) => Number(c.id) === Number(cId));
      const wh = warehouses.find((w: any) => Number(w.id) === Number(wId));
      const retItems = allItems.filter((it) => {
        const rId = typeof it.return_id === 'object' ? (it.return_id as any)?.id : it.return_id;
        return Number(rId) === Number(ret.id);
      });
      return {
        ...ret,
        original_order_number: ret.original_order_number || ord?.order_number,
        customer_name: ret.customer_name || cust?.name,
        warehouse_name: ret.warehouse_name || wh?.name,
        items_count: retItems.length,
      };
    });

    if (params?.search) {
      const q = params.search.toLowerCase();
      mapped = mapped.filter(
        (r) =>
          (r.return_number && r.return_number.toLowerCase().includes(q)) ||
          (r.original_order_number && r.original_order_number.toLowerCase().includes(q)) ||
          (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    return mapped.sort(
      (a, b) =>
        new Date(b.return_date || b.date_created || 0).getTime() -
        new Date(a.return_date || a.date_created || 0).getTime()
    );
  }

  async getOrderReturnItems(returnId?: number): Promise<OrderReturnItem[]> {
    const all = await this.base.getItems<OrderReturnItem>('order_return_items');
    const variants = await this.base.getItems<any>('product_variants');
    const filtered =
      returnId !== undefined
        ? all.filter((i) => {
            const rId = typeof i.return_id === 'object' ? (i.return_id as any)?.id : i.return_id;
            return Number(rId) === Number(returnId);
          })
        : all;

    return filtered.map((item) => {
      const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
      const v = variants.find((x: any) => Number(x.id) === Number(vId));
      return {
        ...item,
        sku: item.sku || v?.sku,
        product_title: item.product_title || v?.product_title,
        color_name: item.color_name || v?.color_name,
        size_name: item.size_name || v?.size_name,
      };
    });
  }

  async saveOrderReturn(
    ret: Partial<OrderReturn>,
    items?: Partial<OrderReturnItem>[]
  ): Promise<OrderReturn> {
    const list = await this.base.getItems<OrderReturn>('order_returns');
    const validId =
      typeof ret.id === 'number' && ret.id > 0 ? ret.id : this.base.generateUniqueId(list);
    const orgId = Number(ret.organization_id) || this.base.getActiveOrgId() || 1;
    const now = new Date().toISOString();

    const savedReturn: OrderReturn = {
      organization_id: orgId,
      return_number: ret.return_number || `RET-${Math.floor(100000 + Math.random() * 900000)}`,
      original_order_id: ret.original_order_id || 0,
      customer_id: ret.customer_id ?? null,
      warehouse_id: ret.warehouse_id || 1,
      pos_shift_id: ret.pos_shift_id ?? null,
      type: ret.type || 'return',
      status: ret.status || 'completed',
      reason: ret.reason || 'other',
      returned_total: Number(ret.returned_total) || 0,
      exchange_total: Number(ret.exchange_total) || 0,
      net_amount: Number(ret.net_amount) || 0,
      settlement_method: ret.settlement_method || 'none',
      financial_account_id: ret.financial_account_id ?? null,
      return_date: ret.return_date || now,
      notes: ret.notes || '',
      date_created: ret.date_created || now,
      date_updated: now,
      ...ret,
      id: validId,
    };
    await this.base.saveItem('order_returns', savedReturn);

    if (items && items.length > 0) {
      const allReturnItems = await this.base.getItems<OrderReturnItem>('order_return_items');
      const savedItems: OrderReturnItem[] = [];
      for (const it of items) {
        const itId =
          typeof it.id === 'number' && it.id > 0
            ? it.id
            : this.base.generateUniqueId(allReturnItems);
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Number(it.unit_price) || 0;
        const savedItem: OrderReturnItem = {
          ...it,
          id: itId,
          organization_id: orgId,
          return_id: validId,
          item_type: it.item_type || 'returned',
          original_order_item_id: it.original_order_item_id ?? null,
          variant_id: it.variant_id || 0,
          quantity: qty,
          unit_price: unitPrice,
          unit_cost: Number(it.unit_cost) || 0,
          total: it.total !== undefined ? Number(it.total) : qty * unitPrice,
          condition: it.condition || 'restockable',
          created_at: it.created_at || now,
        };
        await this.base.saveItem('order_return_items', savedItem);
        allReturnItems.push(savedItem);
        savedItems.push(savedItem);
      }
      savedReturn.items = savedItems;
    }

    return savedReturn;
  }

  async deleteOrderReturn(id: number): Promise<boolean> {
    await this.base.deleteItem('order_returns', id);
    const allItems = await this.base.getItems<OrderReturnItem>('order_return_items');
    for (const it of allItems) {
      const rId = typeof it.return_id === 'object' ? (it.return_id as any)?.id : it.return_id;
      if (Number(rId) === Number(id)) {
        await this.base.deleteItem('order_return_items', it.id);
      }
    }
    return true;
  }

  async reconcileOrdersWithTreasury(targetOrgId?: number): Promise<void> {
    const orgId = targetOrgId || this.base.getActiveOrgId() || 1;
    let allAccounts = await this.base.getItems<FinancialAccount>('financial_accounts', orgId);

    if (allAccounts.length === 0) {
      const now = new Date().toISOString();
      const defaults: FinancialAccount[] = [
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
      for (const acc of defaults) {
        await this.base.saveItem('financial_accounts', acc);
      }
      allAccounts = defaults;
    }

    const defaultCashbox = allAccounts.find((a) => a.type === 'cashbox' || a.type === 'petty_cash') || allAccounts[0];
    const defaultPos = allAccounts.find((a) => a.type === 'pos' || a.pos_terminal_id) || allAccounts.find((a) => a.type === 'bank') || defaultCashbox;
    const defaultBank = allAccounts.find((a) => a.type === 'bank') || defaultPos || defaultCashbox;

    const allOrders = await this.getOrders({ organization_id: orgId });
    const treasuryTxList = await this.base.getItems<TreasuryTransaction>('treasury_transactions', orgId);

    const completedOrPaidOrders = allOrders.filter((o) => {
      if (o.status === 'cancelled') return false;
      const isPaid = o.payment_status === 'paid' || (o as any).payment_status === 'settled';
      const isCompleted = o.status === 'completed';
      const isConfirmed = o.status === 'confirmed';
      const pMethod = (o as any).payment_method || (o as any).payment_type || 'pos';
      const isCashOrElectronic = ['cash', 'pos', 'card_to_card', 'card_reader', 'bank'].includes(pMethod);
      return isPaid || isCompleted || isConfirmed || (isCashOrElectronic && o.payment_status !== 'pending');
    });

    for (const ord of completedOrPaidOrders) {
      const orderNum = ord.order_number || String(ord.id);
      const ordTotal =
        Number(ord.total) ||
        Number((ord as any).final_amount) ||
        Number((ord as any).total_amount) ||
        Number(ord.subtotal) ||
        0;

      if (ordTotal <= 0) continue;

      const exists = treasuryTxList.some((t) => {
        const tracking = t.tracking_code || '';
        const desc = t.description || '';
        return (
          tracking.includes(orderNum) ||
          desc.includes(orderNum) ||
          (t as any).order_id === ord.id
        );
      });

      if (!exists && defaultCashbox) {
        let destAcc = defaultCashbox;
        const pMethod = (ord as any).payment_method || (ord as any).payment_type;
        const customAccId = (ord as any).financial_account_id || (ord as any).account_id;
        if (customAccId) {
          const found = allAccounts.find((a) => Number(a.id) === Number(customAccId));
          if (found) destAcc = found;
        } else if (pMethod === 'pos' || pMethod === 'card_reader') {
          destAcc = defaultPos || defaultCashbox;
        } else if (pMethod === 'card_to_card' || pMethod === 'bank') {
          destAcc = defaultBank || defaultCashbox;
        }

        const txDate = ord.date_created || (ord as any).order_date || new Date().toISOString();
        const newTx: TreasuryTransaction = {
          id: this.base.generateUniqueId(treasuryTxList),
          organization_id: orgId,
          source_account_id: null,
          destination_account_id: destAcc.id,
          type: 'deposit',
          amount: ordTotal,
          tracking_code: `ORD-${orderNum}`,
          description: `دریافت وجه فاکتور فروش #${orderNum} (همگام‌سازی خودکار)`,
          transaction_date: txDate,
          date_created: txDate,
        };
        await this.base.saveItem('treasury_transactions', newTx);
        treasuryTxList.push(newTx);
      }
    }

    // Recalculate balances
    for (const acc of allAccounts) {
      let balance = Number(acc.initial_balance) || 0;
      treasuryTxList.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        const srcId = typeof tx.source_account_id === 'object' ? (tx.source_account_id as any)?.id : tx.source_account_id;
        const dstId = typeof tx.destination_account_id === 'object' ? (tx.destination_account_id as any)?.id : tx.destination_account_id;

        if (tx.type === 'deposit' && Number(dstId) === Number(acc.id)) {
          balance += amt;
        } else if (tx.type === 'withdrawal' && Number(srcId) === Number(acc.id)) {
          balance -= amt;
        } else if (tx.type === 'transfer') {
          if (Number(dstId) === Number(acc.id)) balance += amt;
          if (Number(srcId) === Number(acc.id)) balance -= amt;
        }
      });
      acc.current_balance = balance;
      await this.base.saveItem('financial_accounts', acc);
    }
  }
}
