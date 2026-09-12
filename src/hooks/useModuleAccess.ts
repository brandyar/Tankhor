import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import { storageManager } from '../storage';
import { SystemModule, OrganizationModule } from '../types';
import {
  DEFAULT_SYSTEM_MODULES,
  getMachineFingerprint,
  verifyLicenseTokenString,
  generateLicenseTokenString,
  LicensePayload,
} from '../utils/license';
import {
  syncOrganizationLicenses,
  getLastLicenseSyncInfo,
  LicenseSyncResult,
} from '../utils/licenseSync';

export interface UseModuleAccessReturn {
  hasAccess: (moduleSlug: string) => boolean;
  isPro: boolean;
  activeModules: OrganizationModule[];
  orgModules: OrganizationModule[];
  systemModules: SystemModule[];
  loading: boolean;
  isSyncing: boolean;
  lastSyncInfo: { timestamp: string; isPro?: boolean; activeCount?: number; revokedCount?: number; status: string } | null;
  hardwareId: string;
  refreshModules: () => Promise<void>;
  syncWithServer: (force?: boolean) => Promise<LicenseSyncResult>;
  activateLicense: (tokenString: string) => Promise<{ success: boolean; message: string; module?: OrganizationModule }>;
  createDemoLicenseToken: (moduleSlug: string) => Promise<string>;
}

export function useModuleAccess(): UseModuleAccessReturn {
  const { activeOrganization } = useOrganization();
  const [systemModules, setSystemModules] = useState<SystemModule[]>(DEFAULT_SYSTEM_MODULES);
  const [orgModules, setOrgModules] = useState<OrganizationModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<{ timestamp: string; isPro?: boolean; activeCount?: number; revokedCount?: number; status: string } | null>(null);
  const hardwareId = useMemo(() => getMachineFingerprint(), []);

  const isPro = useMemo(() => {
    return activeOrganization?.plan === 'pro';
  }, [activeOrganization?.plan]);

  const loadModules = useCallback(async () => {
    if (!activeOrganization) {
      setOrgModules([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const adapter = storageManager.getAdapter();

      // 1. Fetch system catalog from storage adapter / Directus
      let sysList: SystemModule[] = [];
      if (adapter.getSystemModules) {
        sysList = await adapter.getSystemModules({ status: 'published' });
      }
      if (!sysList || sysList.length === 0) {
        sysList = DEFAULT_SYSTEM_MODULES;
      }
      setSystemModules(sysList);

      // 2. Fetch organization's specific modules from local storage / SQLite
      let orgList: OrganizationModule[] = [];
      if (adapter.getOrganizationModules) {
        orgList = await adapter.getOrganizationModules({ organization_id: activeOrganization.id });
      }

      // Merge / enrich orgList with catalog info if available
      const enrichedOrgList = orgList.map((om) => {
        const sys = sysList.find((s) => s.slug === om.slug);
        return {
          ...om,
          name: om.name || sys?.name,
          description: om.description || sys?.description,
          price_ir: om.price_ir ?? sys?.price_ir,
          price_usd: om.price_usd ?? sys?.price_usd,
          included_in_pro: om.included_in_pro !== undefined ? om.included_in_pro : sys?.included_in_pro,
        };
      });

      setOrgModules(enrichedOrgList);

      // Read last sync info
      const syncInfo = getLastLicenseSyncInfo(activeOrganization.id);
      setLastSyncInfo(syncInfo);
    } catch (err) {
      console.warn('[useModuleAccess] Failed to load modules:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOrganization]);

  /**
   * Sync and validate licenses against Directus server
   */
  const syncWithServer = useCallback(
    async (force: boolean = false): Promise<LicenseSyncResult> => {
      if (!activeOrganization) {
        return {
          success: false,
          error: 'سازمان فعالی انتخاب نشده است.',
          activeCount: 0,
          revokedCount: 0,
          timestamp: new Date().toISOString(),
          modules: [],
        };
      }

      setIsSyncing(true);
      try {
        const res = await syncOrganizationLicenses(activeOrganization.id, { force });
        if (res.success && res.modules) {
          setOrgModules(res.modules);
        }
        const updatedInfo = getLastLicenseSyncInfo(activeOrganization.id);
        setLastSyncInfo(updatedInfo);
        return res;
      } finally {
        setIsSyncing(false);
      }
    },
    [activeOrganization]
  );

  useEffect(() => {
    loadModules();

    // Trigger non-blocking background server sync on startup / org switch
    if (activeOrganization?.id) {
      syncWithServer(false).catch(() => {});
    }
  }, [loadModules, activeOrganization?.id, syncWithServer]);

  // Periodic background check & auto-reconnect sync (every 15 minutes)
  useEffect(() => {
    if (!activeOrganization?.id) return;

    const handleOnline = () => {
      console.log('[useModuleAccess] Network restored, checking licenses with server...');
      syncWithServer(false).catch(() => {});
    };

    const handleModulesUpdated = () => {
      loadModules();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('tankhor_modules_updated', handleModulesUpdated);

    // Periodic heartbeat sync every 15 minutes
    const interval = setInterval(() => {
      syncWithServer(false).catch(() => {});
    }, 15 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('tankhor_modules_updated', handleModulesUpdated);
      clearInterval(interval);
    };
  }, [activeOrganization?.id, syncWithServer, loadModules]);

  /**
   * Evaluates whether current organization has active entitlement to a module
   */
  const hasAccess = useCallback(
    (moduleSlug: string): boolean => {
      if (!activeOrganization) return false;

      const sysMod = systemModules.find((m) => m.slug === moduleSlug);
      const orgMod = orgModules.find((m) => m.slug === moduleSlug);

      // Read whether the module is included in the Pro plan strictly from the database item
      const isIncludedInPro = orgMod?.included_in_pro !== undefined
        ? Boolean(orgMod.included_in_pro)
        : Boolean(sysMod?.included_in_pro);

      // 1. If organization is on Pro plan AND the module is marked as included in Pro:
      if (isPro && isIncludedInPro) {
        return true;
      }

      // 2. Check purchased standalone organization module
      if (!orgMod) return false;

      // Module MUST be active. If revoked by server or expired, deny access
      if (orgMod.status !== 'active') return false;

      // Check date expiry if set
      if (orgMod.expires_at) {
        const expiry = new Date(orgMod.expires_at).getTime();
        if (Date.now() > expiry) return false;
      }

      return true;
    },
    [activeOrganization, isPro, systemModules, orgModules]
  );

  /**
   * Activates a cryptographic offline/online license token
   */
  const activateLicense = useCallback(
    async (tokenString: string): Promise<{ success: boolean; message: string; module?: OrganizationModule }> => {
      if (!activeOrganization) {
        return { success: false, message: 'سازمان فعالی یافت نشد.' };
      }

      const trimmed = tokenString.trim();
      if (!trimmed) {
        return { success: false, message: 'لطفاً کد لایسنس را وارد کنید.' };
      }

      // Verify token
      const verification = await verifyLicenseTokenString(trimmed, activeOrganization.id, hardwareId);
      if (!verification.valid || !verification.payload) {
        let msg = 'کد لایسنس نامعتبر است.';
        if (verification.error === 'SIGNATURE_MISMATCH') {
          msg = 'امضای دیجیتال لایسنس معتبر نیست و تغییر یافته است.';
        } else if (verification.error === 'ORGANIZATION_MISMATCH') {
          msg = 'این لایسنس برای سازمان دیگری صادر شده است.';
        } else if (verification.error === 'HARDWARE_MISMATCH') {
          msg = 'این لایسنس مختص به سخت‌افزار دیگری است.';
        } else if (verification.error === 'LICENSE_EXPIRED') {
          msg = 'مدت اعتبار زمانی این لایسنس به پایان رسیده است.';
        }
        return { success: false, message: msg };
      }

      const { payload } = verification;
      const matchedSys = systemModules.find((m) => m.slug === payload.slug);

      const adapter = storageManager.getAdapter();
      if (!adapter.saveOrganizationModule) {
        return { success: false, message: 'سیستم ذخیره‌سازی از فعال‌سازی ماژول پشتیبانی نمی‌کند.' };
      }

      const saved = await adapter.saveOrganizationModule({
        organization_id: activeOrganization.id,
        slug: payload.slug,
        module_id: matchedSys?.id || 1,
        license_type: payload.license_type,
        status: 'active',
        license_token: trimmed,
        hardware_id: payload.hardware_id || hardwareId,
        starts_at: payload.issued_at,
        expires_at: payload.expires_at || null,
      });

      // Trigger server sync to verify with Directus if online
      syncWithServer(true).catch(() => {});

      await loadModules();
      return {
        success: true,
        message: `ماژول «${matchedSys?.name || payload.slug}» با موفقیت فعال شد.`,
        module: saved,
      };
    },
    [activeOrganization, hardwareId, systemModules, loadModules, syncWithServer]
  );

  /**
   * Helper to generate a valid signed token for offline demonstration or testing
   */
  const createDemoLicenseToken = useCallback(
    async (moduleSlug: string): Promise<string> => {
      const payload: LicensePayload = {
        organization_id: activeOrganization?.id || 1,
        slug: moduleSlug,
        license_type: 'lifetime',
        hardware_id: hardwareId,
        issued_at: new Date().toISOString(),
        expires_at: null, // lifetime
      };
      return await generateLicenseTokenString(payload);
    },
    [activeOrganization?.id, hardwareId]
  );

  return {
    hasAccess,
    isPro,
    activeModules: orgModules,
    orgModules,
    systemModules,
    loading,
    isSyncing,
    lastSyncInfo,
    hardwareId,
    refreshModules: loadModules,
    syncWithServer,
    activateLicense,
    createDemoLicenseToken,
  };
}
