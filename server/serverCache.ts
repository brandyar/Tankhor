/**
 * Shared Server-Side Cache Registry & Invalidation Helper
 * Coordinates cache invalidation across dashboard, inventory, fast-init,
 * tenant items, and accounting sync routes whenever data is mutated.
 */

type CacheInvalidator = (orgId: number, collection?: string) => void;

const invalidators: CacheInvalidator[] = [];

export function registerCacheInvalidator(fn: CacheInvalidator): void {
  if (!invalidators.includes(fn)) {
    invalidators.push(fn);
  }
}

export function invalidateOrgCaches(orgId: number, collection?: string): void {
  if (!orgId || isNaN(orgId)) return;
  for (const fn of invalidators) {
    try {
      fn(orgId, collection);
    } catch {
      // ignore invalidator errors
    }
  }
}
