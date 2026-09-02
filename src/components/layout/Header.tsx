import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { storageManager } from '../../storage';
import { StorageSyncManager } from '../../storage/syncManager';
import { LoginModal } from '../../features/auth/LoginModal';
import { CreateOrganizationModal } from '../../features/organizations/CreateOrganizationModal';
import { UpgradeToProModal } from '../modals/UpgradeToProModal';
import { Building2, Globe, Database, RefreshCw, User as UserIcon, CheckCircle2, Menu, PanelLeft, LogIn, LogOut, ShieldCheck, Cloud, Settings, ChevronDown, Plus, Store, Sparkles, Sun, Moon, Monitor } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onNavigate?: (route: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNavigate }) => {
  const { t, locale, setLocale } = useTranslation();
  const { organizations, activeOrganization, selectOrganization, refreshOrganizations, isOwner, userRole, permissions } = useOrganization();
  const { user, isCloudAuthenticated, openLoginModal, logout } = useAuth();
  const { theme, isDark, setTheme, toggleTheme } = useTheme();

  const [mode, setModeState] = useState(storageManager.getMode());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(StorageSyncManager.getQueue().length);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setIsOrgMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleStorageMode = () => {
    if (mode === 'local_offline') {
      if (!isCloudAuthenticated) {
        openLoginModal();
        return;
      }
      if (activeOrganization?.plan !== 'pro') {
        setIsUpgradeModalOpen(true);
        return;
      }
      storageManager.setMode('cloud_synced');
      setModeState('cloud_synced');
    } else {
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
    } finally {
      setSyncing(false);
    }
  };

  const getUserRoleLabel = () => {
    if (!isCloudAuthenticated) return 'مالک سازمان (آفلاین)';
    switch (userRole) {
      case 'owner':
        return 'مالک سازمان (Owner)';
      case 'manager':
        return 'مدیر فروشگاه (Manager)';
      case 'warehouse':
        return 'انباردار (Warehouse)';
      case 'sales':
        return 'فروشنده / صندوق‌دار (Sales)';
      case 'viewer':
        return 'مشاهده‌گر (Viewer)';
      default:
        return userRole || 'کاربر';
    }
  };

  return (
    <>
      <header className="h-16 bg-white/90 dark:bg-[#0e1014]/90 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800/80 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-vercel-sm transition-colors">
        {/* Left / Start: Sidebar Toggle & Organization Switcher Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            title="تغییر وضعیت سایدبار"
            className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <PanelLeft className="w-5 h-5 shrink-0" />
          </button>

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
                  {activeOrganization?.name || 'انتخاب سازمان'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 transition-transform ${isOrgMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Organization Switcher Dropdown Menu */}
            {isOrgMenuOpen && (
              <div className="absolute start-0 mt-2 w-72 bg-white dark:bg-[#14161c] rounded-2xl shadow-xl border border-neutral-200/90 dark:border-neutral-800 py-2 z-50 animate-fade-in text-neutral-800 dark:text-neutral-200">
                <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">سازمان‌ها و فروشگاه‌ها</span>
                  <span className="text-[11px] font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-neutral-600 dark:text-neutral-400">
                    {organizations.length} سازمان
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
                    <span>ایجاد سازمان / فروشگاه جدید</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right / End: Storage Mode Indicator, Language Switcher, Theme Switcher, User Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Storage Mode Toggle Badge */}
          <button
            onClick={toggleStorageMode}
            title={t('common.storageMode')}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border border-neutral-200/90 dark:border-neutral-700/80 hover:bg-neutral-50 dark:hover:bg-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200 transition-all cursor-pointer shadow-2xs"
          >
            <span className={`w-2 h-2 rounded-full ${mode === 'cloud_synced' && isCloudAuthenticated ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="hidden md:inline">
              {mode === 'local_offline' ? t('common.localOffline') : (isCloudAuthenticated ? t('common.cloudSynced') : 'اتصال ابری (ورود لازم است)')}
            </span>
          </button>

          {/* Sync Status Button if pending */}
          {pendingCount > 0 && (
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs font-mono text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-3 py-1 rounded-full border border-amber-200/80 dark:border-amber-800/60 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              <span>{pendingCount} {t('common.syncPending')}</span>
            </button>
          )}

          {/* Dark / Light / System Theme Switcher Dropdown */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              title={`پوسته: ${theme === 'dark' ? 'تیره' : theme === 'light' ? 'روشن' : 'سیستم'}`}
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
                  <span>روشن (Light)</span>
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
                  <span>تیره (Dark)</span>
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
                  <span>سیستم (System)</span>
                </button>
              </div>
            )}
          </div>

          {/* Language Switcher */}
          <button
            onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}
            className="flex items-center gap-1.5 text-xs font-mono text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-1 rounded-full border border-neutral-200/80 dark:border-neutral-700/80 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
            <span>{locale === 'fa' ? 'FA' : 'EN'}</span>
          </button>

          {/* User Badge with Dropdown Trigger */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 ps-2.5 border-s border-neutral-200 dark:border-neutral-700 hover:opacity-90 transition-opacity cursor-pointer focus:outline-none"
            >
              <div className={`w-7 h-7 font-bold text-xs rounded-full flex items-center justify-center shadow-xs transition-colors ${isCloudAuthenticated ? 'bg-blue-600 text-white' : 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900'}`}>
                {user?.first_name ? user.first_name[0] : 'T'}
              </div>
              <div className="hidden lg:block text-start">
                <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 truncate max-w-[110px]">
                  {getUserRoleLabel()}
                </p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute end-0 mt-2 w-64 bg-white dark:bg-[#14161c] rounded-2xl shadow-xl border border-neutral-200/90 dark:border-neutral-800 py-2 z-50 animate-fade-in text-neutral-800 dark:text-neutral-200">
                {/* Profile Header inside menu */}
                <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 rounded-t-2xl">
                  <p className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate mt-0.5">
                    {user?.email || ''}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${isCloudAuthenticated ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'}`}>
                      {isCloudAuthenticated ? 'متصل به همگام‌سازی ابری' : 'حالت آفلاین محلی'}
                    </span>
                  </div>
                </div>

                {/* Account Details & Role */}
                <div className="px-4 py-2.5 text-xs border-b border-neutral-100 dark:border-neutral-800 space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-neutral-500 dark:text-neutral-400">نقش کاربری:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">{getUserRoleLabel()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-neutral-500 dark:text-neutral-400">وضعیت اتصال:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">
                      {isCloudAuthenticated ? 'ابری همگام' : 'آفلاین محلی'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-1 space-y-0.5 text-xs font-medium">
                  {!isCloudAuthenticated ? (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        openLoginModal();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors text-start cursor-pointer font-bold"
                    >
                      <LogIn className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>ورود به حساب سرور ابری</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors text-start cursor-pointer font-bold"
                    >
                      <LogOut className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                      <span>خروج از حساب ابری</span>
                    </button>
                  )}

                  {onNavigate && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('settings/sync');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-start cursor-pointer"
                    >
                      <Settings className="w-4 h-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
                      <span>تنظیمات سرور و همگام‌سازی</span>
                    </button>
                  )}
                </div>
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
    </>
  );
};


