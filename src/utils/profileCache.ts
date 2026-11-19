/**
 * Safe, Quota-Resilient LocalStorage Cache Helpers for Auth & Organization Profile
 *
 * Prevents DOMException QuotaExceededError when persisting `tankhor_cached_user_profile`
 * or critical session keys by:
 * 1. Stripping large inline Base64/data: image blobs (logo, signature, avatar) from cached profiles
 *    (full images are kept in React state and fetched from Cloud/SQLite/IndexedDB as needed).
 * 2. Reclaiming stale localStorage cache keys (media indexes and legacy `tankhor_db_*` keys on
 *    Desktop Tauri / Cloud mode) if the 5MB WebView storage quota is already exhausted.
 * 3. Falling back to an ultra-minimal auth/plan stub and never throwing out of login/startup flows.
 */

export const CACHED_USER_KEY = 'tankhor_cached_user_profile';

const PROTECTED_KEYS = new Set([
  'tankhor_directus_token',
  'tankhor_directus_refresh_token',
  'tankhor_active_org_id',
  'tankhor_storage_mode',
  'tankhor_hardware_id',
  'tankhor_locale',
  'tankhor_theme',
  'tankhor_sync_queue',
  'tankhor_last_activity_timestamp',
  CACHED_USER_KEY,
]);

function isQuotaExceededError(err: any): boolean {
  if (!err) return false;
  const name = String(err.name || '');
  const message = String(err.message || '').toLowerCase();
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014 ||
    message.includes('quota') ||
    message.includes('exceeded')
  );
}

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol.includes('tauri') ||
    Boolean((window as any).__TAURI__) ||
    Boolean((window as any).__TAURI_INTERNALS__) ||
    window.location.hostname === 'tauri.localhost'
  );
}

function stripLargeString(value: any, maxLen = 1024): any {
  if (typeof value !== 'string') return value;
  if (value.startsWith('data:') || value.length > maxLen) {
    return null;
  }
  return value;
}

export function compactOrgForCache(org: any): any {
  if (!org || typeof org !== 'object') return org;

  const compact: Record<string, any> = {};
  for (const [key, val] of Object.entries(org)) {
    if (key === 'logo' || key === 'signature' || key === 'avatar' || key === 'image') {
      compact[key] = stripLargeString(val, 512);
    } else if (typeof val === 'string') {
      compact[key] = val.startsWith('data:') || val.length > 2048 ? null : val;
    } else if (val !== undefined && typeof val !== 'function') {
      compact[key] = val;
    }
  }
  return compact;
}

export function compactUserForCache(user: any): any {
  if (!user || typeof user !== 'object') return user;

  const rawActiveOrg = user.activeOrganization || user.active_organization || null;
  const compactActiveOrg = rawActiveOrg ? compactOrgForCache(rawActiveOrg) : null;
  const compactOrgs = Array.isArray(user.organizations)
    ? user.organizations.filter(Boolean).map(compactOrgForCache)
    : compactActiveOrg
    ? [compactActiveOrg]
    : [];

  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    user_phone: user.user_phone,
    avatar: stripLargeString(user.avatar, 512),
    title: user.title,
    description: stripLargeString(user.description, 1024),
    role: user.role,
    user_role: user.user_role,
    status: user.status,
    activeOrganization: compactActiveOrg,
    active_organization: compactActiveOrg,
    organizations: compactOrgs,
  };
}

function buildMinimalUserStub(user: any): any {
  const rawActiveOrg = user?.activeOrganization || user?.active_organization || null;
  const minimalOrg = (org: any) =>
    org
      ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan || 'free',
          trial_ends_at: org.trial_ends_at ?? null,
          has_active_subscription: Boolean(org.has_active_subscription),
          has_used_trial: Boolean(org.has_used_trial),
          currency: org.currency || 'TOMAN',
          user_role: org.user_role,
        }
      : null;

  const active = minimalOrg(rawActiveOrg);
  const orgs = Array.isArray(user?.organizations)
    ? user.organizations.filter(Boolean).map(minimalOrg)
    : active
    ? [active]
    : [];

  return {
    id: user?.id,
    email: user?.email,
    first_name: user?.first_name,
    last_name: user?.last_name,
    role: user?.role,
    user_role: user?.user_role,
    activeOrganization: active,
    active_organization: active,
    organizations: orgs,
  };
}

/**
 * Reclaims localStorage space when QuotaExceededError occurs.
 * - First clears expendable media cache indexes and old license sync metadata.
 * - ONLY when confirmed in Cloud/Pro mode (never for Free/offline users!), clears
 *   legacy `tankhor_db_*` localStorage tables (largest first) since Pro data lives on Cloud.
 * - Never touches SQLite (`tankhor.db`) or protected session/sync keys.
 */
export function reclaimLocalStorageSpace(
  targetBytes = 256 * 1024,
  options?: { allowEvictLegacyDb?: boolean }
): number {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 0;

  let reclaimed = 0;
  try {
    const entries: Array<{ key: string; size: number; priority: number }> = [];
    const allowEvictLegacyDb = Boolean(
      options?.allowEvictLegacyDb || localStorage.getItem('tankhor_storage_mode') === 'cloud_synced'
    );

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || PROTECTED_KEYS.has(key)) continue;

      const val = localStorage.getItem(key) || '';
      const size = key.length + val.length;

      // Priority 1: expendable media / template / misc caches
      if (
        key.startsWith('tankhor_local_media') ||
        key.startsWith('tankhor_media_') ||
        key.startsWith('tankhor_tpl_sizes_') ||
        key.startsWith('tankhor_last_license_sync_')
      ) {
        entries.push({ key, size, priority: 1 });
        continue;
      }

      // Priority 2: legacy tankhor_db_* keys ONLY when user is Pro / cloud_synced
      if (allowEvictLegacyDb && key.startsWith('tankhor_db_')) {
        entries.push({ key, size, priority: 2 });
        continue;
      }

      // Priority 3: any huge non-DB non-protected key (> 100KB) as last resort
      if (size > 100 * 1024 && !key.startsWith('tankhor_db_')) {
        entries.push({ key, size, priority: 3 });
      }
    }

    // Sort by lowest priority number first, then largest size first
    entries.sort((a, b) => a.priority - b.priority || b.size - a.size);

    for (const item of entries) {
      try {
        localStorage.removeItem(item.key);
        reclaimed += item.size;
      } catch {}
      if (reclaimed >= targetBytes) {
        break;
      }
    }
  } catch {}

  return reclaimed;
}

/**
 * Safely writes a small critical key to localStorage with automatic quota recovery.
 * Never throws.
 */
export function safeSetLocalStorageItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      reclaimLocalStorageSpace(Math.max(256 * 1024, value.length * 4));
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.warn(`[ProfileCache] Failed to save ${key} after reclaiming space:`, retryErr);
      }
    } else {
      console.warn(`[ProfileCache] Failed to save ${key}:`, err);
    }
    return false;
  }
}

/**
 * Safely compacts and persists `tankhor_cached_user_profile` without ever throwing QuotaExceededError.
 */
export function safeSaveCachedUserProfile(user: any): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined' || !user) return false;

  const compacted = compactUserForCache(user);
  let serialized = '';
  try {
    serialized = JSON.stringify(compacted);
  } catch (err) {
    console.warn('[ProfileCache] Failed to serialize user profile:', err);
    return false;
  }

  const activeOrg = user.activeOrganization || user.active_organization;
  const isProUser = Boolean(
    activeOrg?.plan === 'pro' ||
      (Array.isArray(user.organizations) && user.organizations.some((o: any) => o?.plan === 'pro'))
  );

  try {
    localStorage.setItem(CACHED_USER_KEY, serialized);
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      // Remove existing bloated profile first and reclaim stale cache keys
      try {
        localStorage.removeItem(CACHED_USER_KEY);
      } catch {}
      reclaimLocalStorageSpace(Math.max(512 * 1024, serialized.length * 4), {
        allowEvictLegacyDb: isProUser,
      });

      try {
        localStorage.setItem(CACHED_USER_KEY, serialized);
        return true;
      } catch {
        // Ultra-minimal fallback so auth & Pro plan detection still survive reloads
        try {
          const minimal = JSON.stringify(buildMinimalUserStub(user));
          localStorage.setItem(CACHED_USER_KEY, minimal);
          return true;
        } catch (finalErr) {
          console.warn('[ProfileCache] Unable to persist cached user profile due to storage quota:', finalErr);
        }
      }
    } else {
      console.warn('[ProfileCache] Unable to persist cached user profile:', err);
    }
    return false;
  }
}
