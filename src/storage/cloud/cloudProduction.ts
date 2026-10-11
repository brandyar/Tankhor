import { CloudStorageBase } from './cloudBase';
import { QueryParams } from '../types';
import {
  RawMaterial,
  BillOfMaterials,
  BomItem,
  Contractor,
  ProductionOrder,
  ProductionOrderItem,
  ProductionStage,
} from '../../types';

export class CloudProductionStorage {
  constructor(private base: CloudStorageBase) {}

  // --------------------------------------------------------
  // Raw Materials
  // --------------------------------------------------------
  async getRawMaterials(params?: QueryParams): Promise<RawMaterial[]> {
    try {
      const items = await this.base.client.getItems<RawMaterial>('raw_materials', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        limit: params?.limit || 1000,
      });
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await this.base.localAdapter.saveRawMaterial(item);
        }
        return await this.base.localAdapter.getRawMaterials(params);
      }
      return await this.base.localAdapter.getRawMaterials(params);
    } catch {
      return await this.base.localAdapter.getRawMaterials(params);
    }
  }

  async getRawMaterialById(id: number): Promise<RawMaterial | null> {
    try {
      const item = await this.base.client.getItemById<RawMaterial>('raw_materials', id);
      if (item) {
        await this.base.localAdapter.saveRawMaterial(item);
        return item;
      }
      return await this.base.localAdapter.getRawMaterialById(id);
    } catch {
      return await this.base.localAdapter.getRawMaterialById(id);
    }
  }

  async saveRawMaterial(material: Partial<RawMaterial>): Promise<RawMaterial> {
    try {
      if (material.id) {
        const updated = await this.base.client.updateItem<RawMaterial>('raw_materials', material.id, material);
        const result = { ...material, ...updated };
        await this.base.localAdapter.saveRawMaterial(result);
        return result;
      } else {
        const created = await this.base.client.createItem<RawMaterial>('raw_materials', material);
        const result = { ...material, ...created };
        await this.base.localAdapter.saveRawMaterial(result);
        return result;
      }
    } catch (err: any) {
      console.warn('[CloudProductionStorage] saveRawMaterial fallback to local:', err?.message || err);
      const saved = await this.base.localAdapter.saveRawMaterial(material);
      this.base.syncManager.enqueue({ action: material.id ? 'UPDATE' : 'CREATE', collection: 'raw_materials', payload: saved });
      return saved;
    }
  }

  async deleteRawMaterial(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('raw_materials', id);
      await this.base.localAdapter.deleteRawMaterial(id);
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deleteRawMaterial(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'raw_materials', payload: { id } });
      return deleted;
    }
  }

  // --------------------------------------------------------
  // Bill of Materials (BOM)
  // --------------------------------------------------------
  async getBillOfMaterials(params?: QueryParams): Promise<BillOfMaterials[]> {
    try {
      const items = await this.base.client.getItems<BillOfMaterials>('bill_of_materials', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        limit: params?.limit || 1000,
      });
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await this.base.localAdapter.saveBillOfMaterials(item);
        }
        return await this.base.localAdapter.getBillOfMaterials(params);
      }
      return await this.base.localAdapter.getBillOfMaterials(params);
    } catch {
      return await this.base.localAdapter.getBillOfMaterials(params);
    }
  }

  async getBomByProductId(productId: number): Promise<BillOfMaterials | null> {
    return await this.base.localAdapter.getBomByProductId(productId);
  }

  async saveBillOfMaterials(
    bom: Partial<BillOfMaterials>,
    items?: Partial<BomItem>[]
  ): Promise<BillOfMaterials> {
    try {
      let savedBom: BillOfMaterials;
      if (bom.id) {
        const updated = await this.base.client.updateItem<BillOfMaterials>('bill_of_materials', bom.id, bom);
        savedBom = { ...bom, ...updated };
      } else {
        const created = await this.base.client.createItem<BillOfMaterials>('bill_of_materials', bom);
        savedBom = { ...bom, ...created };
      }

      await this.base.localAdapter.saveBillOfMaterials(savedBom, items);
      return savedBom;
    } catch (err: any) {
      console.warn('[CloudProductionStorage] saveBillOfMaterials fallback to local:', err?.message || err);
      const saved = await this.base.localAdapter.saveBillOfMaterials(bom, items);
      this.base.syncManager.enqueue({ action: bom.id ? 'UPDATE' : 'CREATE', collection: 'bill_of_materials', payload: saved });
      return saved;
    }
  }

  async deleteBillOfMaterials(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('bill_of_materials', id);
      await this.base.localAdapter.deleteBillOfMaterials(id);
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deleteBillOfMaterials(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'bill_of_materials', payload: { id } });
      return deleted;
    }
  }

  // --------------------------------------------------------
  // Contractors
  // --------------------------------------------------------
  async getContractors(params?: QueryParams): Promise<Contractor[]> {
    try {
      const items = await this.base.client.getItems<Contractor>('contractors', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        limit: params?.limit || 1000,
      });
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await this.base.localAdapter.saveContractor(item);
        }
        return await this.base.localAdapter.getContractors(params);
      }
      return await this.base.localAdapter.getContractors(params);
    } catch {
      return await this.base.localAdapter.getContractors(params);
    }
  }

  async getContractorById(id: number): Promise<Contractor | null> {
    try {
      const item = await this.base.client.getItemById<Contractor>('contractors', id);
      if (item) {
        await this.base.localAdapter.saveContractor(item);
        return item;
      }
      return await this.base.localAdapter.getContractorById(id);
    } catch {
      return await this.base.localAdapter.getContractorById(id);
    }
  }

  async saveContractor(contractor: Partial<Contractor>): Promise<Contractor> {
    try {
      if (contractor.id) {
        const updated = await this.base.client.updateItem<Contractor>('contractors', contractor.id, contractor);
        const result = { ...contractor, ...updated };
        await this.base.localAdapter.saveContractor(result);
        return result;
      } else {
        const created = await this.base.client.createItem<Contractor>('contractors', contractor);
        const result = { ...contractor, ...created };
        await this.base.localAdapter.saveContractor(result);
        return result;
      }
    } catch (err: any) {
      console.warn('[CloudProductionStorage] saveContractor fallback to local:', err?.message || err);
      const saved = await this.base.localAdapter.saveContractor(contractor);
      this.base.syncManager.enqueue({ action: contractor.id ? 'UPDATE' : 'CREATE', collection: 'contractors', payload: saved });
      return saved;
    }
  }

  async deleteContractor(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('contractors', id);
      await this.base.localAdapter.deleteContractor(id);
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deleteContractor(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'contractors', payload: { id } });
      return deleted;
    }
  }

  // --------------------------------------------------------
  // Production Orders & Stages
  // --------------------------------------------------------
  async getProductionOrders(params?: QueryParams): Promise<ProductionOrder[]> {
    try {
      const items = await this.base.client.getItems<ProductionOrder>('production_orders', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        limit: params?.limit || 1000,
      });
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await this.base.localAdapter.saveProductionOrder(item);
        }
        return await this.base.localAdapter.getProductionOrders(params);
      }
      return await this.base.localAdapter.getProductionOrders(params);
    } catch {
      return await this.base.localAdapter.getProductionOrders(params);
    }
  }

  async getProductionOrderById(id: number): Promise<ProductionOrder | null> {
    try {
      const item = await this.base.client.getItemById<ProductionOrder>('production_orders', id);
      if (item) {
        await this.base.localAdapter.saveProductionOrder(item);
        return item;
      }
      return await this.base.localAdapter.getProductionOrderById(id);
    } catch {
      return await this.base.localAdapter.getProductionOrderById(id);
    }
  }

  async saveProductionOrder(
    order: Partial<ProductionOrder>,
    items?: Partial<ProductionOrderItem>[],
    stages?: Partial<ProductionStage>[]
  ): Promise<ProductionOrder> {
    try {
      let savedOrder: ProductionOrder;
      if (order.id) {
        const updated = await this.base.client.updateItem<ProductionOrder>('production_orders', order.id, order);
        savedOrder = { ...order, ...updated };
      } else {
        const created = await this.base.client.createItem<ProductionOrder>('production_orders', order);
        savedOrder = { ...order, ...created };
      }

      await this.base.localAdapter.saveProductionOrder(savedOrder, items, stages);
      return savedOrder;
    } catch (err: any) {
      console.warn('[CloudProductionStorage] saveProductionOrder fallback to local:', err?.message || err);
      const saved = await this.base.localAdapter.saveProductionOrder(order, items, stages);
      this.base.syncManager.enqueue({ action: order.id ? 'UPDATE' : 'CREATE', collection: 'production_orders', payload: saved });
      return saved;
    }
  }

  async deleteProductionOrder(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('production_orders', id);
      await this.base.localAdapter.deleteProductionOrder(id);
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deleteProductionOrder(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'production_orders', payload: { id } });
      return deleted;
    }
  }
}
