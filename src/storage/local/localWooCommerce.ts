import { QueryParams } from '../types';
import { LocalStorageBase } from './localBase';
import { normalizeId } from '../../utils/formatters';
import {
  WooCommerceSettings,
  WooCommerceLog,
  IntegrationMapping
} from '../../types';

export class LocalWooCommerceStorage {
  constructor(private base: LocalStorageBase) {}

  async getWooCommerceSettings(params?: QueryParams): Promise<WooCommerceSettings | null> {
    const list = this.base.getItem<WooCommerceSettings>('woocommerce_settings', []);
    const orgId = this.base.getActiveOrgId(params);
    if (!orgId) return null;
    const found = list.find((item) => normalizeId(item.organization_id) === orgId);
    return found || null;
  }

  async saveWooCommerceSettings(settings: Partial<WooCommerceSettings>): Promise<WooCommerceSettings> {
    const list = this.base.getItem<WooCommerceSettings>('woocommerce_settings', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(settings.organization_id) });
    if (!orgId) throw new Error('Active organization ID required');

    const existingIdx = list.findIndex((item) => normalizeId(item.organization_id) === orgId);
    let saved: WooCommerceSettings;

    if (existingIdx !== -1) {
      saved = {
        ...list[existingIdx],
        ...settings,
        organization_id: orgId,
        date_updated: new Date().toISOString(),
      };
      list[existingIdx] = saved;
    } else {
      const nextId = this.base.generateUniqueId(list as any);
      saved = {
        id: nextId,
        organization_id: orgId,
        site_url: settings.site_url || '',
        consumer_key: settings.consumer_key || '',
        consumer_secret: settings.consumer_secret || '',
        warehouse_id: settings.warehouse_id || null,
        financial_account_id: settings.financial_account_id || null,
        default_customer_id: settings.default_customer_id || null,
        auto_sync_stock: settings.auto_sync_stock ?? false,
        auto_sync_price: settings.auto_sync_price ?? false,
        auto_import_orders: settings.auto_import_orders ?? false,
        sync_status: settings.sync_status || 'idle',
        last_sync_at: settings.last_sync_at || null,
        last_order_import_at: settings.last_order_import_at || null,
        webhook_secret: settings.webhook_secret || null,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      };
      list.push(saved);
    }

    this.base.setItem('woocommerce_settings', list);
    return saved;
  }

  async getWooCommerceLogs(params?: QueryParams & { limit?: number }): Promise<WooCommerceLog[]> {
    const list = this.base.getItem<WooCommerceLog>('woocommerce_logs', []);
    const orgId = this.base.getActiveOrgId(params);
    let filtered = list;
    if (orgId) {
      filtered = filtered.filter((log) => normalizeId(log.organization_id) === orgId);
    }
    filtered.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
    if (params?.limit && params.limit > 0) {
      filtered = filtered.slice(0, params.limit);
    }
    return filtered;
  }

  async addWooCommerceLog(log: Partial<WooCommerceLog>): Promise<WooCommerceLog> {
    const list = this.base.getItem<WooCommerceLog>('woocommerce_logs', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(log.organization_id) });
    if (!orgId) throw new Error('Active organization ID required for log');

    const nextId = this.base.generateUniqueId(list as any);
    const newLog: WooCommerceLog = {
      id: nextId,
      organization_id: orgId,
      action: log.action || 'test_connection',
      direction: log.direction || 'outbound',
      status: log.status || 'info',
      message: log.message || '',
      details: log.details || null,
      date_created: log.date_created || new Date().toISOString(),
    };

    list.unshift(newLog);
    if (list.length > 500) {
      list.length = 500;
    }
    this.base.setItem('woocommerce_logs', list);
    return newLog;
  }

  async getIntegrationMappings(params?: QueryParams & { entity_type?: string }): Promise<IntegrationMapping[]> {
    const list = this.base.getItem<IntegrationMapping>('woocommerce_mappings', []);
    const orgId = this.base.getActiveOrgId(params);
    let filtered = list;
    if (orgId) {
      filtered = filtered.filter((m) => normalizeId(m.organization_id) === orgId);
    }
    if (params?.entity_type) {
      filtered = filtered.filter((m) => m.entity_type === params.entity_type);
    }
    return filtered;
  }

  async saveIntegrationMapping(mapping: Partial<IntegrationMapping>): Promise<IntegrationMapping> {
    const list = this.base.getItem<IntegrationMapping>('woocommerce_mappings', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(mapping.organization_id) });
    if (!orgId) throw new Error('Active organization ID required');

    const existingIdx = list.findIndex(
      (m) =>
        normalizeId(m.organization_id) === orgId &&
        m.entity_type === mapping.entity_type &&
        (m.tankhor_id === mapping.tankhor_id || String(m.external_id) === String(mapping.external_id))
    );

    let saved: IntegrationMapping;
    if (existingIdx !== -1) {
      saved = {
        ...list[existingIdx],
        ...mapping,
        organization_id: orgId,
        last_synced_at: new Date().toISOString(),
      };
      list[existingIdx] = saved;
    } else {
      const nextId = this.base.generateUniqueId(list as any);
      saved = {
        id: nextId,
        organization_id: orgId,
        entity_type: mapping.entity_type || 'variant',
        tankhor_id: mapping.tankhor_id!,
        external_id: mapping.external_id!,
        sku: mapping.sku || null,
        last_synced_at: new Date().toISOString(),
        sync_status: mapping.sync_status || 'synced',
      };
      list.push(saved);
    }

    this.base.setItem('woocommerce_mappings', list);
    return saved;
  }
}
