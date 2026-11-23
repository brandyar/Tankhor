/**
 * TANKHOR Local & Cloud Backup, Restore & Demo Data Management
 * Enables users to export complete database backups (JSON) with 1-click
 * and restore seamlessly across Browser (localStorage), Desktop (SQLite), and Cloud modes.
 */

import { formatDate } from '../utils/formatters';
import { isTauriEnvironment } from './sqliteAdapter';
import { APP_VERSION } from '../utils/version';
import { downloadCsvContent, escapeCsvCell, triggerBlobDownload } from '../utils/excelUtils';

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
  'order_returns',
  'order_return_items',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'stock_transfers',
  'stock_transfer_items',
  'size_guide_templates',
  'size_guide_measurements',
  'size_guide_values',
  'subscriptions',
  'system_modules',
  'organization_modules',
  'expense_categories',
  'expenses',
  'person_transactions',
  'financial_accounts',
  'treasury_transactions',
  'cheques',
  'landed_costs',
  'landed_cost_allocations',
  'pos_shifts',
  'woocommerce_settings',
  'woocommerce_logs',
  'woocommerce_mappings',
  'raw_materials',
  'bill_of_materials',
  'bom_items',
  'contractors',
  'production_orders',
  'production_order_items',
  'production_stages',
  'feedbacks',
] as const;

export type BackupCollectionKey = typeof BACKUP_COLLECTIONS[number];

const CHILD_PARENT_FILTER_MAP: Partial<
  Record<BackupCollectionKey, { parentCollection: BackupCollectionKey; foreignKey: string }>
> = {
  warehouse_locations: { parentCollection: 'warehouses', foreignKey: 'warehouse_id' },
  product_variants: { parentCollection: 'products', foreignKey: 'product_id' },
  order_items: { parentCollection: 'orders', foreignKey: 'order_id' },
  order_return_items: { parentCollection: 'order_returns', foreignKey: 'return_id' },
  purchase_order_items: { parentCollection: 'purchase_orders', foreignKey: 'purchase_order_id' },
  stock_transfer_items: { parentCollection: 'stock_transfers', foreignKey: 'transfer_id' },
  size_guide_measurements: { parentCollection: 'size_guide_templates', foreignKey: 'template_id' },
  size_guide_values: { parentCollection: 'size_guide_templates', foreignKey: 'template_id' },
  sizes: { parentCollection: 'size_groups', foreignKey: 'size_group_id' },
  bom_items: { parentCollection: 'bill_of_materials', foreignKey: 'bom_id' },
  production_order_items: { parentCollection: 'production_orders', foreignKey: 'production_order_id' },
  production_stages: { parentCollection: 'production_orders', foreignKey: 'production_order_id' },
  landed_cost_allocations: { parentCollection: 'landed_costs', foreignKey: 'landed_cost_id' },
};

const GLOBAL_CATALOG_COLLECTIONS = new Set<BackupCollectionKey>(['system_modules']);

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

export interface CsvExportResult {
  success: boolean;
  count: number;
  message: string;
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

  private static extractRelationId(val: any): number | undefined {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return Number.isFinite(val) ? val : undefined;
    if (typeof val === 'object' && val.id !== undefined) {
      const n = Number(val.id);
      return Number.isFinite(n) ? n : undefined;
    }
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }

  private static normalizeCloudRecord(rec: any): any {
    if (!rec || typeof rec !== 'object') return rec;
    const copy: any = { ...rec };
    for (const [k, v] of Object.entries(copy)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && 'id' in v) {
        copy[k] = (v as any).id;
      }
    }
    return copy;
  }

  /**
   * Helper to filter collection items by organization ID (including child tables)
   */
  public static filterCollectionByOrg(
    collection: BackupCollectionKey,
    items: any[],
    orgId: number,
    allCollections?: Partial<Record<BackupCollectionKey, any[]>>
  ): any[] {
    if (!Array.isArray(items)) return [];
    if (!orgId) return items;
    if (GLOBAL_CATALOG_COLLECTIONS.has(collection)) return items;

    const matchDirectOrg = (item: any) => {
      if (!item) return false;
      const itemOrgId = this.extractRelationId(item.organization_id);
      return itemOrgId === Number(orgId);
    };

    switch (collection) {
      case 'organizations':
        return items.filter((o) => Number(o?.id) === Number(orgId));

      case 'organization_users':
        return items.filter((ou) => this.extractRelationId(ou?.organization_id) === Number(orgId));

      case 'inventory_items': {
        const rawVariants = allCollections?.product_variants || this.getRawCollection('product_variants');
        const validVariantIds = new Set(
          this.filterCollectionByOrg('product_variants', rawVariants, orgId, allCollections).map((v: any) => Number(v.id))
        );
        return items.filter((i) => {
          if (matchDirectOrg(i)) return true;
          const varId = this.extractRelationId(i?.variant_id);
          return varId !== undefined && validVariantIds.has(varId);
        });
      }

      case 'warehouse_locations':
      case 'product_variants':
      case 'order_items':
      case 'purchase_order_items':
      case 'stock_transfer_items':
      case 'size_guide_measurements':
      case 'size_guide_values':
      case 'sizes':
      case 'bom_items':
      case 'production_order_items':
      case 'production_stages':
      case 'landed_cost_allocations': {
        const rel = CHILD_PARENT_FILTER_MAP[collection]!;
        const rawParents = allCollections?.[rel.parentCollection] || this.getRawCollection(rel.parentCollection);
        const validParentIds = new Set(
          rawParents.filter(matchDirectOrg).map((p: any) => Number(p.id))
        );
        return items.filter((child) => {
          if (matchDirectOrg(child)) return true;
          const fkVal = this.extractRelationId(child?.[rel.foreignKey]);
          return fkVal !== undefined && validParentIds.has(fkVal);
        });
      }

      default:
        return items.filter(matchDirectOrg);
    }
  }

  /**
   * Asynchronous unified reader across Cloud (Directus), Desktop (SQLite), and Web (localStorage).
   */
  public static async readAllCollectionsAsync(orgId?: number): Promise<Record<BackupCollectionKey, any[]>> {
    const result: Record<string, any[]> = {};
    for (const col of BACKUP_COLLECTIONS) {
      result[col] = [];
    }

    try {
      const [{ storageManager }, { directusClient }] = await Promise.all([
        import('./index'),
        import('../api/directus'),
      ]);

      const mode = storageManager.getMode();

      // 1. Cloud Mode
      if (mode === 'cloud_synced' && directusClient.getToken()) {
        for (const col of BACKUP_COLLECTIONS) {
          try {
            let items: any[] = [];
            if (col === 'organizations') {
              items = await directusClient.getItems<any>('organizations', {
                filter: orgId ? { id: { _eq: orgId } } : undefined,
                limit: 100,
              });
            } else if (GLOBAL_CATALOG_COLLECTIONS.has(col)) {
              items = await directusClient.getItems<any>(col, { limit: 1000 });
            } else if (CHILD_PARENT_FILTER_MAP[col] && orgId) {
              const rel = CHILD_PARENT_FILTER_MAP[col]!;
              try {
                items = await directusClient.getItems<any>(col, {
                  filter: { organization_id: { _eq: orgId } },
                  limit: 5000,
                });
              } catch {
                // Fallback to filtering by already-fetched parent IDs if child lacks organization_id column in cloud
                const parentItems = result[rel.parentCollection] || [];
                const parentIds = parentItems.map((p) => Number(p.id)).filter((id) => Number.isFinite(id) && id > 0);
                if (parentIds.length > 0) {
                  items = await directusClient.getItems<any>(col, {
                    filter: { [rel.foreignKey]: { _in: parentIds } },
                    limit: 5000,
                  });
                }
              }
            } else {
              items = await directusClient.getItems<any>(col, {
                filter: orgId ? { organization_id: { _eq: orgId } } : undefined,
                limit: 5000,
              });
            }

            const normalized = Array.isArray(items) ? items.map((r) => this.normalizeCloudRecord(r)) : [];
            result[col] = orgId ? this.filterCollectionByOrg(col, normalized, orgId, result) : normalized;
          } catch {
            // Fall back to local cache for this collection if endpoint unavailable
            const localRaw = this.getRawCollection(col);
            result[col] = orgId ? this.filterCollectionByOrg(col, localRaw, orgId, result) : localRaw;
          }
        }
        return result as Record<BackupCollectionKey, any[]>;
      }

      // 2. Desktop Tauri SQLite Mode
      if (isTauriEnvironment()) {
        try {
          const Database = (await import('@tauri-apps/plugin-sql')).default;
          const db = await Database.load('sqlite:tankhor.db');
          for (const col of BACKUP_COLLECTIONS) {
            try {
              const rows =
                orgId && !GLOBAL_CATALOG_COLLECTIONS.has(col)
                  ? await db.select<{ data: string }[]>(
                      `SELECT data FROM ${col} WHERE organization_id = $1 OR organization_id IS NULL OR organization_id = 0`,
                      [orgId]
                    )
                  : await db.select<{ data: string }[]>(`SELECT data FROM ${col}`);

              const parsed = rows
                .map((r) => {
                  try {
                    return JSON.parse(r.data);
                  } catch {
                    return null;
                  }
                })
                .filter(Boolean);

              result[col] = orgId ? this.filterCollectionByOrg(col, parsed, orgId, result) : parsed;
            } catch {
              const fallback = this.getRawCollection(col);
              result[col] = orgId ? this.filterCollectionByOrg(col, fallback, orgId, result) : fallback;
            }
          }
          return result as Record<BackupCollectionKey, any[]>;
        } catch (sqliteErr) {
          console.warn('[BackupManager] Falling back to localStorage while reading collections:', sqliteErr);
        }
      }
    } catch (err) {
      console.warn('[BackupManager] Fallback to localStorage collections:', err);
    }

    // 3. Browser localStorage Mode
    for (const col of BACKUP_COLLECTIONS) {
      const raw = this.getRawCollection(col);
      result[col] = orgId ? this.filterCollectionByOrg(col, raw, orgId, result) : raw;
    }
    return result as Record<BackupCollectionKey, any[]>;
  }

  /**
   * Synchronous summary stats from localStorage (used by synchronous migration helpers)
   */
  public static getLocalStats(orgId?: number): Record<string, number> {
    const stats: Record<string, number> = {};
    const collected: Partial<Record<BackupCollectionKey, any[]>> = {};
    for (const key of BACKUP_COLLECTIONS) {
      const raw = this.getRawCollection(key);
      const filtered = orgId ? this.filterCollectionByOrg(key, raw, orgId, collected) : raw;
      collected[key] = filtered;
      stats[key] = filtered.length;
    }
    return stats;
  }

  /**
   * Asynchronous summary counts across Cloud, Desktop SQLite, and Web localStorage
   */
  public static async getBackupStatsAsync(orgId?: number): Promise<Record<string, number>> {
    const collections = await this.readAllCollectionsAsync(orgId);
    const stats: Record<string, number> = {};
    for (const key of BACKUP_COLLECTIONS) {
      stats[key] = collections[key]?.length || 0;
    }
    return stats;
  }

  private static buildBackupPayload(
    collections: Record<string, any[]>,
    organization?: { id: number; name: string; slug?: string } | null
  ): TankhorBackupFile {
    const data: Record<string, any[]> = {};
    const summary: Record<string, number> = {};
    let totalRecords = 0;

    for (const col of BACKUP_COLLECTIONS) {
      const scopedItems = Array.isArray(collections[col]) ? collections[col] : [];
      data[col] = scopedItems;
      summary[col] = scopedItems.length;
      totalRecords += scopedItems.length;
    }

    const now = new Date();
    const metadata: TankhorBackupMetadata = {
      app: 'TANKHOR (تن‌خور)',
      signature: 'tankhor_full_backup_v1',
      version: APP_VERSION || '1.2.0',
      exported_at: now.toISOString(),
      exported_at_jalali: formatDate(now.toISOString(), true),
      total_records: totalRecords,
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
          }
        : undefined,
      collections_summary: summary,
    };

    return { metadata, data };
  }

  /**
   * Synchronous localStorage backup generator (preserved for synchronous callers)
   */
  public static generateBackup(organization?: { id: number; name: string; slug?: string } | null): TankhorBackupFile {
    const collections: Record<string, any[]> = {};
    const orgId = organization?.id ? Number(organization.id) : undefined;

    for (const col of BACKUP_COLLECTIONS) {
      const rawItems = this.getRawCollection(col);
      collections[col] = orgId ? this.filterCollectionByOrg(col, rawItems, orgId, collections) : rawItems;
    }

    return this.buildBackupPayload(collections, organization);
  }

  /**
   * Asynchronous backup generator (supports Cloud, Desktop SQLite, and Browser localStorage)
   */
  public static async generateBackupAsync(
    organization?: { id: number; name: string; slug?: string } | null
  ): Promise<TankhorBackupFile> {
    const orgId = organization?.id ? Number(organization.id) : undefined;
    const collections = await this.readAllCollectionsAsync(orgId);
    return this.buildBackupPayload(collections, organization);
  }

  /**
   * Synchronous export backup file (localStorage only)
   */
  public static exportBackupFile(organization?: { id: number; name: string; slug?: string } | null): void {
    const backupObj = this.generateBackup(organization);
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const orgSlug = organization?.slug || 'tankhor';
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerBlobDownload(blob, `tankhor_backup_${orgSlug}_${dateStr}.json`);
  }

  /**
   * Asynchronous export backup file (reads live Cloud / SQLite / localStorage data)
   */
  public static async exportBackupFileAsync(
    organization?: { id: number; name: string; slug?: string } | null
  ): Promise<{ success: boolean; totalRecords: number; fileName: string }> {
    const backupObj = await this.generateBackupAsync(organization);
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const orgSlug = organization?.slug || 'tankhor';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `tankhor_backup_${orgSlug}_${dateStr}.json`;
    triggerBlobDownload(blob, fileName);
    return {
      success: true,
      totalRecords: backupObj.metadata.total_records,
      fileName,
    };
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
   * Restores data from a backup object with strict tenant isolation & SQLite/Cloud synchronization
   */
  public static async restoreBackup(
    backupData: Record<string, any[]>,
    mode: 'replace' | 'merge' = 'replace',
    targetOrgId?: number,
    skipCloudSync: boolean = false
  ): Promise<{ success: boolean; restoredCount: number; warning?: string; error?: string }> {
    try {
      let totalRestored = 0;
      const activeOrgId = Number(targetOrgId || localStorage.getItem('tankhor_active_org_id') || 1);
      const touchedCollections: BackupCollectionKey[] = [];

      for (const col of BACKUP_COLLECTIONS) {
        const incoming = backupData[col];
        if (!Array.isArray(incoming)) continue;

        // Global system_modules catalog: never strip/replace with empty array
        if (GLOBAL_CATALOG_COLLECTIONS.has(col)) {
          if (incoming.length > 0) {
            this.setRawCollection(col, incoming);
            touchedCollections.push(col);
            totalRestored += incoming.length;
          }
          continue;
        }

        // Preserve target organization identity while allowing org metadata updates when matching
        if (col === 'organizations') {
          if (incoming.length === 0) continue;
          const existingOrgs = this.getRawCollection('organizations');
          const otherOrgs = existingOrgs.filter((o) => Number(o?.id) !== activeOrgId);
          const matchingIncoming = incoming.find((o) => Number(o?.id) === activeOrgId) || incoming[0];
          const updatedActiveOrg = { ...matchingIncoming, id: activeOrgId };
          this.setRawCollection('organizations', [...otherOrgs, updatedActiveOrg]);
          touchedCollections.push(col);
          totalRestored += 1;
          continue;
        }

        // Remap tenant organization_id to activeOrgId so restored records appear under the current organization
        const normalizedIncoming = incoming
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            ...this.normalizeCloudRecord(item),
            organization_id: activeOrgId,
          }));

        if (mode === 'replace') {
          const existing = this.getRawCollection(col);
          const otherOrgsItems = existing.filter((item) => {
            const itemOrg = this.extractRelationId(item?.organization_id);
            return itemOrg !== undefined && itemOrg !== activeOrgId;
          });

          const finalCollection = [...otherOrgsItems, ...normalizedIncoming];
          this.setRawCollection(col, finalCollection);
          touchedCollections.push(col);
          totalRestored += normalizedIncoming.length;
        } else {
          // Merge mode: update matching IDs within activeOrgId or append new records
          const existing = this.getRawCollection(col);
          const existingIndexById = new Map<string, number>();
          existing.forEach((item, idx) => {
            const itemOrg = this.extractRelationId(item?.organization_id);
            if (itemOrg === undefined || itemOrg === activeOrgId) {
              existingIndexById.set(String(item.id), idx);
            }
          });
          const merged = [...existing];

          for (const item of normalizedIncoming) {
            const idStr = String(item.id);
            const idx = existingIndexById.get(idStr);
            if (idx !== undefined) {
              merged[idx] = { ...merged[idx], ...item, organization_id: activeOrgId };
            } else {
              merged.push(item);
              existingIndexById.set(idStr, merged.length - 1);
            }
          }

          this.setRawCollection(col, merged);
          touchedCollections.push(col);
          totalRestored += normalizedIncoming.length;
        }
      }

      if (activeOrgId) {
        localStorage.setItem('tankhor_active_org_id', String(activeOrgId));
      }

      // Desktop Tauri SQLite transactional synchronization
      let sqliteSynced = false;
      if (isTauriEnvironment()) {
        try {
          const Database = (await import('@tauri-apps/plugin-sql')).default;
          const db = await Database.load('sqlite:tankhor.db');
          await db.execute('BEGIN TRANSACTION');
          try {
            for (const col of BACKUP_COLLECTIONS) {
              if (!touchedCollections.includes(col) && mode !== 'replace') continue;
              if (GLOBAL_CATALOG_COLLECTIONS.has(col) && (!Array.isArray(backupData[col]) || backupData[col].length === 0)) {
                continue;
              }
              if (mode === 'replace' && col !== 'organizations' && col !== 'organization_users') {
                try {
                  await db.execute(
                    `DELETE FROM ${col} WHERE organization_id = $1 OR organization_id IS NULL OR organization_id = 0`,
                    [activeOrgId]
                  );
                } catch {}
              }
              const currentItems = this.getRawCollection(col);
              for (const item of currentItems) {
                if (!item || !item.id) continue;
                const itemOrgId =
                  col === 'organizations'
                    ? Number(item.id)
                    : this.extractRelationId(item.organization_id) || activeOrgId;
                if (itemOrgId !== activeOrgId && col !== 'organizations' && !GLOBAL_CATALOG_COLLECTIONS.has(col)) {
                  continue;
                }
                await db.execute(
                  `INSERT OR REPLACE INTO ${col} (id, organization_id, data, date_updated) VALUES ($1, $2, $3, datetime('now'))`,
                  [item.id, itemOrgId, JSON.stringify(item)]
                );
              }
            }
            await db.execute('COMMIT');
            sqliteSynced = true;
          } catch (txErr) {
            await db.execute('ROLLBACK');
            throw txErr;
          }
        } catch (dbErr) {
          console.warn('[BackupManager] SQLite sync warning during restore:', dbErr);
        }
      }

      // Sync with Cloud ONLY when actively operating in cloud_synced mode (unless skipped)
      let warning: string | undefined;
      if (!skipCloudSync) {
        try {
          const [{ storageManager }, { directusClient }] = await Promise.all([
            import('./index'),
            import('../api/directus'),
          ]);
          if (storageManager.getMode() === 'cloud_synced' && Boolean(directusClient.getToken())) {
            const { CloudMigrationManager } = await import('./cloudMigrationManager');
            const cloudRes = await CloudMigrationManager.migrateLocalToCloud(activeOrgId);
            if (!cloudRes.success && cloudRes.errors.length > 0) {
              warning = `بازیابی محلی انجام شد اما همگام‌سازی برخی موارد با سرور ابری با خطا مواجه شد: ${cloudRes.errors[0]}`;
            }
          }
        } catch (cloudErr: any) {
          console.warn('[BackupManager] Cloud sync warning during restore:', cloudErr);
          warning = `بازیابی محلی انجام شد اما همگام‌سازی ابری کامل نشد: ${cloudErr?.message || ''}`;
        }
      }

      // Notify the application
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tankhor_data_restored', {
            detail: {
              timestamp: new Date().toISOString(),
              mode,
              count: totalRestored,
              skipSqliteSync: sqliteSynced,
            },
          })
        );
      }

      return { success: true, restoredCount: totalRestored, warning };
    } catch (e: any) {
      return { success: false, restoredCount: 0, error: e.message || 'خطا در بازیابی اطلاعات' };
    }
  }

  private static buildCsvFromItems(collectionName: BackupCollectionKey, items: any[]): CsvExportResult {
    if (!items || items.length === 0) {
      return {
        success: false,
        count: 0,
        message: 'داده‌ای در این بخش برای خروجی اکسل وجود ندارد.',
      };
    }

    const allKeys = Array.from(new Set(items.flatMap((item) => (item && typeof item === 'object' ? Object.keys(item) : []))));
    // Keep any field unless every non-null occurrence is an array or plain non-id nested object
    const exportKeys = allKeys.filter((k) => {
      for (const item of items) {
        const val = item?.[k];
        if (val === null || val === undefined) continue;
        if (Array.isArray(val)) return false;
        if (typeof val === 'object') {
          return 'id' in val || 'name' in val || 'title' in val;
        }
        return true;
      }
      return true;
    });

    const formatCell = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        if ('name' in val && val.name) return String(val.name);
        if ('title' in val && val.title) return String(val.title);
        if ('id' in val) return String(val.id);
        return '';
      }
      return String(val);
    };

    const csvRows: string[] = [];
    csvRows.push(exportKeys.map((k) => escapeCsvCell(k)).join(','));

    for (const item of items) {
      const row = exportKeys.map((k) => escapeCsvCell(formatCell(item?.[k])));
      csvRows.push(row.join(','));
    }

    const fileName = `tankhor_${collectionName}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsvContent(csvRows.join('\n'), fileName);

    return {
      success: true,
      count: items.length,
      message: `خروجی CSV با ${items.length} ردیف با موفقیت دانلود شد.`,
    };
  }

  /**
   * Synchronous single-collection CSV export from localStorage (no alert())
   */
  public static exportToCsv(collectionName: BackupCollectionKey, orgId?: number): CsvExportResult {
    let items = this.getRawCollection(collectionName);
    if (orgId) {
      items = this.filterCollectionByOrg(collectionName, items, orgId);
    }
    return this.buildCsvFromItems(collectionName, items);
  }

  /**
   * Asynchronous single-collection CSV export across Cloud, SQLite, and localStorage
   */
  public static async exportToCsvAsync(collectionName: BackupCollectionKey, orgId?: number): Promise<CsvExportResult> {
    const collections = await this.readAllCollectionsAsync(orgId);
    const items = collections[collectionName] || [];
    return this.buildCsvFromItems(collectionName, items);
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
        this.setRawCollection('organizations', [...orgs, targetOrg]);
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
        { id: 501, organization_id: activeOrgId, name: 'مشکی مات', hex: '#18181b', hex_code: '#18181b', status: 'active' },
        { id: 502, organization_id: activeOrgId, name: 'کرم نسکافه‌ای', hex: '#d4b996', hex_code: '#d4b996', status: 'active' },
        { id: 503, organization_id: activeOrgId, name: 'طوسی ملانژ', hex: '#9ca3af', hex_code: '#9ca3af', status: 'active' },
        { id: 504, organization_id: activeOrgId, name: 'سبز سدری', hex: '#5b7065', hex_code: '#5b7065', status: 'active' },
        { id: 505, organization_id: activeOrgId, name: 'سرمه‌ای تیره', hex: '#1e293b', hex_code: '#1e293b', status: 'active' },
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
          status: 'published',
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
          status: 'published',
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
          status: 'published',
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
          status: 'published',
          date_created: new Date().toISOString(),
        },
      ];
      this.setRawCollection('products', products);

      // 8. Variants & Inventory
      const variants = [
        { id: 2001, organization_id: activeOrgId, product_id: 1001, sku: 'COAT-BLK-M', barcode: '626100101', color_id: 501, size_id: 702, price: 3450000, regular_price: 3850000, sale_price: 3450000, cost: 1950000, cost_price: 1950000, status: 'active' },
        { id: 2002, organization_id: activeOrgId, product_id: 1001, sku: 'COAT-BLK-L', barcode: '626100102', color_id: 501, size_id: 703, price: 3450000, regular_price: 3850000, sale_price: 3450000, cost: 1950000, cost_price: 1950000, status: 'active' },
        { id: 2003, organization_id: activeOrgId, product_id: 1001, sku: 'COAT-CRM-M', barcode: '626100103', color_id: 502, size_id: 702, price: 3850000, regular_price: 3850000, sale_price: 3850000, cost: 1950000, cost_price: 1950000, status: 'active' },
        { id: 2004, organization_id: activeOrgId, product_id: 1002, sku: 'HD-GRY-L', barcode: '626100201', color_id: 503, size_id: 703, price: 1250000, regular_price: 1450000, sale_price: 1250000, cost: 680000, cost_price: 680000, status: 'active' },
        { id: 2005, organization_id: activeOrgId, product_id: 1002, sku: 'HD-GRY-XL', barcode: '626100202', color_id: 503, size_id: 704, price: 1250000, regular_price: 1450000, sale_price: 1250000, cost: 680000, cost_price: 680000, status: 'active' },
        { id: 2006, organization_id: activeOrgId, product_id: 1002, sku: 'HD-GRN-L', barcode: '626100203', color_id: 504, size_id: 703, price: 1450000, regular_price: 1450000, sale_price: 1450000, cost: 680000, cost_price: 680000, status: 'active' },
        { id: 2007, organization_id: activeOrgId, product_id: 1003, sku: 'JEAN-BLU-38', barcode: '626100301', color_id: 505, size_id: 705, price: 1890000, regular_price: 1890000, sale_price: 1890000, cost: 920000, cost_price: 920000, status: 'active' },
        { id: 2008, organization_id: activeOrgId, product_id: 1003, sku: 'JEAN-BLU-40', barcode: '626100302', color_id: 505, size_id: 706, price: 1890000, regular_price: 1890000, sale_price: 1890000, cost: 920000, cost_price: 920000, status: 'active' },
        { id: 2009, organization_id: activeOrgId, product_id: 1004, sku: 'SHOE-WHT-38', barcode: '626100401', color_id: 502, size_id: 708, price: 2950000, regular_price: 2950000, sale_price: 2950000, cost: 1450000, cost_price: 1450000, status: 'active' },
        { id: 2010, organization_id: activeOrgId, product_id: 1004, sku: 'SHOE-WHT-39', barcode: '626100402', color_id: 502, size_id: 709, price: 2950000, regular_price: 2950000, sale_price: 2950000, cost: 1450000, cost_price: 1450000, status: 'active' },
      ];
      this.setRawCollection('product_variants', variants);

      const inventory = [
        { id: 3001, organization_id: activeOrgId, variant_id: 2001, warehouse_id: 801, location_id: 901, quantity: 18, reserved_quantity: 2, available_quantity: 16, damaged_quantity: 0, reorder_point: 5, safety_stock: 5 },
        { id: 3002, organization_id: activeOrgId, variant_id: 2002, warehouse_id: 801, location_id: 901, quantity: 12, reserved_quantity: 0, available_quantity: 12, damaged_quantity: 0, reorder_point: 5, safety_stock: 4 },
        { id: 3003, organization_id: activeOrgId, variant_id: 2003, warehouse_id: 802, location_id: 903, quantity: 8, reserved_quantity: 1, available_quantity: 7, damaged_quantity: 0, reorder_point: 5, safety_stock: 3 },
        { id: 3004, organization_id: activeOrgId, variant_id: 2004, warehouse_id: 801, location_id: 901, quantity: 35, reserved_quantity: 4, available_quantity: 31, damaged_quantity: 0, reorder_point: 10, safety_stock: 10 },
        { id: 3005, organization_id: activeOrgId, variant_id: 2005, warehouse_id: 801, location_id: 901, quantity: 24, reserved_quantity: 2, available_quantity: 22, damaged_quantity: 0, reorder_point: 8, safety_stock: 8 },
        { id: 3006, organization_id: activeOrgId, variant_id: 2006, warehouse_id: 802, location_id: 903, quantity: 15, reserved_quantity: 0, available_quantity: 15, damaged_quantity: 0, reorder_point: 5, safety_stock: 5 },
        { id: 3007, organization_id: activeOrgId, variant_id: 2007, warehouse_id: 801, location_id: 902, quantity: 28, reserved_quantity: 3, available_quantity: 25, damaged_quantity: 0, reorder_point: 6, safety_stock: 6 },
        { id: 3008, organization_id: activeOrgId, variant_id: 2008, warehouse_id: 801, location_id: 902, quantity: 20, reserved_quantity: 1, available_quantity: 19, damaged_quantity: 0, reorder_point: 6, safety_stock: 6 },
        { id: 3009, organization_id: activeOrgId, variant_id: 2009, warehouse_id: 802, location_id: 903, quantity: 10, reserved_quantity: 0, available_quantity: 10, damaged_quantity: 0, reorder_point: 3, safety_stock: 3 },
        { id: 3010, organization_id: activeOrgId, variant_id: 2010, warehouse_id: 802, location_id: 903, quantity: 14, reserved_quantity: 1, available_quantity: 13, damaged_quantity: 0, reorder_point: 4, safety_stock: 4 },
      ];
      this.setRawCollection('inventory_items', inventory);

      // 9. Customers
      const customers = [
        { id: 4001, organization_id: activeOrgId, name: 'سارا محمدی', first_name: 'سارا', last_name: 'محمدی', phone: '09121112233', email: 'sara.m@gmail.com', city: 'تهران', address: 'نیاوران، خ مژده، پلاک ۱۲', status: 'active', total_orders: 4, total_spent: 9800000 },
        { id: 4002, organization_id: activeOrgId, name: 'امیرحسین کریمی', first_name: 'امیرحسین', last_name: 'کریمی', phone: '09354445566', email: 'a.karimi@yahoo.com', city: 'اصفهان', address: 'چهارباغ عباسی، مجتمع افتخار', status: 'active', total_orders: 2, total_spent: 4200000 },
        { id: 4003, organization_id: activeOrgId, name: 'مریم صادقی', first_name: 'مریم', last_name: 'صادقی', phone: '09198889900', email: 'maryam.s@gmail.com', city: 'شیراز', address: 'قدوسی غربی، کوچه ۸', status: 'active', total_orders: 1, total_spent: 3450000 },
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
          subtotal: 4700000,
          discount: 200000,
          tax: 0,
          total: 4500000,
          paid_amount: 4500000,
          order_date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          date_created: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          payment_method: 'card',
          warehouse_id: 801,
        },
        {
          id: 5002,
          organization_id: activeOrgId,
          order_number: 'ORD-1403-1002',
          customer_id: 4002,
          status: 'processing',
          payment_status: 'paid',
          subtotal: 1890000,
          discount: 0,
          tax: 0,
          total: 1890000,
          paid_amount: 1890000,
          order_date: new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10),
          date_created: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
          payment_method: 'online',
          warehouse_id: 801,
        },
      ];
      this.setRawCollection('orders', orders);

      const orderItems = [
        { id: 6001, organization_id: activeOrgId, order_id: 5001, variant_id: 2001, quantity: 1, unit_price: 3450000, discount: 0, total: 3450000 },
        { id: 6002, organization_id: activeOrgId, order_id: 5001, variant_id: 2004, quantity: 1, unit_price: 1250000, discount: 0, total: 1250000 },
        { id: 6003, organization_id: activeOrgId, order_id: 5002, variant_id: 2007, quantity: 1, unit_price: 1890000, discount: 0, total: 1890000 },
      ];
      this.setRawCollection('order_items', orderItems);

      // 11. Size Guide Templates & Measurements
      const sizeGuides = [
        { id: 7001, organization_id: activeOrgId, name: 'راهنمای سایز پالتو و بارانی زنانه', title: 'راهنمای سایز پالتو و بارانی زنانه', type: 'apparel', template_type: 'apparel', category_id: 101, unit: 'cm', status: 'active', description: 'مناسب انواع پالتو و بارانی زمستانه' },
        { id: 7002, organization_id: activeOrgId, name: 'جدول ابعاد هودی و دورس اورسایز', title: 'جدول ابعاد هودی و دورس اورسایز', type: 'apparel', template_type: 'apparel', category_id: 102, unit: 'cm', status: 'active', description: 'قالب آزاد و راحت مخصوص هودی و دورس' },
      ];
      this.setRawCollection('size_guide_templates', sizeGuides);

      const measurements = [
        { id: 8001, organization_id: activeOrgId, template_id: 7001, name: 'دور سینه', code: 'chest', unit: 'cm', type: 'circumference', status: 'active', sort: 1, description: 'اندازه‌گیری از برجسته‌ترین قسمت سینه' },
        { id: 8002, organization_id: activeOrgId, template_id: 7001, name: 'عرض شانه', code: 'shoulder', unit: 'cm', type: 'width', status: 'active', sort: 2, description: 'از نوک استخوان شانه چپ تا راست' },
        { id: 8003, organization_id: activeOrgId, template_id: 7001, name: 'قد آستین', code: 'sleeve', unit: 'cm', type: 'length', status: 'active', sort: 3, description: 'از سرشانه تا روی مچ دست' },
        { id: 8004, organization_id: activeOrgId, template_id: 7001, name: 'قد کل لباس', code: 'length', unit: 'cm', type: 'length', status: 'active', sort: 4, description: 'از کنار گردن تا لبه پایین پالتو' },
      ];
      this.setRawCollection('size_guide_measurements', measurements);

      const values = [
        { id: 9001, organization_id: activeOrgId, template_id: 7001, measurement_id: 8001, size_id: 702, value: 94, value_exact: 94 },
        { id: 9002, organization_id: activeOrgId, template_id: 7001, measurement_id: 8001, size_id: 703, value: 100, value_exact: 100 },
        { id: 9003, organization_id: activeOrgId, template_id: 7001, measurement_id: 8002, size_id: 702, value: 40, value_exact: 40 },
        { id: 9004, organization_id: activeOrgId, template_id: 7001, measurement_id: 8002, size_id: 703, value: 43, value_exact: 43 },
        { id: 9005, organization_id: activeOrgId, template_id: 7001, measurement_id: 8003, size_id: 702, value: 60, value_exact: 60 },
        { id: 9006, organization_id: activeOrgId, template_id: 7001, measurement_id: 8003, size_id: 703, value: 62, value_exact: 62 },
        { id: 9007, organization_id: activeOrgId, template_id: 7001, measurement_id: 8004, size_id: 702, value: 110, value_exact: 110 },
        { id: 9008, organization_id: activeOrgId, template_id: 7001, measurement_id: 8004, size_id: 703, value: 112, value_exact: 112 },
      ];
      this.setRawCollection('size_guide_values', values);

      // 12. Inventory Movements
      const movements = [
        { id: 10001, organization_id: activeOrgId, variant_id: 2001, warehouse_id: 801, type: 'purchase', quantity: 20, reference_type: 'manual', reference_id: 'PO-1403-01', created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() },
        { id: 10002, organization_id: activeOrgId, variant_id: 2001, warehouse_id: 801, type: 'sale', quantity: 2, reference_type: 'order', reference_id: 'ORD-1403-1001', created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
        { id: 10003, organization_id: activeOrgId, variant_id: 2004, warehouse_id: 801, type: 'sale', quantity: 1, reference_type: 'order', reference_id: 'ORD-1403-1001', created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
        { id: 10004, organization_id: activeOrgId, variant_id: 2007, warehouse_id: 801, type: 'sale', quantity: 1, reference_type: 'order', reference_id: 'ORD-1403-1002', created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
      ];
      this.setRawCollection('inventory_movements', movements);

      // Desktop SQLite sync inside transaction
      let sqliteSynced = false;
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
            ['inventory_movements', movements],
            ['customers', customers],
            ['orders', orders],
            ['order_items', orderItems],
            ['size_guide_templates', sizeGuides],
            ['size_guide_measurements', measurements],
            ['size_guide_values', values],
          ];

          await db.execute('BEGIN TRANSACTION');
          try {
            for (const [col, items] of allSeeded) {
              if (col !== 'organizations') {
                await db.execute(
                  `DELETE FROM ${col} WHERE organization_id = $1 OR organization_id IS NULL OR organization_id = 0`,
                  [activeOrgId]
                );
              }
              for (const item of items) {
                const orgId = this.extractRelationId(item.organization_id) || activeOrgId;
                await db.execute(
                  `INSERT OR REPLACE INTO ${col} (id, organization_id, data, date_updated) VALUES ($1, $2, $3, datetime('now'))`,
                  [item.id, orgId, JSON.stringify(item)]
                );
              }
            }
            await db.execute('COMMIT');
            sqliteSynced = true;
          } catch (txErr) {
            await db.execute('ROLLBACK');
            throw txErr;
          }
        } catch (dbErr) {
          console.warn('[BackupManager] SQLite sync warning during demo seed:', dbErr);
        }
      }

      // Sync with Cloud ONLY if currently in Cloud Mode
      try {
        const { storageManager } = await import('./index');
        if (storageManager.getMode() === 'cloud_synced') {
          const { CloudMigrationManager } = await import('./cloudMigrationManager');
          await CloudMigrationManager.migrateLocalToCloud(activeOrgId);
        }
      } catch (cloudErr) {
        console.warn('[BackupManager] Cloud sync warning during demo seed:', cloudErr);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tankhor_data_restored', {
            detail: { timestamp: new Date().toISOString(), type: 'demo_seeded', skipSqliteSync: sqliteSynced },
          })
        );
      }

      return { success: true, message: 'داده‌های دمو صنف پوشاک با موفقیت در پایگاه داده بارگذاری شد.' };
    } catch (e: any) {
      return { success: false, message: `خطا در بارگذاری داده‌های دمو: ${e.message}` };
    }
  }

  /**
   * Resets local collections for a specific organization
   */
  public static async clearLocalData(
    preserveOrganization: boolean = true,
    targetOrgId?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const activeOrgId = Number(targetOrgId || localStorage.getItem('tankhor_active_org_id') || 1);
      const orgs = this.getRawCollection('organizations');
      const activeOrg = orgs.find((o) => Number(o.id) === activeOrgId);

      for (const col of BACKUP_COLLECTIONS) {
        if (GLOBAL_CATALOG_COLLECTIONS.has(col)) continue;
        if (preserveOrganization && (col === 'organizations' || col === 'organization_users')) {
          continue;
        }

        const existing = this.getRawCollection(col);
        const otherOrgsItems = existing.filter((item) => {
          const itemOrg = this.extractRelationId(item?.organization_id);
          return itemOrg !== undefined && itemOrg !== activeOrgId;
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

      let sqliteCleared = false;
      if (isTauriEnvironment()) {
        try {
          const Database = (await import('@tauri-apps/plugin-sql')).default;
          const db = await Database.load('sqlite:tankhor.db');
          await db.execute('BEGIN TRANSACTION');
          try {
            for (const col of BACKUP_COLLECTIONS) {
              if (GLOBAL_CATALOG_COLLECTIONS.has(col)) continue;
              if (preserveOrganization && (col === 'organizations' || col === 'organization_users')) {
                continue;
              }
              try {
                await db.execute(
                  `DELETE FROM ${col} WHERE organization_id = $1 OR organization_id IS NULL OR organization_id = 0`,
                  [activeOrgId]
                );
              } catch {}
            }
            await db.execute('COMMIT');
            sqliteCleared = true;
          } catch (txErr) {
            await db.execute('ROLLBACK');
            throw txErr;
          }
        } catch (dbErr) {
          console.warn('[BackupManager] SQLite clear warning:', dbErr);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tankhor_data_restored', {
            detail: { timestamp: new Date().toISOString(), type: 'cleared', skipSqliteSync: sqliteCleared },
          })
        );
      }

      return { success: true, message: 'اطلاعات محلی سازمان با موفقیت پاکسازی شد.' };
    } catch (e: any) {
      return { success: false, message: `خطا در پاکسازی داده‌ها: ${e.message}` };
    }
  }
}
