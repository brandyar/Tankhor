/**
 * Client-Side Stale-While-Revalidate (SWR) Cache & Request Deduplicator
 *
 * - Deduplicates concurrent identical GET requests (in-flight sharing)
 * - Serves fresh cached responses in <1ms without redundant network hits
 * - Serves stale cached responses instantaneously after idle periods while
 *   silently revalidating in the background
 * - Emits `tankhor:swr-updated` when background revalidation detects new data
 * - Automatically invalidates related caches on mutations (POST/PATCH/PUT/DELETE)
 */

interface CacheEntry<T = any> {
  data: T;
  fingerprint: string;
  timestamp: number;
  freshMs: number;
  maxAgeMs: number;
  collection?: string;
}

const REFERENCE_COLLECTIONS = new Set([
  'categories',
  'collections',
  'seasons',
  'brands',
  'colors',
  'sizes',
  'size_groups',
  'size_guide_templates',
  'size_guide_measurements',
  'size_guide_values',
  'warehouses',
  'warehouse_locations',
  'system_modules',
  'organization_modules',
  'expense_categories',
  'project_settings',
]);

const MUTATION_CASCADE_MAP: Record<string, string[]> = {
  orders: ['orders', 'order_items', 'order_returns', 'inventory_items', 'inventory_movements', 'financial_accounts', 'treasury_transactions', 'person_transactions', 'customers', 'pos_shifts'],
  order_items: ['orders', 'order_items', 'order_returns', 'inventory_items', 'inventory_movements'],
  order_returns: ['order_returns', 'order_return_items', 'orders', 'order_items', 'inventory_items', 'inventory_movements', 'financial_accounts', 'treasury_transactions', 'person_transactions', 'customers', 'pos_shifts'],
  order_return_items: ['order_returns', 'order_return_items', 'orders', 'order_items', 'inventory_items', 'inventory_movements'],
  purchase_orders: ['purchase_orders', 'purchase_order_items', 'inventory_items', 'inventory_movements', 'person_transactions', 'suppliers'],
  products: ['products', 'product_variants', 'inventory_items'],
  product_variants: ['product_variants', 'products', 'inventory_items'],
  inventory_items: ['inventory_items', 'inventory_movements', 'products', 'product_variants'],
  inventory_movements: ['inventory_movements', 'inventory_items', 'products', 'product_variants'],
  stock_transfers: ['stock_transfers', 'stock_transfer_items', 'inventory_items', 'inventory_movements'],
  treasury_transactions: ['treasury_transactions', 'financial_accounts'],
  financial_accounts: ['financial_accounts', 'treasury_transactions'],
  expenses: ['expenses', 'financial_accounts', 'treasury_transactions'],
  cheques: ['cheques', 'financial_accounts', 'treasury_transactions', 'person_transactions'],
  production_orders: ['production_orders', 'raw_materials', 'inventory_items', 'inventory_movements', 'product_variants'],
  raw_materials: ['raw_materials', 'production_orders', 'boms'],
  boms: ['boms', 'production_orders'],
};

const MAX_CACHE_ENTRIES = 250;

class SwrCacheManager {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<any>>();
  private revalidating = new Set<string>();

  public extractCollection(endpoint: string): string | undefined {
    const clean = endpoint.split('?')[0];
    if (clean.startsWith('/items/')) {
      const parts = clean.slice('/items/'.length).split('/');
      return parts[0] || undefined;
    }
    if (clean.startsWith('/system-modules')) return 'system_modules';
    if (clean.startsWith('/dashboard/summary')) return 'dashboard_summary';
    if (clean.startsWith('/inventory/summary')) return 'inventory_summary';
    if (clean.startsWith('/orders/pos-init')) return 'pos_init';
    if (clean.startsWith('/inventory/barcode-init')) return 'barcode_init';
    return undefined;
  }

  public isCacheableGet(endpoint: string): boolean {
    const clean = endpoint.split('?')[0];
    if (
      clean.startsWith('/auth/') ||
      clean.startsWith('/payment/') ||
      clean.startsWith('/woocommerce/') ||
      clean.startsWith('/warmup') ||
      clean.startsWith('/health') ||
      clean.startsWith('/modules/sync-licenses')
    ) {
      return false;
    }
    return (
      clean.startsWith('/items/') ||
      clean.startsWith('/dashboard/summary') ||
      clean.startsWith('/inventory/summary') ||
      clean.startsWith('/orders/pos-init') ||
      clean.startsWith('/inventory/barcode-init') ||
      clean.startsWith('/system-modules')
    );
  }

  private getScopePrefix(): string {
    if (typeof window === 'undefined') return 'srv';
    const orgId = localStorage.getItem('tankhor_active_org_id') || '0';
    const token = localStorage.getItem('tankhor_directus_token') || '';
    const tokenSig = token ? token.slice(-8) : 'anon';
    return `${orgId}:${tokenSig}`;
  }

  private buildKey(endpoint: string, preserveMeta?: boolean): string {
    return `${this.getScopePrefix()}::${preserveMeta ? 'meta' : 'raw'}::${endpoint}`;
  }

  private getTtlForCollection(collection?: string): { freshMs: number; maxAgeMs: number } {
    if (collection && REFERENCE_COLLECTIONS.has(collection)) {
      return {
        freshMs: 60 * 1000, // 60 seconds fresh
        maxAgeMs: 20 * 60 * 1000, // 20 minutes SWR window
      };
    }
    return {
      freshMs: 15 * 1000, // 15 seconds fresh
      maxAgeMs: 15 * 60 * 1000, // 15 minutes SWR window
    };
  }

  private safeFingerprint(data: any): string {
    try {
      return JSON.stringify(data);
    } catch {
      return String(Date.now());
    }
  }

  private setEntry(key: string, data: any, collection?: string): string {
    const { freshMs, maxAgeMs } = this.getTtlForCollection(collection);
    const fingerprint = this.safeFingerprint(data);

    // Simple LRU eviction when exceeding limit
    if (this.cache.size >= MAX_CACHE_ENTRIES && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    // Re-insert to keep newest at end
    this.cache.delete(key);
    this.cache.set(key, {
      data,
      fingerprint,
      timestamp: Date.now(),
      freshMs,
      maxAgeMs,
      collection,
    });

    return fingerprint;
  }

  public async fetchWithSWR<T>(
    endpoint: string,
    fetcher: () => Promise<T>,
    options?: { preserveMeta?: boolean; bypassCache?: boolean }
  ): Promise<T> {
    if (options?.bypassCache || !this.isCacheableGet(endpoint)) {
      return fetcher();
    }

    const collection = this.extractCollection(endpoint);
    const key = this.buildKey(endpoint, options?.preserveMeta);
    const existing = this.cache.get(key);
    const now = Date.now();

    if (existing) {
      const age = now - existing.timestamp;

      // 1. Fresh hit: return immediately with zero network traffic
      if (age < existing.freshMs) {
        return existing.data as T;
      }

      // 2. Stale-While-Revalidate hit: return cached data immediately (<1ms) and refresh silently in background
      if (age < existing.maxAgeMs) {
        if (!this.revalidating.has(key) && !this.inFlight.has(key)) {
          this.revalidating.add(key);
          fetcher()
            .then((freshData) => {
              const prevFingerprint = existing.fingerprint;
              const nextFingerprint = this.setEntry(key, freshData, collection);
              if (prevFingerprint !== nextFingerprint && typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('tankhor:swr-updated', {
                    detail: { endpoint, collection },
                  })
                );
              }
            })
            .catch(() => {
              // Silent background revalidation error: keep serving stale cache gracefully
            })
            .finally(() => {
              this.revalidating.delete(key);
            });
        }
        return existing.data as T;
      }

      // Expired beyond maxAgeMs
      this.cache.delete(key);
    }

    // 3. In-flight deduplication for cache misses
    const pending = this.inFlight.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const work = fetcher()
      .then((data) => {
        this.setEntry(key, data, collection);
        return data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, work);
    return work;
  }

  public invalidateCollection(collection: string): void {
    const targets = new Set<string>([
      collection,
      ...(MUTATION_CASCADE_MAP[collection] || []),
      'dashboard_summary',
      'inventory_summary',
      'pos_init',
      'barcode_init',
    ]);

    for (const [key, entry] of this.cache.entries()) {
      if (entry.collection && targets.has(entry.collection)) {
        this.cache.delete(key);
      }
    }
  }

  public invalidateByMutation(endpoint: string): void {
    const collection = this.extractCollection(endpoint);
    if (collection) {
      this.invalidateCollection(collection);
    } else {
      // Unknown mutation endpoint: clear composite summaries to be safe
      this.invalidateCollection('dashboard_summary');
    }
  }

  public clearAll(): void {
    this.cache.clear();
    this.inFlight.clear();
    this.revalidating.clear();
  }
}

export const swrCache = new SwrCacheManager();
