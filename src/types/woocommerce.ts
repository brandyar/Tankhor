/**
 * TANKHOR (تن‌خور) - WooCommerce Integration Types
 */

import { Organization } from './index';

export type WooCommerceSyncStatus = 'idle' | 'syncing' | 'error' | 'success';

export interface WooCommerceSettings {
  id?: number;
  organization_id: number | Organization;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
  warehouse_id?: number | null;
  financial_account_id?: number | null;
  default_customer_id?: number | null;
  auto_sync_stock: boolean;
  auto_sync_price: boolean;
  auto_import_orders: boolean;
  sync_status?: WooCommerceSyncStatus;
  last_sync_at?: string | null;
  last_order_import_at?: string | null;
  webhook_secret?: string | null;
  date_created?: string;
  date_updated?: string;
}

export type WooCommerceLogAction =
  | 'test_connection'
  | 'sync_stock'
  | 'sync_prices'
  | 'import_orders'
  | 'webhook_order';

export type WooCommerceLogDirection = 'inbound' | 'outbound';
export type WooCommerceLogStatus = 'success' | 'error' | 'info';

export interface WooCommerceLog {
  id?: number;
  organization_id: number | Organization;
  action: WooCommerceLogAction;
  direction: WooCommerceLogDirection;
  status: WooCommerceLogStatus;
  message: string;
  details?: any;
  date_created: string;
}

export type IntegrationEntityType = 'variant' | 'product' | 'order';

export interface IntegrationMapping {
  id?: number;
  organization_id: number | Organization;
  entity_type: IntegrationEntityType;
  tankhor_id: number;
  external_id: number | string;
  sku?: string | null;
  last_synced_at?: string;
  sync_status?: 'synced' | 'pending' | 'error';
}

export interface WooCommerceTestConnectionResult {
  success: boolean;
  message?: string;
  store_name?: string;
  wc_version?: string;
  currency?: string;
  url?: string;
}

export interface WooCommerceSyncStockResult {
  success: boolean;
  totalVariants: number;
  matchedCount: number;
  updatedCount: number;
  missingSkuCount: number;
  errors: string[];
}

export interface WooCommerceImportOrdersResult {
  success: boolean;
  fetchedOrdersCount: number;
  importedOrdersCount: number;
  skippedCount: number;
  errors: string[];
  importedOrderIds: number[];
}
