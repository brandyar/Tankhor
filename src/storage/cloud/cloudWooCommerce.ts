import { CloudStorageBase } from './cloudBase';
import { QueryParams } from '../types';
import {
  WooCommerceSettings,
  WooCommerceLog,
  IntegrationMapping,
} from '../../types';

export class CloudWooCommerceStorage {
  constructor(private base: CloudStorageBase) {}

  // WooCommerce Integration (ماژول همگام‌سازی ووکامرس)
  async getWooCommerceSettings(params?: QueryParams): Promise<WooCommerceSettings | null> {
    try {
      const items = await this.base.client.getItems<WooCommerceSettings>('woocommerce_settings', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        limit: 1,
      });
      if (Array.isArray(items) && items.length > 0) {
        await this.base.localAdapter.saveWooCommerceSettings(items[0]);
        return items[0];
      }
      return await this.base.localAdapter.getWooCommerceSettings(params);
    } catch {
      return await this.base.localAdapter.getWooCommerceSettings(params);
    }
  }

  async saveWooCommerceSettings(settings: Partial<WooCommerceSettings>): Promise<WooCommerceSettings> {
    try {
      if (settings.id) {
        const updated = await this.base.client.updateItem<WooCommerceSettings>('woocommerce_settings', settings.id, settings);
        const result = { ...settings, ...updated };
        await this.base.localAdapter.saveWooCommerceSettings(result);
        return result;
      } else {
        const created = await this.base.client.createItem<WooCommerceSettings>('woocommerce_settings', settings);
        const result = { ...settings, ...created };
        await this.base.localAdapter.saveWooCommerceSettings(result);
        return result;
      }
    } catch (err: any) {
      console.warn('[CloudWooCommerceStorage] saveWooCommerceSettings fallback to local:', err?.message || err);
      const saved = await this.base.localAdapter.saveWooCommerceSettings(settings);
      this.base.syncManager.enqueue({ action: settings.id ? 'UPDATE' : 'CREATE', collection: 'woocommerce_settings', payload: saved });
      return saved;
    }
  }

  async getWooCommerceLogs(params?: QueryParams & { limit?: number }): Promise<WooCommerceLog[]> {
    try {
      const items = await this.base.client.getItems<WooCommerceLog>('woocommerce_logs', {
        sort: '-id',
        limit: params?.limit || 50,
      });
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await this.base.localAdapter.addWooCommerceLog(item);
        }
        return await this.base.localAdapter.getWooCommerceLogs(params);
      }
      return await this.base.localAdapter.getWooCommerceLogs(params);
    } catch {
      return await this.base.localAdapter.getWooCommerceLogs(params);
    }
  }

  async addWooCommerceLog(log: Partial<WooCommerceLog>): Promise<WooCommerceLog> {
    try {
      const created = await this.base.client.createItem<WooCommerceLog>('woocommerce_logs', log);
      const result = { ...log, ...created } as WooCommerceLog;
      await this.base.localAdapter.addWooCommerceLog(result);
      return result;
    } catch {
      return await this.base.localAdapter.addWooCommerceLog(log);
    }
  }

  async getIntegrationMappings(params?: QueryParams & { entity_type?: string }): Promise<IntegrationMapping[]> {
    try {
      const query: any = {};
      if (params?.entity_type) {
        query.filter = { entity_type: { _eq: params.entity_type } };
      }
      const items = await this.base.client.getItems<IntegrationMapping>('woocommerce_mappings', query);
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await this.base.localAdapter.saveIntegrationMapping(item);
        }
        return await this.base.localAdapter.getIntegrationMappings(params);
      }
      return await this.base.localAdapter.getIntegrationMappings(params);
    } catch {
      return await this.base.localAdapter.getIntegrationMappings(params);
    }
  }

  async saveIntegrationMapping(mapping: Partial<IntegrationMapping>): Promise<IntegrationMapping> {
    try {
      if (mapping.id) {
        const updated = await this.base.client.updateItem<IntegrationMapping>('woocommerce_mappings', mapping.id, mapping);
        const result = { ...mapping, ...updated };
        await this.base.localAdapter.saveIntegrationMapping(result);
        return result;
      } else {
        const created = await this.base.client.createItem<IntegrationMapping>('woocommerce_mappings', mapping);
        const result = { ...mapping, ...created };
        await this.base.localAdapter.saveIntegrationMapping(result);
        return result;
      }
    } catch {
      return await this.base.localAdapter.saveIntegrationMapping(mapping);
    }
  }
}
