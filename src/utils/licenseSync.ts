/**
 * TANKHOR (تن‌خور) - Module License Synchronization & Verification Engine
 * Periodically verifies and synchronizes module licenses with Directus backend,
 * ensuring that revoked or disabled module licenses in Directus take immediate effect
 * in desktop (Tauri SQLite) and web offline storage while supporting graceful offline operation.
 */

import { directusClient } from '../api/directus';
import { storageManager } from '../storage';
import { OrganizationModule, SystemModule } from '../types';
import { verifyLicenseTokenString, getMachineFingerprint, DEFAULT_SYSTEM_MODULES } from './license';

export interface LicenseSyncResult {
  success: boolean;
  offline?: boolean;
  error?: string;
  isPro?: boolean;
  activeCount: number;
  revokedCount: number;
  timestamp: string;
  modules: OrganizationModule[];
}

// In-flight sync promises to eliminate duplicate concurrent network/database requests
const inFlightSyncs = new Map<number, Promise<LicenseSyncResult>>();

/**
 * Synchronizes and validates organization module entitlements with the Directus server.
 * - If server responds: Directus server is authoritative.
 * - If offline / local cryptographic token exists: Cryptographically verifies local token
 *   and permits offline operation without accidental revocation.
 */
export async function syncOrganizationLicenses(
  organizationId: number,
  options: { force?: boolean } = {}
): Promise<LicenseSyncResult> {
  // Deduplicate concurrent sync calls for the same organization
  if (inFlightSyncs.has(organizationId) && !options.force) {
    return inFlightSyncs.get(organizationId)!;
  }

  const syncPromise = (async () => {
    const hardwareId = getMachineFingerprint();
    const timestamp = new Date().toISOString();

    // 1. Check if network is available
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline && !options.force) {
      const adapter = storageManager.getAdapter();
      let localModules: OrganizationModule[] = [];
      if (adapter.getOrganizationModules) {
        localModules = await adapter.getOrganizationModules({ organization_id: organizationId });
      }
      return {
        success: false,
        offline: true,
        error: 'اتصال به شبکه برقرار نیست (حالت آفلاین)',
        activeCount: localModules.filter((m) => m.status === 'active').length,
        revokedCount: localModules.filter((m) => m.status !== 'active').length,
        timestamp,
        modules: localModules,
      };
    }

    try {
      // 2. Request authoritative license verification from BFF Gateway / Directus
      let serverData: any = null;
      try {
        serverData = await directusClient.request('/modules/sync-licenses', {
          method: 'POST',
          body: JSON.stringify({ organizationId, hardwareId }),
        });
      } catch (apiErr: any) {
        // Directus items fallback if /modules/sync-licenses is unreachable directly
        try {
          const directusItems = await directusClient.getItems<any>('organization_modules', {
            filter: { organization_id: { _eq: organizationId } },
            limit: 100,
          });
          if (Array.isArray(directusItems)) {
            serverData = {
              success: true,
              organizationId,
              modules: directusItems,
            };
          }
        } catch (directusErr) {
          throw apiErr;
        }
      }

      if (!serverData || !Array.isArray(serverData.modules)) {
        throw new Error('پاسخ نامعتبر از سرور دریافت شد.');
      }

      const serverModules: any[] = serverData.modules;
      const adapter = storageManager.getAdapter();

      // 3. Read current local modules from SQLite or LocalStorage
      let localModules: OrganizationModule[] = [];
      if (adapter.getOrganizationModules) {
        localModules = await adapter.getOrganizationModules({ organization_id: organizationId });
      }

      let activeCount = 0;
      let revokedCount = 0;
      const processedSlugs = new Set<string>();

      // 4. Update / Sync each module from Directus server into local storage
      for (const sMod of serverModules) {
        const slug = sMod.slug;
        if (!slug) continue;
        processedSlugs.add(slug);

        const serverStatus = sMod.status || 'active';
        const isServerActive = serverStatus === 'active';

        // Check expiry if timestamp provided
        let isExpired = false;
        if (sMod.expires_at) {
          const expiry = new Date(sMod.expires_at).getTime();
          if (Date.now() > expiry) {
            isExpired = true;
          }
        }

        const finalStatus = isExpired ? 'expired' : isServerActive ? 'active' : 'revoked';

        if (finalStatus === 'active') {
          activeCount++;
        } else {
          revokedCount++;
        }

        if (adapter.saveOrganizationModule) {
          await adapter.saveOrganizationModule({
            organization_id: organizationId,
            slug,
            module_id: sMod.module_id || 1,
            license_type: sMod.license_type || 'lifetime',
            status: finalStatus,
            license_token: sMod.license_token || null,
            hardware_id: sMod.hardware_id || hardwareId,
            starts_at: sMod.starts_at || new Date().toISOString(),
            expires_at: sMod.expires_at || null,
          });
        }
      }

      // 5. Handle local modules that do NOT exist in Directus server response
      // CRITICAL: If a local module has a valid cryptographic offline license token,
      // preserve it and do NOT revoke it unless the token is cryptographically invalid or expired.
      for (const lMod of localModules) {
        if (lMod.slug && !processedSlugs.has(lMod.slug)) {
          if (lMod.license_token) {
            const verification = await verifyLicenseTokenString(lMod.license_token, organizationId, hardwareId);
            if (verification.valid && verification.payload) {
              // Valid offline cryptographic license - retain active status
              if (lMod.status === 'active') {
                activeCount++;
              }
              continue;
            }
          }

          // If no valid offline token and not in server modules, mark revoked
          if (lMod.status === 'active') {
            revokedCount++;
            if (adapter.saveOrganizationModule) {
              await adapter.saveOrganizationModule({
                ...lMod,
                status: 'revoked',
              });
            }
          }
        }
      }

      // 6. Save last sync status in localStorage
      if (typeof window !== 'undefined') {
        const syncInfo = {
          timestamp,
          isPro: Boolean(serverData.isPro),
          activeCount,
          revokedCount,
          status: 'synced_ok',
        };
        localStorage.setItem(`tankhor_last_license_sync_${organizationId}`, JSON.stringify(syncInfo));
      }

      // Re-fetch updated list from local storage
      let updatedModules: OrganizationModule[] = [];
      if (adapter.getOrganizationModules) {
        updatedModules = await adapter.getOrganizationModules({ organization_id: organizationId });
      }

      return {
        success: true,
        isPro: Boolean(serverData.isPro),
        activeCount,
        revokedCount,
        timestamp,
        modules: updatedModules,
      };
    } catch (err: any) {
      console.warn('[LicenseSync] Online validation warning:', err?.message || err);
      const adapter = storageManager.getAdapter();
      let localModules: OrganizationModule[] = [];
      if (adapter.getOrganizationModules) {
        localModules = await adapter.getOrganizationModules({ organization_id: organizationId });
      }
      return {
        success: false,
        offline: true,
        error: err.message || 'خطا در ارتباط با سرور برای بررسی لایسنس‌ها',
        activeCount: localModules.filter((m) => m.status === 'active').length,
        revokedCount: localModules.filter((m) => m.status !== 'active').length,
        timestamp,
        modules: localModules,
      };
    } finally {
      inFlightSyncs.delete(organizationId);
    }
  })();

  inFlightSyncs.set(organizationId, syncPromise);
  return syncPromise;
}

/**
 * Gets last sync info from localStorage
 */
export function getLastLicenseSyncInfo(organizationId: number): {
  timestamp: string;
  isPro?: boolean;
  activeCount?: number;
  revokedCount?: number;
  status: string;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`tankhor_last_license_sync_${organizationId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
