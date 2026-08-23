import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager } from '../../storage';
import { StorageSyncManager } from '../../storage/syncManager';
import { LoginModal } from '../../features/auth/LoginModal';
import { CreateOrganizationModal } from '../../features/organizations/CreateOrganizationModal';
import { Building2, Globe, Database, RefreshCw, User as UserIcon, CheckCircle2, Menu, PanelLeft, LogIn, LogOut, ShieldCheck, Cloud, Settings, ChevronDown, Plus, Store } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onNavigate?: (route: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNavigate }) => {
  const { t, locale, setLocale } = useTranslation();
  const { organizations, activeOrganization, selectOrganization, refreshOrganizations, isOwner } = useOrganization();
  const { user, isCloudAuthenticated, openLoginModal, logout } = useAuth();

  const [mode, setModeState] = useState(storageManager.getMode());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(StorageSyncManager.getQueue().length);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setIsOrgMenuOpen(false);
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
      storageManager.setMode('cloud_synced');
      setModeState('cloud_synced');
    } else {
      storageManager.setMode('local_offline');
      setModeState('local_offline');
    }
  };

  const handleSyncNow = async () => {
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
    if (!user) return 'کاربر ناشناس';
    if (typeof user.role === 'object' && user.role?.name) {
      return user.role.name;
    }
    if (typeof user.role === 'string') {
      return user.role;
    }
    return isCloudAuthenticated ? 'کاربر سرور ابری' : 'مدیر کل (آفلاین)';
  };

  return (
    <>
      <header className="h-16 bg-white/90 backdrop-blur-md border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-vercel-sm">
        {/* Left / Start: Sidebar Toggle & Organization Switcher Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            title="تغییر وضعیت سایدبار"
            className="p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <PanelLeft className="w-5 h-5 shrink-0" />
          </button>

          {/* Interactive Organization Dropdown */}
          <div className="relative" ref={orgMenuRef}>
            <button
              onClick={() => setIsOrgMenuOpen(!isOrgMenuOpen)}
              className="flex items-center gap-2 bg-neutral-100/90 hover:bg-neutral-200/70 rounded-xl px-3 py-1.5 border border-neutral-200/90 transition-all cursor-pointer focus:outline-none shadow-2xs"
            >
              <div className="w-5 h-5 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
                <Building2 className="w-3 h-3" />
              </div>
              <div className="text-start pe-1">
                <span className="text-xs font-bold text-neutral-900 block truncate max-w-[140px] sm:max-w-[180px]">
                  {activeOrganization?.name || 'انتخاب سازمان'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${isOrgMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Organization Switcher Dropdown Menu */}
            {isOrgMenuOpen && (
              <div className="absolute start-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-neutral-200/90 py-2 z-50 animate-fade-in text-neutral-800">
                <div className="px-4 py-2.5 border-b border-neutral-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700">سازمان‌ها و فروشگاه‌ها</span>
                  <span className="text-[11px] font-mono font-semibold bg-neutral-100 px-2 py-0.5 rounded-full text-neutral-600">
                    {organizations.length} سازمان
                  </span>
                </div>

                {/* Organization List */}
                <div className="max-h-56 overflow-y-auto p-1 space-y-1">
                  {organizations.map((org) => {
                    const isSelected = activeOrganization?.id === org.id;
                    return (
                      <button
                        key={org.id}
                        onClick={() => {
                          selectOrganization(org.id);
                          setIsOrgMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-start ${
                          isSelected
                            ? 'bg-neutral-900 text-white font-bold'
                            : 'hover:bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                            }`}
                          >
                            {org.name ? org.name[0] : 'O'}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs">{org.name}</p>
                            {org.slug && (
                              <p className={`text-[10px] font-mono truncate ${isSelected ? 'text-neutral-300' : 'text-neutral-400'}`}>
                                {org.slug}
                              </p>
                            )}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Add New Organization Action */}
                <div className="p-1 pt-1.5 border-t border-neutral-100 mt-1">
                  <button
                    onClick={() => {
                      setIsOrgMenuOpen(false);
                      setIsCreateOrgOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors text-start cursor-pointer"
                  >
                    <Plus className="w-4 h-4 shrink-0 text-blue-600" />
                    <span>ایجاد سازمان / فروشگاه جدید</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right / End: Storage Mode Indicator, Language Switcher, User Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Storage Mode Toggle Badge */}
          <button
            onClick={toggleStorageMode}
            title={t('common.storageMode')}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border border-neutral-200/90 hover:bg-neutral-50 bg-neutral-50/80 text-neutral-800 transition-all cursor-pointer shadow-2xs"
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
              className="flex items-center gap-1.5 text-xs font-mono text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-full border border-amber-200/80 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              <span>{pendingCount} {t('common.syncPending')}</span>
            </button>
          )}

          {/* Language Switcher */}
          <button
            onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}
            className="flex items-center gap-1.5 text-xs font-mono text-neutral-700 hover:bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200/80 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-neutral-500" />
            <span>{locale === 'fa' ? 'FA' : 'EN'}</span>
          </button>

          {/* User Badge with Dropdown Trigger */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 ps-2.5 border-s border-neutral-200 hover:opacity-90 transition-opacity cursor-pointer focus:outline-none"
            >
              <div className={`w-7 h-7 font-bold text-xs rounded-full flex items-center justify-center shadow-xs transition-colors ${isCloudAuthenticated ? 'bg-blue-600 text-white' : 'bg-[#171717] text-white'}`}>
                {user?.first_name ? user.first_name[0] : 'T'}
              </div>
              <div className="hidden lg:block text-start">
                <p className="text-xs font-bold text-neutral-900 leading-tight">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[10px] font-mono text-neutral-500 truncate max-w-[110px]">
                  {getUserRoleLabel()}
                </p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute end-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-neutral-200/90 py-2 z-50 animate-fade-in text-neutral-800">
                {/* Profile Header inside menu */}
                <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50 rounded-t-2xl">
                  <p className="font-bold text-xs text-neutral-900">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-[11px] text-neutral-500 font-mono truncate mt-0.5">
                    {user?.email || 'admin@tankhor.com'}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${isCloudAuthenticated ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {isCloudAuthenticated ? 'متصل به همگام‌سازی ابری' : 'حالت آفلاین محلی'}
                    </span>
                  </div>
                </div>

                {/* Account Details & Role */}
                <div className="px-4 py-2.5 text-xs border-b border-neutral-100 space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-neutral-500">نقش کاربری:</span>
                    <span className="font-bold text-neutral-800">{getUserRoleLabel()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-neutral-500">وضعیت اتصال:</span>
                    <span className="font-bold text-neutral-800">
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors text-start cursor-pointer font-bold"
                    >
                      <LogIn className="w-4 h-4 shrink-0 text-blue-600" />
                      <span>ورود به حساب سرور ابری</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-start cursor-pointer font-bold"
                    >
                      <LogOut className="w-4 h-4 shrink-0 text-red-600" />
                      <span>خروج از حساب ابری</span>
                    </button>
                  )}

                  {onNavigate && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('settings/sync');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors text-start cursor-pointer"
                    >
                      <Settings className="w-4 h-4 shrink-0 text-neutral-500" />
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
    </>
  );
};


