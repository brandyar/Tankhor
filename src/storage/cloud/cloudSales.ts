import { CloudStorageBase } from './cloudBase';
import { QueryParams, PaginatedResult } from '../types';
import {
  Order,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  Customer,
  PosShift,
  PosShiftStatus,
} from '../../types';

export class CloudSalesStorage {
  constructor(private base: CloudStorageBase) {}

  // Orders
  async getOrders(params?: QueryParams): Promise<Order[]> {
    try {
      const orders = await this.base.client.getItems<Order>('orders', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        sort: '-date_created',
        fields: [
          'id',
          'organization_id',
          'customer_id',
          'warehouse_id',
          'order_number',
          'status',
          'payment_status',
          'currency',
          'subtotal',
          'discount',
          'tax',
          'total',
          'notes',
          'date_created',
        ],
      });
      return orders;
    } catch {
      return this.base.localAdapter.getOrders(params);
    }
  }

  async getPaginatedOrders(params: QueryParams): Promise<PaginatedResult<Order>> {
    const page = params.page || 1;
    const pageSize = params.limit || 25;
    const filter: any = {};
    if (params.organization_id) filter.organization_id = { _eq: params.organization_id };
    if (params.status && params.status !== 'all') filter.status = { _eq: params.status };
    if (params.warehouse_id) filter.warehouse_id = { _eq: params.warehouse_id };

    try {
      const res = await this.base.client.getPaginatedItems<Order>('orders', {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        limit: pageSize,
        page,
        sort: params.sort || '-date_created',
        search: params.search,
        fields: [
          'id',
          'organization_id',
          'customer_id',
          'warehouse_id',
          'order_number',
          'status',
          'payment_status',
          'currency',
          'subtotal',
          'discount',
          'tax',
          'total',
          'notes',
          'date_created',
        ],
      });

      const totalCount = res.meta?.filter_count ?? res.meta?.total_count ?? res.data.length;
      return {
        items: res.data,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
      };
    } catch {
      if (this.base.localAdapter.getPaginatedOrders) {
        return this.base.localAdapter.getPaginatedOrders(params);
      }
      const all = await this.base.localAdapter.getOrders(params);
      const start = (page - 1) * pageSize;
      return {
        items: all.slice(start, start + pageSize),
        totalCount: all.length,
        page,
        pageSize,
        totalPages: Math.ceil(all.length / pageSize) || 1,
      };
    }
  }

  async getOrderById(id: number): Promise<Order | null> {
    try {
      return await this.base.client.getItemById<Order>('orders', id, '*');
    } catch {
      return this.base.localAdapter.getOrderById(id);
    }
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    try {
      const rawItems = await this.base.client.getItems<any>('order_items', {
        filter: { order_id: { _eq: orderId } },
        fields: [
          'id',
          'organization_id',
          'order_id',
          'variant_id',
          'quantity',
          'unit_price',
          'discount',
          'total',
          'returned_quantity',
          'created_at',
        ],
      });
      return rawItems.map((item) => ({
        ...item,
        price: item.unit_price ?? item.price ?? 0,
        unit_price: item.unit_price ?? item.price ?? 0,
        returned_quantity: Number(item.returned_quantity) || 0,
      }));
    } catch {
      return this.base.localAdapter.getOrderItems(orderId);
    }
  }

  async saveOrderItem(item: Partial<OrderItem>): Promise<OrderItem> {
    try {
      const payload: any = { ...item };
      delete payload.variant_sku;
      delete payload.unit_cost;
      let savedItem: OrderItem;
      if (payload.id) {
        const id = payload.id;
        delete payload.id;
        savedItem = await this.base.client.updateItem<OrderItem>('order_items', id, payload);
      } else {
        delete payload.id;
        savedItem = await this.base.client.createItem<OrderItem>('order_items', payload);
      }
      if (this.base.localAdapter.saveOrderItem) {
        await this.base.localAdapter.saveOrderItem(savedItem);
      }
      return savedItem;
    } catch (err: any) {
      console.warn('[CloudSalesStorage] saveOrderItem failed, using local adapter:', err?.message || err);
      const saved = this.base.localAdapter.saveOrderItem
        ? await this.base.localAdapter.saveOrderItem(item)
        : (item as OrderItem);
      this.base.syncManager.enqueue({
        action: item.id ? 'UPDATE' : 'CREATE',
        collection: 'order_items',
        payload: saved,
      });
      return saved;
    }
  }

  async saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    try {
      const payload: any = { ...order };
      const shiftId = (order as any).pos_shift_id;
      delete payload.customer_name;
      delete payload.warehouse_name;
      delete payload.items_count;
      delete payload.items;
      delete payload.pos_shift_id; // Keep cloud payload clean from non-Directus fields

      let savedOrder: Order;
      if (payload.id) {
        const id = payload.id;
        delete payload.id;
        savedOrder = await this.base.client.updateItem<Order>('orders', id, payload);
      } else {
        delete payload.id;
        savedOrder = await this.base.client.createItem<Order>('orders', payload);
      }

      if (items && items.length > 0) {
        for (const item of items) {
          const itemPayload: any = { ...item };
          delete itemPayload.id;
          await this.base.client.createItem<OrderItem>('order_items', {
            ...itemPayload,
            order_id: savedOrder.id,
            organization_id: savedOrder.organization_id,
          });
        }
      }

      const orderWithShift = { ...savedOrder, pos_shift_id: shiftId };
      await this.base.localAdapter.saveOrder(orderWithShift, items);
      return orderWithShift;
    } catch (err: any) {
      console.warn('[CloudSalesStorage] Cloud saveOrder failed, using local adapter:', err?.message || err);
      const saved = await this.base.localAdapter.saveOrder(order, items);
      this.base.syncManager.enqueue({ action: order.id ? 'UPDATE' : 'CREATE', collection: 'orders', payload: saved });
      return saved;
    }
  }

  async deleteOrder(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('orders', id);
      await this.base.localAdapter.deleteOrder(id);
      return true;
    } catch (err: any) {
      console.warn('[CloudSalesStorage] deleteOrder failed, fallback to local:', err?.message || err);
      const res = await this.base.localAdapter.deleteOrder(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'orders', payload: { id } });
      return res;
    }
  }

  // Order Returns & Exchanges
  async getOrderReturns(
    params?: QueryParams & { order_id?: number; reason?: string }
  ): Promise<OrderReturn[]> {
    try {
      const filter: any = {};
      if (params?.organization_id) filter.organization_id = { _eq: params.organization_id };
      if (params?.order_id) filter.original_order_id = { _eq: params.order_id };
      if (params?.type && params.type !== 'all') filter.type = { _eq: params.type };
      if (params?.status && params.status !== 'all') filter.status = { _eq: params.status };
      if (params?.reason && params.reason !== 'all') filter.reason = { _eq: params.reason };
      if (params?.warehouse_id) filter.warehouse_id = { _eq: params.warehouse_id };

      const returns = await this.base.client.getItems<OrderReturn>('order_returns', {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        sort: params?.sort || '-return_date,-date_created',
        search: params?.search,
        fields: [
          'id',
          'organization_id',
          'return_number',
          'original_order_id',
          'customer_id',
          'warehouse_id',
          'pos_shift_id',
          'type',
          'status',
          'reason',
          'returned_total',
          'exchange_total',
          'net_amount',
          'settlement_method',
          'financial_account_id',
          'return_date',
          'notes',
          'date_created',
        ],
      });
      return returns.map((r) => ({
        ...r,
        returned_total: Number(r.returned_total) || 0,
        exchange_total: Number(r.exchange_total) || 0,
        net_amount: Number(r.net_amount) || 0,
      }));
    } catch {
      return this.base.localAdapter.getOrderReturns
        ? this.base.localAdapter.getOrderReturns(params)
        : [];
    }
  }

  async getPaginatedOrderReturns(
    params: QueryParams & { order_id?: number; reason?: string }
  ): Promise<PaginatedResult<OrderReturn>> {
    const page = params.page || 1;
    const pageSize = params.limit || 25;
    const filter: any = {};
    if (params.organization_id) filter.organization_id = { _eq: params.organization_id };
    if (params.order_id) filter.original_order_id = { _eq: params.order_id };
    if (params.type && params.type !== 'all') filter.type = { _eq: params.type };
    if (params.status && params.status !== 'all') filter.status = { _eq: params.status };
    if (params.reason && params.reason !== 'all') filter.reason = { _eq: params.reason };
    if (params.warehouse_id) filter.warehouse_id = { _eq: params.warehouse_id };

    try {
      const res = await this.base.client.getPaginatedItems<OrderReturn>('order_returns', {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        limit: pageSize,
        page,
        sort: params.sort || '-return_date,-date_created',
        search: params.search,
        fields: [
          'id',
          'organization_id',
          'return_number',
          'original_order_id',
          'customer_id',
          'warehouse_id',
          'pos_shift_id',
          'type',
          'status',
          'reason',
          'returned_total',
          'exchange_total',
          'net_amount',
          'settlement_method',
          'financial_account_id',
          'return_date',
          'notes',
          'date_created',
        ],
      });
      const totalCount = res.meta?.filter_count ?? res.meta?.total_count ?? res.data.length;
      return {
        items: res.data.map((r) => ({
          ...r,
          returned_total: Number(r.returned_total) || 0,
          exchange_total: Number(r.exchange_total) || 0,
          net_amount: Number(r.net_amount) || 0,
        })),
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
      };
    } catch {
      const all = this.base.localAdapter.getOrderReturns
        ? await this.base.localAdapter.getOrderReturns(params)
        : [];
      const start = (page - 1) * pageSize;
      return {
        items: all.slice(start, start + pageSize),
        totalCount: all.length,
        page,
        pageSize,
        totalPages: Math.ceil(all.length / pageSize) || 1,
      };
    }
  }

  async getOrderReturnItems(returnId?: number): Promise<OrderReturnItem[]> {
    try {
      const filter: any = {};
      if (returnId !== undefined) filter.return_id = { _eq: returnId };
      const rawItems = await this.base.client.getItems<OrderReturnItem>('order_return_items', {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        fields: [
          'id',
          'organization_id',
          'return_id',
          'item_type',
          'original_order_item_id',
          'variant_id',
          'quantity',
          'unit_price',
          'unit_cost',
          'total',
          'condition',
          'created_at',
        ],
      });
      return rawItems.map((it) => ({
        ...it,
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
        unit_cost: Number(it.unit_cost) || 0,
        total: Number(it.total) || 0,
      }));
    } catch {
      return this.base.localAdapter.getOrderReturnItems
        ? this.base.localAdapter.getOrderReturnItems(returnId)
        : [];
    }
  }

  async saveOrderReturn(
    ret: Partial<OrderReturn>,
    items?: Partial<OrderReturnItem>[]
  ): Promise<OrderReturn> {
    try {
      const payload: any = { ...ret };
      delete payload.original_order_number;
      delete payload.customer_name;
      delete payload.warehouse_name;
      delete payload.items;
      delete payload.items_count;

      let savedReturn: OrderReturn;
      if (payload.id) {
        const id = payload.id;
        delete payload.id;
        savedReturn = await this.base.client.updateItem<OrderReturn>('order_returns', id, payload);
      } else {
        delete payload.id;
        savedReturn = await this.base.client.createItem<OrderReturn>('order_returns', payload);
      }

      const savedItems: OrderReturnItem[] = [];
      if (items && items.length > 0) {
        for (const it of items) {
          const itemPayload: any = { ...it };
          delete itemPayload.id;
          delete itemPayload.sku;
          delete itemPayload.product_title;
          delete itemPayload.color_name;
          delete itemPayload.size_name;
          const createdItem = await this.base.client.createItem<OrderReturnItem>('order_return_items', {
            ...itemPayload,
            return_id: savedReturn.id,
            organization_id: savedReturn.organization_id,
          });
          savedItems.push(createdItem);
        }
      }

      if (this.base.localAdapter.saveOrderReturn) {
        await this.base.localAdapter.saveOrderReturn(savedReturn, savedItems.length > 0 ? savedItems : items);
      }
      return {
        ...savedReturn,
        returned_total: Number(savedReturn.returned_total) || 0,
        exchange_total: Number(savedReturn.exchange_total) || 0,
        net_amount: Number(savedReturn.net_amount) || 0,
        items: savedItems.length > 0 ? savedItems : undefined,
      };
    } catch (err: any) {
      console.warn('[CloudSalesStorage] saveOrderReturn failed, using local adapter:', err?.message || err);
      const saved = this.base.localAdapter.saveOrderReturn
        ? await this.base.localAdapter.saveOrderReturn(ret, items)
        : (ret as OrderReturn);
      this.base.syncManager.enqueue({
        action: ret.id ? 'UPDATE' : 'CREATE',
        collection: 'order_returns',
        payload: saved,
      });
      return saved;
    }
  }

  async deleteOrderReturn(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('order_returns', id);
      if (this.base.localAdapter.deleteOrderReturn) {
        await this.base.localAdapter.deleteOrderReturn(id);
      }
      return true;
    } catch (err: any) {
      console.warn('[CloudSalesStorage] deleteOrderReturn failed, fallback to local:', err?.message || err);
      const res = this.base.localAdapter.deleteOrderReturn
        ? await this.base.localAdapter.deleteOrderReturn(id)
        : true;
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'order_returns', payload: { id } });
      return res;
    }
  }

  // Customers
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    try {
      return await this.base.client.getItems<Customer>('customers', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        sort: '-id',
        fields: [
          'id',
          'organization_id',
          'name',
          'phone',
          'email',
          'address',
          'status',
          'balance',
          'credit_limit',
          'date_created',
        ],
      });
    } catch {
      return this.base.localAdapter.getCustomers(params);
    }
  }

  async getPaginatedCustomers(params: QueryParams): Promise<PaginatedResult<Customer>> {
    const page = params.page || 1;
    const pageSize = params.limit || 25;
    const filter: any = {};
    if (params.organization_id) filter.organization_id = { _eq: params.organization_id };
    if (params.status && params.status !== 'all') filter.status = { _eq: params.status };

    try {
      const res = await this.base.client.getPaginatedItems<Customer>('customers', {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        limit: pageSize,
        page,
        sort: params.sort || '-id',
        search: params.search,
        fields: [
          'id',
          'organization_id',
          'name',
          'phone',
          'email',
          'address',
          'status',
          'balance',
          'credit_limit',
          'date_created',
        ],
      });

      const totalCount = res.meta?.filter_count ?? res.meta?.total_count ?? res.data.length;
      return {
        items: res.data,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
      };
    } catch {
      if (this.base.localAdapter.getPaginatedCustomers) {
        return this.base.localAdapter.getPaginatedCustomers(params);
      }
      const all = await this.base.localAdapter.getCustomers(params);
      const start = (page - 1) * pageSize;
      return {
        items: all.slice(start, start + pageSize),
        totalCount: all.length,
        page,
        pageSize,
        totalPages: Math.ceil(all.length / pageSize) || 1,
      };
    }
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    try {
      return await this.base.client.getItemById<Customer>('customers', id, '*');
    } catch {
      return this.base.localAdapter.getCustomerById(id);
    }
  }

  async saveCustomer(cust: Partial<Customer>): Promise<Customer> {
    try {
      const payload: any = { ...cust };
      let savedCust: Customer;
      if (payload.id) {
        const id = payload.id;
        delete payload.id;
        savedCust = await this.base.client.updateItem<Customer>('customers', id, payload);
      } else {
        delete payload.id;
        savedCust = await this.base.client.createItem<Customer>('customers', payload);
      }
      await this.base.localAdapter.saveCustomer(savedCust);
      return savedCust;
    } catch (err: any) {
      console.warn('[CloudSalesStorage] saveCustomer failed, fallback to local:', err?.message || err);
      const saved = await this.base.localAdapter.saveCustomer(cust);
      this.base.syncManager.enqueue({ action: cust.id ? 'UPDATE' : 'CREATE', collection: 'customers', payload: saved });
      return saved;
    }
  }

  async deleteCustomer(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('customers', id);
      await this.base.localAdapter.deleteCustomer(id);
      return true;
    } catch (err: any) {
      console.warn('[CloudSalesStorage] deleteCustomer failed, fallback to local:', err?.message || err);
      const res = await this.base.localAdapter.deleteCustomer(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'customers', payload: { id } });
      return res;
    }
  }

  // POS Shifts (شیفت‌های صندوق)
  async getPosShifts(params?: QueryParams & { user_id?: string; status?: PosShiftStatus; warehouse_id?: number }): Promise<PosShift[]> {
    const orgId = params?.organization_id || (typeof window !== 'undefined' ? localStorage.getItem('tankhor_active_org_id') : null);
    if (!orgId) return [];

    const numOrgId = Number(orgId);
    if (isNaN(numOrgId) || numOrgId <= 0) return [];

    const query: any = {
      sort: '-id',
      fields: ['*'],
    };

    if (params?.user_id) {
      query.filter = query.filter || {};
      query.filter.user_id = { _eq: params.user_id };
    }
    if (params?.status) {
      query.filter = query.filter || {};
      query.filter.status = { _eq: params.status };
    }
    if (params?.warehouse_id) {
      query.filter = query.filter || {};
      query.filter.warehouse_id = { _eq: Number(params.warehouse_id) };
    }

    try {
      // Sync recent orders and order_returns into local storage cache to ensure shift totals calculate accurately
      try {
        const [cloudOrders, cloudReturns] = await Promise.all([
          this.base.client.getItems<Order>('orders', {
            filter: { organization_id: { _eq: numOrgId } },
            sort: '-id',
            limit: 150,
          }),
          this.base.client
            .getItems<OrderReturn>('order_returns', {
              filter: { organization_id: { _eq: numOrgId } },
              sort: '-id',
              limit: 150,
            })
            .catch(() => []),
        ]);
        if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
          for (const co of cloudOrders) {
            await this.base.localAdapter.saveOrder(co);
          }
        }
        if (Array.isArray(cloudReturns) && cloudReturns.length > 0 && this.base.localAdapter.saveOrderReturn) {
          for (const cr of cloudReturns) {
            await this.base.localAdapter.saveOrderReturn(cr);
          }
        }
      } catch {
        // Non-blocking sync attempt
      }

      const items = await this.base.client.getItems<any>('pos_shifts', query);
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const normalizedItem: PosShift = {
            ...item,
            organization_id: numOrgId,
            status: Array.isArray(item.status) ? item.status[0] : (item.status || 'open'),
          };
          await this.base.localAdapter.savePosShift(normalizedItem);
        }
        return await this.base.localAdapter.getPosShifts(params);
      }
      return await this.base.localAdapter.getPosShifts(params);
    } catch (err: any) {
      console.warn('[CloudSalesStorage] getPosShifts failed, using local adapter:', err?.message || err);
      return await this.base.localAdapter.getPosShifts(params);
    }
  }

  async getActivePosShift(userId?: string, warehouseId?: number): Promise<PosShift | null> {
    try {
      const shifts = await this.getPosShifts({ status: 'open' });
      if (userId && warehouseId) {
        const match = shifts.find((s) => {
          const whId = typeof s.warehouse_id === 'object' ? (s.warehouse_id as any)?.id : s.warehouse_id;
          const uMatch = s.user_id === userId || (s as any).user_email === userId;
          return uMatch && Number(whId) === Number(warehouseId);
        });
        if (match) return match;
      }
      if (userId) {
        const userShift = shifts.find((s) => s.user_id === userId || (s as any).user_email === userId);
        return userShift || null;
      }
      if (warehouseId) {
        const whShift = shifts.find((s) => {
          const whId = typeof s.warehouse_id === 'object' ? (s.warehouse_id as any)?.id : s.warehouse_id;
          return Number(whId) === Number(warehouseId);
        });
        return whShift || null;
      }
      return shifts.length > 0 ? shifts[0] : null;
    } catch {
      return await this.base.localAdapter.getActivePosShift(userId, warehouseId);
    }
  }

  async savePosShift(shift: Partial<PosShift>): Promise<PosShift> {
    try {
      if (shift.id) {
        const updated = await this.base.client.updateItem<PosShift>('pos_shifts', shift.id, shift);
        const result = { ...shift, ...updated };
        await this.base.localAdapter.savePosShift(result);
        return result;
      } else {
        const created = await this.base.client.createItem<PosShift>('pos_shifts', shift);
        const result = { ...shift, ...created };
        await this.base.localAdapter.savePosShift(result);
        return result;
      }
    } catch (err: any) {
      console.warn('[CloudSalesStorage] savePosShift failed, fallback to local & sync:', err?.message || err);
      const saved = await this.base.localAdapter.savePosShift(shift);
      this.base.syncManager.enqueue({ action: shift.id ? 'UPDATE' : 'CREATE', collection: 'pos_shifts', payload: saved });
      return saved;
    }
  }

  async closePosShift(id: number, closingBalance: number | string, notes?: string): Promise<PosShift> {
    try {
      const updated = await this.base.client.updateItem<PosShift>('pos_shifts', id, {
        closing_balance: String(closingBalance),
        status: 'closed',
        closed_at: new Date().toISOString(),
      });
      await this.base.localAdapter.closePosShift(id, closingBalance, notes);
      return updated;
    } catch (err: any) {
      console.warn('[CloudSalesStorage] closePosShift failed, fallback to local & sync:', err?.message || err);
      const updated = await this.base.localAdapter.closePosShift(id, closingBalance, notes);
      this.base.syncManager.enqueue({ action: 'UPDATE', collection: 'pos_shifts', payload: updated });
      return updated;
    }
  }

  async deletePosShift(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('pos_shifts', id);
      await this.base.localAdapter.deletePosShift(id);
      return true;
    } catch (err: any) {
      console.warn('[CloudSalesStorage] deletePosShift failed, fallback to local & sync:', err?.message || err);
      await this.base.localAdapter.deletePosShift(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'pos_shifts', payload: { id } });
      return true;
    }
  }
}
