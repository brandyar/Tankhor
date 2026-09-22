import { QueryParams } from '../types';
import { LocalStorageBase } from './localBase';
import { normalizeId, matchesSearchQuery } from '../../utils/formatters';
import {
  Category,
  Collection,
  Season,
  Color,
  SizeGroup,
  Size,
  Brand,
  Product,
  ProductVariant,
  InventoryItem,
  InventoryMovement,
  Warehouse,
  SizeGuideTemplate,
  SizeGuideMeasurement,
  SizeGuideValue
} from '../../types';

export class LocalCatalogStorage {
  constructor(private base: LocalStorageBase) {}

  // Products & Variants
  async getProducts(params?: QueryParams): Promise<Product[]> {
    let items = this.base.getItem<Product>('products', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((p) => {
        const pOrgId = typeof p.organization_id === 'number' ? p.organization_id : Number((p.organization_id as any)?.id || (p as any).organization_id);
        return pOrgId === orgId;
      });
    }
    const variants = this.base.getItem<ProductVariant>('product_variants', []);
    const inventoryItems = this.base.getItem<InventoryItem>('inventory_items', []);

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
      const pVariants = variants.filter((v) => {
        const pId = normalizeId(v.product_id);
        return pId === p.id;
      });
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
    const list = await this.getProducts();
    return list.find((p) => p.id === id) || null;
  }

  async saveProduct(product: Partial<Product>): Promise<Product> {
    const list = this.base.getItem<Product>('products', []);
    if (product.id) {
      const idx = list.findIndex((p) => p.id === product.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...product,
          main_image: product.main_image !== undefined ? (product.main_image || null as any) : list[idx].main_image,
          date_updated: new Date().toISOString()
        };
        this.base.setItem('products', list);
        return list[idx];
      }
    }
    const newProduct: Product = {
      id: this.base.generateUniqueId(list),
      organization_id: product.organization_id || 1,
      title: product.title || 'محصول جدید',
      status: product.status || 'published',
      date_created: new Date().toISOString(),
      variants_count: 0,
      total_stock: 0,
      ...product,
    };
    list.unshift(newProduct);
    this.base.setItem('products', list);
    return newProduct;
  }

  async deleteProduct(id: number | string): Promise<boolean> {
    const normId = normalizeId(id) || Number(id);
    let list = this.base.getItem<Product>('products', []);
    list = list.filter((p) => (normalizeId(p.id) || Number(p.id)) !== normId && p.id !== id);
    this.base.setItem('products', list);

    // Clean up associated variants, inventory & movements
    const variants = this.base.getItem<ProductVariant>('product_variants', []);
    const removedVariantIds: number[] = [];
    const remainingVariants = variants.filter((v) => {
      const pId = normalizeId(v.product_id) || Number(v.product_id);
      if (pId === normId) {
        removedVariantIds.push(normalizeId(v.id) || Number(v.id));
        return false;
      }
      return true;
    });
    this.base.setItem('product_variants', remainingVariants);

    let inventoryList = this.base.getItem<InventoryItem>('inventory_items', []);
    inventoryList = inventoryList.filter((i) => {
      const vId = normalizeId(i.variant_id) || Number(i.variant_id);
      return !removedVariantIds.includes(vId);
    });
    this.base.setItem('inventory_items', inventoryList);

    let movementsList = this.base.getItem<InventoryMovement>('inventory_movements', []);
    movementsList = movementsList.filter((m) => {
      const vId = normalizeId(m.variant_id) || Number(m.variant_id);
      return !removedVariantIds.includes(vId);
    });
    this.base.setItem('inventory_movements', movementsList);

    return true;
  }

  async getVariants(params?: QueryParams): Promise<ProductVariant[]> {
    let items = this.base.getItem<ProductVariant>('product_variants', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((v) => {
        const vOrgId = typeof v.organization_id === 'number' ? v.organization_id : Number((v.organization_id as any)?.id || (v as any).organization_id);
        return vOrgId === orgId;
      });
    }
    const products = this.base.getItem<Product>('products', []);
    const colors = this.base.getItem<Color>('colors', []);
    const sizes = this.base.getItem<Size>('sizes', []);
    const inventoryItems = this.base.getItem<InventoryItem>('inventory_items', []);

    return items.map((v) => {
      const vNormalizedId = normalizeId(v.id);
      const prodId = normalizeId(v.product_id);
      const colorId = normalizeId(v.color_id);
      const sizeId = normalizeId(v.size_id);

      const prod = products.find((p) => p.id === prodId);
      const color = colors.find((c) => c.id === colorId);
      const size = sizes.find((s) => s.id === sizeId);

      const vInv = inventoryItems.filter((i) => {
        const vId = normalizeId(i.variant_id);
        return vId === vNormalizedId;
      });
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
    const variants = this.base.getItem<ProductVariant>('product_variants', []).filter((v) => {
      const pId = normalizeId(v.product_id);
      return pId === productId;
    });
    const inventoryItems = this.base.getItem<InventoryItem>('inventory_items', []);
    const colors = this.base.getItem<Color>('colors', []);
    const sizes = this.base.getItem<Size>('sizes', []);
    const products = this.base.getItem<Product>('products', []);
    const prod = products.find((p) => p.id === productId);

    return variants.map((v) => {
      const vNormalizedId = normalizeId(v.id);
      const vInv = inventoryItems.filter((i) => {
        const vId = normalizeId(i.variant_id);
        return vId === vNormalizedId;
      });
      const totalStock = vInv.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      const cId = normalizeId(v.color_id);
      const sId = normalizeId(v.size_id);

      const matchedColor = colors.find((c) => c.id === cId);
      const matchedSize = sizes.find((s) => s.id === sId);

      return {
        ...v,
        id: vNormalizedId || v.id,
        product_id: productId,
        color_id: cId,
        size_id: sId,
        product_title: prod?.title || 'محصول',
        color_name: matchedColor?.name || v.color_name || '-',
        size_name: matchedSize?.name || v.size_name || '-',
        stock_quantity: totalStock,
      };
    });
  }

  async saveVariant(variant: Partial<ProductVariant>, warehouseId?: number, locationId?: number): Promise<ProductVariant> {
    const list = this.base.getItem<ProductVariant>('product_variants', []);
    let saved: ProductVariant;
    const vId = normalizeId(variant.id);
    const colorId = normalizeId(variant.color_id);
    const sizeId = normalizeId(variant.size_id);
    const productId = normalizeId(variant.product_id);

    if (vId) {
      const idx = list.findIndex((v) => normalizeId(v.id) === vId);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...variant,
          id: vId,
          product_id: productId || list[idx].product_id,
          color_id: colorId,
          size_id: sizeId,
          image: variant.image !== undefined ? (variant.image || null as any) : list[idx].image,
          date_updated: new Date().toISOString(),
        };
        saved = list[idx];
      } else {
        saved = {
          id: vId,
          organization_id: variant.organization_id || 1,
          product_id: productId || 0,
          color_id: colorId,
          size_id: sizeId,
          sku: variant.sku || `SKU-${Date.now().toString().slice(-6)}`,
          status: 'published',
          ...variant,
        };
        list.unshift(saved);
      }
    } else {
      saved = {
        id: this.base.generateUniqueId(list),
        organization_id: variant.organization_id || 1,
        product_id: productId || 0,
        color_id: colorId,
        size_id: sizeId,
        sku: variant.sku || `SKU-${Date.now().toString().slice(-6)}`,
        status: 'published',
        date_created: new Date().toISOString(),
        ...variant,
      };
      list.unshift(saved);
    }
    this.base.setItem('product_variants', list);

    if (variant.stock_quantity !== undefined && variant.stock_quantity !== null) {
      const inventoryList = this.base.getItem<InventoryItem>('inventory_items', []);
      const qtyNum = Math.max(0, Number(variant.stock_quantity) || 0);

      // Resolve warehouse
      const warehouses = this.base.getItem<Warehouse>('warehouses', []);
      let targetWarehouseId = warehouseId;
      if (!targetWarehouseId || !warehouses.some((w) => w.id === targetWarehouseId)) {
        if (warehouses.length > 0) {
          targetWarehouseId = warehouses[0].id;
        } else {
          const newWh: Warehouse = {
            id: 1,
            organization_id: saved.organization_id || 1,
            name: 'انبار مرکزی',
            code: 'MAIN',
            type: 'warehouse',
            status: 'active',
          };
          warehouses.push(newWh);
          this.base.setItem('warehouses', warehouses);
          targetWarehouseId = 1;
        }
      }

      const invIdx = inventoryList.findIndex((i) => {
        const itemVId = normalizeId(i.variant_id);
        return itemVId === saved.id;
      });

      if (invIdx !== -1) {
        const item = inventoryList[invIdx];
        const reserved = Number(item.reserved_quantity) || 0;
        const damaged = Number(item.damaged_quantity) || 0;
        inventoryList[invIdx].quantity = qtyNum;
        inventoryList[invIdx].available_quantity = Math.max(0, qtyNum - reserved - damaged);
        if (locationId) {
          inventoryList[invIdx].location_id = locationId;
        }
        inventoryList[invIdx].updated_at = new Date().toISOString();
      } else {
        inventoryList.push({
          id: this.base.generateUniqueId(inventoryList),
          organization_id: saved.organization_id || 1,
          variant_id: saved.id,
          warehouse_id: targetWarehouseId || 1,
          location_id: locationId || undefined,
          quantity: qtyNum,
          reserved_quantity: 0,
          available_quantity: qtyNum,
          damaged_quantity: 0,
          reorder_point: 5,
          safety_stock: 2,
          updated_at: new Date().toISOString(),
        });

        // Record initial movement log
        const movementsList = this.base.getItem<InventoryMovement>('inventory_movements', []);
        movementsList.unshift({
          id: this.base.generateUniqueId(movementsList),
          organization_id: saved.organization_id || 1,
          variant_id: saved.id,
          warehouse_id: targetWarehouseId || 1,
          location_id: locationId || undefined,
          type: 'adjustment',
          quantity: qtyNum,
          reference_type: 'manual',
          reference_id: `INIT-${saved.id}`,
          note: 'موجودی اولیه هنگام ایجاد متغیر کالا',
          created_at: new Date().toISOString(),
        });
        this.base.setItem('inventory_movements', movementsList);
      }
      this.base.setItem('inventory_items', inventoryList);
    }

    return saved;
  }

  async deleteVariant(id: number): Promise<boolean> {
    let list = this.base.getItem<ProductVariant>('product_variants', []);
    list = list.filter((v) => v.id !== id);
    this.base.setItem('product_variants', list);

    let inventoryList = this.base.getItem<InventoryItem>('inventory_items', []);
    inventoryList = inventoryList.filter((i) => {
      const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
      return vId !== id;
    });
    this.base.setItem('inventory_items', inventoryList);

    let movementsList = this.base.getItem<InventoryMovement>('inventory_movements', []);
    movementsList = movementsList.filter((m) => {
      const vId = typeof m.variant_id === 'number' ? m.variant_id : (m.variant_id as any)?.id;
      return vId !== id;
    });
    this.base.setItem('inventory_movements', movementsList);

    return true;
  }

  // Catalog Attributes
  async getCategories(params?: QueryParams): Promise<Category[]> {
    let items = this.base.getItem<Category>('categories', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((c) => {
        const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
        return cOrgId === orgId;
      });
    }
    return items;
  }

  async saveCategory(cat: Partial<Category>): Promise<Category> {
    const list = await this.getCategories();
    if (cat.id) {
      const idx = list.findIndex((c) => c.id === cat.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...cat };
        this.base.setItem('categories', list);
        return list[idx];
      }
    }
    const newCat: Category = {
      id: this.base.generateUniqueId(list),
      organization_id: cat.organization_id || this.base.getActiveOrgId() || 1,
      name: cat.name || 'دسته‌بندی جدید',
      slug: cat.slug || 'cat-new',
      status: 'active',
      ...cat,
    };
    list.push(newCat);
    this.base.setItem('categories', list);
    return newCat;
  }

  async deleteCategory(id: number): Promise<boolean> {
    let list = await this.getCategories();
    list = list.filter((c) => c.id !== id);
    this.base.setItem('categories', list);
    return true;
  }

  async getCollections(params?: QueryParams): Promise<Collection[]> {
    let items = this.base.getItem<Collection>('collections', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((c) => {
        const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
        return cOrgId === orgId;
      });
    }
    return items;
  }

  async saveCollection(col: Partial<Collection>): Promise<Collection> {
    const list = await this.getCollections();
    if (col.id) {
      const idx = list.findIndex((c) => c.id === col.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...col };
        this.base.setItem('collections', list);
        return list[idx];
      }
    }
    const newCol: Collection = {
      id: this.base.generateUniqueId(list),
      organization_id: col.organization_id || this.base.getActiveOrgId() || 1,
      name: col.name || 'مجموعه جدید',
      slug: col.slug || 'col-new',
      status: 'active',
      ...col,
    };
    list.push(newCol);
    this.base.setItem('collections', list);
    return newCol;
  }

  async deleteCollection(id: number): Promise<boolean> {
    let list = await this.getCollections();
    list = list.filter((c) => c.id !== id);
    this.base.setItem('collections', list);
    return true;
  }

  async getBrands(params?: QueryParams): Promise<Brand[]> {
    let items = this.base.getItem<Brand>('brands', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((b) => {
        const bOrgId = typeof b.organization_id === 'number' ? b.organization_id : Number((b.organization_id as any)?.id || (b as any).organization_id);
        return bOrgId === orgId;
      });
    }
    return items;
  }

  async saveBrand(brand: Partial<Brand>): Promise<Brand> {
    const list = await this.getBrands();
    if (brand.id) {
      const idx = list.findIndex((b) => b.id === brand.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...brand, date_updated: new Date().toISOString() };
        this.base.setItem('brands', list);
        return list[idx];
      }
    }
    const newBrand: Brand = {
      id: this.base.generateUniqueId(list),
      organization_id: brand.organization_id || this.base.getActiveOrgId() || 1,
      name: brand.name || 'برند جدید',
      code: brand.code || '',
      status: 'active',
      date_created: new Date().toISOString(),
      ...brand,
    };
    list.push(newBrand);
    this.base.setItem('brands', list);
    return newBrand;
  }

  async deleteBrand(id: number): Promise<boolean> {
    let list = await this.getBrands();
    list = list.filter((b) => b.id !== id);
    this.base.setItem('brands', list);
    return true;
  }

  async getSeasons(params?: QueryParams): Promise<Season[]> {
    let items = this.base.getItem<Season>('seasons', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((s) => {
        const sOrgId = typeof s.organization_id === 'number' ? s.organization_id : Number((s.organization_id as any)?.id || (s as any).organization_id);
        return sOrgId === orgId;
      });
    }
    return items;
  }

  async saveSeason(season: Partial<Season>): Promise<Season> {
    const list = await this.getSeasons();
    if (season.id) {
      const idx = list.findIndex((s) => s.id === season.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...season };
        this.base.setItem('seasons', list);
        return list[idx];
      }
    }
    const newSeason: Season = {
      id: this.base.generateUniqueId(list),
      organization_id: season.organization_id || this.base.getActiveOrgId() || 1,
      name: season.name || 'فصل جدید',
      status: 'active',
      ...season,
    };
    list.push(newSeason);
    this.base.setItem('seasons', list);
    return newSeason;
  }

  async deleteSeason(id: number): Promise<boolean> {
    let list = await this.getSeasons();
    list = list.filter((s) => s.id !== id);
    this.base.setItem('seasons', list);
    return true;
  }

  async getColors(params?: QueryParams): Promise<Color[]> {
    let items = this.base.getItem<Color>('colors', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((c) => {
        const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
        return cOrgId === orgId;
      });
    }
    return items;
  }

  async saveColor(color: Partial<Color>): Promise<Color> {
    const list = await this.getColors();
    if (color.id) {
      const idx = list.findIndex((c) => c.id === color.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...color };
        this.base.setItem('colors', list);
        return list[idx];
      }
    }
    const newColor: Color = {
      id: this.base.generateUniqueId(list),
      organization_id: color.organization_id || this.base.getActiveOrgId() || 1,
      name: color.name || 'رنگ جدید',
      hex: color.hex || '#000000',
      status: 'active',
      ...color,
    };
    list.push(newColor);
    this.base.setItem('colors', list);
    return newColor;
  }

  async deleteColor(id: number): Promise<boolean> {
    let list = await this.getColors();
    list = list.filter((c) => c.id !== id);
    this.base.setItem('colors', list);
    return true;
  }

  async getSizeGroups(params?: QueryParams): Promise<SizeGroup[]> {
    let items = this.base.getItem<SizeGroup>('size_groups', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((g) => {
        const gOrgId = typeof g.organization_id === 'number' ? g.organization_id : Number((g.organization_id as any)?.id || (g as any).organization_id);
        return gOrgId === orgId;
      });
    }
    return items;
  }

  async saveSizeGroup(group: Partial<SizeGroup>): Promise<SizeGroup> {
    const list = await this.getSizeGroups();
    if (group.id) {
      const idx = list.findIndex((g) => g.id === group.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...group };
        this.base.setItem('size_groups', list);
        return list[idx];
      }
    }
    const newGroup: SizeGroup = {
      id: this.base.generateUniqueId(list),
      organization_id: group.organization_id || this.base.getActiveOrgId() || 1,
      name: group.name || 'گروه سایز جدید',
      category: group.category || 'apparel',
      status: 'active',
      ...group,
    };
    list.push(newGroup);
    this.base.setItem('size_groups', list);
    return newGroup;
  }

  async deleteSizeGroup(id: number): Promise<boolean> {
    let list = await this.getSizeGroups();
    list = list.filter((g) => g.id !== id);
    this.base.setItem('size_groups', list);
    return true;
  }

  async getSizes(params?: QueryParams): Promise<Size[]> {
    let items = this.base.getItem<Size>('sizes', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((s) => {
        const sOrgId = typeof s.organization_id === 'number' ? s.organization_id : Number((s.organization_id as any)?.id || (s as any).organization_id);
        return sOrgId === orgId;
      });
    }
    return items;
  }

  async saveSize(size: Partial<Size>): Promise<Size> {
    const list = await this.getSizes();
    if (size.id) {
      const idx = list.findIndex((s) => s.id === size.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...size };
        this.base.setItem('sizes', list);
        return list[idx];
      }
    }
    const newSize: Size = {
      id: this.base.generateUniqueId(list),
      organization_id: size.organization_id || this.base.getActiveOrgId() || 1,
      name: size.name || 'سایز جدید',
      status: 'active',
      ...size,
    };
    list.push(newSize);
    this.base.setItem('sizes', list);
    return newSize;
  }

  async deleteSize(id: number): Promise<boolean> {
    let list = await this.getSizes();
    list = list.filter((s) => s.id !== id);
    this.base.setItem('sizes', list);
    return true;
  }

  // Size Guides
  async getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    let items = this.base.getItem<SizeGuideTemplate>('size_guide_templates', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      items = items.filter((t) => {
        const tOrgId = typeof t.organization_id === 'number' ? t.organization_id : Number((t.organization_id as any)?.id || (t as any).organization_id);
        return tOrgId === orgId;
      });
    }
    return items;
  }

  async saveSizeGuideTemplate(tpl: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    const list = await this.getSizeGuideTemplates();
    if (tpl.id) {
      const idx = list.findIndex((t) => t.id === tpl.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...tpl };
        this.base.setItem('size_guide_templates', list);
        return list[idx];
      }
    }
    const newTpl: SizeGuideTemplate = {
      id: this.base.generateUniqueId(list),
      organization_id: tpl.organization_id || this.base.getActiveOrgId() || 1,
      name: tpl.name || 'قالب راهنمای سایز جدید',
      type: tpl.type || 'apparel',
      unit: tpl.unit || 'cm',
      status: 'active',
      date_created: new Date().toISOString(),
      ...tpl,
    };
    list.push(newTpl);
    this.base.setItem('size_guide_templates', list);
    return newTpl;
  }

  async deleteSizeGuideTemplate(id: number): Promise<boolean> {
    const list = await this.getSizeGuideTemplates();
    const updated = list.filter((t) => t.id !== id);
    this.base.setItem('size_guide_templates', updated);
    return true;
  }

  async getSizeGuideMeasurements(templateId: number): Promise<SizeGuideMeasurement[]> {
    const list = this.base.getItem<SizeGuideMeasurement>('size_guide_measurements', []);
    return list.filter((m) => m.template_id === templateId);
  }

  async saveSizeGuideMeasurement(meas: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement> {
    const list = this.base.getItem<SizeGuideMeasurement>('size_guide_measurements', []);
    if (meas.id) {
      const idx = list.findIndex((m) => m.id === meas.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...meas };
        this.base.setItem('size_guide_measurements', list);
        return list[idx];
      }
    }
    const newMeas: SizeGuideMeasurement = {
      id: this.base.generateUniqueId(list),
      template_id: meas.template_id || 1,
      name: meas.name || 'اندازه جدید',
      unit: meas.unit || 'cm',
      type: meas.type || 'width',
      status: 'active',
      ...meas,
    };
    list.push(newMeas);
    this.base.setItem('size_guide_measurements', list);
    return newMeas;
  }

  async deleteSizeGuideMeasurement(id: number): Promise<boolean> {
    const list = this.base.getItem<SizeGuideMeasurement>('size_guide_measurements', []);
    const updated = list.filter((m) => m.id !== id);
    this.base.setItem('size_guide_measurements', updated);
    return true;
  }

  async getSizeGuideValues(templateId: number): Promise<SizeGuideValue[]> {
    const list = this.base.getItem<SizeGuideValue>('size_guide_values', []);
    return list.filter((v) => v.template_id === templateId);
  }

  async saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue> {
    const list = this.base.getItem<SizeGuideValue>('size_guide_values', []);
    if (val.id) {
      const idx = list.findIndex((v) => v.id === val.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...val };
        this.base.setItem('size_guide_values', list);
        return list[idx];
      }
    }
    const newVal: SizeGuideValue = {
      id: this.base.generateUniqueId(list),
      template_id: val.template_id || 1,
      size_id: val.size_id || 1,
      measurement_id: val.measurement_id || 1,
      value: val.value || 0,
      ...val,
    };
    list.push(newVal);
    this.base.setItem('size_guide_values', list);
    return newVal;
  }

  async deleteSizeGuideValue(id: number): Promise<boolean> {
    const list = this.base.getItem<SizeGuideValue>('size_guide_values', []);
    const updated = list.filter((v) => v.id !== id);
    this.base.setItem('size_guide_values', updated);
    return true;
  }
}
