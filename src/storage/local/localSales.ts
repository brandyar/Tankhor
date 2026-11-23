import { QueryParams } from '../types';
import { LocalStorageBase } from './localBase';
import { normalizeId } from '../../utils/formatters';
import {
  Customer,
  Order,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  ProductVariant,
  Warehouse,
  PersonTransaction,
  FinancialAccount,
  TreasuryTransaction,
  InventoryMovement,
  InventoryItem,
  OrderStatus,
  PaymentStatus
} from '../../types';

export class LocalSalesStorage {
  constructor(private base: LocalStorageBase) {}

  // Customers
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    let items = this.base.getItem<Customer>('customers', []);
    items = this.base.filterByOrg(items, params);

    const orders = this.base.getItem<Order>('orders', []);
    const personTxs = this.base.getItem<PersonTransaction>('person_transactions', []);

    if (params?.status) {
      items = items.filter((c) => c.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }

    return items.map((customer) => {
      const custOrders = orders.filter((o) => {
        const custId = typeof o.customer_id === 'object' ? (o.customer_id as any)?.id : o.customer_id;
        return Number(custId) === customer.id && o.status !== 'cancelled';
      });

      let calculatedBalance = 0;
      const custTxs = personTxs.filter((tx) => {
        const custId = typeof tx.customer_id === 'object' ? (tx.customer_id as any)?.id : tx.customer_id;
        return Number(custId) === customer.id;
      });

      if (custTxs.length > 0) {
        custTxs.forEach((tx) => {
          if (
            tx.type === 'debtor' ||
            tx.transaction_type === 'sale_invoice' ||
            tx.transaction_type === 'cash_refund'
          ) {
            calculatedBalance += Number(tx.debit_amount || tx.amount) || 0;
          } else if (
            tx.type === 'creditor' ||
            tx.transaction_type === 'cash_receipt' ||
            tx.transaction_type === 'receipt' ||
            tx.transaction_type === 'sale_return'
          ) {
            calculatedBalance -= Number(tx.credit_amount || tx.amount) || 0;
          }
        });
      } else {
        calculatedBalance = Number(customer.balance) || 0;
      }

      return {
        ...customer,
        balance: calculatedBalance,
      };
    });
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    const list = await this.getCustomers();
    return list.find((c) => c.id === id) || null;
  }

  async saveCustomer(customer: Partial<Customer>): Promise<Customer> {
    const list = this.base.getItem<Customer>('customers', []);
    let savedCustomer: Customer;

    if (customer.id) {
      const idx = list.findIndex((c) => c.id === customer.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...customer, id: customer.id, date_updated: new Date().toISOString() };
        savedCustomer = list[idx];
      } else {
        savedCustomer = { ...customer, id: customer.id, date_updated: new Date().toISOString() } as Customer;
        list.push(savedCustomer);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      savedCustomer = {
        id: newId,
        organization_id: this.base.getActiveOrgId() || 1,
        name: customer.name || 'مشتری جدید',
        status: customer.status || 'active',
        balance: Number(customer.balance) || 0,
        credit_limit: Number(customer.credit_limit) || 0,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        ...customer,
      };
      list.push(savedCustomer);
    }
    this.base.setItem('customers', list);
    return savedCustomer;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const list = this.base.getItem<Customer>('customers', []);
    const filtered = list.filter((c) => c.id !== id);
    this.base.setItem('customers', filtered);
    return true;
  }

  // Orders
  async getOrders(params?: QueryParams): Promise<Order[]> {
    let items = this.base.getItem<Order>('orders', []);
    items = this.base.filterByOrg(items, params);

    const customers = this.base.getItem<Customer>('customers', []);
    const warehouses = this.base.getItem<Warehouse>('warehouses', []);

    if (params?.status) {
      items = items.filter((o) => o.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((o) =>
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q))
      );
    }

    return items
      .map((order) => {
        const cId = typeof order.customer_id === 'object' ? (order.customer_id as any)?.id : order.customer_id;
        const wId = typeof order.warehouse_id === 'object' ? (order.warehouse_id as any)?.id : order.warehouse_id;
        const cust = customers.find((c) => c.id === cId);
        const wh = warehouses.find((w) => w.id === wId);

        return {
          ...order,
          customer_name: cust?.name || order.customer_name,
          warehouse_name: wh?.name,
        };
      })
      .sort((a, b) => new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime());
  }

  async getOrderById(id: number): Promise<Order | null> {
    const list = await this.getOrders();
    return list.find((o) => o.id === id) || null;
  }

  async saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    const orders = this.base.getItem<Order>('orders', []);
    const orderItems = this.base.getItem<OrderItem>('order_items', []);
    const existingOrder = order.id ? orders.find((o) => o.id === order.id) : null;
    const oldStatus = existingOrder?.status;

    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = Number(order.discount) || 0;

    if (items && items.length > 0) {
      items.forEach((item) => {
        const qty = item.quantity || 1;
        const price = item.unit_price || 0;
        const disc = item.discount || 0;
        subtotal += qty * price - disc;
      });
    } else if (order.subtotal !== undefined) {
      subtotal = Number(order.subtotal) || 0;
    }

    totalTax = Number(order.tax) || 0;
    const calculatedTotal = order.total !== undefined ? Number(order.total) : subtotal - totalDiscount + totalTax;

    let savedOrder: Order;
    if (order.id) {
      const idx = orders.findIndex((o) => o.id === order.id);
      if (idx !== -1) {
        orders[idx] = {
          ...orders[idx],
          ...order,
          id: order.id,
          subtotal,
          tax: totalTax,
          discount: totalDiscount,
          total: calculatedTotal,
          date_updated: new Date().toISOString(),
        };
        savedOrder = orders[idx];
      } else {
        savedOrder = {
          ...order,
          id: order.id,
          subtotal,
          tax: totalTax,
          discount: totalDiscount,
          total: calculatedTotal,
          date_updated: new Date().toISOString(),
        } as Order;
        orders.push(savedOrder);
      }
    } else {
      const newId = this.base.generateUniqueId(orders);
      savedOrder = {
        id: newId,
        organization_id: this.base.getActiveOrgId() || 1,
        customer_id: order.customer_id,
        warehouse_id: order.warehouse_id || 1,
        order_number: order.order_number || `ORD-${Date.now().toString().slice(-6)}`,
        status: (order.status || 'confirmed') as OrderStatus,
        payment_status: (order.payment_status || 'paid') as PaymentStatus,
        currency: order.currency || 'IRR',
        subtotal,
        discount: totalDiscount,
        tax: totalTax,
        total: calculatedTotal,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        ...order,
      };
      orders.push(savedOrder);
    }
    this.base.setItem('orders', orders);

    // Save order items
    let savedOrderItems: OrderItem[] = [];
    if (items && items.length > 0) {
      const filtered = orderItems.filter((i) => {
        const oId = typeof i.order_id === 'number' ? i.order_id : Number((i.order_id as any)?.id || (i as any).order_id);
        return oId !== savedOrder.id;
      });

      for (const item of items) {
        const newItemId = this.base.generateUniqueId(filtered);
        const qty = item.quantity || 1;
        const price = item.unit_price || 0;
        const disc = item.discount || 0;
        const total = item.total || qty * price - disc;

        const newItem: OrderItem = {
          id: item.id || newItemId,
          organization_id: this.base.getActiveOrgId() || 1,
          order_id: savedOrder.id,
          variant_id: item.variant_id || 0,
          quantity: qty,
          unit_price: price,
          discount: disc,
          total,
          created_at: new Date().toISOString(),
          ...item,
        };
        filtered.push(newItem);
        savedOrderItems.push(newItem);
      }
      this.base.setItem('order_items', filtered);
    } else {
      savedOrderItems = orderItems.filter((i) => {
        const oId = typeof i.order_id === 'number' ? i.order_id : Number((i.order_id as any)?.id || (i as any).order_id);
        return oId === savedOrder.id;
      });
    }

    // Inventory & Accounting side-effects
    const newStatus = savedOrder.status;
    const isNowActive = newStatus === 'confirmed' || newStatus === 'processing' || newStatus === 'completed';
    const wasActive =
      oldStatus === 'confirmed' ||
      oldStatus === 'processing' ||
      oldStatus === 'completed' ||
      oldStatus === 'partially_returned' ||
      oldStatus === 'returned';

    // Stock deduction on confirmation
    if (isNowActive && !wasActive) {
      const movements = this.base.getItem<InventoryMovement>('inventory_movements', []);
      const invItems = this.base.getItem<InventoryItem>('inventory_items', []);
      const wId = typeof savedOrder.warehouse_id === 'object' ? (savedOrder.warehouse_id as any)?.id : savedOrder.warehouse_id;

      for (const item of savedOrderItems) {
        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
        const normVId = normalizeId(vId);
        if (!normVId) continue;
        const normWId = normalizeId(wId);
        const qty = item.quantity || 1;

        // Record stock movement
        const movId = this.base.generateUniqueId(movements);
        movements.push({
          id: movId,
          organization_id: this.base.getActiveOrgId() || 1,
          variant_id: normVId,
          warehouse_id: normWId || 1,
          type: 'sale',
          quantity: qty,
          reference_type: 'order',
          reference_id: String(savedOrder.id),
          note: `ثبت سفارش فروش ${savedOrder.order_number}`,
          created_at: new Date().toISOString(),
        });

        // Update inventory item
        const invIdx = invItems.findIndex((ii) => {
          const ivId = normalizeId(ii.variant_id);
          const iwId = normalizeId(ii.warehouse_id);
          return ivId === normVId && (normWId ? iwId === normWId : true);
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

    // Stock return on cancellation
    if (wasActive && newStatus === 'cancelled') {
      const movements = this.base.getItem<InventoryMovement>('inventory_movements', []);
      const invItems = this.base.getItem<InventoryItem>('inventory_items', []);
      const wId = typeof savedOrder.warehouse_id === 'object' ? (savedOrder.warehouse_id as any)?.id : savedOrder.warehouse_id;

      for (const item of savedOrderItems) {
        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
        const normVId = normalizeId(vId);
        if (!normVId) continue;
        const normWId = normalizeId(wId);
        const qty = item.quantity || 1;

        const movId = this.base.generateUniqueId(movements);
        movements.push({
          id: movId,
          organization_id: this.base.getActiveOrgId() || 1,
          variant_id: normVId,
          warehouse_id: normWId || 1,
          type: 'return',
          quantity: qty,
          reference_type: 'order',
          reference_id: String(savedOrder.id),
          note: `لغو سفارش فروش ${savedOrder.order_number}`,
          created_at: new Date().toISOString(),
        });

        const invIdx = invItems.findIndex((ii) => {
          const ivId = normalizeId(ii.variant_id);
          const iwId = normalizeId(ii.warehouse_id);
          return ivId === normVId && (normWId ? iwId === normWId : true);
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
            variant_id: normVId,
            warehouse_id: normWId || 1,
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
    }

    // Person Transaction (Customer Ledger)
    if (isNowActive) {
      const personTxs = this.base.getItem<PersonTransaction>('person_transactions', []);
      const custId = typeof savedOrder.customer_id === 'object' ? (savedOrder.customer_id as any)?.id : savedOrder.customer_id;

      if (custId) {
        const existingInvoiceTx = personTxs.find((tx) => tx.order_id === savedOrder.id || (tx.reference_code === savedOrder.order_number && tx.transaction_type === 'sale_invoice'));
        if (!existingInvoiceTx) {
          const txId = this.base.generateUniqueId(personTxs);
          personTxs.push({
            id: txId,
            organization_id: this.base.getActiveOrgId() || 1,
            party_type: 'customer',
            customer_id: custId,
            transaction_type: 'sale_invoice',
            type: 'debtor',
            amount: savedOrder.total,
            debit_amount: savedOrder.total,
            credit_amount: 0,
            balance_after: 0,
            order_id: savedOrder.id,
            reference_code: savedOrder.order_number,
            transaction_date: savedOrder.date_created || new Date().toISOString(),
            description: `فاکتور فروش شماره ${savedOrder.order_number}`,
            date_created: new Date().toISOString(),
          });
        }

        // If paid, register receipt
        if (savedOrder.payment_status === 'paid') {
          const existingReceiptTx = personTxs.find((tx) => tx.order_id === savedOrder.id && (tx.transaction_type === 'cash_receipt' || tx.transaction_type === 'receipt'));
          if (!existingReceiptTx) {
            const rId = this.base.generateUniqueId(personTxs);
            personTxs.push({
              id: rId,
              organization_id: this.base.getActiveOrgId() || 1,
              party_type: 'customer',
              customer_id: custId,
              transaction_type: 'cash_receipt',
              type: 'creditor',
              amount: savedOrder.total,
              debit_amount: 0,
              credit_amount: savedOrder.total,
              balance_after: 0,
              order_id: savedOrder.id,
              reference_code: savedOrder.order_number,
              transaction_date: savedOrder.date_created || new Date().toISOString(),
              description: `تسویه فاکتور فروش ${savedOrder.order_number}`,
              date_created: new Date().toISOString(),
            });
          }
        }
        this.base.setItem('person_transactions', personTxs);
      }
    }

    return savedOrder;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const list = this.base.getItem<Order>('orders', []);
    const target = list.find((o) => o.id === id);
    if (target && target.status !== 'cancelled') {
      await this.saveOrder({ ...target, status: 'cancelled' });
    }
    this.base.setItem('orders', list.filter((o) => o.id !== id));
    const items = this.base.getItem<OrderItem>('order_items', []);
    this.base.setItem('order_items', items.filter((i) => {
      const oId = typeof i.order_id === 'number' ? i.order_id : Number((i.order_id as any)?.id || (i as any).order_id);
      return oId !== id;
    }));
    return true;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    let items = this.base.getItem<OrderItem>('order_items', []);
    const variants = this.base.getItem<ProductVariant>('product_variants', []);

    items = items.filter((i) => {
      const oId = typeof i.order_id === 'number' ? i.order_id : Number((i.order_id as any)?.id || (i as any).order_id);
      return Number(oId) === Number(orderId);
    });

    return items.map((item) => {
      const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
      const variant = variants.find((v) => v.id === vId);
      return {
        ...item,
        variant_sku: variant?.sku,
      };
    });
  }

  async saveOrderItem(item: Partial<OrderItem>): Promise<OrderItem> {
    const list = this.base.getItem<OrderItem>('order_items', []);
    let saved: OrderItem;

    if (item.id) {
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...item, id: item.id };
        saved = list[idx];
      } else {
        saved = { ...item, id: item.id } as OrderItem;
        list.push(saved);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      const qty = item.quantity || 1;
      const price = item.unit_price || 0;
      const disc = item.discount || 0;
      saved = {
        id: newId,
        organization_id: this.base.getActiveOrgId() || 1,
        order_id: item.order_id || 0,
        variant_id: item.variant_id || 0,
        quantity: qty,
        unit_price: price,
        discount: disc,
        total: item.total || qty * price - disc,
        created_at: new Date().toISOString(),
        ...item,
      };
      list.push(saved);
    }

    this.base.setItem('order_items', list);
    return saved;
  }

  async deleteOrderItem(id: number): Promise<boolean> {
    const list = this.base.getItem<OrderItem>('order_items', []);
    const filtered = list.filter((i) => i.id !== id);
    this.base.setItem('order_items', filtered);
    return true;
  }

  // Order Returns & Exchanges
  async getOrderReturns(params?: QueryParams & { order_id?: number; reason?: string }): Promise<OrderReturn[]> {
    let list = this.base.getItem<OrderReturn>('order_returns', []);
    list = this.base.filterByOrg(list, params);

    const orders = this.base.getItem<Order>('orders', []);
    const customers = this.base.getItem<Customer>('customers', []);
    const warehouses = this.base.getItem<Warehouse>('warehouses', []);
    const allItems = this.base.getItem<OrderReturnItem>('order_return_items', []);

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
      const wh = warehouses.find((w) => Number(w.id) === Number(wId));
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
    let items = this.base.getItem<OrderReturnItem>('order_return_items', []);
    const variants = this.base.getItem<ProductVariant>('product_variants', []);

    if (returnId !== undefined) {
      items = items.filter((i) => {
        const rId = typeof i.return_id === 'object' ? (i.return_id as any)?.id : i.return_id;
        return Number(rId) === Number(returnId);
      });
    } else {
      const orgId = this.base.getActiveOrgId();
      if (orgId) {
        items = items.filter((i) => {
          const iOrg = typeof i.organization_id === 'object' ? (i.organization_id as any)?.id : i.organization_id;
          return !iOrg || Number(iOrg) === Number(orgId);
        });
      }
    }

    return items.map((item) => {
      const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
      const variant = variants.find((v) => Number(v.id) === Number(vId));
      return {
        ...item,
        sku: item.sku || variant?.sku,
        product_title: item.product_title || variant?.product_title,
        color_name: item.color_name || variant?.color_name,
        size_name: item.size_name || variant?.size_name,
      };
    });
  }

  async saveOrderReturn(
    ret: Partial<OrderReturn>,
    items?: Partial<OrderReturnItem>[]
  ): Promise<OrderReturn> {
    const list = this.base.getItem<OrderReturn>('order_returns', []);
    const now = new Date().toISOString();
    const orgId = Number(ret.organization_id) || this.base.getActiveOrgId() || 1;
    let savedReturn: OrderReturn;

    if (ret.id) {
      const idx = list.findIndex((r) => Number(r.id) === Number(ret.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...ret, id: ret.id, date_updated: now };
        savedReturn = list[idx];
      } else {
        savedReturn = {
          organization_id: orgId,
          return_number: ret.return_number || `RET-${Date.now().toString().slice(-6)}`,
          original_order_id: ret.original_order_id || 0,
          warehouse_id: ret.warehouse_id || 1,
          type: ret.type || 'return',
          status: ret.status || 'completed',
          returned_total: Number(ret.returned_total) || 0,
          exchange_total: Number(ret.exchange_total) || 0,
          net_amount: Number(ret.net_amount) || 0,
          return_date: ret.return_date || now,
          date_created: now,
          date_updated: now,
          ...ret,
          id: ret.id,
        } as OrderReturn;
        list.unshift(savedReturn);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      savedReturn = {
        id: newId,
        organization_id: orgId,
        return_number: ret.return_number || `RET-${Date.now().toString().slice(-6)}`,
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
        date_created: now,
        date_updated: now,
        ...ret,
      };
      list.unshift(savedReturn);
    }
    this.base.setItem('order_returns', list);

    if (items && items.length > 0) {
      const allReturnItems = this.base.getItem<OrderReturnItem>('order_return_items', []);
      const filtered = allReturnItems.filter((i) => {
        const rId = typeof i.return_id === 'object' ? (i.return_id as any)?.id : i.return_id;
        return Number(rId) !== Number(savedReturn.id);
      });

      const savedItems: OrderReturnItem[] = [];
      for (const it of items) {
        const newItemId = it.id || this.base.generateUniqueId(filtered);
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Number(it.unit_price) || 0;
        const savedItem: OrderReturnItem = {
          ...it,
          id: newItemId,
          organization_id: orgId,
          return_id: savedReturn.id,
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
        filtered.push(savedItem);
        savedItems.push(savedItem);
      }
      this.base.setItem('order_return_items', filtered);
      savedReturn.items = savedItems;
    }

    return savedReturn;
  }

  async deleteOrderReturn(id: number): Promise<boolean> {
    const list = this.base.getItem<OrderReturn>('order_returns', []);
    this.base.setItem(
      'order_returns',
      list.filter((r) => Number(r.id) !== Number(id))
    );
    const items = this.base.getItem<OrderReturnItem>('order_return_items', []);
    this.base.setItem(
      'order_return_items',
      items.filter((i) => {
        const rId = typeof i.return_id === 'object' ? (i.return_id as any)?.id : i.return_id;
        return Number(rId) !== Number(id);
      })
    );
    return true;
  }

  async reconcileOrdersWithTreasury(orgId: number): Promise<void> {
    const orders = this.base.getItem<Order>('orders', []);
    const treasuryTxs = this.base.getItem<TreasuryTransaction>('treasury_transactions', []);
    const accounts = this.base.getItem<FinancialAccount>('financial_accounts', []);

    const orgOrders = orders.filter((o) => {
      const oOrg = typeof o.organization_id === 'object' ? (o.organization_id as any)?.id : o.organization_id;
      return Number(oOrg) === orgId && o.status !== 'cancelled' && o.payment_status === 'paid' && Number(o.total) > 0;
    });

    const defaultAcc = accounts.find((a) => {
      const aOrg = typeof a.organization_id === 'object' ? (a.organization_id as any)?.id : a.organization_id;
      return (Number(aOrg) === orgId || !aOrg) && (a.is_default || a.type === 'cashbox' || a.type === 'pos');
    }) || accounts[0];

    if (!defaultAcc) return;

    for (const order of orgOrders) {
      const existingTx = treasuryTxs.find((tx) => tx.tracking_code === order.order_number || tx.description?.includes(order.order_number));
      if (!existingTx) {
        const txId = this.base.generateUniqueId(treasuryTxs);
        treasuryTxs.push({
          id: txId,
          organization_id: orgId,
          destination_account_id: defaultAcc.id,
          type: 'deposit',
          amount: Number(order.total) || 0,
          tracking_code: order.order_number,
          transaction_date: order.date_created || new Date().toISOString(),
          description: `واریز فروش فاکتور ${order.order_number}`,
          date_created: new Date().toISOString(),
        });
      }
    }

    this.base.setItem('treasury_transactions', treasuryTxs);
  }
}
