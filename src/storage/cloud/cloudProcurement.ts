import { CloudStorageBase } from './cloudBase';
import { QueryParams } from '../types';
import {
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
} from '../../types';

export class CloudProcurementStorage {
  constructor(private base: CloudStorageBase) {}

  // Suppliers
  async getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    try {
      return await this.base.client.getItems<Supplier>('suppliers', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getSuppliers(params);
    }
  }

  async getSupplierById(id: number): Promise<Supplier | null> {
    try {
      return await this.base.client.getItemById<Supplier>('suppliers', id);
    } catch {
      return this.base.localAdapter.getSupplierById(id);
    }
  }

  async saveSupplier(sup: Partial<Supplier>): Promise<Supplier> {
    try {
      const payload: any = { ...sup };
      let savedSup: Supplier;
      if (payload.id) {
        const id = payload.id;
        delete payload.id;
        savedSup = await this.base.client.updateItem<Supplier>('suppliers', id, payload);
      } else {
        delete payload.id;
        savedSup = await this.base.client.createItem<Supplier>('suppliers', payload);
      }
      await this.base.localAdapter.saveSupplier(savedSup);
      return savedSup;
    } catch (err: any) {
      console.warn('[CloudProcurementStorage] saveSupplier failed, fallback to local:', err?.message || err);
      const saved = await this.base.localAdapter.saveSupplier(sup);
      this.base.syncManager.enqueue({ action: sup.id ? 'UPDATE' : 'CREATE', collection: 'suppliers', payload: saved });
      return saved;
    }
  }

  async deleteSupplier(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('suppliers', id);
      await this.base.localAdapter.deleteSupplier(id);
      return true;
    } catch (err: any) {
      console.warn('[CloudProcurementStorage] deleteSupplier failed, fallback to local:', err?.message || err);
      const res = await this.base.localAdapter.deleteSupplier(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'suppliers', payload: { id } });
      return res;
    }
  }

  // Purchase Orders
  async getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    try {
      return await this.base.client.getItems<PurchaseOrder>('purchase_orders', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getPurchaseOrders(params);
    }
  }

  async getPurchaseOrderById(id: number): Promise<PurchaseOrder | null> {
    try {
      return await this.base.client.getItemById<PurchaseOrder>('purchase_orders', id);
    } catch {
      return this.base.localAdapter.getPurchaseOrderById(id);
    }
  }

  async getPurchaseOrderItems(purchaseOrderId?: number): Promise<PurchaseOrderItem[]> {
    try {
      const filter = purchaseOrderId ? { purchase_order_id: { _eq: purchaseOrderId } } : undefined;
      return await this.base.client.getItems<PurchaseOrderItem>('purchase_order_items', {
        filter,
        limit: -1,
      });
    } catch {
      return this.base.localAdapter.getPurchaseOrderItems(purchaseOrderId);
    }
  }

  async savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    try {
      const payload: any = { ...po };
      let savedPo: PurchaseOrder;
      if (payload.id) {
        const id = payload.id;
        delete payload.id;
        savedPo = await this.base.client.updateItem<PurchaseOrder>('purchase_orders', id, payload);
      } else {
        delete payload.id;
        savedPo = await this.base.client.createItem<PurchaseOrder>('purchase_orders', payload);
      }

      if (items && items.length > 0) {
        for (const item of items) {
          const itemPayload: any = { ...item };
          delete itemPayload.id;
          await this.base.client.createItem<PurchaseOrderItem>('purchase_order_items', {
            ...itemPayload,
            purchase_order_id: savedPo.id,
            organization_id: savedPo.organization_id,
          });
        }
      }

      await this.base.localAdapter.savePurchaseOrder(savedPo, items);
      return savedPo;
    } catch (err: any) {
      console.warn('[CloudProcurementStorage] savePurchaseOrder failed, fallback to local:', err?.message || err);
      const saved = await this.base.localAdapter.savePurchaseOrder(po, items);
      this.base.syncManager.enqueue({ action: po.id ? 'UPDATE' : 'CREATE', collection: 'purchase_orders', payload: saved });
      return saved;
    }
  }

  async deletePurchaseOrder(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('purchase_orders', id);
      await this.base.localAdapter.deletePurchaseOrder(id);
      return true;
    } catch (err: any) {
      console.warn('[CloudProcurementStorage] deletePurchaseOrder failed, fallback to local:', err?.message || err);
      const res = await this.base.localAdapter.deletePurchaseOrder(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'purchase_orders', payload: { id } });
      return res;
    }
  }
}
