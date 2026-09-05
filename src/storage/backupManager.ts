/**
 * TANKHOR Local Backup, Restore & Demo Data Management
 * Enables offline users to export complete database backups (JSON) with 1-click
 * and restore seamlessly on other devices/systems or after browser cache resets.
 */

import { formatDate, toPersianDigits } from '../utils/formatters';
import { isTauriEnvironment } from './sqliteAdapter';

export const BACKUP_COLLECTIONS = [
  'organizations',
  'organization_users',
  'categories',
  'collections',
  'seasons',
  'colors',
  'size_groups',
  'sizes',
  'brands',
  'products',
  'product_variants',
  'warehouses',
  'warehouse_locations',
  'inventory_items',
  'inventory_movements',
  'customers',
  'orders',
  'order_items',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'stock_transfers',
  'stock_transfer_items',
  'size_guide_templates',
  'size_guide_measurements',
  'size_guide_values',
] as const;

export type BackupCollectionKey = typeof BACKUP_COLLECTIONS[number];

export interface TankhorBackupMetadata {
  app: string;
  signature: string;
  version: string;
  exported_at: string;
  exported_at_jalali: string;
  total_records: number;
  organization?: {
    id: number;
    name: string;
    slug?: string;
  };
  collections_summary: Record<string, number>;
}

export interface TankhorBackupFile {
  metadata: TankhorBackupMetadata;
  data: Record<string, any[]>;
}

export interface InspectionResult {
  valid: boolean;
  error?: string;
  metadata?: TankhorBackupMetadata;
  collections?: Record<string, number>;
  data?: Record<string, any[]>;
}

export class BackupManager {
  /**
   * Reads raw collection from localStorage
   */
  private static getRawCollection(name: string): any[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(`tankhor_db_${name}`);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Writes raw collection to localStorage
   */
  private static setRawCollection(name: string, data: any[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`tankhor_db_${name}`, JSON.stringify(data));
  }

  /**
   * Helper to filter collection items by organization ID
   */
  public static filterCollectionByOrg(
    collection: BackupCollectionKey,
    items: any[],
    orgId: number,
    allCollections?: Partial<Record<BackupCollectionKey, any[]>>
  ): any[] {
    if (!Array.isArray(items)) return [];
    if (!orgId) return items;

    const matchDirectOrg = (item: any) => {
      if (!item) return false;
      const itemOrgId = typeof item.organization_id === 'number'
        ? item.organization_id
        : item.organization_id?.id !== undefined
        ? Number(item.organization_id.id)
        : item.organization_id !== undefined
        ? Number(item.organization_id)
        : undefined;
      return itemOrgId === orgId;
    };

    switch (collection) {
      case 'organizations':
        return items.filter((o) => Number(o.id) === orgId);

      case 'organization_users':
        return items.filter((ou) => {
          const ouOrgId = typeof ou.organization_id === 'number'
            ? ou.organization_id
            : Number(ou.organization_id?.id || ou.organization_id);
          return ouOrgId === orgId;
        });

      case 'warehouse_locations': {
        const rawWarehouses = allCollections?.warehouses || this.getRawCollection('warehouses');
        const validWarehouseIds = new Set(
          rawWarehouses.filter(matchDirectOrg).map((w: any) => Number(w.id))
        );
        return items.filter((l) => {
          if (matchDirectOrg(l)) return true;
          const whId = typeof l.warehouse_id === 'number'
            ? l.warehouse_id
            : Number(l.warehouse_id?.id || l.warehouse_id);
          return validWarehouseIds.has(whId);
        });
      }

      case 'product_variants': {
        const rawProducts = allCollections?.products || this.getRawCollection('products');
        const validProductIds = new Set(
          rawProducts.filter(matchDirectOrg).map((p: any) => Number(p.id))
        );
        return items.filter((v) => {
          if (matchDirectOrg(v)) return true;
          const pId = typeof v.product_id === 'number'
            ? v.product_id
            : Number(v.product_id?.id || v.product_id);
          return validProductIds.has(pId);
        });
      }

      case 'inventory_items': {
        const rawVariants = allCollections?.product_variants || this.getRawCollection('product_variants');
        const validVariantIds = new Set(
          this.filterCollectionByOrg('product_variants', rawVariants, orgId, allCollections).map((v: any) => Number(v.id))
        );
        return items.filter((i) => {
          if (matchDirectOrg(i)) return true;
          const varId = typeof i.variant_id === 'number'
            ? i.variant_id
            : Number(i.variant_id?.id || i.variant_id);
          return validVariantIds.has(varId);
        });
      }

      case 'order_items': {
        const rawOrders = allCollections?.orders || this.getRawCollection('orders');
        const validOrderIds = new Set(
          rawOrders.filter(matchDirectOrg).map((o: any) => Number(o.id))
        );
        return items.filter((oi) => {
          if (matchDirectOrg(oi)) return true;
          const ordId = typeof oi.order_id === 'number'
            ? oi.order_id
            : Number(oi.order_id?.id || oi.order_id);
          return validOrderIds.has(ordId);
        });
      }

      case 'purchase_order_items': {
        const rawPOs = allCollections?.purchase_orders || this.getRawCollection('purchase_orders');
        const validPOIds = new Set(
          rawPOs.filter(matchDirectOrg).map((po: any) => Number(po.id))
        );
        return items.filter((poi) => {
          if (matchDirectOrg(poi)) return true;
          const poId = typeof poi.purchase_order_id === 'number'
            ? poi.purchase_order_id
            : Number(poi.purchase_order_id?.id || poi.purchase_order_id);
          return validPOIds.has(poId);
        });
      }

      case 'stock_transfer_items': {
        const rawTransfers = allCollections?.stock_transfers || this.getRawCollection('stock_transfers');
        const validTransferIds = new Set(
          rawTransfers.filter(matchDirectOrg).map((t: any) => Number(t.id))
        );
        return items.filter((sti) => {
          if (matchDirectOrg(sti)) return true;
          const tId = typeof sti.transfer_id === 'number'
            ? sti.transfer_id
            : Number(sti.transfer_id?.id || sti.transfer_id);
          return validTransferIds.has(tId);
        });
      }

      case 'size_guide_measurements': {
        const rawTemplates = allCollections?.size_guide_templates || this.getRawCollection('size_guide_templates');
        const validTemplateIds = new Set(
          rawTemplates.filter(matchDirectOrg).map((t: any) => Number(t.id))
        );
        return items.filter((m) => {
          if (matchDirectOrg(m)) return true;
          const tId = typeof m.template_id === 'number'
            ? m.template_id
            : Number(m.template_id?.id || m.template_id);
          return validTemplateIds.has(tId);
        });
      }

      case 'size_guide_values': {
        const rawTemplates = allCollections?.size_guide_templates || this.getRawCollection('size_guide_templates');
        const validTemplateIds = new Set(
          rawTemplates.filter(matchDirectOrg).map((t: any) => Number(t.id))
        );
        return items.filter((v) => {
          if (matchDirectOrg(v)) return true;
          const tId = typeof v.template_id === 'number'
            ? v.template_id
            : Number(v.template_id?.id || v.template_id);
          return validTemplateIds.has(tId);
        });
      }

      case 'sizes': {
        const rawSizeGroups = allCollections?.size_groups || this.getRawCollection('size_groups');
        const validSizeGroupIds = new Set(
          rawSizeGroups.filter(matchDirectOrg).map((sg: any) => Number(sg.id))
        );
        return items.filter((s) => {
          if (matchDirectOrg(s)) return true;
          const sgId = typeof s.size_group_id === 'number'
            ? s.size_group_id
            : Number(s.size_group_id?.id || s.size_group_id);
          return validSizeGroupIds.has(sgId);
        });
      }

      default:
        // Direct tenant scoped items
        return items.filter(matchDirectOrg);
    }
  }

  /**
   * Retrieves summary counts of all stored local collections scoped to an organization
   */
  public static getLocalStats(orgId?: number): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const key of BACKUP_COLLECTIONS) {
      const raw = this.getRawCollection(key);
      const filtered = orgId ? this.filterCollectionByOrg(key, raw, orgId) : raw;
      stats[key] = filtered.length;
    }
    return stats;
  }

  /**
   * Generates a complete JSON backup of the local database strictly scoped to the active organization
   */
  public static generateBackup(organization?: { id: number; name: string; slug?: string } | null): TankhorBackupFile {
    const data: Record<string, any[]> = {};
    const summary: Record<string, number> = {};
    let totalRecords = 0;
    const orgId = organization?.id ? Number(organization.id) : undefined;

    for (const col of BACKUP_COLLECTIONS) {
      const rawItems = this.getRawCollection(col);
      const scopedItems = orgId ? this.filterCollectionByOrg(col, rawItems, orgId) : rawItems;

      data[col] = scopedItems;
      summary[col] = scopedItems.length;
      totalRecords += scopedItems.length;
    }

    const now = new Date();
    const metadata: TankhorBackupMetadata = {
      app: 'TANKHOR (تن‌خور)',
      signature: 'tankhor_full_backup_v1',
      version: '1.0.0',
      exported_at: now.toISOString(),
      exported_at_jalali: formatDate(now.toISOString(), true),
      total_records: totalRecords,
      organization: organization ? {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      } : undefined,
      collections_summary: summary,
    };

    return {
      metadata,
      data,
    };
  }

  /**
   * Exports backup file and triggers automatic browser download
   */
  public static exportBackupFile(organization?: { id: number; name: string; slug?: string } | null): void {
    const backupObj = this.generateBackup(organization);
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const orgSlug = organization?.slug || 'tankhor';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `tankhor_backup_${orgSlug}_${dateStr}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Validates and inspects an uploaded backup JSON file
   */
  public static inspectBackupFile(content: string): InspectionResult {
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object') {
        return { valid: false, error: 'فایل بارگذاری شده ساختار معتبر JSON ندارد.' };
      }

      // Check if it has data property or is direct collection map
      const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      const metadata: TankhorBackupMetadata = parsed.metadata || {
        app: 'TANKHOR',
        signature: 'tankhor_legacy_backup',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        exported_at_jalali: formatDate(new Date().toISOString(), true),
        total_records: 0,
        collections_summary: {},
      };

      const summary: Record<string, number> = {};
      let total = 0;

      for (const col of BACKUP_COLLECTIONS) {
        if (Array.isArray(data[col])) {
          summary[col] = data[col].length;
          total += data[col].length;
        } else {
          summary[col] = 0;
        }
      }

      metadata.total_records = total;
      metadata.collections_summary = summary;

      if (total === 0) {
        return { valid: false, error: 'فایل انتخاب شده حاوی داده‌های معتبر پایگاه داده تن‌خور نیست.' };
      }

      return {
        valid: true,
        metadata,
        collections: summary,
        data,
      };
    } catch (e: any) {
      return { valid: false, error: `خطا در خواندن فایل پشتیبان: ${e.message || 'فرمت نامعتبر'}` };
    }
  }

  /**
   * Restores data from a backup object with tenant isolation
   */
  public static async restoreBackup(
    backupData: Record<string, any[]>,
    mode: 'replace' | 'merge' = 'replace',
    targetOrgId?: number
  ): Promise<{ success: boolean; restoredCount: number; error?: string }> {
    try {
      let totalRestored = 0;
      const activeOrgId = targetOrgId || Number(localStorage.getItem('tankhor_active_org_id') || 1);

      for (const col of BACKUP_COLLECTIONS) {
        const incoming = backupData[col];
        if (!Array.isArray(incoming)) continue;

        // Ensure incoming records carry targetOrgId if applicable
        const normalizedIncoming = incoming.map((item) => {
          if (col !== 'organizations' && (item.organization_id === undefined || item.organization_id === null)) {
            return { ...item, organization_id: activeOrgId };
          }
          return item;
        });

        if (mode === 'replace') {
          // In multi-tenant replace: Keep other orgs' data and replace only activeOrgId's data
          const existing = this.getRawCollection(col);
          const otherOrgsItems = existing.filter((item) => {
            const itemOrg = typeof item.organization_id === 'number'
              ? item.organization_id
              : Number(item.organization_id?.id || item.organization_id);
            return itemOrg && itemOrg !== activeOrgId;
          });

          const finalCollection = [...otherOrgsItems, ...normalizedIncoming];
          this.setRawCollection(col, finalCollection);
          totalRestored += normalizedIncoming.length;
        } else {
          // Merge mode: append or update by ID
          const existing = this.getRawCollection(col);
          const existingIds = new Set(existing.map((item) => String(item.id)));
          const merged = [...existing];

          for (const item of normalizedIncoming) {
            const idStr = String(item.id);
            if (existingIds.has(idStr)) {
              const idx = merged.findIndex((m) => String(m.id) === idStr);
              if (idx !== -1) {
                merged[idx] = { ...merged[idx], ...item };
              }
            } else {
              merged.push(item);
              existingIds.add(idStr);
            }
          }

          this.setRawCollection(col, merged);
          totalRestored += normalizedIncoming.length;
        }
      }

      // Check if organizations collection was restored, update active org if needed
      const restoredOrgs = backupData['organizations'];
      if (Array.isArray(restoredOrgs) && restoredOrgs.length > 0) {
        const orgToSelect = restoredOrgs.find((o) => Number(o.id) === activeOrgId) || restoredOrgs[0];
        if (orgToSelect?.id) {
          localStorage.setItem('tankhor_active_org_id', String(orgToSelect.id));
        }
      }

      // If in desktop Tauri environment, write directly to SQLite
      if (isTauriEnvironment()) {
        try {
          const Database = (await import('@tauri-apps/plugin-sql')).default;
          const db = await Database.load('sqlite:tankhor.db');
          for (const col of BACKUP_COLLECTIONS) {
            if (mode === 'replace') {
              try {
                await db.execute(`DELETE FROM ${col} WHERE organization_id = $1`, [activeOrgId]);
              } catch {}
            }
            const currentItems = this.getRawCollection(col);
            for (const item of currentItems) {
              if (item && item.id) {
                const orgId = typeof item.organization_id === 'number' ? item.organization_id : (item.organization_id?.id || activeOrgId);
                await db.execute(
                  `INSERT OR REPLACE INTO ${col} (id, organization_id, data, date_updated) VALUES ($1, $2, $3, datetime('now'))`,
                  [item.id, orgId, JSON.stringify(item)]
                );
              }
            }
          }
        } catch (dbErr) {
          console.warn('[BackupManager] SQLite sync warning during restore:', dbErr);
        }
      }

      // Notify the application
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tankhor_data_restored', {
          detail: { timestamp: new Date().toISOString(), mode, count: totalRestored }
        }));
      }

      return { success: true, restoredCount: totalRestored };
    } catch (e: any) {
      return { success: false, restoredCount: 0, error: e.message || 'خطا در بازیابی اطلاعات' };
    }
  }

  /**
   * Exports a single collection to CSV format with UTF-8 BOM for Microsoft Excel compatibility
   */
  public static exportToCsv(collectionName: BackupCollectionKey, orgId?: number): void {
    let items = this.getRawCollection(collectionName);
    if (orgId) {
      items = this.filterCollectionByOrg(collectionName, items, orgId);
    }

    if (items.length === 0) {
      alert('داده‌ای در این بخش برای خروجی اکسل وجود ندارد.');
      return;
    }

    // Collect all unique keys
    const keys = Array.from(new Set(items.flatMap((item) => Object.keys(item))));
    const filteredKeys = keys.filter((k) => typeof items[0]?.[k] !== 'object');

    const csvRows: string[] = [];
    csvRows.push(filteredKeys.join(','));

    for (const item of items) {
      const row = filteredKeys.map((k) => {
        const val = item[k];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvRows.push(row.join(','));
    }

    // Add UTF-8 BOM so Excel opens Persian text without encoding issues
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `tankhor_${collectionName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Seeds rich, realistic demo data tailored for fashion/apparel boutiques
   */
  public static async seedFashionDemoData(activeOrgId: number = 1): Promise<{ success: boolean; message: string }> {
    try {
      const orgs = this.getRawCollection('organizations');
      let targetOrg = orgs.find((o) => Number(o.id) === Number(activeOrgId));
      if (!targetOrg) {
        targetOrg = {
          id: activeOrgId,
          name: 'بوتیک مد و پوشاک تن‌خور',
          slug: 'tankhor-boutique',
          currency: 'TOMAN',
          timezone: 'Asia/Tehran',
          plan: 'free',
          status: 'active',
          date_created: new Date().toISOString(),
        };
        this.setRawCollection('organizations', [targetOrg]);
        localStorage.setItem('tankhor_active_org_id', String(activeOrgId));
      }

      // 1. Categories
      const categories = [
        { id: 101, organization_id: activeOrgId, name: 'مانتو و پالتو', slug: 'manto-coat', type: 'apparel', status: 'active' },
        { id: 102, organization_id: activeOrgId, name: 'هودی و سویشرت', slug: 'hoodies', type: 'apparel', status: 'active' },
        { id: 103, organization_id: activeOrgId, name: 'شلوار و لگ', slug: 'pants', type: 'apparel', status: 'active' },
        { id: 104, organization_id: activeOrgId, name: 'کیف و کوله', slug: 'bags', type: 'bags', status: 'active' },
        { id: 105, organization_id: activeOrgId, name: 'کفش و کتانی', slug: 'shoes', type: 'shoes', status: 'active' },
      ];
      this.setRawCollection('categories', categories);

      // 2. Brands
      const brands = [
        { id: 201, organization_id: activeOrgId, name: 'زارا (Zara)', slug: 'zara', status: 'active' },
        { id: 202, organization_id: activeOrgId, name: 'مانگو (Mango)', slug: 'mango', status: 'active' },
        { id: 203, organization_id: activeOrgId, name: 'ماسیو دوتی (Massimo Dutti)', slug: 'massimo-dutti', status: 'active' },
        { id: 204, organization_id: activeOrgId, name: 'تن‌درست', slug: 'tan-dorost', status: 'active' },
      ];
      this.setRawCollection('brands', brands);

      // 3. Seasons & Collections
      const seasons = [
        { id: 301, organization_id: activeOrgId, name: 'پاییز و زمستان ۱۴۰۳', code: 'FW2024', status: 'active' },
        { id: 302, organization_id: activeOrgId, name: 'بهار و تابستان ۱۴۰۴', code: 'SS2025', status: 'active' },
      ];
      this.setRawCollection('seasons', seasons);

      const collections = [
        { id: 401, organization_id: activeOrgId, name: 'کالکشن مینیمال کژوال', slug: 'minimal-casual', season_id: 301, status: 'active' },
        { id: 402, organization_id: activeOrgId, name: 'کالکشن رسمی و شب', slug: 'formal-night', season_id: 301, status: 'active' },
      ];
      this.setRawCollection('collections', collections);

      // 4. Colors
      const colors = [
        { id: 501, organization_id: activeOrgId, name: 'مشکی مات', hex_code: '#18181b', status: 'active' },
        { id: 502, organization_id: activeOrgId, name: 'کرم نسکافه‌ای', hex_code: '#d4b996', status: 'active' },
        { id: 503, organization_id: activeOrgId, name: 'طوسی ملانژ', hex_code: '#9ca3af', status: 'active' },
        { id: 504, organization_id: activeOrgId, name: 'سبز سدری', hex_code: '#5b7065', status: 'active' },
        { id: 505, organization_id: activeOrgId, name: 'سرمه‌ای تیره', hex_code: '#1e293b', status: 'active' },
      ];
      this.setRawCollection('colors', colors);

      // 5. Size Groups & Sizes
      const sizeGroups = [
        { id: 601, organization_id: activeOrgId, name: 'سایزبندی استاندارد پوشاک (S تا XL)', type: 'apparel', status: 'active' },
        { id: 602, organization_id: activeOrgId, name: 'سایزبندی عددی شلوار (36 تا 44)', type: 'apparel', status: 'active' },
        { id: 603, organization_id: activeOrgId, name: 'سایزبندی کفش (37 تا 44)', type: 'shoes', status: 'active' },
      ];
      this.setRawCollection('size_groups', sizeGroups);

      const sizes = [
        { id: 701, organization_id: activeOrgId, size_group_id: 601, name: 'Small (S)', code: 'S', sort_order: 1 },
        { id: 702, organization_id: activeOrgId, size_group_id: 601, name: 'Medium (M)', code: 'M', sort_order: 2 },
        { id: 703, organization_id: activeOrgId, size_group_id: 601, name: 'Large (L)', code: 'L', sort_order: 3 },
        { id: 704, organization_id: activeOrgId, size_group_id: 601, name: 'X-Large (XL)', code: 'XL', sort_order: 4 },
        { id: 705, organization_id: activeOrgId, size_group_id: 602, name: 'سایز 38', code: '38', sort_order: 1 },
        { id: 706, organization_id: activeOrgId, size_group_id: 602, name: 'سایز 40', code: '40', sort_order: 2 },
        { id: 707, organization_id: activeOrgId, size_group_id: 602, name: 'سایز 42', code: '42', sort_order: 3 },
        { id: 708, organization_id: activeOrgId, size_group_id: 603, name: 'سایز 38', code: '38', sort_order: 1 },
        { id: 709, organization_id: activeOrgId, size_group_id: 603, name: 'سایز 39', code: '39', sort_order: 2 },
        { id: 710, organization_id: activeOrgId, size_group_id: 603, name: 'سایز 40', code: '40', sort_order: 3 },
      ];
      this.setRawCollection('sizes', sizes);

      // 6. Warehouses & Locations
      const warehouses = [
        { id: 801, organization_id: activeOrgId, name: 'انبار مرکزی تهران', code: 'WH-MAIN', is_default: true, status: 'active' },
        { id: 802, organization_id: activeOrgId, name: 'فروشگاه شعبه پالادیوم', code: 'WH-PLD', is_default: false, status: 'active' },
      ];
      this.setRawCollection('warehouses', warehouses);

      const locations = [
        { id: 901, organization_id: activeOrgId, warehouse_id: 801, name: 'قفسه A-01 (پوشاک پاییزه)', code: 'LOC-A01' },
        { id: 902, organization_id: activeOrgId, warehouse_id: 801, name: 'قفسه B-03 (شلوار و جین)', code: 'LOC-B03' },
        { id: 903, organization_id: activeOrgId, warehouse_id: 802, name: 'رگال ورودی فروشگاه', code: 'LOC-FRONT' },
      ];
      this.setRawCollection('warehouse_locations', locations);

      // 7. Products
      const products = [
        {
          id: 1001,
          organization_id: activeOrgId,
          title: 'پالتو فوتر یقه بلیزر کلاسیک',
          code: 'PRD-1001',
          category_id: 101,
          brand_id: 201,
          collection_id: 401,
          season_id: 301,
          gender: 'women',
          material: 'فوتر ترک ۸۰٪ پشم',
          status: 'active',
          date_created: new Date().toISOString(),
        },
        {
          id: 1002,
          organization_id: activeOrgId,
          title: 'هودی کلاه‌دار اورسایز ۳ نخ توکرکی',
          code: 'PRD-1002',
          category_id: 102,
          brand_id: 204,
          collection_id: 401,
          season_id: 301,
          gender: 'unisex',
          material: 'پنبه سوپر توکرکی',
          status: 'active',
          date_created: new Date().toISOString(),
        },
        {
          id: 1003,
          organization_id: activeOrgId,
          title: 'شلوار جین زنانه نیم‌بگ دمپا ریش',
          code: 'PRD-1003',
          category_id: 103,
          brand_id: 202,
          collection_id: 401,
          season_id: 301,
          gender: 'women',
          material: 'دنیم ۱۰۰٪ پنبه سنگ‌شور',
          status: 'active',
          date_created: new Date().toISOString(),
        },
        {
          id: 1004,
          organization_id: activeOrgId,
          title: 'کتانی چرم طبیعی کژوال آکسفورد',
          code: 'PRD-1004',
          category_id: 105,
          brand_id: 203,
          collection_id: 402,
          season_id: 302,
          gender: 'unisex',
          material: 'چرم طبیعی گاو با زیره EVA',
          status: 'active',
          date_created: new Date().toISOString(),
        },
      ];
      this.setRawCollection('products', products);

      // 8. Variants & Inventory
      const variants = [
        // Coat Variants
        { id: 2001, organization_id: activeOrgId, product_id: 1001, sku: 'COAT-BLK-M', barcode: '626100101', color_id: 501, size_id: 702, regular_price: 3850000, sale_price: 3450000, cost_price: 1950000, status: 'active' },
        { id: 2002, organization_id: activeOrgId, product_id: 1001, sku: 'COAT-BLK-L', barcode: '626100102', color_id: 501, size_id: 703, regular_price: 3850000, sale_price: 3450000, cost_price: 1950000, status: 'active' },
        { id: 2003, organization_id: activeOrgId, product_id: 1001, sku: 'COAT-CRM-M', barcode: '626100103', color_id: 502, size_id: 702, regular_price: 3850000, sale_price: 3850000, cost_price: 1950000, status: 'active' },

        // Hoodie Variants
        { id: 2004, organization_id: activeOrgId, product_id: 1002, sku: 'HD-GRY-L', barcode: '626100201', color_id: 503, size_id: 703, regular_price: 1450000, sale_price: 1250000, cost_price: 680000, status: 'active' },
        { id: 2005, organization_id: activeOrgId, product_id: 1002, sku: 'HD-GRY-XL', barcode: '626100202', color_id: 503, size_id: 704, regular_price: 1450000, sale_price: 1250000, cost_price: 680000, status: 'active' },
        { id: 2006, organization_id: activeOrgId, product_id: 1002, sku: 'HD-GRN-L', barcode: '626100203', color_id: 504, size_id: 703, regular_price: 1450000, sale_price: 1450000, cost_price: 680000, status: 'active' },

        // Pants Variants
        { id: 2007, organization_id: activeOrgId, product_id: 1003, sku: 'JEAN-BLU-38', barcode: '626100301', color_id: 505, size_id: 705, regular_price: 1890000, sale_price: 1890000, cost_price: 920000, status: 'active' },
        { id: 2008, organization_id: activeOrgId, product_id: 1003, sku: 'JEAN-BLU-40', barcode: '626100302', color_id: 505, size_id: 706, regular_price: 1890000, sale_price: 1890000, cost_price: 920000, status: 'active' },

        // Shoes Variants
        { id: 2009, organization_id: activeOrgId, product_id: 1004, sku: 'SHOE-WHT-38', barcode: '626100401', color_id: 502, size_id: 708, regular_price: 2950000, sale_price: 2950000, cost_price: 1450000, status: 'active' },
        { id: 2010, organization_id: activeOrgId, product_id: 1004, sku: 'SHOE-WHT-39', barcode: '626100402', color_id: 502, size_id: 709, regular_price: 2950000, sale_price: 2950000, cost_price: 1450000, status: 'active' },
      ];
      this.setRawCollection('product_variants', variants);

      // Inventory balances
      const inventory = [
        { id: 3001, organization_id: activeOrgId, variant_id: 2001, warehouse_id: 801, location_id: 901, quantity: 18, reserved_quantity: 2, safety_stock: 5 },
        { id: 3002, organization_id: activeOrgId, variant_id: 2002, warehouse_id: 801, location_id: 901, quantity: 12, reserved_quantity: 0, safety_stock: 4 },
        { id: 3003, organization_id: activeOrgId, variant_id: 2003, warehouse_id: 802, location_id: 903, quantity: 8, reserved_quantity: 1, safety_stock: 3 },
        { id: 3004, organization_id: activeOrgId, variant_id: 2004, warehouse_id: 801, location_id: 901, quantity: 35, reserved_quantity: 4, safety_stock: 10 },
        { id: 3005, organization_id: activeOrgId, variant_id: 2005, warehouse_id: 801, location_id: 901, quantity: 24, reserved_quantity: 2, safety_stock: 8 },
        { id: 3006, organization_id: activeOrgId, variant_id: 2006, warehouse_id: 802, location_id: 903, quantity: 15, reserved_quantity: 0, safety_stock: 5 },
        { id: 3007, organization_id: activeOrgId, variant_id: 2007, warehouse_id: 801, location_id: 902, quantity: 28, reserved_quantity: 3, safety_stock: 6 },
        { id: 3008, organization_id: activeOrgId, variant_id: 2008, warehouse_id: 801, location_id: 902, quantity: 20, reserved_quantity: 1, safety_stock: 6 },
        { id: 3009, organization_id: activeOrgId, variant_id: 2009, warehouse_id: 802, location_id: 903, quantity: 10, reserved_quantity: 0, safety_stock: 3 },
        { id: 3010, organization_id: activeOrgId, variant_id: 2010, warehouse_id: 802, location_id: 903, quantity: 14, reserved_quantity: 1, safety_stock: 4 },
      ];
      this.setRawCollection('inventory_items', inventory);

      // 9. Customers
      const customers = [
        { id: 4001, organization_id: activeOrgId, first_name: 'سارا', last_name: 'محمدی', phone: '09121112233', email: 'sara.m@gmail.com', city: 'تهران', address: 'نیاوران، خ مژده، پلاک ۱۲', total_orders: 4, total_spent: 9800000 },
        { id: 4002, organization_id: activeOrgId, first_name: 'امیرحسین', last_name: 'کریمی', phone: '09354445566', email: 'a.karimi@yahoo.com', city: 'اصفهان', address: 'چهارباغ عباسی، مجتمع افتخار', total_orders: 2, total_spent: 4200000 },
        { id: 4003, organization_id: activeOrgId, first_name: 'مریم', last_name: 'صادقی', phone: '09198889900', email: 'maryam.s@gmail.com', city: 'شیراز', address: 'قدوسی غربی، کوچه ۸', total_orders: 1, total_spent: 3450000 },
      ];
      this.setRawCollection('customers', customers);

      // 10. Orders
      const orders = [
        {
          id: 5001,
          organization_id: activeOrgId,
          order_number: 'ORD-1403-1001',
          customer_id: 4001,
          status: 'completed',
          payment_status: 'paid',
          total_amount: 4700000,
          discount_amount: 200000,
          tax_amount: 0,
          shipping_amount: 85000,
          final_amount: 4585000,
          date_created: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          payment_method: 'card_reader',
          warehouse_id: 801,
        },
        {
          id: 5002,
          organization_id: activeOrgId,
          order_number: 'ORD-1403-1002',
          customer_id: 4002,
          status: 'processing',
          payment_status: 'paid',
          total_amount: 2700000,
          discount_amount: 0,
          tax_amount: 0,
          shipping_amount: 65000,
          final_amount: 2765000,
          date_created: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
          payment_method: 'online',
          warehouse_id: 801,
        },
      ];
      this.setRawCollection('orders', orders);

      const orderItems = [
        { id: 6001, order_id: 5001, variant_id: 2001, quantity: 1, unit_price: 3450000, total_price: 3450000 },
        { id: 6002, order_id: 5001, variant_id: 2004, quantity: 1, unit_price: 1250000, total_price: 1250000 },
        { id: 6003, order_id: 5002, variant_id: 2007, quantity: 1, unit_price: 1890000, total_price: 1890000 },
      ];
      this.setRawCollection('order_items', orderItems);

      // 11. Size Guide Templates & Measurements
      const sizeGuides = [
        { id: 7001, organization_id: activeOrgId, name: 'راهنمای سایز پالتو و بارانی زنانه', title: 'راهنمای سایز پالتو و بارانی زنانه', type: 'apparel', template_type: 'apparel', category_id: 101, unit: 'cm', status: 'active', description: 'مناسب انواع پالتو و بارانی زمستانه' },
        { id: 7002, organization_id: activeOrgId, name: 'جدول ابعاد هودی و دورس اورسایز', title: 'جدول ابعاد هودی و دورس اورسایز', type: 'apparel', template_type: 'apparel', category_id: 102, unit: 'cm', status: 'active', description: 'قالب آزاد و راحت مخصوص هودی و دورس' },
      ];
      this.setRawCollection('size_guide_templates', sizeGuides);

      const measurements = [
        { id: 8001, template_id: 7001, name: 'دور سینه', code: 'chest', unit: 'cm', type: 'circumference', status: 'active', sort: 1, description: 'اندازه‌گیری از برجسته‌ترین قسمت سینه' },
        { id: 8002, template_id: 7001, name: 'عرض شانه', code: 'shoulder', unit: 'cm', type: 'width', status: 'active', sort: 2, description: 'از نوک استخوان شانه چپ تا راست' },
        { id: 8003, template_id: 7001, name: 'قد آستین', code: 'sleeve', unit: 'cm', type: 'length', status: 'active', sort: 3, description: 'از سرشانه تا روی مچ دست' },
        { id: 8004, template_id: 7001, name: 'قد کل لباس', code: 'length', unit: 'cm', type: 'length', status: 'active', sort: 4, description: 'از کنار گردن تا لبه پایین پالتو' },
      ];
      this.setRawCollection('size_guide_measurements', measurements);

      const values = [
        { id: 9001, template_id: 7001, measurement_id: 8001, size_id: 702, value: 94, value_exact: 94 },
        { id: 9002, template_id: 7001, measurement_id: 8001, size_id: 703, value: 100, value_exact: 100 },
        { id: 9003, template_id: 7001, measurement_id: 8002, size_id: 702, value: 40, value_exact: 40 },
        { id: 9004, template_id: 7001, measurement_id: 8002, size_id: 703, value: 43, value_exact: 43 },
        { id: 9005, template_id: 7001, measurement_id: 8003, size_id: 702, value: 60, value_exact: 60 },
        { id: 9006, template_id: 7001, measurement_id: 8003, size_id: 703, value: 62, value_exact: 62 },
        { id: 9007, template_id: 7001, measurement_id: 8004, size_id: 702, value: 110, value_exact: 110 },
        { id: 9008, template_id: 7001, measurement_id: 8004, size_id: 703, value: 112, value_exact: 112 },
      ];
      this.setRawCollection('size_guide_values', values);

      // If in desktop Tauri environment, write directly to SQLite
      if (isTauriEnvironment()) {
        try {
          const Database = (await import('@tauri-apps/plugin-sql')).default;
          const db = await Database.load('sqlite:tankhor.db');
          const allSeeded: [string, any[]][] = [
            ['organizations', [targetOrg]],
            ['categories', categories],
            ['brands', brands],
            ['seasons', seasons],
            ['collections', collections],
            ['colors', colors],
            ['size_groups', sizeGroups],
            ['sizes', sizes],
            ['warehouses', warehouses],
            ['warehouse_locations', locations],
            ['products', products],
            ['product_variants', variants],
            ['inventory_items', inventory],
            ['customers', customers],
            ['orders', orders],
            ['order_items', orderItems],
            ['size_guide_templates', sizeGuides],
            ['size_guide_measurements', measurements],
            ['size_guide_values', values],
          ];

          for (const [col, items] of allSeeded) {
            for (const item of items) {
              const orgId = typeof item.organization_id === 'number' ? item.organization_id : (item.organization_id?.id || activeOrgId);
              await db.execute(
                `INSERT OR REPLACE INTO ${col} (id, organization_id, data, date_updated) VALUES ($1, $2, $3, datetime('now'))`,
                [item.id, orgId, JSON.stringify(item)]
              );
            }
          }
        } catch (dbErr) {
          console.warn('[BackupManager] SQLite sync warning during demo seed:', dbErr);
        }
      }

      // Trigger data restored event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tankhor_data_restored', {
          detail: { timestamp: new Date().toISOString(), type: 'demo_seeded' }
        }));
      }

      return { success: true, message: 'داده‌های دمو صنف پوشاک با موفقیت در پایگاه داده محلی بارگذاری شد.' };
    } catch (e: any) {
      return { success: false, message: `خطا در بارگذاری داده‌های دمو: ${e.message}` };
    }
  }

  /**
   * Resets local collections for a specific organization
   */
  public static async clearLocalData(preserveOrganization: boolean = true, targetOrgId?: number): Promise<{ success: boolean; message: string }> {
    try {
      const activeOrgId = targetOrgId || Number(localStorage.getItem('tankhor_active_org_id') || 1);
      const orgs = this.getRawCollection('organizations');
      const activeOrg = orgs.find((o) => Number(o.id) === activeOrgId);

      for (const col of BACKUP_COLLECTIONS) {
        if (preserveOrganization && (col === 'organizations' || col === 'organization_users')) {
          continue;
        }

        const existing = this.getRawCollection(col);
        // Keep records from OTHER organizations
        const otherOrgsItems = existing.filter((item) => {
          const itemOrg = typeof item.organization_id === 'number'
            ? item.organization_id
            : Number(item.organization_id?.id || item.organization_id);
          return itemOrg && itemOrg !== activeOrgId;
        });

        if (otherOrgsItems.length > 0) {
          this.setRawCollection(col, otherOrgsItems);
        } else {
          localStorage.removeItem(`tankhor_db_${col}`);
        }
      }

      if (preserveOrganization && activeOrg) {
        const remainingOrgs = orgs.filter((o) => Number(o.id) !== activeOrgId);
        this.setRawCollection('organizations', [...remainingOrgs, activeOrg]);
      }

      // If in desktop Tauri environment, delete from SQLite
      if (isTauriEnvironment()) {
        try {
          const Database = (await import('@tauri-apps/plugin-sql')).default;
          const db = await Database.load('sqlite:tankhor.db');
          for (const col of BACKUP_COLLECTIONS) {
            if (preserveOrganization && (col === 'organizations' || col === 'organization_users')) {
              continue;
            }
            try {
              await db.execute(`DELETE FROM ${col} WHERE organization_id = $1`, [activeOrgId]);
            } catch {}
          }
        } catch (dbErr) {
          console.warn('[BackupManager] SQLite clear warning:', dbErr);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tankhor_data_restored', {
          detail: { timestamp: new Date().toISOString(), type: 'cleared' }
        }));
      }

      return { success: true, message: 'اطلاعات محلی سازمان با موفقیت پاکسازی شد.' };
    } catch (e: any) {
      return { success: false, message: `خطا در پاکسازی داده‌ها: ${e.message}` };
    }
  }
}
