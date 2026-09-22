import { QueryParams } from '../types';
import { SqliteStorageBase } from './sqliteBase';
import { normalizeId, matchesSearchQuery } from '../../utils/formatters';
import {
  Product,
  ProductVariant,
  InventoryItem,
  Warehouse,
  InventoryMovement,
  Category,
  Collection,
  Brand,
  Season,
  Color,
  SizeGroup,
  Size,
  SizeGuideTemplate,
  SizeGuideMeasurement,
  SizeGuideValue,
} from '../../types';

export class SqliteCatalogStorage {
  constructor(private base: SqliteStorageBase) {}

  // ==========================================
  // Products
  // ==========================================
  async getProducts(params?: QueryParams): Promise<Product[]> {
    const orgId = this.base.getActiveOrgId(params);
    let items = await this.base.getItems<Product>('products', orgId);

    const variants = await this.base.getItems<ProductVariant>('product_variants', orgId);
    const inventoryItems = await this.base.getItems<InventoryItem>('inventory_items', orgId);

    if (params?.search && params.search.trim()) {
      const searchTerm = params.search.trim();
      items = items.filter((p) => {
        const pId = normalizeId(p.id) || Number(p.id);
        const pVariants = variants.filter((v) => (normalizeId(v.product_id) || Number(v.product_id)) === pId);
        const variantTexts = pVariants.map((v) => `${v.sku || ''} ${v.barcode || ''} ${v.color_name || ''} ${v.size_name || ''}`).join(' ');
        const brandName = typeof p.brand === 'string' ? p.brand : p.brand?.name || (typeof p.brand_id === 'object' ? (p.brand_id as any)?.name : '');
        return matchesSearchQuery(searchTerm, p.title, (p as any).sku, (p as any).barcode, p.slug, p.description, p.tags, brandName, variantTexts);
      });
    }

    return items.map((p) => {
      const pVariants = variants.filter((v) => normalizeId(v.product_id) === p.id);
      const pVariantIds = new Set(pVariants.map((v) => normalizeId(v.id)).filter(Boolean));
      const pInventory = inventoryItems.filter((i) => {
        const vId = normalizeId(i.variant_id);
        return vId !== undefined && pVariantIds.has(vId);
      });
      const totalStock = pInventory.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      return {
        ...p,
        variants_count: pVariants.length,
        total_stock: totalStock,
      };
    });
  }

  async getProductById(id: number): Promise<Product | null> {
    const products = await this.getProducts();
    return products.find((p) => p.id === id) || null;
  }

  async saveProduct(product: Partial<Product>): Promise<Product> {
    const list = await this.base.getItems<Product>('products');
    const pId = normalizeId(product.id);
    let saved: Product;

    if (pId) {
      const existing = list.find((p) => normalizeId(p.id) === pId);
      if (existing) {
        saved = {
          ...existing,
          ...product,
          main_image: product.main_image !== undefined ? (product.main_image || null as any) : existing.main_image,
          id: pId,
          date_updated: new Date().toISOString(),
        };
      } else {
        saved = {
          organization_id: product.organization_id || 1,
          title: product.title || '',
          slug: product.slug || `prod-${pId}`,
          status: product.status || 'published',
          date_created: new Date().toISOString(),
          ...product,
          id: pId,
        };
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      saved = {
        organization_id: product.organization_id || 1,
        title: product.title || '',
        slug: product.slug || `prod-${newId}`,
        status: product.status || 'published',
        date_created: new Date().toISOString(),
        ...product,
        id: newId,
      };
    }

    await this.base.saveItem('products', saved);
    return saved;
  }

  async deleteProduct(id: number | string): Promise<boolean> {
    const normId = normalizeId(id) || Number(id);
    await this.base.deleteItem('products', normId);

    const variants = await this.base.getItems<ProductVariant>('product_variants');
    const removedVariantIds: number[] = [];
    for (const v of variants) {
      if ((normalizeId(v.product_id) || Number(v.product_id)) === normId) {
        const vId = normalizeId(v.id) || Number(v.id);
        removedVariantIds.push(vId);
        await this.base.deleteItem('product_variants', vId);
      }
    }

    const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
    for (const inv of inventoryList) {
      const vId = normalizeId(inv.variant_id) || Number(inv.variant_id);
      if (vId && removedVariantIds.includes(vId)) {
        await this.base.deleteItem('inventory_items', normalizeId(inv.id) || Number(inv.id));
      }
    }

    return true;
  }

  // ==========================================
  // Variants
  // ==========================================
  async getVariants(params?: QueryParams): Promise<ProductVariant[]> {
    const orgId = this.base.getActiveOrgId(params);
    const items = await this.base.getItems<ProductVariant>('product_variants', orgId);
    const products = await this.base.getItems<Product>('products', orgId);
    const colors = await this.base.getItems<Color>('colors', orgId);
    const sizes = await this.base.getItems<Size>('sizes', orgId);
    const inventoryItems = await this.base.getItems<InventoryItem>('inventory_items', orgId);

    return items.map((v) => {
      const vNormalizedId = normalizeId(v.id);
      const prodId = normalizeId(v.product_id);
      const colorId = normalizeId(v.color_id);
      const sizeId = normalizeId(v.size_id);

      const prod = products.find((p) => p.id === prodId);
      const color = colors.find((c) => c.id === colorId);
      const size = sizes.find((s) => s.id === sizeId);

      const vInv = inventoryItems.filter((i) => normalizeId(i.variant_id) === vNormalizedId);
      const totalStock = vInv.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      return {
        ...v,
        id: vNormalizedId || v.id,
        product_id: prodId || v.product_id,
        color_id: colorId,
        size_id: sizeId,
        product_title: prod?.title || v.product_title || 'محصول',
        color_name: color?.name || v.color_name || '-',
        size_name: size?.name || v.size_name || '-',
        stock_quantity: totalStock,
      };
    });
  }

  async getVariantsByProductId(productId: number): Promise<ProductVariant[]> {
    const all = await this.getVariants();
    return all.filter((v) => normalizeId(v.product_id) === productId);
  }

  async saveVariant(variant: Partial<ProductVariant>, warehouseId?: number, locationId?: number): Promise<ProductVariant> {
    const list = await this.base.getItems<ProductVariant>('product_variants');
    let saved: ProductVariant;
    const vId = normalizeId(variant.id);
    const colorId = normalizeId(variant.color_id);
    const sizeId = normalizeId(variant.size_id);
    const productId = normalizeId(variant.product_id);

    if (vId) {
      const existing = list.find((v) => normalizeId(v.id) === vId);
      if (existing) {
        saved = {
          ...existing,
          ...variant,
          id: vId,
          product_id: productId || existing.product_id,
          color_id: colorId,
          size_id: sizeId,
          image: variant.image !== undefined ? (variant.image || null as any) : existing.image,
          date_updated: new Date().toISOString(),
        };
      } else {
        saved = {
          organization_id: variant.organization_id || 1,
          product_id: productId || 0,
          color_id: colorId,
          size_id: sizeId,
          sku: variant.sku || `SKU-${Date.now().toString().slice(-6)}`,
          status: 'published',
          ...variant,
          id: vId,
        };
      }
    } else {
      const newVarId = this.base.generateUniqueId(list);
      saved = {
        organization_id: variant.organization_id || 1,
        product_id: productId || 0,
        color_id: colorId,
        size_id: sizeId,
        sku: variant.sku || `SKU-${Date.now().toString().slice(-6)}`,
        status: 'published',
        date_created: new Date().toISOString(),
        ...variant,
        id: newVarId,
      };
    }

    await this.base.saveItem('product_variants', saved);

    if (variant.stock_quantity !== undefined && variant.stock_quantity !== null) {
      const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
      const qtyNum = Math.max(0, Number(variant.stock_quantity) || 0);

      const warehouses = await this.base.getItems<Warehouse>('warehouses');
      let targetWarehouseId = warehouseId;
      if (!targetWarehouseId || !warehouses.some((w) => w.id === targetWarehouseId)) {
        if (warehouses.length > 0) {
          targetWarehouseId = warehouses[0].id;
        } else {
          const validWhId = this.base.generateUniqueId(warehouses);
          const defaultWarehouse: Warehouse = {
            id: validWhId,
            name: 'انبار مرکزی',
            code: 'MAIN-WH',
            type: 'warehouse',
            status: 'active',
            organization_id: variant.organization_id || 1,
          };
          await this.base.saveItem('warehouses', defaultWarehouse);
          targetWarehouseId = defaultWarehouse.id;
        }
      }

      const invItem = inventoryList.find((i) => normalizeId(i.variant_id) === saved.id && i.warehouse_id === targetWarehouseId);
      const movList = await this.base.getItems<InventoryMovement>('inventory_movements');

      if (invItem) {
        const oldQty = invItem.quantity || 0;
        await this.base.saveItem('inventory_items', { ...invItem, quantity: qtyNum });
        if (qtyNum !== oldQty) {
          const movId = this.base.generateUniqueId(movList);
          await this.base.saveItem('inventory_movements', {
            id: movId,
            organization_id: variant.organization_id || 1,
            variant_id: saved.id,
            warehouse_id: targetWarehouseId,
            type: 'adjustment',
            quantity: Math.abs(qtyNum - oldQty),
            reference_type: 'manual',
            created_at: new Date().toISOString(),
          });
        }
      } else {
        const newInvId = this.base.generateUniqueId(inventoryList);
        await this.base.saveItem('inventory_items', {
          id: newInvId,
          organization_id: variant.organization_id || 1,
          variant_id: saved.id,
          warehouse_id: targetWarehouseId,
          location_id: locationId || undefined,
          quantity: qtyNum,
          reserved_quantity: 0,
        });
        if (qtyNum > 0) {
          const movId = this.base.generateUniqueId(movList);
          await this.base.saveItem('inventory_movements', {
            id: movId,
            organization_id: variant.organization_id || 1,
            variant_id: saved.id,
            warehouse_id: targetWarehouseId,
            type: 'purchase',
            quantity: qtyNum,
            reference_type: 'manual',
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    return saved;
  }

  async deleteVariant(id: number): Promise<boolean> {
    await this.base.deleteItem('product_variants', id);
    const inventoryList = await this.base.getItems<InventoryItem>('inventory_items');
    for (const inv of inventoryList) {
      if (normalizeId(inv.variant_id) === id) {
        await this.base.deleteItem('inventory_items', inv.id);
      }
    }
    return true;
  }

  // ==========================================
  // Catalog Attributes
  // ==========================================
  async getCategories(params?: QueryParams): Promise<Category[]> {
    return this.base.getItems<Category>('categories', this.base.getActiveOrgId(params));
  }
  async saveCategory(cat: Partial<Category>): Promise<Category> {
    const list = await this.base.getItems<Category>('categories');
    const validId = typeof cat.id === 'number' && cat.id > 0 ? cat.id : this.base.generateUniqueId(list);
    const saved: Category = {
      name: cat.name || 'دسته‌بندی جدید',
      slug: cat.slug || `cat-${validId}`,
      status: 'active',
      organization_id: cat.organization_id || 1,
      ...cat,
      id: validId,
    };
    await this.base.saveItem('categories', saved);
    return saved;
  }
  async deleteCategory(id: number): Promise<boolean> {
    return this.base.deleteItem('categories', id);
  }

  async getCollections(params?: QueryParams): Promise<Collection[]> {
    return this.base.getItems<Collection>('collections', this.base.getActiveOrgId(params));
  }
  async saveCollection(col: Partial<Collection>): Promise<Collection> {
    const list = await this.base.getItems<Collection>('collections');
    const validId = typeof col.id === 'number' && col.id > 0 ? col.id : this.base.generateUniqueId(list);
    const saved: Collection = {
      name: col.name || 'کالکشن جدید',
      slug: col.slug || `col-${validId}`,
      status: 'active',
      organization_id: col.organization_id || 1,
      ...col,
      id: validId,
    };
    await this.base.saveItem('collections', saved);
    return saved;
  }
  async deleteCollection(id: number): Promise<boolean> {
    return this.base.deleteItem('collections', id);
  }

  async getBrands(params?: QueryParams): Promise<Brand[]> {
    return this.base.getItems<Brand>('brands', this.base.getActiveOrgId(params));
  }
  async saveBrand(brand: Partial<Brand>): Promise<Brand> {
    const list = await this.base.getItems<Brand>('brands');
    const validId = typeof brand.id === 'number' && brand.id > 0 ? brand.id : this.base.generateUniqueId(list);
    const saved: Brand = {
      name: brand.name || 'برند جدید',
      status: 'active',
      organization_id: brand.organization_id || 1,
      ...brand,
      id: validId,
    };
    await this.base.saveItem('brands', saved);
    return saved;
  }
  async deleteBrand(id: number): Promise<boolean> {
    return this.base.deleteItem('brands', id);
  }

  async getSeasons(params?: QueryParams): Promise<Season[]> {
    return this.base.getItems<Season>('seasons', this.base.getActiveOrgId(params));
  }
  async saveSeason(season: Partial<Season>): Promise<Season> {
    const list = await this.base.getItems<Season>('seasons');
    const validId = typeof season.id === 'number' && season.id > 0 ? season.id : this.base.generateUniqueId(list);
    const saved: Season = {
      name: season.name || 'فصل جدید',
      status: 'active',
      organization_id: season.organization_id || 1,
      ...season,
      id: validId,
    };
    await this.base.saveItem('seasons', saved);
    return saved;
  }
  async deleteSeason(id: number): Promise<boolean> {
    return this.base.deleteItem('seasons', id);
  }

  async getColors(params?: QueryParams): Promise<Color[]> {
    return this.base.getItems<Color>('colors', this.base.getActiveOrgId(params));
  }
  async saveColor(color: Partial<Color>): Promise<Color> {
    const list = await this.base.getItems<Color>('colors');
    const validId = typeof color.id === 'number' && color.id > 0 ? color.id : this.base.generateUniqueId(list);
    const saved: Color = {
      name: color.name || 'رنگ جدید',
      hex: color.hex || '#000000',
      status: 'active',
      organization_id: color.organization_id || 1,
      ...color,
      id: validId,
    };
    await this.base.saveItem('colors', saved);
    return saved;
  }
  async deleteColor(id: number): Promise<boolean> {
    return this.base.deleteItem('colors', id);
  }

  async getSizeGroups(params?: QueryParams): Promise<SizeGroup[]> {
    return this.base.getItems<SizeGroup>('size_groups', this.base.getActiveOrgId(params));
  }
  async saveSizeGroup(group: Partial<SizeGroup>): Promise<SizeGroup> {
    const list = await this.base.getItems<SizeGroup>('size_groups');
    const validId = typeof group.id === 'number' && group.id > 0 ? group.id : this.base.generateUniqueId(list);
    const saved: SizeGroup = {
      name: group.name || 'گروه سایز جدید',
      category: group.category || 'apparel',
      status: 'active',
      organization_id: group.organization_id || 1,
      ...group,
      id: validId,
    };
    await this.base.saveItem('size_groups', saved);
    return saved;
  }
  async deleteSizeGroup(id: number): Promise<boolean> {
    return this.base.deleteItem('size_groups', id);
  }

  async getSizes(params?: QueryParams): Promise<Size[]> {
    return this.base.getItems<Size>('sizes', this.base.getActiveOrgId(params));
  }
  async saveSize(size: Partial<Size>): Promise<Size> {
    const list = await this.base.getItems<Size>('sizes');
    const validId = typeof size.id === 'number' && size.id > 0 ? size.id : this.base.generateUniqueId(list);
    const saved: Size = {
      name: size.name || 'سایز جدید',
      status: 'active',
      organization_id: size.organization_id || 1,
      ...size,
      id: validId,
    };
    await this.base.saveItem('sizes', saved);
    return saved;
  }
  async deleteSize(id: number): Promise<boolean> {
    return this.base.deleteItem('sizes', id);
  }

  // ==========================================
  // Size Guides
  // ==========================================
  async getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    return this.base.getItems<SizeGuideTemplate>('size_guide_templates', this.base.getActiveOrgId(params));
  }
  async getSizeGuideTemplateById(id: number): Promise<SizeGuideTemplate | null> {
    const list = await this.getSizeGuideTemplates();
    return list.find((t) => t.id === id) || null;
  }
  async saveSizeGuideTemplate(tpl: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    const list = await this.base.getItems<SizeGuideTemplate>('size_guide_templates');
    const validId = typeof tpl.id === 'number' && tpl.id > 0 ? tpl.id : this.base.generateUniqueId(list);
    const saved: SizeGuideTemplate = {
      name: tpl.name || 'قالب راهنمای سایز جدید',
      type: tpl.type || 'apparel',
      unit: tpl.unit || 'cm',
      status: 'active',
      date_created: new Date().toISOString(),
      organization_id: tpl.organization_id || 1,
      ...tpl,
      id: validId,
    };
    await this.base.saveItem('size_guide_templates', saved);
    return saved;
  }
  async deleteSizeGuideTemplate(id: number): Promise<boolean> {
    return this.base.deleteItem('size_guide_templates', id);
  }

  async getSizeGuideMeasurements(templateId?: number): Promise<SizeGuideMeasurement[]> {
    const all = await this.base.getItems<SizeGuideMeasurement>('size_guide_measurements');
    if (templateId) {
      return all.filter((m) => normalizeId(m.template_id) === templateId);
    }
    return all;
  }
  async saveSizeGuideMeasurement(meas: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement> {
    const list = await this.base.getItems<SizeGuideMeasurement>('size_guide_measurements');
    const validId = typeof meas.id === 'number' && meas.id > 0 ? meas.id : this.base.generateUniqueId(list);
    const saved: SizeGuideMeasurement = {
      name: meas.name || 'اندازه جدید',
      template_id: meas.template_id || 1,
      unit: meas.unit || 'cm',
      type: meas.type || 'width',
      status: 'active',
      ...meas,
      id: validId,
    };
    await this.base.saveItem('size_guide_measurements', saved);
    return saved;
  }
  async deleteSizeGuideMeasurement(id: number): Promise<boolean> {
    return this.base.deleteItem('size_guide_measurements', id);
  }

  async getSizeGuideValues(templateId?: number): Promise<SizeGuideValue[]> {
    const all = await this.base.getItems<SizeGuideValue>('size_guide_values');
    if (templateId) {
      return all.filter((v) => normalizeId(v.template_id) === templateId);
    }
    return all;
  }
  async saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue> {
    const list = await this.base.getItems<SizeGuideValue>('size_guide_values');
    const validId = typeof val.id === 'number' && val.id > 0 ? val.id : this.base.generateUniqueId(list);
    const saved: SizeGuideValue = {
      template_id: val.template_id || 1,
      size_id: val.size_id || 1,
      measurement_id: val.measurement_id || 1,
      value: val.value || 0,
      ...val,
      id: validId,
    };
    await this.base.saveItem('size_guide_values', saved);
    return saved;
  }
  async deleteSizeGuideValue(id: number): Promise<boolean> {
    return this.base.deleteItem('size_guide_values', id);
  }
}
