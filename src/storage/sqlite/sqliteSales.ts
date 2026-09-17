import { QueryParams } from '../types';
import { SqliteStorageBase } from './sqliteBase';
import {
  Customer,
  Order,
  OrderItem,
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
    const wasConfirmedOrCompleted = previousOrder && (previousOrder.status === 'confirmed' || previousOrder.status === 'completed');
    const isNowCancelled = savedOrder.status === 'cancelled';

    const targetWarehouseId = typeof savedOrder.warehouse_id === 'object' ? (savedOrder.warehouse_id as any)?.id : (savedOrder.warehouse_id || 1);

    if ((isNew && isNowConfirmedOrCompleted) || (!wasConfirmedOrCompleted && isNowConfirmedOrCompleted)) {
      // Deduct stock
      const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
      const movementList = await this.base.getItems<InventoryMovement>('inventory_movements');

      for (const itm of savedItems) {
        const vId = typeof itm.variant_id === 'object' ? (itm.variant_id as any)?.id : itm.variant_id;
        const qty = Number(itm.quantity) || 1;

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
        const qty = Number(itm.quantity) || 1;

        const inv = inventoryList.find((i) => normalizeId(i.variant_id) === normalizeId(vId) && Number(i.warehouse_id) === Number(targetWarehouseId));
        if (inv) {
          inv.quantity = (Number(inv.quantity) || 0) + qty;
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
        const qty = Number(itm.quantity) || 1;

        const inv = inventoryList.find((i) => normalizeId(i.variant_id) === normalizeId(vId) && Number(i.warehouse_id) === Number(targetWarehouseId));
        if (inv) {
          inv.quantity = (Number(inv.quantity) || 0) + qty;
          await this.base.saveItem('inventory_items', inv);
        }

        const movId = this.base.generateUniqueId(movementList);
        await this.base.saveItem('inventory_movements', {
          id: movId,
          organization_id: order.organization_id || 1,
          variant_id: vId,
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
          id: Date.now() + Math.floor(Math.random() * 10000),
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
