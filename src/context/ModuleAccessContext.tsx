import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOrganization } from './OrganizationContext';
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

export interface ModuleAccessContextType {
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

const ModuleAccessContext = createContext<ModuleAccessContextType | undefined>(undefined);

export const ModuleAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeOrganization } = useOrganization();
  const [systemModules, setSystemModules] = useState<SystemModule[]>(DEFAULT_SYSTEM_MODULES);
  const [orgModules, setOrgModules] = useState<OrganizationModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<{ timestamp: string; isPro?: boolean; activeCount?: number; revokedCount?: number; status: string } | null>(null);
  
  const hardwareId = useMemo(() => getMachineFingerprint(), []);
  const activeOrgId = activeOrganization?.id;

  const isPro = useMemo(() => {
    return activeOrganization?.plan === 'pro';
  }, [activeOrganization?.plan]);

  // Load modules from local storage / SQLite
  const loadModules = useCallback(async (isInitial = false) => {
    if (!activeOrgId) {
      setOrgModules([]);
      setLoading(false);
      return;
    }

    try {
      if (isInitial) {
        setLoading(true);
      }
      const adapter = storageManager.getAdapter();

      // 1. Fetch system catalog
      let sysList: SystemModule[] = [];
      if (adapter.getSystemModules) {
        sysList = await adapter.getSystemModules({ status: 'published' });
      }
      if (!sysList || sysList.length === 0) {
        sysList = DEFAULT_SYSTEM_MODULES;
      }
      setSystemModules(sysList);

      // 2. Fetch organization modules from SQLite / LocalStorage
      let orgList: OrganizationModule[] = [];
      if (adapter.getOrganizationModules) {
        orgList = await adapter.getOrganizationModules({ organization_id: activeOrgId });
      }

      // Merge and enrich orgList
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
      const syncInfo = getLastLicenseSyncInfo(activeOrgId);
      setLastSyncInfo(syncInfo);
    } catch (err) {
      console.warn('[ModuleAccessContext] Failed to load modules:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  /**
   * Sync and validate licenses against Directus server (background, non-blocking)
   */
  const syncWithServer = useCallback(
    async (force: boolean = false): Promise<LicenseSyncResult> => {
      if (!activeOrgId) {
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
        const res = await syncOrganizationLicenses(activeOrgId, { force });
        if (res.success && res.modules) {
          setOrgModules((prev) => {
            // Merge enriched attributes
            return res.modules.map((om) => {
              const sys = systemModules.find((s) => s.slug === om.slug);
              return {
                ...om,
                name: om.name || sys?.name,
                description: om.description || sys?.description,
                price_ir: om.price_ir ?? sys?.price_ir,
                price_usd: om.price_usd ?? sys?.price_usd,
                included_in_pro: om.included_in_pro !== undefined ? om.included_in_pro : sys?.included_in_pro,
              };
            });
          });
        }
        const updatedInfo = getLastLicenseSyncInfo(activeOrgId);
        setLastSyncInfo(updatedInfo);
        return res;
      } finally {
        setIsSyncing(false);
      }
    },
    [activeOrgId, systemModules]
  );

  // Initial load when active organization changes
  useEffect(() => {
    let isMounted = true;

    loadModules(true).then(() => {
      if (isMounted && activeOrgId) {
        // Non-blocking background sync
        syncWithServer(false).catch(() => {});
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeOrgId, loadModules, syncWithServer]);

  // Global event listeners for external activations or network events
  useEffect(() => {
    if (!activeOrgId) return;

    const handleOnline = () => {
      syncWithServer(false).catch(() => {});
    };

    const handleModuleActivated = () => {
      loadModules(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('tankhor_module_activated', handleModuleActivated);

    // Heartbeat sync every 15 minutes in background
    const interval = setInterval(() => {
      syncWithServer(false).catch(() => {});
    }, 15 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('tankhor_module_activated', handleModuleActivated);
      clearInterval(interval);
    };
  }, [activeOrgId, syncWithServer, loadModules]);

  /**
   * Evaluates whether current organization has active entitlement to a module
   */
  const hasAccess = useCallback(
    (moduleSlug: string): boolean => {
      if (!activeOrgId) return false;

      const sysMod = systemModules.find((m) => m.slug === moduleSlug);
      const orgMod = orgModules.find((m) => m.slug === moduleSlug);

      // Read whether the module is included in Pro plan
      const isIncludedInPro = orgMod?.included_in_pro !== undefined
        ? Boolean(orgMod.included_in_pro)
        : Boolean(sysMod?.included_in_pro);

      // 1. If organization is on Pro plan AND the module is marked as included in Pro:
      if (isPro && isIncludedInPro) {
        return true;
      }

      // 2. Check purchased standalone organization module
      if (!orgMod) return false;

      // Module MUST be active
      if (orgMod.status !== 'active') return false;

      // Check date expiry if set
      if (orgMod.expires_at) {
        const expiry = new Date(orgMod.expires_at).getTime();
        if (Date.now() > expiry) return false;
      }

      return true;
    },
    [activeOrgId, isPro, systemModules, orgModules]
  );

  /**
   * Activates a cryptographic offline/online license token
   */
  const activateLicense = useCallback(
    async (tokenString: string): Promise<{ success: boolean; message: string; module?: OrganizationModule }> => {
      if (!activeOrgId) {
        return { success: false, message: 'سازمان فعالی یافت نشد.' };
      }

      const trimmed = tokenString.trim();
      if (!trimmed) {
        return { success: false, message: 'لطفاً کد لایسنس را وارد کنید.' };
      }

      // Verify token
      const verification = await verifyLicenseTokenString(trimmed, activeOrgId, hardwareId);
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
        organization_id: activeOrgId,
        slug: payload.slug,
        module_id: matchedSys?.id || 1,
        license_type: payload.license_type,
        status: 'active',
        license_token: trimmed,
        hardware_id: payload.hardware_id || hardwareId,
        starts_at: payload.issued_at,
        expires_at: payload.expires_at || null,
      });

      // Background server sync to notify Directus if online
      syncWithServer(true).catch(() => {});

      await loadModules(false);
      return {
        success: true,
        message: `ماژول «${matchedSys?.name || payload.slug}» با موفقیت فعال شد.`,
        module: saved,
      };
    },
    [activeOrgId, hardwareId, systemModules, loadModules, syncWithServer]
  );

  /**
   * Helper to generate a valid signed token for offline demonstration or testing
   */
  const createDemoLicenseToken = useCallback(
    async (moduleSlug: string): Promise<string> => {
      const payload: LicensePayload = {
        organization_id: activeOrgId || 1,
        slug: moduleSlug,
        license_type: 'lifetime',
        hardware_id: hardwareId,
        issued_at: new Date().toISOString(),
        expires_at: null, // lifetime
      };
      return await generateLicenseTokenString(payload);
    },
    [activeOrgId, hardwareId]
  );

  const contextValue = useMemo<ModuleAccessContextType>(
    () => ({
      hasAccess,
      isPro,
      activeModules: orgModules,
      orgModules,
      systemModules,
      loading,
      isSyncing,
      lastSyncInfo,
      hardwareId,
      refreshModules: () => loadModules(false),
      syncWithServer,
      activateLicense,
      createDemoLicenseToken,
    }),
    [
      hasAccess,
      isPro,
      orgModules,
      systemModules,
      loading,
      isSyncing,
      lastSyncInfo,
      hardwareId,
      loadModules,
      syncWithServer,
      activateLicense,
      createDemoLicenseToken,
    ]
  );

  return (
    <ModuleAccessContext.Provider value={contextValue}>
      {children}
    </ModuleAccessContext.Provider>
  );
};

export const useModuleAccess = (): ModuleAccessContextType => {
  const context = useContext(ModuleAccessContext);
  if (!context) {
    throw new Error('useModuleAccess must be used within a ModuleAccessProvider');
  }
  return context;
};
