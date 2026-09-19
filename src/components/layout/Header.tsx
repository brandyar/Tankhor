import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { storageManager, isTauriEnvironment } from '../../storage';
import { StorageSyncManager } from '../../storage/syncManager';
import { LoginModal } from '../../features/auth/LoginModal';
import { CreateOrganizationModal } from '../../features/organizations/CreateOrganizationModal';
import { UpgradeToProModal } from '../modals/UpgradeToProModal';
import { QuickSearchModal } from '../modals/QuickSearchModal';
import { Building2, Search, Database, RefreshCw, CheckCircle2, Menu, Cloud, ChevronDown, Plus, Sun, Moon, Monitor } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onNavigate?: (route: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNavigate }) => {
  const { t } = useTranslation();
  const { organizations, activeOrganization, selectOrganization, refreshOrganizations } = useOrganization();
  const { isCloudAuthenticated, openLoginModal } = useAuth();
  const { theme, setTheme } = useTheme();

  const [mode, setModeState] = useState(storageManager.getMode());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(StorageSyncManager.getQueue().length);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  const orgMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setIsOrgMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };

    const handleModeChange = () => {
      setModeState(storageManager.getMode());
    };

    const handleQueueChange = (e?: any) => {
      const count = typeof e?.detail === 'number' ? e.detail : StorageSyncManager.getQueue().length;
      setPendingCount(count);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('tankhor_storage_mode_changed', handleModeChange);
    window.addEventListener('tankhor_sync_queue_updated', handleQueueChange);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('tankhor_storage_mode_changed', handleModeChange);
      window.removeEventListener('tankhor_sync_queue_updated', handleQueueChange);
    };
  }, []);

  const toggleStorageMode = () => {
    if (mode === 'local_offline') {
      if (!isCloudAuthenticated) {
        openLoginModal();
        return;
      }
      const currentPlan = activeOrganization?.plan || 'free';
      if (currentPlan !== 'pro') {
        setIsUpgradeModalOpen(true);
        return;
      }
      storageManager.setMode('cloud_synced');
      setModeState('cloud_synced');
    } else {
      // In web environment, keep in cloud mode if Pro
      if (!isTauriEnvironment() && activeOrganization?.plan === 'pro') {
        handleSyncNow();
        return;
      }
      storageManager.setMode('local_offline');
      setModeState('local_offline');
    }
  };

  const handleSyncNow = async () => {
    if (activeOrganization?.plan !== 'pro') {
      setIsUpgradeModalOpen(true);
      return;
    }
    setSyncing(true);
    try {
      await StorageSyncManager.syncLocalToCloud(storageManager.getCloudAdapter());
      setPendingCount(StorageSyncManager.getQueue().length);
      await refreshOrganizations();
    } catch (err) {
      console.error('[Header] Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-white/95 dark:bg-[#0f121a]/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800/80 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors">
        {/* Left / Start: Mobile Sidebar Toggle (Hidden on Desktop) & Organization Switcher Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Sidebar Toggle (Hidden on Desktop since sidebar has its own button) */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              title={t('common.toggleSidebar')}
              className="lg:hidden p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5 shrink-0" />
            </button>
          )}

          {/* Interactive Organization Dropdown */}
          <div className="relative" ref={orgMenuRef}>
            <button
              onClick={() => setIsOrgMenuOpen(!isOrgMenuOpen)}
              className="flex items-center gap-2 bg-neutral-100/90 dark:bg-neutral-800/80 hover:bg-neutral-200/70 dark:hover:bg-neutral-700/80 rounded-xl px-3 py-1.5 border border-neutral-200/90 dark:border-neutral-700/80 transition-all cursor-pointer focus:outline-none shadow-2xs"
            >
              <div className="w-5 h-5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center shrink-0">
                <Building2 className="w-3 h-3" />
              </div>
              <div className="text-start pe-1">
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block truncate max-w-[140px] sm:max-w-[180px]">
                  {activeOrganization?.name || t('common.selectOrg')}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 transition-transform ${isOrgMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Organization Switcher Dropdown Menu */}
            {isOrgMenuOpen && (
              <div className="absolute start-0 mt-2 w-72 bg-white dark:bg-[#14161c] rounded-2xl shadow-xl border border-neutral-200/90 dark:border-neutral-800 py-2 z-50 animate-fade-in text-neutral-800 dark:text-neutral-200">
                <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{t('common.orgsAndStores')}</span>
                  <span className="text-[11px] font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-neutral-600 dark:text-neutral-400">
                    {organizations.length} {t('common.organization')}
                  </span>
                </div>

                {/* Organization List */}
                <div className="max-h-56 overflow-y-auto p-1 space-y-1">
                  {organizations.map((org, orgIdx) => {
                    const isSelected = activeOrganization?.id === org.id;
                    return (
                      <button
                        key={`hdr_org_${org.id}_${orgIdx}`}
                        onClick={() => {
                          selectOrganization(org.id);
                          setIsOrgMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-start ${
                          isSelected
                            ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold ${
                              isSelected ? 'bg-white/20 dark:bg-neutral-900/20 text-white dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            {org.name ? org.name[0] : 'O'}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs">{org.name}</p>
                            {org.slug && (
                              <p className={`text-[10px] font-mono truncate ${isSelected ? 'text-neutral-300 dark:text-neutral-700' : 'text-neutral-400 dark:text-neutral-500'}`}>
                                {org.slug}
                              </p>
                            )}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Add New Organization Action */}
                <div className="p-1 pt-1.5 border-t border-neutral-100 dark:border-neutral-800 mt-1">
                  <button
                    onClick={() => {
                      setIsOrgMenuOpen(false);
                      setIsCreateOrgOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors text-start cursor-pointer"
                  >
                    <Plus className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>{t('common.createNewOrg')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Quick Search Shortcut Trigger (Ctrl + K) */}
        <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-2 sm:mx-4">
          <button
            type="button"
            onClick={() => setIsQuickSearchOpen(true)}
            className="w-full flex items-center justify-between gap-2 bg-neutral-100/90 dark:bg-neutral-800/80 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 rounded-xl px-3 py-1.5 border border-neutral-200/90 dark:border-neutral-700/80 transition-all cursor-pointer text-start shadow-2xs group"
            title={`${t('common.quickSearchTitle', 'جستجوی سریع صفحات')} (Ctrl+K)`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 shrink-0" />
              <span className="text-xs text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 truncate">
                {t('common.quickSearch', 'جستجوی سریع صفحات...')}
              </span>
            </div>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 shadow-2xs shrink-0">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right / End: Cloud Sync Icon & Theme Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Sync & Storage Mode Icon Button */}
          <button
            onClick={() => {
              if (pendingCount > 0 || mode === 'cloud_synced') {
                handleSyncNow();
              } else {
                toggleStorageMode();
              }
            }}
            disabled={syncing}
            title={
              pendingCount > 0
                ? `${pendingCount} ${t('common.syncPending')} - ${t('common.syncNow', 'همگام‌سازی فوری')}`
                : mode === 'cloud_synced' && isCloudAuthenticated
                ? `${t('common.cloudSynced')} - ${t('common.syncNow', 'همگام‌سازی فوری')}`
                : mode === 'cloud_synced'
                ? t('common.cloudLoginRequired')
                : `${t('common.localOffline')} - ${t('common.switchToCloud', 'اتصال به سرور ابری')}`
            }
            className={`relative flex items-center justify-center w-8 h-8 rounded-full border transition-all cursor-pointer shadow-2xs ${
              pendingCount > 0
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                : mode === 'cloud_synced' && isCloudAuthenticated
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 hover:bg-blue-100/80 dark:hover:bg-blue-900/50'
                : 'text-neutral-600 dark:text-neutral-300 bg-neutral-50/80 dark:bg-neutral-800/80 border-neutral-200/90 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
          >
            {syncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
            ) : mode === 'cloud_synced' ? (
              <Cloud className="w-4 h-4" />
            ) : (
              <Database className="w-4 h-4" />
            )}

            {/* Notification Dot or Pending Counter */}
            {pendingCount > 0 ? (
              <span className="absolute -top-1 -end-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold font-mono flex items-center justify-center shadow-xs">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            ) : (
              <span
                className={`absolute bottom-0 end-0 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#0f121a] ${
                  mode === 'cloud_synced' && isCloudAuthenticated
                    ? 'bg-blue-500'
                    : 'bg-emerald-500'
                }`}
              />
            )}
          </button>

          {/* Dark / Light / System Theme Switcher Dropdown */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              title={`${t('common.theme')}: ${theme === 'dark' ? t('common.themeDark') : theme === 'light' ? t('common.themeLight') : t('common.themeSystem')}`}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-neutral-200/80 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer shadow-2xs"
            >
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : theme === 'light' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Monitor className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              )}
            </button>

            {isThemeMenuOpen && (
              <div className="absolute end-0 mt-2 w-40 bg-white dark:bg-[#14161c] rounded-2xl shadow-xl border border-neutral-200/90 dark:border-neutral-800 py-1.5 z-50 animate-fade-in text-neutral-800 dark:text-neutral-200">
                <button
                  onClick={() => {
                    setTheme('light');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer text-start ${
                    theme === 'light' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{t('common.themeLight')}</span>
                </button>
                <button
                  onClick={() => {
                    setTheme('dark');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer text-start ${
                    theme === 'dark' ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{t('common.themeDark')}</span>
                </button>
                <button
                  onClick={() => {
                    setTheme('system');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer text-start ${
                    theme === 'system' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Monitor className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span>{t('common.themeSystem')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Login Modal */}
      <LoginModal />

      {/* Header Organization Creation Modal */}
      <CreateOrganizationModal
        isOpen={isCreateOrgOpen}
        onClose={() => setIsCreateOrgOpen(false)}
        onSuccess={() => refreshOrganizations()}
      />

      {/* Upgrade to Pro Modal */}
      <UpgradeToProModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSuccess={() => {
          setModeState('cloud_synced');
          refreshOrganizations();
        }}
      />

      {/* Quick Search & Command Palette Modal (Ctrl+K) */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        onNavigate={(route) => {
          if (onNavigate) {
            onNavigate(route);
          }
        }}
        onSyncNow={handleSyncNow}
        onOpenCreateOrg={() => setIsCreateOrgOpen(true)}
      />
    </>
  );
};


