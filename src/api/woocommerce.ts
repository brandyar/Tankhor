import { directusClient } from './directus';

export interface TestConnectionResult {
  success: boolean;
  store_name?: string;
  wc_version?: string;
  currency?: string;
  url?: string;
  error?: string;
}

export interface SyncStockResult {
  success: boolean;
  totalVariants?: number;
  matchedCount?: number;
  updatedCount?: number;
  missingSkuCount?: number;
  errors?: string[];
  error?: string;
}

export interface SyncPricesResult {
  success: boolean;
  updatedCount?: number;
  error?: string;
}

export interface ImportOrdersResult {
  success: boolean;
  fetchedOrdersCount?: number;
  importedOrdersCount?: number;
  skippedCount?: number;
  importedOrderIds?: number[];
  errors?: string[];
  error?: string;
}

export async function testWooCommerceConnection(params: {
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
}): Promise<TestConnectionResult> {
  const baseUrl = directusClient.getBaseUrl();
  const url = `${baseUrl}/woocommerce/test-connection`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => ({ success: false, error: 'خطای نامشخص از سمت سرور' }));
  return data;
}

export async function syncStockToWooCommerce(params: {
  organization_id: number;
  warehouse_id?: number | null;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
}): Promise<SyncStockResult> {
  const baseUrl = directusClient.getBaseUrl();
  const url = `${baseUrl}/woocommerce/sync-stock`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => ({ success: false, error: 'خطای نامشخص در ارتباط با سرور' }));
  return data;
}

export async function syncPricesToWooCommerce(params: {
  organization_id: number;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
}): Promise<SyncPricesResult> {
  const baseUrl = directusClient.getBaseUrl();
  const url = `${baseUrl}/woocommerce/sync-prices`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => ({ success: false, error: 'خطای نامشخص در ارتباط با سرور' }));
  return data;
}

export async function importOrdersFromWooCommerce(params: {
  organization_id: number;
  warehouse_id?: number | null;
  financial_account_id?: number | null;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
}): Promise<ImportOrdersResult> {
  const baseUrl = directusClient.getBaseUrl();
  const url = `${baseUrl}/woocommerce/import-orders`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => ({ success: false, error: 'خطای نامشخص در ارتباط با سرور' }));
  return data;
}
