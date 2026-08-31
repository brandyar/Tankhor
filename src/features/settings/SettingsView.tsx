import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager, isTauriEnvironment } from '../../storage';
import { StorageSyncManager } from '../../storage/syncManager';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EditOrganizationModal } from '../organizations/EditOrganizationModal';
import { CreateOrganizationModal } from '../organizations/CreateOrganizationModal';
import { OrganizationMembersSection } from '../organizations/OrganizationMembersSection';
import { LocalBackupRestoreCard } from './LocalBackupRestoreCard';
import { UpgradeToProModal } from '../../components/modals/UpgradeToProModal';
import { Database, Cloud, RefreshCw, LogIn, LogOut, ShieldCheck, Building2, Edit3, Plus, ShieldAlert, Globe, Clock, CheckCircle2, Users, Sparkles, Lock } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization, isOwner, userRole, refreshOrganizations } = useOrganization();
  const {
    user,
    isCloudAuthenticated,
    openLoginModal,
    logout,
  } = useAuth();

  const [mode, setMode] = useState(storageManager.getMode());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isEditOrgOpen, setIsEditOrgOpen] = useState(false);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleModeChange = (newMode: 'local_offline' | 'cloud_synced') => {
    if (newMode === 'cloud_synced') {
      if (!isCloudAuthenticated) {
        openLoginModal();
        return;
      }
      if (activeOrganization?.plan !== 'pro') {
        setIsUpgradeModalOpen(true);
        return;
      }
    }
    storageManager.setMode(newMode);
    setMode(newMode);
  };

  const handleManualSync = async () => {
    if (activeOrganization?.plan !== 'pro') {
      setIsUpgradeModalOpen(true);
      return;
    }
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await StorageSyncManager.syncLocalToCloud(storageManager.getCloudAdapter());
      setSyncStatusMsg(`همگام‌سازی انجام شد: ${res.success} موفق، ${res.failed} ناموفق.`);
      await refreshOrganizations();
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
    return isCloudAuthenticated ? 'کاربر سرور ابری' : 'مدیر کل (آفلاین)';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('navigation.orgSettings', 'تنظیمات')}
        subtitle="مدیریت اطلاعات سازمان، کاربران و دسترسی‌ها، پشتیبان‌گیری پایگاه داده و پیکربندی سیستم"
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

      {/* Active Org Profile & Owner Edit Section */}
      <Card
        title="اطلاعات سازمان فعال"
        subtitle="مشخصات، واحد پول، منطقه زمانی و مدیریت تنظیمات کسب‌وکار"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOrgOpen(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
              className="text-xs font-medium"
            >
              سازمان جدید
            </Button>
            {isOwner ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsEditOrgOpen(true)}
                icon={<Edit3 className="w-3.5 h-3.5" />}
                className="text-xs font-bold bg-blue-600 hover:bg-blue-700"
              >
                ویرایش اطلاعات سازمان
              </Button>
            ) : (
              <Badge variant="neutral">نقش: {userRole} (فقط مشاهده)</Badge>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {!isOwner && (
            <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                شما به عنوان <strong>{userRole}</strong> در این سازمان عضو هستید. ویرایش اطلاعات سازمان فقط برای <strong>مالک (Owner)</strong> مجاز است.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/80">
            <div className="space-y-1">
              <span className="text-[11px] text-neutral-500 font-medium">نام سازمان / برند</span>
              <p className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-neutral-500 shrink-0" />
                <span>{activeOrganization?.name || 'سازمان اصلی'}</span>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-neutral-500 font-medium">شناسه یکتا (Slug)</span>
              <p className="text-xs font-mono font-bold text-neutral-700 dir-ltr text-start">
                {activeOrganization?.slug || '-'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-neutral-500 font-medium">واحد پول پیش‌فرض</span>
              <p className="text-xs font-bold text-neutral-800">
                {activeOrganization?.currency === 'TOMAN' ? 'تومان (TOMAN)' : (activeOrganization?.currency || 'TOMAN')}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-neutral-500 font-medium">منطقه زمانی</span>
              <p className="text-xs font-mono text-neutral-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>{activeOrganization?.timezone || 'Asia/Tehran'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-2">
              <span>وضعیت سازمان:</span>
              <Badge variant={activeOrganization?.status === 'active' ? 'success' : 'neutral'}>
                {activeOrganization?.status === 'active' ? 'فعال' : (activeOrganization?.status || 'نامشخص')}
              </Badge>
              <span className="ms-2">پلن:</span>
              <Badge variant={activeOrganization?.plan === 'pro' ? 'info' : 'neutral'}>
                {activeOrganization?.plan === 'pro' ? 'حرفه‌ای (Pro)' : 'رایگان (Free)'}
              </Badge>
            </div>
            {activeOrganization?.date_created && (
              <span className="font-mono text-[11px]">
                تاریخ ایجاد: {new Date(activeOrganization.date_created).toLocaleDateString('fa-IR')}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Organization Members & Roles Section */}
      <OrganizationMembersSection />

      {/* Local Backup, Restore & Demo Data Management */}
      <LocalBackupRestoreCard />

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
            <div className="flex items-center gap-1.5">
              {isTauriEnvironment() ? (
                <Badge variant="success">SQLite Desktop</Badge>
              ) : (
                <Badge variant="neutral">Local Storage</Badge>
              )}
              {mode === 'local_offline' && <Badge variant="success">فعال</Badge>}
            </div>
          </div>
          <h3 className="text-base font-bold text-neutral-900">
            حالت آفلاین محلی {isTauriEnvironment() ? '(پایگاه داده SQLite)' : '(حافظه مرورگر)'}
          </h3>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            {isTauriEnvironment()
              ? 'داده‌ها در دیتابیس مستقل و فوق‌سریع SQLite (فایل tankhor.db در حافظه دسکتاپ) ذخیره می‌شوند. بدون محدودیت حجم و پایدار در برابر ریست ویندوز.'
              : 'داده‌ها روی حافظه محلی دستگاه ذخیره می‌شوند. کاملاً رایگان، بدون نیاز به اینترنت و بسیار سریع.'}
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
            <div className="flex items-center gap-1.5">
              {activeOrganization?.plan !== 'pro' && (
                <Badge variant="warning" className="flex items-center gap-1 text-[10px]">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  پلن Pro
                </Badge>
              )}
              {mode === 'cloud_synced' && <Badge variant="info">فعال است</Badge>}
            </div>
          </div>
          <h3 className="text-base font-bold text-neutral-900 flex items-center justify-between">
            <span>همگام‌سازی ابری (نسخه پیشرفته)</span>
            {activeOrganization?.plan !== 'pro' && (
              <span className="text-[11px] font-bold text-blue-600 hover:underline">
                ارتقا به Pro
              </span>
            )}
          </h3>
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

      {/* Upgrade to Pro Modal */}
      <UpgradeToProModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSuccess={() => {
          setMode('cloud_synced');
          refreshOrganizations();
        }}
      />

      {/* Edit Organization Modal */}
      <EditOrganizationModal
        isOpen={isEditOrgOpen}
        onClose={() => setIsEditOrgOpen(false)}
        organization={activeOrganization}
        onSuccess={() => refreshOrganizations()}
      />

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={isCreateOrgOpen}
        onClose={() => setIsCreateOrgOpen(false)}
        onSuccess={() => refreshOrganizations()}
      />
    </div>
  );
};

