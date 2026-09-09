import React, { useState } from 'react';
import { Lock, KeyRound, Sparkles, CheckCircle2, Copy, Check, ShieldCheck, Cpu, CreditCard } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { useTranslation } from '../../i18n';
import { formatModulePrice } from '../../utils/license';
import { PurchaseModuleModal } from '../modals/PurchaseModuleModal';

interface ModuleLockedCardProps {
  moduleSlug: string;
  moduleName: string;
  description?: string;
  onUnlocked?: () => void;
  id?: string;
}

export const ModuleLockedCard: React.FC<ModuleLockedCardProps> = ({
  moduleSlug,
  moduleName,
  description,
  onUnlocked,
  id,
}) => {
  const { t, locale } = useTranslation();
  const { systemModules, orgModules, hardwareId, activateLicense, createDemoLicenseToken, refreshModules } = useModuleAccess();

  const [licenseKey, setLicenseKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [copiedHwId, setCopiedHwId] = useState(false);
  const [generatedDemoKey, setGeneratedDemoKey] = useState<string | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const matchedModule = systemModules.find((m) => m.slug === moduleSlug);
  const matchedOrgModule = orgModules.find((m) => m.slug === moduleSlug);

  // Read whether this module is included in Pro plan from the database item
  const isIncludedInPro = matchedOrgModule?.included_in_pro !== undefined
    ? Boolean(matchedOrgModule.included_in_pro)
    : Boolean(matchedModule?.included_in_pro);

  // Formatted price according to active locale (Tomans in Persian, USD in English)
  const formattedPrice = formatModulePrice(matchedModule || matchedOrgModule, locale);

  const handleCopyHardwareId = () => {
    navigator.clipboard.writeText(hardwareId);
    setCopiedHwId(true);
    setTimeout(() => setCopiedHwId(false), 2500);
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setMessage({ text: t('modules.enterLicenseKeyAlert', 'لطفاً کلید لایسنس را وارد کنید.'), isError: true });
      return;
    }

    setIsActivating(true);
    setMessage(null);

    try {
      const res = await activateLicense(licenseKey);
      if (res.success) {
        setMessage({ text: res.message, isError: false });
        await refreshModules();
        if (onUnlocked) {
          setTimeout(() => onUnlocked(), 1200);
        }
      } else {
        setMessage({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setMessage({ text: err?.message || 'خطا در اعتبارسنجی لایسنس', isError: true });
    } finally {
      setIsActivating(false);
    }
  };

  const handleGenerateAndApplyDemoKey = async () => {
    try {
      setIsActivating(true);
      const token = await createDemoLicenseToken(moduleSlug);
      setGeneratedDemoKey(token);
      setLicenseKey(token);

      const res = await activateLicense(token);
      if (res.success) {
        setMessage({ text: 'لایسنس آفلاین تستی با موفقیت ایجاد و اعمال شد!', isError: false });
        await refreshModules();
        if (onUnlocked) {
          setTimeout(() => onUnlocked(), 1200);
        }
      } else {
        setMessage({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setMessage({ text: 'خطا در صدور لایسنس تستی', isError: true });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div id={id} className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <Card className="border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-b from-amber-50/20 to-white dark:from-amber-950/10 dark:to-[#13151a]">
        <div className="p-6 md:p-8 space-y-6 text-neutral-900 dark:text-neutral-100">
          {/* Header Icon and Badges */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{matchedModule?.name || moduleName}</h2>
                  {isIncludedInPro ? (
                    <Badge variant="info">{t('modules.badgeIncludedInPro', 'شامل در Pro')}</Badge>
                  ) : (
                    <Badge variant="warning">{t('modules.badgeStandalone', 'خرید مجزا')}</Badge>
                  )}
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {description || matchedModule?.description || t('modules.moduleLockedDesc', 'این بخش به عنوان ماژول تکمیلی و تخصصی ارائه شده است.')}
                </p>
              </div>
            </div>

            {formattedPrice && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                <div className="text-start sm:text-end shrink-0 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded-xl border border-amber-200/50 dark:border-amber-900/40">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 block">{t('modules.priceLabel', 'قیمت خرید دائمی')}</span>
                  <span className="text-base font-bold text-amber-700 dark:text-amber-400">{formattedPrice}</span>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white shadow-md font-bold text-xs shrink-0 cursor-pointer"
                  icon={<CreditCard className="w-4 h-4" />}
                >
                  {t('modules.payWithZibal', 'خرید آنلاین با درگاه زیبال')}
                </Button>
              </div>
            )}
          </div>

          {/* Features Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t('modules.featureOfflineTitle', 'کارکرد ۱۰۰٪ آفلاین')}</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                {t('modules.featureOfflineDesc', 'بدون نیاز به اینترنت، لایسنس روی دستگاه شما ثبت و فعال باقی می‌ماند.')}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {isIncludedInPro ? (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>{t('modules.featureProIncludedTitle', 'شامل در اشتراک Pro')}</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <span>{t('modules.featureStandaloneTitle', 'خرید مجزا (خارج از اشتراک Pro)')}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                {isIncludedInPro
                  ? t('modules.featureProIncludedDesc', 'این ماژول به عنوان بخشی از اشتراک Pro ارائه می‌شود و برای سازمان‌های دارای اشتراک فعال، باز است.')
                  : t('modules.featureStandaloneDesc', 'این ماژول به صورت لایسنس دائمی جداگانه ارائه می‌شود و با شناسه سخت‌افزاری فعال می‌گردد.')}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                <Cpu className="w-4 h-4 text-sky-600" />
                <span>{t('modules.featureHardwareTitle', 'قفل سخت‌افزاری امن')}</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                {t('modules.featureHardwareDesc', 'لایسنس با امضای رمزنگاری‌شده ضد دستکاری برای سیستم شما صادر می‌شود.')}
              </p>
            </div>
          </div>

          {/* Hardware ID Display */}
          <div className="p-4 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 block">
                {t('modules.hardwareIdLabel', 'شناسه سخت‌افزاری سیستم شما (جهت دریافت لایسنس):')}
              </span>
              <code className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200 select-all mt-0.5 inline-block dir-ltr">
                {hardwareId}
              </code>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyHardwareId}
              icon={copiedHwId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedHwId ? t('common.copied', 'کپی شد') : t('modules.copyHwId', 'کپی شناسه')}
            </Button>
          </div>

          {/* License Activation Form */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
              {t('modules.enterLicenseTokenLabel', 'کد فعال‌سازی یا توکن لایسنس:')}
            </label>
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder={t('modules.licenseTokenPlaceholder', 'کد لایسنس دریافتی را اینجا قرار دهید...')}
                className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <Button
                variant="primary"
                onClick={handleActivate}
                disabled={isActivating}
                icon={<KeyRound className="w-4 h-4" />}
              >
                {isActivating ? t('common.loading', 'در حال بررسی...') : t('modules.activateButton', 'فعال‌سازی لایسنس')}
              </Button>
            </div>

            {/* Test & Demo Quick Unlock Button */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                {t('modules.demoNote', 'برای تست عملکرد در محیط دمو و آفلاین می‌توانید لایسنس آزمایشی بسازید:')}
              </p>
              <button
                type="button"
                onClick={handleGenerateAndApplyDemoKey}
                disabled={isActivating}
                className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('modules.quickDemoActivate', 'فعال‌سازی فوری تستی')}</span>
              </button>
            </div>

            {/* Status Message Banner */}
            {message && (
              <div
                className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  message.isError
                    ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
                }`}
              >
                {message.isError ? (
                  <Lock className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>{message.text}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <PurchaseModuleModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        moduleSlug={moduleSlug}
        moduleName={matchedModule?.name || moduleName}
        onSuccess={() => {
          setIsPurchaseModalOpen(false);
          refreshModules();
          if (onUnlocked) onUnlocked();
        }}
      />
    </div>
  );
};
