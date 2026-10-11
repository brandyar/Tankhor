import { QueryParams } from '../types';
import { LocalStorageBase } from './localBase';
import { normalizeId } from '../../utils/formatters';
import {
  RawMaterial,
  BillOfMaterials,
  BomItem,
  Contractor,
  ProductionOrder,
  ProductionOrderItem,
  ProductionStage,
} from '../../types';

export class LocalProductionStorage {
  constructor(private base: LocalStorageBase) {}

  // --------------------------------------------------------
  // Raw Materials
  // --------------------------------------------------------
  async getRawMaterials(params?: QueryParams): Promise<RawMaterial[]> {
    const list = this.base.getItem<RawMaterial>('raw_materials', []);
    let filtered = this.base.filterByOrg(list, params);
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.code && m.code.toLowerCase().includes(q)) ||
          (m.category && m.category.toLowerCase().includes(q))
      );
    }
    if (params?.status) {
      filtered = filtered.filter((m) => m.status === params.status);
    }
    return filtered;
  }

  async getRawMaterialById(id: number): Promise<RawMaterial | null> {
    const list = this.base.getItem<RawMaterial>('raw_materials', []);
    const found = list.find((m) => normalizeId(m.id) === normalizeId(id));
    return found || null;
  }

  async saveRawMaterial(material: Partial<RawMaterial>): Promise<RawMaterial> {
    const list = this.base.getItem<RawMaterial>('raw_materials', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(material.organization_id) });
    if (!orgId) throw new Error('Active organization ID required');

    let saved: RawMaterial;
    if (material.id && normalizeId(material.id) > 0) {
      const idx = list.findIndex((m) => normalizeId(m.id) === normalizeId(material.id));
      if (idx !== -1) {
        saved = {
          ...list[idx],
          ...material,
          organization_id: orgId,
          date_updated: new Date().toISOString(),
        };
        list[idx] = saved;
      } else {
        saved = {
          id: normalizeId(material.id),
          organization_id: orgId,
          name: material.name || '',
          code: material.code || `MAT-${Date.now().toString().slice(-4)}`,
          unit: material.unit || 'متر',
          category: material.category || 'fabric',
          warehouse_id: material.warehouse_id ? normalizeId(material.warehouse_id) : null,
          current_stock: Number(material.current_stock) || 0,
          min_stock: material.min_stock !== undefined ? Number(material.min_stock) : null,
          unit_cost: Number(material.unit_cost) || 0,
          color_hex: material.color_hex || null,
          description: material.description || null,
          status: material.status || 'active',
          date_created: new Date().toISOString(),
          date_updated: new Date().toISOString(),
        };
        list.push(saved);
      }
    } else {
      const nextId = this.base.generateUniqueId(list as any);
      saved = {
        id: nextId,
        organization_id: orgId,
        name: material.name || '',
        code: material.code || `MAT-${nextId.toString().padStart(3, '0')}`,
        unit: material.unit || 'متر',
        category: material.category || 'fabric',
        warehouse_id: material.warehouse_id ? normalizeId(material.warehouse_id) : null,
        current_stock: Number(material.current_stock) || 0,
        min_stock: material.min_stock !== undefined ? Number(material.min_stock) : null,
        unit_cost: Number(material.unit_cost) || 0,
        color_hex: material.color_hex || null,
        description: material.description || null,
        status: material.status || 'active',
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };
      list.push(saved);
    }

    this.base.setItem('raw_materials', list);
    return saved;
  }

  async deleteRawMaterial(id: number): Promise<boolean> {
    const list = this.base.getItem<RawMaterial>('raw_materials', []);
    const filtered = list.filter((m) => normalizeId(m.id) !== normalizeId(id));
    this.base.setItem('raw_materials', filtered);
    return true;
  }

  // --------------------------------------------------------
  // Bill of Materials (BOM)
  // --------------------------------------------------------
  async getBillOfMaterials(params?: QueryParams): Promise<BillOfMaterials[]> {
    const boms = this.base.getItem<BillOfMaterials>('bill_of_materials', []);
    const bomItems = this.base.getItem<BomItem>('bom_items', []);
    const rawMaterials = this.base.getItem<RawMaterial>('raw_materials', []);
    const products = this.base.getItem<any>('products', []);

    let filtered = this.base.filterByOrg(boms, params);

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (b) => b.name.toLowerCase().includes(q) || (b.version && b.version.toLowerCase().includes(q))
      );
    }

    return filtered.map((bom) => {
      const prod = products.find((p: any) => normalizeId(p.id) === normalizeId(bom.product_id));
      const items = bomItems
        .filter((bi) => normalizeId(bi.bom_id) === normalizeId(bom.id))
        .map((bi) => {
          const rm = rawMaterials.find((m) => normalizeId(m.id) === normalizeId(bi.raw_material_id));
          return {
            ...bi,
            raw_material: rm,
          };
        });

      const estimated_cost = items.reduce(
        (sum, bi) => sum + bi.quantity_required * (bi.unit_cost || bi.raw_material?.unit_cost || 0),
        0
      );

      return {
        ...bom,
        items,
        product_name: prod?.name || '',
        estimated_cost,
      };
    });
  }

  async getBomByProductId(productId: number): Promise<BillOfMaterials | null> {
    const boms = await this.getBillOfMaterials();
    const found = boms.find((b) => normalizeId(b.product_id) === normalizeId(productId) && b.status === 'active');
    return found || null;
  }

  async saveBillOfMaterials(
    bom: Partial<BillOfMaterials>,
    items?: Partial<BomItem>[]
  ): Promise<BillOfMaterials> {
    const boms = this.base.getItem<BillOfMaterials>('bill_of_materials', []);
    const bomItems = this.base.getItem<BomItem>('bom_items', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(bom.organization_id) });
    if (!orgId) throw new Error('Active organization ID required');

    let savedBom: BillOfMaterials;
    if (bom.id && normalizeId(bom.id) > 0) {
      const idx = boms.findIndex((b) => normalizeId(b.id) === normalizeId(bom.id));
      if (idx !== -1) {
        savedBom = {
          ...boms[idx],
          ...bom,
          organization_id: orgId,
          date_updated: new Date().toISOString(),
        };
        boms[idx] = savedBom;
      } else {
        savedBom = {
          id: normalizeId(bom.id),
          organization_id: orgId,
          product_id: normalizeId(bom.product_id),
          variant_id: bom.variant_id ? normalizeId(bom.variant_id) : null,
          name: bom.name || 'شناسنامه جدید',
          version: bom.version || 'v1.0',
          waste_percentage: Number(bom.waste_percentage) || 0,
          notes: bom.notes || null,
          status: bom.status || 'active',
          date_created: new Date().toISOString(),
          date_updated: new Date().toISOString(),
        };
        boms.push(savedBom);
      }
    } else {
      const nextId = this.base.generateUniqueId(boms as any);
      savedBom = {
        id: nextId,
        organization_id: orgId,
        product_id: normalizeId(bom.product_id),
        variant_id: bom.variant_id ? normalizeId(bom.variant_id) : null,
        name: bom.name || 'شناسنامه جدید',
        version: bom.version || 'v1.0',
        waste_percentage: Number(bom.waste_percentage) || 0,
        notes: bom.notes || null,
        status: bom.status || 'active',
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };
      boms.push(savedBom);
    }

    this.base.setItem('bill_of_materials', boms);

    // Save associated items if provided
    if (items) {
      let remainingItems = bomItems.filter((bi) => normalizeId(bi.bom_id) !== normalizeId(savedBom.id));
      const newSavedItems: BomItem[] = [];

      for (const item of items) {
        const nextItemId = this.base.generateUniqueId(remainingItems as any);
        const savedItem: BomItem = {
          id: item.id && normalizeId(item.id) > 0 ? normalizeId(item.id) : nextItemId,
          bom_id: savedBom.id,
          raw_material_id: normalizeId(item.raw_material_id),
          quantity_required: Number(item.quantity_required) || 0,
          unit_cost: item.unit_cost !== undefined ? Number(item.unit_cost) : 0,
          notes: item.notes || null,
        };
        remainingItems.push(savedItem);
        newSavedItems.push(savedItem);
      }
      this.base.setItem('bom_items', remainingItems);
      savedBom.items = newSavedItems;
    }

    return savedBom;
  }

  async deleteBillOfMaterials(id: number): Promise<boolean> {
    const boms = this.base.getItem<BillOfMaterials>('bill_of_materials', []);
    const bomItems = this.base.getItem<BomItem>('bom_items', []);

    const filteredBoms = boms.filter((b) => normalizeId(b.id) !== normalizeId(id));
    const filteredItems = bomItems.filter((bi) => normalizeId(bi.bom_id) !== normalizeId(id));

    this.base.setItem('bill_of_materials', filteredBoms);
    this.base.setItem('bom_items', filteredItems);
    return true;
  }

  // --------------------------------------------------------
  // Contractors
  // --------------------------------------------------------
  async getContractors(params?: QueryParams): Promise<Contractor[]> {
    const list = this.base.getItem<Contractor>('contractors', []);
    let filtered = this.base.filterByOrg(list, params);

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          c.specialty.toLowerCase().includes(q)
      );
    }
    if (params?.status) {
      filtered = filtered.filter((c) => c.status === params.status);
    }

    return filtered;
  }

  async getContractorById(id: number): Promise<Contractor | null> {
    const list = this.base.getItem<Contractor>('contractors', []);
    const found = list.find((c) => normalizeId(c.id) === normalizeId(id));
    return found || null;
  }

  async saveContractor(contractor: Partial<Contractor>): Promise<Contractor> {
    const list = this.base.getItem<Contractor>('contractors', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(contractor.organization_id) });
    if (!orgId) throw new Error('Active organization ID required');

    let saved: Contractor;
    if (contractor.id && normalizeId(contractor.id) > 0) {
      const idx = list.findIndex((c) => normalizeId(c.id) === normalizeId(contractor.id));
      if (idx !== -1) {
        saved = {
          ...list[idx],
          ...contractor,
          organization_id: orgId,
          date_updated: new Date().toISOString(),
        };
        list[idx] = saved;
      } else {
        saved = {
          id: normalizeId(contractor.id),
          organization_id: orgId,
          name: contractor.name || '',
          specialty: contractor.specialty || 'sewing',
          phone: contractor.phone || null,
          address: contractor.address || null,
          current_balance: Number(contractor.current_balance) || 0,
          status: contractor.status || 'active',
          date_created: new Date().toISOString(),
          date_updated: new Date().toISOString(),
        };
        list.push(saved);
      }
    } else {
      const nextId = this.base.generateUniqueId(list as any);
      saved = {
        id: nextId,
        organization_id: orgId,
        name: contractor.name || '',
        specialty: contractor.specialty || 'sewing',
        phone: contractor.phone || null,
        address: contractor.address || null,
        current_balance: Number(contractor.current_balance) || 0,
        status: contractor.status || 'active',
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };
      list.push(saved);
    }

    this.base.setItem('contractors', list);
    return saved;
  }

  async deleteContractor(id: number): Promise<boolean> {
    const list = this.base.getItem<Contractor>('contractors', []);
    const filtered = list.filter((c) => normalizeId(c.id) !== normalizeId(id));
    this.base.setItem('contractors', filtered);
    return true;
  }

  // --------------------------------------------------------
  // Production Orders & Stages
  // --------------------------------------------------------
  async getProductionOrders(params?: QueryParams): Promise<ProductionOrder[]> {
    const orders = this.base.getItem<ProductionOrder>('production_orders', []);
    const items = this.base.getItem<ProductionOrderItem>('production_order_items', []);
    const stages = this.base.getItem<ProductionStage>('production_stages', []);
    const products = this.base.getItem<any>('products', []);
    const warehouses = this.base.getItem<any>('warehouses', []);
    const contractors = this.base.getItem<Contractor>('contractors', []);

    let filtered = this.base.filterByOrg(orders, params);

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.notes && o.notes.toLowerCase().includes(q))
      );
    }
    if (params?.status) {
      filtered = filtered.filter((o) => o.status === params.status);
    }

    return filtered.map((ord) => {
      const prod = products.find((p: any) => normalizeId(p.id) === normalizeId(ord.product_id));
      const wh = warehouses.find((w: any) => normalizeId(w.id) === normalizeId(ord.target_warehouse_id));

      const orderItems = items.filter((i) => normalizeId(i.production_order_id) === normalizeId(ord.id));
      const orderStages = stages
        .filter((s) => normalizeId(s.production_order_id) === normalizeId(ord.id))
        .map((st) => {
          const ctr = contractors.find((c) => normalizeId(c.id) === normalizeId(st.contractor_id));
          return {
            ...st,
            contractor_name: ctr?.name || '',
          };
        });

      return {
        ...ord,
        product_name: prod?.name || '',
        target_warehouse_name: wh?.name || '',
        items: orderItems,
        stages: orderStages,
      };
    });
  }

  async getProductionOrderById(id: number): Promise<ProductionOrder | null> {
    const orders = await this.getProductionOrders();
    const found = orders.find((o) => normalizeId(o.id) === normalizeId(id));
    return found || null;
  }

  async saveProductionOrder(
    order: Partial<ProductionOrder>,
    items?: Partial<ProductionOrderItem>[],
    stages?: Partial<ProductionStage>[]
  ): Promise<ProductionOrder> {
    const orders = this.base.getItem<ProductionOrder>('production_orders', []);
    const orderItems = this.base.getItem<ProductionOrderItem>('production_order_items', []);
    const orderStages = this.base.getItem<ProductionStage>('production_stages', []);

    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(order.organization_id) });
    if (!orgId) throw new Error('Active organization ID required');

    let savedOrder: ProductionOrder;
    if (order.id && normalizeId(order.id) > 0) {
      const idx = orders.findIndex((o) => normalizeId(o.id) === normalizeId(order.id));
      if (idx !== -1) {
        savedOrder = {
          ...orders[idx],
          ...order,
          organization_id: orgId,
          date_updated: new Date().toISOString(),
        };
        orders[idx] = savedOrder;
      } else {
        savedOrder = {
          id: normalizeId(order.id),
          organization_id: orgId,
          order_number: order.order_number || `CUT-${Date.now().toString().slice(-4)}`,
          product_id: normalizeId(order.product_id),
          bom_id: order.bom_id ? normalizeId(order.bom_id) : null,
          target_warehouse_id: order.target_warehouse_id ? normalizeId(order.target_warehouse_id) : null,
          total_quantity: Number(order.total_quantity) || 0,
          status: order.status || 'draft',
          start_date: order.start_date || null,
          due_date: order.due_date || null,
          completed_date: order.completed_date || null,
          estimated_unit_cost: Number(order.estimated_unit_cost) || 0,
          actual_unit_cost: Number(order.actual_unit_cost) || 0,
          notes: order.notes || null,
          date_created: new Date().toISOString(),
          date_updated: new Date().toISOString(),
        };
        orders.push(savedOrder);
      }
    } else {
      const nextId = this.base.generateUniqueId(orders as any);
      savedOrder = {
        id: nextId,
        organization_id: orgId,
        order_number: order.order_number || `CUT-${nextId.toString().padStart(4, '0')}`,
        product_id: normalizeId(order.product_id),
        bom_id: order.bom_id ? normalizeId(order.bom_id) : null,
        target_warehouse_id: order.target_warehouse_id ? normalizeId(order.target_warehouse_id) : null,
        total_quantity: Number(order.total_quantity) || 0,
        status: order.status || 'draft',
        start_date: order.start_date || null,
        due_date: order.due_date || null,
        completed_date: order.completed_date || null,
        estimated_unit_cost: Number(order.estimated_unit_cost) || 0,
        actual_unit_cost: Number(order.actual_unit_cost) || 0,
        notes: order.notes || null,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };
      orders.push(savedOrder);
    }

    this.base.setItem('production_orders', orders);

    // Save order items if provided
    if (items) {
      let remainingItems = orderItems.filter((i) => normalizeId(i.production_order_id) !== normalizeId(savedOrder.id));
      const savedItemsList: ProductionOrderItem[] = [];
      for (const item of items) {
        const nextItemId = this.base.generateUniqueId(remainingItems as any);
        const savedItem: ProductionOrderItem = {
          id: item.id && normalizeId(item.id) > 0 ? normalizeId(item.id) : nextItemId,
          production_order_id: savedOrder.id,
          variant_id: normalizeId(item.variant_id),
          quantity_planned: Number(item.quantity_planned) || 0,
          quantity_completed: Number(item.quantity_completed) || 0,
          quantity_rejected: Number(item.quantity_rejected) || 0,
        };
        remainingItems.push(savedItem);
        savedItemsList.push(savedItem);
      }
      this.base.setItem('production_order_items', remainingItems);
      savedOrder.items = savedItemsList;
    }

    // Save stages if provided
    if (stages) {
      let remainingStages = orderStages.filter((s) => normalizeId(s.production_order_id) !== normalizeId(savedOrder.id));
      const savedStagesList: ProductionStage[] = [];
      for (const stage of stages) {
        const nextStageId = this.base.generateUniqueId(remainingStages as any);
        const savedStage: ProductionStage = {
          id: stage.id && normalizeId(stage.id) > 0 ? normalizeId(stage.id) : nextStageId,
          production_order_id: savedOrder.id,
          contractor_id: stage.contractor_id ? normalizeId(stage.contractor_id) : null,
          stage_type: stage.stage_type || 'sewing',
          status: stage.status || 'pending',
          unit_fee: Number(stage.unit_fee) || 0,
          total_fee: Number(stage.total_fee) || 0,
          quantity_sent: Number(stage.quantity_sent) || 0,
          quantity_received: Number(stage.quantity_received) || 0,
          quantity_damaged: Number(stage.quantity_damaged) || 0,
          sent_date: stage.sent_date || null,
          received_date: stage.received_date || null,
          notes: stage.notes || null,
        };
        remainingStages.push(savedStage);
        savedStagesList.push(savedStage);
      }
      this.base.setItem('production_stages', remainingStages);
      savedOrder.stages = savedStagesList;
    }

    return savedOrder;
  }

  async deleteProductionOrder(id: number): Promise<boolean> {
    const orders = this.base.getItem<ProductionOrder>('production_orders', []);
    const items = this.base.getItem<ProductionOrderItem>('production_order_items', []);
    const stages = this.base.getItem<ProductionStage>('production_stages', []);

    this.base.setItem('production_orders', orders.filter((o) => normalizeId(o.id) !== normalizeId(id)));
    this.base.setItem('production_order_items', items.filter((i) => normalizeId(i.production_order_id) !== normalizeId(id)));
    this.base.setItem('production_stages', stages.filter((s) => normalizeId(s.production_order_id) !== normalizeId(id)));
    return true;
  }
}
