import { CloudStorageBase } from './cloudBase';
import { QueryParams } from '../types';
import {
  Order,
  OrderItem,
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
      });
      return orders;
    } catch {
      return this.base.localAdapter.getOrders(params);
    }
  }

  async getOrderById(id: number): Promise<Order | null> {
    try {
      return await this.base.client.getItemById<Order>('orders', id);
    } catch {
      return this.base.localAdapter.getOrderById(id);
    }
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    try {
      return await this.base.client.getItems<OrderItem>('order_items', {
        filter: { order_id: { _eq: orderId } },
      });
    } catch {
      return this.base.localAdapter.getOrderItems(orderId);
    }
  }

  async saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    try {
      const payload: any = { ...order };
      delete payload.customer_name;
      delete payload.warehouse_name;
      delete payload.items_count;
      delete payload.items;

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

      await this.base.localAdapter.saveOrder(savedOrder, items);
      return savedOrder;
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

  // Customers
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    try {
      return await this.base.client.getItems<Customer>('customers', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getCustomers(params);
    }
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    try {
      return await this.base.client.getItemById<Customer>('customers', id);
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
