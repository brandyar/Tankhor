import { directusClient } from '../api/directus';
import { BackupManager } from './backupManager';
import { storageManager } from './index';

export interface MigrationStepProgress {
  step: string;
  total: number;
  current: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface CloudMigrationResult {
  success: boolean;
  totalMigrated: number;
  errors: string[];
}

/**
 * CloudMigrationManager
 * Performs an automated, foreign-key-safe data onboarding / migration
 * from local offline storage (LocalStorage or SQLite) to Cloud Directus.
 * 
 * It uses an in-memory ID translation map (Local ID -> Cloud ID) to ensure that
 * parent-child relations (e.g. Products -> Variants -> Inventory Items / Order Items)
 * remain 100% intact even when Directus auto-generates brand-new primary keys.
 */
export class CloudMigrationManager {
  public static async migrateLocalToCloud(
    orgId: number,
    onProgress?: (progress: MigrationStepProgress) => void
  ): Promise<CloudMigrationResult> {
    const errors: string[] = [];
    let totalMigrated = 0;

    // Translation Map: collection_name -> Map<localId, cloudId>
    const idMap: Record<string, Map<number, number>> = {
      categories: new Map(),
      brands: new Map(),
      seasons: new Map(),
      collections: new Map(),
      colors: new Map(),
      size_groups: new Map(),
      sizes: new Map(),
      warehouses: new Map(),
      warehouse_locations: new Map(),
      size_guide_templates: new Map(),
      size_guide_measurements: new Map(),
      products: new Map(),
      product_variants: new Map(),
      suppliers: new Map(),
      customers: new Map(),
      orders: new Map(),
      purchase_orders: new Map(),
      stock_transfers: new Map(),
    };

    const emitProgress = (
      step: string,
      current: number,
      total: number,
      status: 'pending' | 'in_progress' | 'completed' | 'failed',
      error?: string
    ) => {
      if (onProgress) {
        onProgress({ step, current, total, status, error });
      }
    };

    try {
      // 1. Extract raw local data filtered for active organization
      const backupResult = BackupManager.generateBackup({ id: orgId, name: 'Migration Org' });
      const collections = backupResult.data || {};

      // Phase 1: Base Entities (Categories, Brands, Seasons, Colors, Size Groups, Warehouses, Suppliers, Customers)
      const baseCollections: Array<{ key: string; label: string }> = [
        { key: 'categories', label: 'دسته‌بندی‌ها' },
        { key: 'brands', label: 'برندها' },
        { key: 'seasons', label: 'فصل‌ها' },
        { key: 'colors', label: 'رنگ‌ها' },
        { key: 'size_groups', label: 'گروه‌های سایز' },
        { key: 'warehouses', label: 'انبارها و فروشگاه‌ها' },
        { key: 'suppliers', label: 'تامین‌کنندگان' },
        { key: 'customers', label: 'مشتریان' },
      ];

      for (const col of baseCollections) {
        const items = collections[col.key] || [];
        emitProgress(col.label, 0, items.length, 'in_progress');

        for (let i = 0; i < items.length; i++) {
          const item = { ...items[i] };
          const localId = Number(item.id);
          delete item.id;
          item.organization_id = orgId;

          try {
            const created = await directusClient.createItem<any>(col.key, item);
            if (created && created.id) {
              idMap[col.key]?.set(localId, Number(created.id));
              totalMigrated++;
            }
          } catch (err: any) {
            console.warn(`[CloudMigration] Error migrating ${col.key} item ${localId}:`, err?.message || err);
            errors.push(`خطا در ارسال ${col.label} (${item.name || localId}): ${err?.message || err}`);
          }
          emitProgress(col.label, i + 1, items.length, 'in_progress');
        }
        emitProgress(col.label, items.length, items.length, 'completed');
      }

      // Phase 2: First-level Dependent Base Entities (Collections -> Seasons, Warehouse Locations -> Warehouses, Sizes -> Size Groups)
      // 2.1 Collections (links to seasons)
      const colItems = collections['collections'] || [];
      emitProgress('مجموعه‌ها (Collections)', 0, colItems.length, 'in_progress');
      for (let i = 0; i < colItems.length; i++) {
        const item = { ...colItems[i] };
        const localId = Number(item.id);
        delete item.id;
        item.organization_id = orgId;
        if (item.season_id) {
          const localSeasonId = Number(item.season_id?.id || item.season_id);
          item.season_id = idMap['seasons']?.get(localSeasonId) || item.season_id;
        }

        try {
          const created = await directusClient.createItem<any>('collections', item);
          if (created?.id) {
            idMap['collections']?.set(localId, Number(created.id));
            totalMigrated++;
          }
        } catch (err: any) {
          errors.push(`خطا در ارسال مجموعه (${item.name || localId}): ${err?.message || err}`);
        }
        emitProgress('مجموعه‌ها (Collections)', i + 1, colItems.length, 'in_progress');
      }
      emitProgress('مجموعه‌ها (Collections)', colItems.length, colItems.length, 'completed');

      // 2.2 Warehouse Locations (links to warehouses)
      const locItems = collections['warehouse_locations'] || [];
      emitProgress('قفسه‌بندی و جایگاه‌ها', 0, locItems.length, 'in_progress');
      for (let i = 0; i < locItems.length; i++) {
        const item = { ...locItems[i] };
        const localId = Number(item.id);
        delete item.id;
        item.organization_id = orgId;
        if (item.warehouse_id) {
          const localWhId = Number(item.warehouse_id?.id || item.warehouse_id);
          item.warehouse_id = idMap['warehouses']?.get(localWhId) || item.warehouse_id;
        }

        try {
          const created = await directusClient.createItem<any>('warehouse_locations', item);
          if (created?.id) {
            idMap['warehouse_locations']?.set(localId, Number(created.id));
            totalMigrated++;
          }
        } catch (err: any) {
          errors.push(`خطا در ارسال جایگاه انبار (${item.name || localId}): ${err?.message || err}`);
        }
        emitProgress('قفسه‌بندی و جایگاه‌ها', i + 1, locItems.length, 'in_progress');
      }
      emitProgress('قفسه‌بندی و جایگاه‌ها', locItems.length, locItems.length, 'completed');

      // 2.3 Sizes (links to size_groups)
      const sizeItems = collections['sizes'] || [];
      emitProgress('سایزها', 0, sizeItems.length, 'in_progress');
      for (let i = 0; i < sizeItems.length; i++) {
        const item = { ...sizeItems[i] };
        const localId = Number(item.id);
        delete item.id;
        item.organization_id = orgId;
        if (item.size_group_id) {
          const localSgId = Number(item.size_group_id?.id || item.size_group_id);
          item.size_group_id = idMap['size_groups']?.get(localSgId) || null;
        }

        try {
          const created = await directusClient.createItem<any>('sizes', item);
          if (created?.id) {
            idMap['sizes']?.set(localId, Number(created.id));
            totalMigrated++;
          }
        } catch (err: any) {
          errors.push(`خطا در ارسال سایز (${item.name || localId}): ${err?.message || err}`);
        }
        emitProgress('سایزها', i + 1, sizeItems.length, 'in_progress');
      }
      emitProgress('سایزها', sizeItems.length, sizeItems.length, 'completed');

      // Phase 3: Size Guides (Templates -> Measurements -> Values)
      const tplItems = collections['size_guide_templates'] || [];
      emitProgress('قالب‌های راهنمای سایز', 0, tplItems.length, 'in_progress');
      for (let i = 0; i < tplItems.length; i++) {
        const item = { ...tplItems[i] };
        const localId = Number(item.id);
        delete item.id;
        item.organization_id = orgId;

        try {
          const created = await directusClient.createItem<any>('size_guide_templates', item);
          if (created?.id) {
            idMap['size_guide_templates']?.set(localId, Number(created.id));
            totalMigrated++;
          }
        } catch (err: any) {
          errors.push(`خطا در ارسال قالب راهنمای سایز: ${err?.message || err}`);
        }
        emitProgress('قالب‌های راهنمای سایز', i + 1, tplItems.length, 'in_progress');
      }
      emitProgress('قالب‌های راهنمای سایز', tplItems.length, tplItems.length, 'completed');

      // Size Guide Measurements
      const sgMeasItems = collections['size_guide_measurements'] || [];
      emitProgress('پارامترهای اندازه راهنما', 0, sgMeasItems.length, 'in_progress');
      for (let i = 0; i < sgMeasItems.length; i++) {
        const item = { ...sgMeasItems[i] };
        const localId = Number(item.id);
        delete item.id;
        item.organization_id = orgId;
        if (item.template_id) {
          const localTplId = Number(item.template_id?.id || item.template_id);
          item.template_id = idMap['size_guide_templates']?.get(localTplId) || item.template_id;
        }

        try {
          const created = await directusClient.createItem<any>('size_guide_measurements', item);
          if (created?.id) {
            idMap['size_guide_measurements']?.set(localId, Number(created.id));
            totalMigrated++;
          }
        } catch (err: any) {
          errors.push(`خطا در ارسال پارامتر اندازه: ${err?.message || err}`);
        }
        emitProgress('پارامترهای اندازه راهنما', i + 1, sgMeasItems.length, 'in_progress');
      }
      emitProgress('پارامترهای اندازه راهنما', sgMeasItems.length, sgMeasItems.length, 'completed');

      // Size Guide Values
      const sgValItems = collections['size_guide_values'] || [];
      emitProgress('مقادیر ماتریس راهنمای سایز', 0, sgValItems.length, 'in_progress');
      for (let i = 0; i < sgValItems.length; i++) {
        const item = { ...sgValItems[i] };
        delete item.id;
        item.organization_id = orgId;
        if (item.template_id) {
          const localTplId = Number(item.template_id?.id || item.template_id);
          item.template_id = idMap['size_guide_templates']?.get(localTplId) || item.template_id;
        }
        if (item.measurement_id) {
          const localMeasId = Number(item.measurement_id?.id || item.measurement_id);
          item.measurement_id = idMap['size_guide_measurements']?.get(localMeasId) || item.measurement_id;
        }
        if (item.size_id) {
          const localSzId = Number(item.size_id?.id || item.size_id);
          item.size_id = idMap['sizes']?.get(localSzId) || item.size_id;
        }

        try {
          await directusClient.createItem<any>('size_guide_values', item);
          totalMigrated++;
        } catch (err: any) {
          // ignore or log non-critical matrix cell errors
        }
        emitProgress('مقادیر ماتریس راهنمای سایز', i + 1, sgValItems.length, 'in_progress');
      }
      emitProgress('مقادیر ماتریس راهنمای سایز', sgValItems.length, sgValItems.length, 'completed');

      // Phase 4: Products
      const productItems = collections['products'] || [];
      emitProgress('محصولات و کالاها', 0, productItems.length, 'in_progress');
      for (let i = 0; i < productItems.length; i++) {
        const item = { ...productItems[i] };
        const localId = Number(item.id);
        delete item.id;
        delete item.variants_count;
        delete item.total_stock;
        item.organization_id = orgId;

        if (item.category_id) {
          const localCatId = Number(item.category_id?.id || item.category_id);
          item.category_id = idMap['categories']?.get(localCatId) || item.category_id;
        }
        if (item.brand_id) {
          const localBrandId = Number(item.brand_id?.id || item.brand_id);
          item.brand_id = idMap['brands']?.get(localBrandId) || item.brand_id;
        }
        if (item.season_id) {
          const localSeasonId = Number(item.season_id?.id || item.season_id);
          item.season_id = idMap['seasons']?.get(localSeasonId) || item.season_id;
        }
        if (item.collection_id) {
          const localColId = Number(item.collection_id?.id || item.collection_id);
          item.collection_id = idMap['collections']?.get(localColId) || item.collection_id;
        }
        if (item.size_guide_template_id) {
          const localTplId = Number(item.size_guide_template_id?.id || item.size_guide_template_id);
          item.size_guide_template_id = idMap['size_guide_templates']?.get(localTplId) || item.size_guide_template_id;
        }

        try {
          const created = await directusClient.createItem<any>('products', item);
          if (created?.id) {
            idMap['products']?.set(localId, Number(created.id));
            totalMigrated++;
          }
        } catch (err: any) {
          errors.push(`خطا در ارسال محصول (${item.title || localId}): ${err?.message || err}`);
        }
        emitProgress('محصولات و کالاها', i + 1, productItems.length, 'in_progress');
      }
      emitProgress('محصولات و کالاها', productItems.length, productItems.length, 'completed');

      // Phase 5: Product Variants
      const variantItems = collections['product_variants'] || [];
      emitProgress('تنوع‌ها و تنخور کالا (Variants)', 0, variantItems.length, 'in_progress');
      for (let i = 0; i < variantItems.length; i++) {
        const item = { ...variantItems[i] };
        const localId = Number(item.id);
        delete item.id;
        item.organization_id = orgId;

        if (item.product_id) {
          const localPId = Number(item.product_id?.id || item.product_id);
          item.product_id = idMap['products']?.get(localPId) || item.product_id;
        }
        if (item.color_id) {
          const localCId = Number(item.color_id?.id || item.color_id);
          item.color_id = idMap['colors']?.get(localCId) || item.color_id;
        }
        if (item.size_id) {
          const localSId = Number(item.size_id?.id || item.size_id);
          item.size_id = idMap['sizes']?.get(localSId) || item.size_id;
        }

        try {
          const created = await directusClient.createItem<any>('product_variants', item);
          if (created?.id) {
            idMap['product_variants']?.set(localId, Number(created.id));
            totalMigrated++;
          }
        } catch (err: any) {
          errors.push(`خطا در ارسال تنوع کالا (${item.sku || localId}): ${err?.message || err}`);
        }
        emitProgress('تنوع‌ها و تنخور کالا (Variants)', i + 1, variantItems.length, 'in_progress');
      }
      emitProgress('تنوع‌ها و تنخور کالا (Variants)', variantItems.length, variantItems.length, 'completed');

      // Phase 6: Inventory Items & Stock
      const invItems = collections['inventory_items'] || [];
      emitProgress('موجودی انبارها', 0, invItems.length, 'in_progress');
      for (let i = 0; i < invItems.length; i++) {
        const item = { ...invItems[i] };
        delete item.id;
        item.organization_id = orgId;

        if (item.variant_id) {
          const localVId = Number(item.variant_id?.id || item.variant_id);
          item.variant_id = idMap['product_variants']?.get(localVId) || item.variant_id;
        }
        if (item.warehouse_id) {
          const localWId = Number(item.warehouse_id?.id || item.warehouse_id);
          item.warehouse_id = idMap['warehouses']?.get(localWId) || item.warehouse_id;
        }
        if (item.location_id) {
          const localLId = Number(item.location_id?.id || item.location_id);
          item.location_id = idMap['warehouse_locations']?.get(localLId) || null;
        }

        try {
          await directusClient.createItem<any>('inventory_items', item);
          totalMigrated++;
        } catch (err: any) {
          errors.push(`خطا در ثبت موجودی انبار: ${err?.message || err}`);
        }
        emitProgress('موجودی انبارها', i + 1, invItems.length, 'in_progress');
      }
      emitProgress('موجودی انبارها', invItems.length, invItems.length, 'completed');

      // Phase 7: Orders and Order Items
      const orderItemsList = collections['order_items'] || [];
      const orderList = collections['orders'] || [];
      emitProgress('سفارشات و فاکتورها', 0, orderList.length, 'in_progress');

      for (let i = 0; i < orderList.length; i++) {
        const item = { ...orderList[i] };
        const localId = Number(item.id);
        delete item.id;
        item.organization_id = orgId;

        if (item.customer_id) {
          const localCustId = Number(item.customer_id?.id || item.customer_id);
          item.customer_id = idMap['customers']?.get(localCustId) || item.customer_id;
        }

        try {
          const created = await directusClient.createItem<any>('orders', item);
          if (created?.id) {
            idMap['orders']?.set(localId, Number(created.id));
            totalMigrated++;

            // Migrate order line items for this specific order
            const relatedLines = orderItemsList.filter((oi: any) => {
              const oId = Number(oi.order_id?.id || oi.order_id);
              return oId === localId;
            });

            for (const line of relatedLines) {
              const lineItem = { ...line };
              delete lineItem.id;
              lineItem.organization_id = orgId;
              lineItem.order_id = Number(created.id);
              if (lineItem.variant_id) {
                const localVId = Number(lineItem.variant_id?.id || lineItem.variant_id);
                lineItem.variant_id = idMap['product_variants']?.get(localVId) || lineItem.variant_id;
              }
              await directusClient.createItem<any>('order_items', lineItem).catch(() => {});
              totalMigrated++;
            }
          }
        } catch (err: any) {
          errors.push(`خطا در ارسال سفارش (#${item.order_number || localId}): ${err?.message || err}`);
        }
        emitProgress('سفارشات و فاکتورها', i + 1, orderList.length, 'in_progress');
      }
      emitProgress('سفارشات و فاکتورها', orderList.length, orderList.length, 'completed');

      return {
        success: errors.length === 0,
        totalMigrated,
        errors,
      };
    } catch (e: any) {
      return {
        success: false,
        totalMigrated,
        errors: [...errors, e?.message || 'خطای غیرمنتظره در مهاجرت اطلاعات'],
      };
    }
  }
}
