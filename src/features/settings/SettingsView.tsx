import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager } from '../../storage';
import { StorageSyncManager } from '../../storage/syncManager';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Database, Cloud, RefreshCw, LogIn, LogOut, ShieldCheck } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();
  const {
    user,
    isCloudAuthenticated,
    openLoginModal,
    logout,
  } = useAuth();

  const [mode, setMode] = useState(storageManager.getMode());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const handleModeChange = (newMode: 'local_offline' | 'cloud_synced') => {
    if (newMode === 'cloud_synced' && !isCloudAuthenticated) {
      openLoginModal();
      return;
    }
    storageManager.setMode(newMode);
    setMode(newMode);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await StorageSyncManager.syncLocalToCloud(storageManager.getCloudAdapter());
      setSyncStatusMsg(`همگام‌سازی انجام شد: ${res.success} موفق، ${res.failed} ناموفق.`);
    } catch (err: any) {
      setSyncStatusMsg(`خطا در همگام‌سازی: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const getUserRoleName = () => {
    if (!user) return 'کاربر سیستم';
    if (typeof user.role === 'object' && user.role?.name) {
      return user.role.name;
    }
    if (typeof user.role === 'string') {
      return user.role;
    }
    return isCloudAuthenticated ? 'کاربر سرور ابری' : 'کاربر آفلاین محلی';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('navigation.storageSyncSettings')}
        subtitle="پیکربندی حالت ذخیره‌سازی، وضعیت همگام‌سازی ابری و مدیریت حساب کاربری"
      />

      {/* Cloud Account Status Banner */}
      <Card title="وضعیت حساب و احراز هویت" subtitle="مشخصات کاربر فعال و سطح دسترسی سیستم">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200/80">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-xs ${isCloudAuthenticated ? 'bg-blue-600' : 'bg-neutral-800'}`}>
              {user?.first_name ? user.first_name[0] : 'T'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900">
                  {user?.first_name} {user?.last_name}
                </h3>
                <Badge variant={isCloudAuthenticated ? 'info' : 'neutral'}>
                  {isCloudAuthenticated ? 'حساب ابری متصل' : 'آفلاین محلی'}
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">{user?.email}</p>
              <p className="text-[11px] text-neutral-600 mt-1">
                نقش سیستم: <strong className="text-neutral-900">{getUserRoleName()}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isCloudAuthenticated ? (
              <Button
                variant="primary"
                onClick={openLoginModal}
                icon={<LogIn className="w-4 h-4" />}
                className="text-xs font-bold"
              >
                ورود به حساب کاربری
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => logout()}
                icon={<LogOut className="w-4 h-4 text-red-500" />}
                className="text-xs font-bold text-red-600 hover:bg-red-50 border-red-200"
              >
                خروج از حساب کاربری
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Storage Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          onClick={() => handleModeChange('local_offline')}
          className={`p-6 bg-white border rounded-2xl cursor-pointer transition-all ${
            mode === 'local_offline'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
              : 'border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            {mode === 'local_offline' && <Badge variant="success">فعال است</Badge>}
          </div>
          <h3 className="text-base font-bold text-neutral-900">حالت آفلاین محلی (Free Desktop)</h3>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            داده‌ها روی حافظه محلی دستگاه ذخیره می‌شوند. کاملاً رایگان، بدون نیاز به اینترنت و بسیار سریع.
          </p>
        </div>

        <div
          onClick={() => handleModeChange('cloud_synced')}
          className={`p-6 bg-white border rounded-2xl cursor-pointer transition-all ${
            mode === 'cloud_synced'
              ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
              : 'border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            {mode === 'cloud_synced' && <Badge variant="info">فعال است</Badge>}
          </div>
          <h3 className="text-base font-bold text-neutral-900">همگام‌سازی ابری (نسخه پیشرفته)</h3>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            اتصال به سرور ابری جهت اشتراک‌گذاری هم‌زمان داده‌ها بین شعبه‌ها و دستگاه‌های مختلف.
          </p>
        </div>
      </div>

      {/* Cloud Sync Manual Trigger Card */}
      <Card title="وضعیت همگام‌سازی ابری" subtitle="ارسال تغییرات محلی به پایگاه داده ابری تن‌خور">
        <div className="space-y-4 max-w-xl">
          <p className="text-xs text-neutral-600 leading-relaxed">
            در صورت ثبت اطلاعات جدید در حالت آفلاین، با فشردن دکمه زیر اطلاعات شما با پایگاه داده همگام می‌شود.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              onClick={handleManualSync}
              isLoading={isSyncing}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              همگام‌سازی دستی اطلاعات
            </Button>
          </div>

          {syncStatusMsg && (
            <p className="text-xs font-semibold text-blue-800 bg-blue-50 p-3 rounded-xl border border-blue-100">
              {syncStatusMsg}
            </p>
          )}
        </div>
      </Card>

      {/* Active Org Profile */}
      <Card title="اطلاعات سازمان فعال" subtitle="شناسه و واحد پول حساب کاربر">
        <div className="space-y-2 text-xs text-neutral-700 font-mono">
          <p><span className="font-bold font-sans">نام سازمان:</span> {activeOrganization?.name}</p>
          <p><span className="font-bold font-sans">شناسه (Slug):</span> {activeOrganization?.slug}</p>
          <p><span className="font-bold font-sans">واحد پول اصلی:</span> {activeOrganization?.currency}</p>
          <p><span className="font-bold font-sans">منطقه زمانی:</span> {activeOrganization?.timezone}</p>
        </div>
      </Card>
    </div>
  );
};
