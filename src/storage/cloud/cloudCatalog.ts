import { CloudStorageBase, UUID_REGEX } from './cloudBase';
import { QueryParams } from '../types';
import { matchesSearchQuery } from '../../utils/formatters';
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
  Warehouse,
  InventoryItem,
  InventoryMovement,
  SizeGuideTemplate,
  SizeGuideMeasurement,
  SizeGuideValue,
} from '../../types';

export class CloudCatalogStorage {
  constructor(private base: CloudStorageBase) {}

  // Products & Variants
  async getProducts(params?: QueryParams): Promise<Product[]> {
    const query: any = { sort: '-id' };
    if (params?.organization_id) {
      query.filter = { organization_id: { _eq: params.organization_id } };
    }
    try {
      const products = await this.base.client.getItems<Product>('products', query);
      const [variants, inventoryItems] = await Promise.all([
        this.base.client.getItems<ProductVariant>('product_variants', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
        this.base.client.getItems<InventoryItem>('inventory_items', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
      ]);

      let mappedProducts = products.map((p) => {
        const pVariants = variants.filter((v) => {
          const pId = typeof v.product_id === 'number' ? v.product_id : (v.product_id as any)?.id;
          return pId === p.id;
        });
        const pVariantIds = new Set(pVariants.map((v) => v.id));
        const pInventory = inventoryItems.filter((i) => {
          const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
          return pVariantIds.has(vId);
        });
        const totalStock = pInventory.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

        return {
          ...p,
          variants_count: pVariants.length,
          total_stock: totalStock,
        };
      });

      if (params?.search && params.search.trim()) {
        const searchTerm = params.search.trim();
        mappedProducts = mappedProducts.filter((p) => {
          const pId = typeof p.id === 'number' ? p.id : (p as any)?.id;
          const pVariants = variants.filter((v) => {
            const pvId = typeof v.product_id === 'number' ? v.product_id : (v.product_id as any)?.id;
            return pvId === pId;
          });
          const variantTexts = pVariants.map((v) => `${v.sku || ''} ${v.barcode || ''} ${v.color_name || ''} ${v.size_name || ''}`).join(' ');
          const brandName = typeof p.brand === 'string' ? p.brand : p.brand?.name || (typeof p.brand_id === 'object' ? (p.brand_id as any)?.name : '');
          return matchesSearchQuery(searchTerm, p.title, p.slug, p.description, p.tags, brandName, variantTexts);
        });
      }

      return mappedProducts;
    } catch {
      return this.base.localAdapter.getProducts(params);
    }
  }

  async getProductById(id: number): Promise<Product | null> {
    try {
      return await this.base.client.getItemById<Product>('products', id);
    } catch {
      return this.base.localAdapter.getProductById(id);
    }
  }

  async saveProduct(product: Partial<Product>): Promise<Product> {
    const payload: any = { ...product };
    delete payload.variants_count;
    delete payload.total_stock;
    delete payload.brand;
    delete payload.category;
    delete payload.collection;
    delete payload.season;
    delete payload.size_guide_template;
    delete payload.variants;

    if (payload.main_image) {
      const rawImg = typeof payload.main_image === 'string' ? payload.main_image.trim() : (payload.main_image as any)?.id || '';
      if (rawImg && !UUID_REGEX.test(rawImg)) {
        try {
          const uploadedUuid = await this.base.media.uploadMediaRefToCloud(rawImg);
          if (uploadedUuid) {
            payload.main_image = uploadedUuid;
          }
        } catch (uploadErr) {
          console.warn('[CloudCatalogStorage] Auto-uploading local image to cloud failed:', uploadErr);
        }
      }
    }

    payload.main_image = this.base.cleanUuid(payload.main_image);
    payload.brand_id = this.base.cleanInt(payload.brand_id);
    payload.category_id = this.base.cleanInt(payload.category_id);
    payload.collection_id = this.base.cleanInt(payload.collection_id);
    payload.season_id = this.base.cleanInt(payload.season_id);
    payload.size_guide_template_id = this.base.cleanInt(payload.size_guide_template_id);
    payload.sort = Number(payload.sort) || 0;
    if (!payload.status) payload.status = 'published';

    const id = payload.id ? Number(payload.id) : undefined;
    delete payload.id;

    try {
      if (id) {
        return await this.base.client.updateItem<Product>('products', id, payload);
      }
      return await this.base.client.createItem<Product>('products', payload);
    } catch (err: any) {
      console.error('[CloudCatalogStorage] Cloud saveProduct failed:', err?.message || err);
      throw err;
    }
  }

  async deleteProduct(id: number): Promise<boolean> {
    try {
      const variants = await this.base.client.getItems<ProductVariant>('product_variants', {
        filter: { product_id: { _eq: id } },
      }).catch(() => []);

      for (const v of variants) {
        await this.deleteVariant(v.id).catch((err) => {
          console.warn(`[CloudCatalogStorage] Delete variant ${v.id} warning:`, err?.message || err);
        });
      }

      return await this.base.client.deleteItem('products', id);
    } catch (err: any) {
      console.error('[CloudCatalogStorage] Cloud deleteProduct failed:', err?.message || err);
      throw err;
    }
  }

  async getVariants(params?: QueryParams): Promise<ProductVariant[]> {
    const query: any = { sort: '-id' };
    if (params?.organization_id) {
      query.filter = { organization_id: { _eq: params.organization_id } };
    }
    try {
      const [variants, products, colors, sizes, inventoryItems] = await Promise.all([
        this.base.client.getItems<ProductVariant>('product_variants', query),
        this.base.client.getItems<Product>('products', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
        this.base.client.getItems<Color>('colors', {}).catch(() => []),
        this.base.client.getItems<Size>('sizes', {}).catch(() => []),
        this.base.client.getItems<InventoryItem>('inventory_items', {
          filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        }).catch(() => []),
      ]);

      return variants.map((v) => {
        const prodId = typeof v.product_id === 'number' ? v.product_id : (v.product_id as any)?.id;
        const colorId = typeof v.color_id === 'number' ? v.color_id : (v.color_id as any)?.id;
        const sizeId = typeof v.size_id === 'number' ? v.size_id : (v.size_id as any)?.id;

        const prod = products.find((p) => p.id === prodId);
        const color = colors.find((c) => c.id === colorId);
        const size = sizes.find((s) => s.id === sizeId);

        const vInv = inventoryItems.filter((i) => {
          const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
          return vId === v.id;
        });
        const totalStock = vInv.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

        return {
          ...v,
          product_title: prod?.title || v.product_title || 'محصول',
          color_name: color?.name || v.color_name || '-',
          size_name: size?.name || v.size_name || '-',
          stock_quantity: totalStock,
        };
      });
    } catch {
      return this.base.localAdapter.getVariants(params);
    }
  }

  async getVariantsByProductId(productId: number): Promise<ProductVariant[]> {
    try {
      const normProdId = this.base.normalizeId(productId) || Number(productId);
      let variants = await this.base.client.getItems<ProductVariant>('product_variants', {
        filter: {
          _or: [
            { product_id: { _eq: normProdId } },
            { product_id: { _eq: String(normProdId) } },
          ],
        },
      }).catch(() => []);

      if (variants.length === 0) {
        const allVariants = await this.base.client.getItems<ProductVariant>('product_variants', {}).catch(() => []);
        variants = allVariants.filter((v) => this.base.normalizeId(v.product_id) === normProdId);
      }

      const [inventoryItems, colors, sizes, products] = await Promise.all([
        this.base.client.getItems<InventoryItem>('inventory_items', {}).catch(() => []),
        this.base.client.getItems<Color>('colors', {}).catch(() => []),
        this.base.client.getItems<Size>('sizes', {}).catch(() => []),
        this.base.client.getItems<Product>('products', { filter: { id: { _eq: normProdId } } }).catch(() => []),
      ]);

      const productTitle = products[0]?.title || 'محصول';

      return variants.map((v) => {
        const vNormId = this.base.normalizeId(v.id) || v.id;
        const vInv = inventoryItems.filter((i) => this.base.normalizeId(i.variant_id) === vNormId);
        const totalStock = vInv.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

        const cId = this.base.normalizeId(v.color_id);
        const sId = this.base.normalizeId(v.size_id);

        const matchedColor = colors.find((c) => this.base.normalizeId(c.id) === cId);
        const matchedSize = sizes.find((s) => this.base.normalizeId(s.id) === sId);

        return {
          ...v,
          id: vNormId,
          product_id: normProdId,
          color_id: cId || undefined,
          size_id: sId || undefined,
          product_title: productTitle,
          color_name: matchedColor?.name || v.color_name || '-',
          size_name: matchedSize?.name || v.size_name || '-',
          stock_quantity: totalStock,
        };
      });
    } catch {
      return this.base.localAdapter.getVariantsByProductId(productId);
    }
  }

  async saveVariant(variant: Partial<ProductVariant>, warehouseId?: number, locationId?: number): Promise<ProductVariant> {
    const payload: any = { ...variant };
    const stockQty = payload.stock_quantity;
    delete payload.stock_quantity;
    delete payload.color_name;
    delete payload.size_name;
    delete payload.product_title;
    delete payload.color;
    delete payload.size;
    delete payload.product;
    delete payload._tempId;

    if (payload.image) {
      const rawImg = typeof payload.image === 'string' ? payload.image.trim() : (payload.image as any)?.id || '';
      if (rawImg && !UUID_REGEX.test(rawImg)) {
        try {
          const uploadedUuid = await this.base.media.uploadMediaRefToCloud(rawImg);
          if (uploadedUuid) {
            payload.image = uploadedUuid;
          }
        } catch (uploadErr) {
          console.warn('[CloudCatalogStorage] Auto-uploading variant image to cloud failed:', uploadErr);
        }
      }
    }

    payload.image = this.base.cleanUuid(payload.image);
    payload.color_id = this.base.cleanInt(payload.color_id);
    payload.size_id = this.base.cleanInt(payload.size_id);
    payload.product_id = this.base.normalizeId(payload.product_id) || Number(payload.product_id);
    payload.price = payload.price !== undefined && payload.price !== '' ? Number(payload.price) : 0;
    payload.cost = payload.cost !== undefined && payload.cost !== '' ? Number(payload.cost) : 0;
    payload.sort = Number(payload.sort) || 0;
    if (!payload.status) payload.status = 'published';

    const id = this.base.normalizeId(payload.id);
    delete payload.id;

    try {
      let saved: ProductVariant;
      if (id) {
        saved = await this.base.client.updateItem<ProductVariant>('product_variants', id, payload);
      } else {
        saved = await this.base.client.createItem<ProductVariant>('product_variants', payload);
      }

      // Robust inventory synchronization
      if (stockQty !== undefined && stockQty !== null) {
        const qtyNum = Math.max(0, Number(stockQty) || 0);
        const orgId = saved.organization_id || 1;

        const existingInventory = await this.base.client.getItems<InventoryItem>('inventory_items', {
          filter: { variant_id: { _eq: saved.id } },
        }).catch(() => []);

        if (existingInventory.length > 0) {
          const itemToUpdate = (warehouseId && existingInventory.find((i) => {
            const whId = typeof i.warehouse_id === 'number' ? i.warehouse_id : (i.warehouse_id as any)?.id;
            return whId === warehouseId;
          })) || existingInventory[0];

          const reserved = Number(itemToUpdate.reserved_quantity) || 0;
          const damaged = Number(itemToUpdate.damaged_quantity) || 0;
          const available = Math.max(0, qtyNum - reserved - damaged);

          const invUpdatePayload: any = {
            quantity: qtyNum,
            available_quantity: available,
            updated_at: new Date().toISOString(),
          };
          if (locationId) {
            invUpdatePayload.location_id = locationId;
          }

          await this.base.client.updateItem<InventoryItem>('inventory_items', itemToUpdate.id, invUpdatePayload).catch((err) => {
            console.warn('[CloudCatalogStorage] Update inventory failed:', err?.message || err);
          });
        } else {
          let targetWarehouseId = warehouseId;
          const warehouses = await this.base.client.getItems<Warehouse>('warehouses', {
            filter: { organization_id: { _eq: orgId } },
          }).catch(() => []);

          if (targetWarehouseId && warehouses.some((w) => w.id === targetWarehouseId)) {
            // Valid warehouse selected
          } else if (warehouses.length > 0) {
            targetWarehouseId = warehouses[0].id;
          } else {
            const allWarehouses = await this.base.client.getItems<Warehouse>('warehouses', {}).catch(() => []);
            if (allWarehouses.length > 0) {
              targetWarehouseId = allWarehouses[0].id;
            } else {
              try {
                const newWh = await this.base.client.createItem<Warehouse>('warehouses', {
                  organization_id: orgId,
                  name: 'انبار مرکزی',
                  code: 'MAIN',
                  type: 'warehouse',
                  status: 'active',
                });
                targetWarehouseId = newWh.id;
              } catch (whErr) {
                console.warn('[CloudCatalogStorage] Auto-create warehouse failed:', whErr);
                targetWarehouseId = 1;
              }
            }
          }

          await this.base.client.createItem<InventoryItem>('inventory_items', {
            organization_id: orgId,
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
          }).catch((err) => {
            console.warn('[CloudCatalogStorage] Create inventory failed:', err?.message || err);
          });

          await this.base.client.createItem<InventoryMovement>('inventory_movements', {
            organization_id: orgId,
            variant_id: saved.id,
            warehouse_id: targetWarehouseId || 1,
            location_id: locationId || undefined,
            type: 'adjustment',
            quantity: qtyNum,
            reference_type: 'manual',
            reference_id: `INIT-${saved.id}`,
            note: 'موجودی اولیه هنگام ایجاد متغیر کالا',
          }).catch((movErr) => console.warn('[CloudCatalogStorage] Movement log error:', movErr));
        }
      }

      return { ...saved, stock_quantity: stockQty !== undefined ? Number(stockQty) : 0 };
    } catch (err: any) {
      console.error('[CloudCatalogStorage] Cloud saveVariant failed:', err?.message || err);
      throw err;
    }
  }

  async deleteVariant(id: number): Promise<boolean> {
    try {
      const inventoryItems = await this.base.client.getItems<InventoryItem>('inventory_items', {
        filter: { variant_id: { _eq: id } },
      }).catch(() => []);
      for (const inv of inventoryItems) {
        await this.base.client.deleteItem('inventory_items', inv.id).catch((err) => {
          console.warn(`[CloudCatalogStorage] Delete inventory item ${inv.id} warning:`, err?.message || err);
        });
      }

      const movements = await this.base.client.getItems<InventoryMovement>('inventory_movements', {
        filter: { variant_id: { _eq: id } },
      }).catch(() => []);
      for (const mov of movements) {
        await this.base.client.deleteItem('inventory_movements', mov.id).catch(() => null);
      }

      return await this.base.client.deleteItem('product_variants', id);
    } catch (err: any) {
      console.error('[CloudCatalogStorage] Cloud deleteVariant failed:', err?.message || err);
      throw err;
    }
  }

  // Categories
  async getCategories(params?: QueryParams): Promise<Category[]> {
    const query: any = { sort: 'name' };
    if (params?.organization_id) {
      query.filter = { organization_id: { _eq: params.organization_id } };
    }
    try {
      return await this.base.client.getItems<Category>('categories', query);
    } catch {
      return this.base.localAdapter.getCategories(params);
    }
  }

  async saveCategory(cat: Partial<Category>): Promise<Category> {
    try {
      if (cat.id) return await this.base.client.updateItem<Category>('categories', cat.id, cat);
      return await this.base.client.createItem<Category>('categories', cat);
    } catch {
      const saved = await this.base.localAdapter.saveCategory(cat);
      this.base.syncManager.enqueue({ action: cat.id ? 'UPDATE' : 'CREATE', collection: 'categories', payload: saved });
      return saved;
    }
  }

  async deleteCategory(id: number): Promise<boolean> {
    try {
      return await this.base.client.deleteItem('categories', id);
    } catch {
      const res = await this.base.localAdapter.deleteCategory(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'categories', payload: { id } });
      return res;
    }
  }

  // Collections
  async getCollections(params?: QueryParams): Promise<Collection[]> {
    try {
      return await this.base.client.getItems<Collection>('collections', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getCollections(params);
    }
  }

  async saveCollection(col: Partial<Collection>): Promise<Collection> {
    try {
      if (col.id) return await this.base.client.updateItem<Collection>('collections', col.id, col);
      return await this.base.client.createItem<Collection>('collections', col);
    } catch {
      const saved = await this.base.localAdapter.saveCollection(col);
      this.base.syncManager.enqueue({ action: col.id ? 'UPDATE' : 'CREATE', collection: 'collections', payload: saved });
      return saved;
    }
  }

  async deleteCollection(id: number): Promise<boolean> {
    try {
      return await this.base.client.deleteItem('collections', id);
    } catch {
      const res = await this.base.localAdapter.deleteCollection(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'collections', payload: { id } });
      return res;
    }
  }

  // Brands
  async getBrands(params?: QueryParams): Promise<Brand[]> {
    try {
      return await this.base.client.getItems<Brand>('brands', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getBrands(params);
    }
  }

  async saveBrand(brand: Partial<Brand>): Promise<Brand> {
    try {
      if (brand.id) return await this.base.client.updateItem<Brand>('brands', brand.id, brand);
      return await this.base.client.createItem<Brand>('brands', brand);
    } catch {
      const saved = await this.base.localAdapter.saveBrand(brand);
      this.base.syncManager.enqueue({ action: brand.id ? 'UPDATE' : 'CREATE', collection: 'brands', payload: saved });
      return saved;
    }
  }

  async deleteBrand(id: number): Promise<boolean> {
    try {
      return await this.base.client.deleteItem('brands', id);
    } catch {
      const res = await this.base.localAdapter.deleteBrand(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'brands', payload: { id } });
      return res;
    }
  }

  // Seasons
  async getSeasons(params?: QueryParams): Promise<Season[]> {
    try {
      return await this.base.client.getItems<Season>('seasons', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getSeasons(params);
    }
  }

  async saveSeason(season: Partial<Season>): Promise<Season> {
    const payload: Partial<Season> = {
      ...season,
      code: season.code?.trim() || null,
      start_date: season.start_date && season.start_date.trim() !== '' ? season.start_date : null,
      end_date: season.end_date && season.end_date.trim() !== '' ? season.end_date : null,
    };
    try {
      if (payload.id) return await this.base.client.updateItem<Season>('seasons', payload.id, payload);
      return await this.base.client.createItem<Season>('seasons', payload);
    } catch {
      const saved = await this.base.localAdapter.saveSeason(payload);
      this.base.syncManager.enqueue({ action: payload.id ? 'UPDATE' : 'CREATE', collection: 'seasons', payload: saved });
      return saved;
    }
  }

  async deleteSeason(id: number): Promise<boolean> {
    try {
      return await this.base.client.deleteItem('seasons', id);
    } catch {
      const res = await this.base.localAdapter.deleteSeason(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'seasons', payload: { id } });
      return res;
    }
  }

  // Colors
  async getColors(params?: QueryParams): Promise<Color[]> {
    try {
      return await this.base.client.getItems<Color>('colors', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getColors(params);
    }
  }

  async saveColor(color: Partial<Color>): Promise<Color> {
    try {
      if (color.id) return await this.base.client.updateItem<Color>('colors', color.id, color);
      return await this.base.client.createItem<Color>('colors', color);
    } catch {
      const saved = await this.base.localAdapter.saveColor(color);
      this.base.syncManager.enqueue({ action: color.id ? 'UPDATE' : 'CREATE', collection: 'colors', payload: saved });
      return saved;
    }
  }

  async deleteColor(id: number): Promise<boolean> {
    try {
      return await this.base.client.deleteItem('colors', id);
    } catch {
      const res = await this.base.localAdapter.deleteColor(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'colors', payload: { id } });
      return res;
    }
  }

  // Size Groups
  async getSizeGroups(params?: QueryParams): Promise<SizeGroup[]> {
    try {
      return await this.base.client.getItems<SizeGroup>('size_groups', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getSizeGroups(params);
    }
  }

  async saveSizeGroup(group: Partial<SizeGroup>): Promise<SizeGroup> {
    try {
      if (group.id) return await this.base.client.updateItem<SizeGroup>('size_groups', group.id, group);
      return await this.base.client.createItem<SizeGroup>('size_groups', group);
    } catch {
      const saved = await this.base.localAdapter.saveSizeGroup(group);
      this.base.syncManager.enqueue({ action: group.id ? 'UPDATE' : 'CREATE', collection: 'size_groups', payload: saved });
      return saved;
    }
  }

  async deleteSizeGroup(id: number): Promise<boolean> {
    try {
      return await this.base.client.deleteItem('size_groups', id);
    } catch {
      const res = await this.base.localAdapter.deleteSizeGroup(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'size_groups', payload: { id } });
      return res;
    }
  }

  // Sizes
  async getSizes(params?: QueryParams): Promise<Size[]> {
    try {
      return await this.base.client.getItems<Size>('sizes', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getSizes(params);
    }
  }

  async saveSize(size: Partial<Size>): Promise<Size> {
    try {
      if (size.id) return await this.base.client.updateItem<Size>('sizes', size.id, size);
      return await this.base.client.createItem<Size>('sizes', size);
    } catch {
      const saved = await this.base.localAdapter.saveSize(size);
      this.base.syncManager.enqueue({ action: size.id ? 'UPDATE' : 'CREATE', collection: 'sizes', payload: saved });
      return saved;
    }
  }

  async deleteSize(id: number): Promise<boolean> {
    try {
      return await this.base.client.deleteItem('sizes', id);
    } catch {
      const res = await this.base.localAdapter.deleteSize(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'sizes', payload: { id } });
      return res;
    }
  }

  // Size Guides
  async getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    try {
      return await this.base.client.getItems<SizeGuideTemplate>('size_guide_templates', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
      });
    } catch {
      return this.base.localAdapter.getSizeGuideTemplates(params);
    }
  }

  async getSizeGuideTemplateById(id: number): Promise<SizeGuideTemplate | null> {
    try {
      return await this.base.client.getItemById<SizeGuideTemplate>('size_guide_templates', id);
    } catch {
      const templates = await this.base.localAdapter.getSizeGuideTemplates();
      return templates.find((t) => t.id === id) || null;
    }
  }

  async saveSizeGuideTemplate(tpl: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    try {
      if (tpl.id) return await this.base.client.updateItem<SizeGuideTemplate>('size_guide_templates', tpl.id, tpl);
      return await this.base.client.createItem<SizeGuideTemplate>('size_guide_templates', tpl);
    } catch {
      return this.base.localAdapter.saveSizeGuideTemplate(tpl);
    }
  }

  async deleteSizeGuideTemplate(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('size_guide_templates', id);
      return true;
    } catch {
      return this.base.localAdapter.deleteSizeGuideTemplate(id);
    }
  }

  async getSizeGuideMeasurements(templateId?: number): Promise<SizeGuideMeasurement[]> {
    try {
      const filter = templateId ? { template_id: { _eq: templateId } } : undefined;
      return await this.base.client.getItems<SizeGuideMeasurement>('size_guide_measurements', {
        filter,
      });
    } catch {
      return this.base.localAdapter.getSizeGuideMeasurements(templateId || 0);
    }
  }

  async saveSizeGuideMeasurement(meas: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement> {
    try {
      if (meas.id) return await this.base.client.updateItem<SizeGuideMeasurement>('size_guide_measurements', meas.id, meas);
      return await this.base.client.createItem<SizeGuideMeasurement>('size_guide_measurements', meas);
    } catch {
      return this.base.localAdapter.saveSizeGuideMeasurement(meas);
    }
  }

  async deleteSizeGuideMeasurement(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('size_guide_measurements', id);
      return true;
    } catch {
      return this.base.localAdapter.deleteSizeGuideMeasurement(id);
    }
  }

  async getSizeGuideValues(templateId?: number): Promise<SizeGuideValue[]> {
    try {
      const filter = templateId ? { template_id: { _eq: templateId } } : undefined;
      return await this.base.client.getItems<SizeGuideValue>('size_guide_values', {
        filter,
      });
    } catch {
      return this.base.localAdapter.getSizeGuideValues(templateId || 0);
    }
  }

  async saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue> {
    try {
      if (val.id) return await this.base.client.updateItem<SizeGuideValue>('size_guide_values', val.id, val);
      return await this.base.client.createItem<SizeGuideValue>('size_guide_values', val);
    } catch {
      return this.base.localAdapter.saveSizeGuideValue(val);
    }
  }

  async deleteSizeGuideValue(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('size_guide_values', id);
      return true;
    } catch {
      return this.base.localAdapter.deleteSizeGuideValue(id);
    }
  }
}
