import React, { useState } from 'react';
import {
  Boxes,
  Lock,
  Unlock,
  KeyRound,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  Barcode,
  Calculator,
  Users,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  RefreshCw,
  CloudCheck,
  XCircle,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { useTranslation } from '../../i18n';
import { SystemModule } from '../../types';
import { formatModulePrice } from '../../utils/license';
import { PurchaseModuleModal } from '../../components/modals/PurchaseModuleModal';
import { formatDate } from '../../utils/formatters';

export const ModulesManagementCard: React.FC = () => {
  const { t, locale } = useTranslation();
  const {
    hasAccess,
    isPro,
    systemModules,
    orgModules,
    hardwareId,
    refreshModules,
    syncWithServer,
    isSyncing,
    lastSyncInfo,
    loading,
  } = useModuleAccess();

  const [activePurchaseModule, setActivePurchaseModule] = useState<SystemModule | null>(null);
  const [copiedHwId, setCopiedHwId] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'offline' | 'error'; message: string } | null>(null);

  const getModuleIcon = (slug: string) => {
    switch (slug) {
      case 'barcode':
        return <Barcode className="w-5 h-5 text-amber-600" />;
      case 'accounting':
        return <Calculator className="w-5 h-5 text-emerald-600" />;
      case 'staff':
        return <Users className="w-5 h-5 text-sky-600" />;
      case 'crm':
        return <HeartHandshake className="w-5 h-5 text-rose-600" />;
      default:
        return <Boxes className="w-5 h-5 text-neutral-600" />;
    }
  };

  const handleCopyHw = () => {
    navigator.clipboard.writeText(hardwareId);
    setCopiedHwId(true);
    setTimeout(() => setCopiedHwId(false), 2500);
  };

  const handleOpenPurchase = (mod: SystemModule) => {
    setActivePurchaseModule(mod);
  };

  const handleManualSync = async () => {
    try {
      const res = await syncWithServer(true);
      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message: t('modules.syncSuccess', 'وضعیت لایسنس‌ها با موفقیت از سرور استعلام و به‌روز شد.'),
        });
      } else if (res.offline) {
        setSyncFeedback({
          type: 'offline',
          message: t('modules.syncOfflineNotice', 'سرور در دسترس نیست؛ لایسنس محلی معتبر روی دستگاه فعال است.'),
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || 'خطا در ارتباط با سرور',
        });
      }
    } catch (e: any) {
      setSyncFeedback({
        type: 'error',
        message: e?.message || 'خطا در ارتباط با سرور',
      });
    }

    setTimeout(() => {
      setSyncFeedback(null);
    }, 4000);
  };

  return (
    <Card
      id="modules-management-card"
      title={
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-amber-600" />
          <span>{t('modules.managementTitle', 'مدیریت ماژول‌های تخصصی و لایسنس‌ها')}</span>
        </div>
      }
      subtitle={t('modules.managementSubtitle', 'مدیریت فعال‌سازی افزونه‌های تخصصی، بارکد، حسابداری و شناسه سخت‌افزاری')}
    >
      <div className="space-y-6">
        {/* Pro Plan Banner */}
        {isPro ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                {t('modules.proPlanActiveTitle', 'اشتراک پرو (Pro) فعال است')}
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">
                {t('modules.proPlanDescWithStandalone', 'ماژول‌های دارای نشان «شامل در Pro» با داشتن این اشتراک به صورت خودکار فعال هستند. ماژول‌های مجزا با لایسنس مستقل فعال می‌شوند.')}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {t('modules.offlineModelTitle', 'مدل ماژولار و مالکیت دائمی آفلاین')}
                </h4>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                  {t('modules.offlineModelDesc', 'شما می‌توانید هر ماژول را به صورت لایسنس دائمی آفلاین خریداری و با شناسه سخت‌افزاری فعال کنید، یا با تهیه اشتراک پرو به همه ماژول‌ها دسترسی یابید.')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Server Sync & Hardware ID Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Hardware ID */}
          <div className="p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
            <div className="overflow-hidden">
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block font-medium">
                {t('modules.systemHardwareId', 'شناسه سخت‌افزاری این دستگاه:')}
              </span>
              <code className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200 select-all dir-ltr mt-0.5 inline-block truncate max-w-[200px]">
                {hardwareId}
              </code>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyHw}
              icon={copiedHwId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedHwId ? t('common.copied', 'کپی شد') : t('modules.copyHwId', 'کپی شناسه')}
            </Button>
          </div>

          {/* Server Sync Status & Check Button */}
          <div className="p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
            <div className="overflow-hidden">
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block font-medium">
                {t('modules.lastSyncLabel', 'آخرین وضعیت بررسی آنلاین با سرور:')}
              </span>
              <span className="text-xs text-neutral-700 dark:text-neutral-300 font-medium flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                {lastSyncInfo?.timestamp ? formatDate(lastSyncInfo.timestamp, locale === 'fa') : 'همگام‌سازی اولیه انجام شده'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-600' : ''}`} />}
            >
              {isSyncing ? t('modules.syncingWithServer', 'در حال بررسی...') : t('modules.checkLicenses', 'بررسی مجدد')}
            </Button>
          </div>
        </div>

        {/* Sync feedback notification */}
        {syncFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 transition-all ${
              syncFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : syncFeedback.type === 'offline'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : syncFeedback.type === 'offline' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
        )}

        {/* Modules Catalog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {systemModules.map((mod) => {
            const unlocked = hasAccess(mod.slug);
            const isComingSoon = mod.status === 'draft';
            const isModIncludedInPro = Boolean(mod.included_in_pro);
            const formattedPrice = formatModulePrice(mod, locale);

            // Check if explicitly revoked in local orgModules
            const orgMod = orgModules.find((m) => m.slug === mod.slug);
            const isRevoked = orgMod?.status === 'revoked';

            return (
              <div
                key={mod.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-4 ${
                  unlocked
                    ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : isRevoked
                    ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/10 dark:bg-rose-950/10'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
                        {getModuleIcon(mod.slug)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{mod.name}</h4>
                        <span className="text-[11px] font-mono text-neutral-400 block">slug: {mod.slug}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {isModIncludedInPro ? (
                        <Badge variant="info">{t('modules.badgeIncludedInPro', 'شامل در Pro')}</Badge>
                      ) : (
                        <Badge variant="neutral">{t('modules.badgeStandalone', 'خرید مجزا')}</Badge>
                      )}
                      {unlocked ? (
                        <Badge variant="success">
                          <CheckCircle2 className="w-3 h-3 me-1" />
                          {isPro && isModIncludedInPro ? t('modules.unlockedViaPro', 'فعال در پلن Pro') : t('modules.unlockedViaLicense', 'لایسنس فعال')}
                        </Badge>
                      ) : isRevoked ? (
                        <Badge variant="danger">
                          <XCircle className="w-3 h-3 me-1" />
                          {t('modules.licenseRevoked', 'لغو شده توسط سرور')}
                        </Badge>
                      ) : isComingSoon ? (
                        <Badge variant="neutral">{t('modules.comingSoon', 'به‌زودی')}</Badge>
                      ) : (
                        <Badge variant="warning">
                          <Lock className="w-3 h-3 me-1" />
                          {t('modules.locked', 'قفل')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {formattedPrice}
                  </span>

                  <div>
                    {!unlocked && !isComingSoon && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenPurchase(mod)}
                        className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs text-xs font-semibold cursor-pointer"
                        icon={<CreditCard className="w-3.5 h-3.5" />}
                      >
                        {t('modules.buyAndActivate', 'خرید و فعال‌سازی')}
                      </Button>
                    )}
                    {unlocked && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <Unlock className="w-3.5 h-3.5" />
                        <span>{t('modules.readyToUse', 'آماده استفاده')}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Purchase & Activation Modal */}
        {activePurchaseModule && (
          <PurchaseModuleModal
            isOpen={Boolean(activePurchaseModule)}
            onClose={() => setActivePurchaseModule(null)}
            moduleSlug={activePurchaseModule.slug}
            moduleName={activePurchaseModule.name}
            onSuccess={() => {
              setActivePurchaseModule(null);
              refreshModules();
            }}
          />
        )}
      </div>
    </Card>
  );
};

