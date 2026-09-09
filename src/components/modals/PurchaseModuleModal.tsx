import React, { useState, useEffect, useRef } from 'react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager, isTauriEnvironment } from '../../storage';
import { directusClient } from '../../api/directus';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { useTranslation } from '../../i18n';
import { formatModulePrice } from '../../utils/license';
import { toPersianDigits } from '../../utils/formatters';
import { openExternalUrl } from '../../utils/desktop';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  CreditCard,
  ShieldCheck,
  Cpu,
  KeyRound,
  Sparkles,
  CheckCircle2,
  X,
  Copy,
  Check,
  Barcode,
  Boxes,
  Calculator,
  Users,
  HeartHandshake,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface PurchaseModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleSlug: string;
  moduleName?: string;
  onSuccess?: () => void;
  onOpenProModal?: () => void;
}

export const PurchaseModuleModal: React.FC<PurchaseModuleModalProps> = ({
  isOpen,
  onClose,
  moduleSlug,
  moduleName,
  onSuccess,
  onOpenProModal,
}) => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const { isCloudAuthenticated, openLoginModal } = useAuth();
  const { systemModules, orgModules, hardwareId, activateLicense, refreshModules, hasAccess } = useModuleAccess();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isTestActivating, setIsTestActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedHwId, setCopiedHwId] = useState(false);

  // Manual key section toggle
  const [showManualKey, setShowManualKey] = useState(false);
  const [manualKey, setManualKey] = useState('');

  // Waiting payment on desktop
  const [waitingPayment, setWaitingPayment] = useState<{
    trackId: number | string;
    paymentUrl: string;
    amountTomans: number;
  } | null>(null);
  const pollingTimerRef = useRef<any>(null);

  const matchedSystemMod = systemModules.find((m) => m.slug === moduleSlug);
  const matchedOrgMod = orgModules.find((m) => m.slug === moduleSlug);
  const resolvedName = moduleName || matchedSystemMod?.name || (moduleSlug === 'barcode' ? 'تولید و چاپ بارکد' : moduleSlug);
  const description = matchedSystemMod?.description || 'ماژول تخصصی و پرسرعت برای کسب‌وکارهای پوشاک و خرده‌فروشی';

  const isIncludedInPro = matchedOrgMod?.included_in_pro !== undefined
    ? Boolean(matchedOrgMod.included_in_pro)
    : Boolean(matchedSystemMod?.included_in_pro);

  const formattedPrice = formatModulePrice(matchedSystemMod || matchedOrgMod, locale) || '۴۹۰,۰۰۰ تومان';

  // Copy hardware id
  const handleCopyHw = () => {
    navigator.clipboard.writeText(hardwareId);
    setCopiedHwId(true);
    setTimeout(() => setCopiedHwId(false), 2000);
  };

  // Poll for desktop / external payment completion
  useEffect(() => {
    if (!waitingPayment || success) {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    const checkInterval = setInterval(async () => {
      try {
        await refreshModules();
        if (hasAccess(moduleSlug)) {
          clearInterval(checkInterval);
          pollingTimerRef.current = null;
          setWaitingPayment(null);
          setSuccess(true);
          if (onSuccess) onSuccess();
        }
      } catch {
        // silent retry
      }
    }, 3000);

    pollingTimerRef.current = checkInterval;

    return () => {
      clearInterval(checkInterval);
      pollingTimerRef.current = null;
    };
  }, [waitingPayment, success, moduleSlug, hasAccess, refreshModules, onSuccess]);

  if (!isOpen) return null;

  const getModuleIcon = (slug: string) => {
    switch (slug) {
      case 'barcode':
        return <Barcode className="w-7 h-7 text-amber-500" />;
      case 'accounting':
        return <Calculator className="w-7 h-7 text-emerald-500" />;
      case 'staff':
        return <Users className="w-7 h-7 text-sky-500" />;
      case 'crm':
        return <HeartHandshake className="w-7 h-7 text-rose-500" />;
      default:
        return <Boxes className="w-7 h-7 text-amber-500" />;
    }
  };

  /**
   * Real Online Payment via Zibal Gateway
   */
  const handleInitiatePayment = async (simulate = false) => {
    if (!activeOrganization?.id) return;
    setError(null);
    setIsProcessing(true);

    if (!isCloudAuthenticated) {
      openLoginModal();
      setIsProcessing(false);
      return;
    }

    try {
      const res = await directusClient.requestModulePayment({
        organizationId: activeOrganization.id,
        moduleSlug,
        hardwareId,
        simulate,
      });

      if (res && res.paymentUrl) {
        const isDesktop = isTauriEnvironment();
        if (isDesktop) {
          // Open in default system browser for desktop app
          await openExternalUrl(res.paymentUrl);
          setWaitingPayment({
            trackId: res.trackId || '-',
            paymentUrl: res.paymentUrl,
            amountTomans: res.amountTomans || 490000,
          });
        } else {
          // Direct redirect for web app
          window.location.href = res.paymentUrl;
        }
      } else {
        setError(res?.error || 'خطا در دریافت نشانی درگاه پرداخت زیبال.');
      }
    } catch (err: any) {
      console.error('[PurchaseModuleModal] Payment request failed:', err);
      setError(err?.message || 'خطا در ایجاد تراکنش در درگاه پرداخت زیبال.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 1-Click Test Activation (for instant preview testing)
   */
  const handleTestActivate = async () => {
    if (!activeOrganization?.id) return;
    setError(null);
    setIsTestActivating(true);

    try {
      const res = await directusClient.testActivateModule({
        organizationId: activeOrganization.id,
        moduleSlug,
        hardwareId,
      });

      if (res && res.success) {
        await refreshModules();
        setSuccess(true);
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1000);
        }
      } else {
        setError(res?.error || 'خطا در فعال‌سازی تستی ماژول.');
      }
    } catch (err: any) {
      console.error('[PurchaseModuleModal] Test activation failed:', err);
      setError(err?.message || 'خطا در فعال‌سازی ماژول.');
    } finally {
      setIsTestActivating(false);
    }
  };

  /**
   * Manual license key submit
   */
  const handleManualActivate = async () => {
    if (!manualKey.trim()) {
      setError('لطفاً کد لایسنس را وارد کنید.');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const res = await activateLicense(manualKey);
      if (res.success) {
        await refreshModules();
        setSuccess(true);
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1000);
        }
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'خطا در ثبت لایسنس');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="purchase-module-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id="purchase-module-modal-card"
        className="bg-white dark:bg-[#13151a] border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-scale-up"
      >
        {/* Header */}
        <div className="relative p-6 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-b border-neutral-100 dark:border-neutral-800/80">
          <button
            onClick={onClose}
            className="absolute top-5 end-5 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
              {getModuleIcon(moduleSlug)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  خرید لایسنس ماژول {resolvedName}
                </h3>
                {isIncludedInPro ? (
                  <Badge variant="info">شامل در Pro</Badge>
                ) : (
                  <Badge variant="warning">خرید مجزا</Badge>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  ماژول {resolvedName} با موفقیت فعال شد!
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  لایسنس دائمی این ماژول ثبت گردید و هم‌اکنون در تمامی بخش‌های سیستم در دسترس شماست.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={onClose}
                className="w-full justify-center text-xs font-bold py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                شروع استفاده از ماژول
              </Button>
            </div>
          ) : waitingPayment ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto animate-spin">
                <RefreshCw className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  در انتظار تکمیل پرداخت در درگاه زیبال...
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                  صفحه پرداخت در مرورگر باز شده است. پس از واریز، ماژول شما به صورت خودکار فعال خواهد شد.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs flex justify-between items-center font-mono">
                <span className="text-neutral-500">شماره تراکنش زیبال:</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {toPersianDigits(waitingPayment.trackId)}
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openExternalUrl(waitingPayment.paymentUrl)}
                  className="flex-1 justify-center text-xs"
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  باز کردن مجدد درگاه
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWaitingPayment(null)}
                  className="text-xs"
                >
                  انصراف
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Pro plan alternative recommendation */}
              {isIncludedInPro && onOpenProModal && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-200/80 dark:border-indigo-800/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block">
                        پیشنهاد ویژه: اشتراک Pro
                      </span>
                      <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        این ماژول در اشتراک Pro نیز رایگان است (به همراه ابری و همه ماژول‌ها).
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onOpenProModal();
                    }}
                    className="shrink-0 text-xs border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                  >
                    مشاهده Pro
                  </Button>
                </div>
              )}

              {/* Price & Benefits Box */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
                <div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 block font-medium">
                    مبلغ لایسنس دائمی (Lifetime):
                  </span>
                  <span className="text-xl font-black text-amber-700 dark:text-amber-400 mt-0.5 block">
                    {formattedPrice}
                  </span>
                </div>
                <div className="text-end space-y-1">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    بدون انقضا و بدون آبونمان
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    درگاه پرداخت امن زیبال (Zibal)
                  </span>
                </div>
              </div>

              {/* Hardware ID Info */}
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-500 shrink-0" />
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">
                      شناسه سخت‌افزاری سیستم شما:
                    </span>
                    <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200 dir-ltr inline-block">
                      {hardwareId}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyHw}
                  icon={copiedHwId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  className="h-8 text-[11px]"
                >
                  {copiedHwId ? 'کپی شد' : 'کپی'}
                </Button>
              </div>

              {/* Error Notice */}
              {error && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Payment Actions */}
              <div className="space-y-2.5 pt-1">
                <Button
                  variant="primary"
                  onClick={() => handleInitiatePayment(false)}
                  disabled={isProcessing || isTestActivating}
                  className="w-full justify-center text-xs font-bold py-3 bg-amber-600 hover:bg-amber-700 text-white shadow-md cursor-pointer"
                  icon={<CreditCard className="w-4 h-4" />}
                >
                  {isProcessing ? 'در حال اتصال به درگاه زیبال...' : `پرداخت آنلاین با زیبال (${formattedPrice})`}
                </Button>

                {/* Sandbox / Test Instant Payment */}
                <Button
                  variant="outline"
                  onClick={() => handleInitiatePayment(true)}
                  disabled={isProcessing || isTestActivating}
                  className="w-full justify-center text-xs font-semibold py-2.5 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
                  icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                >
                  تست پرداخت درگاه (محیط شبیه‌ساز زیبال - Sandbox)
                </Button>

                {/* 1-Click Instant Activation for Dev/Test */}
                <button
                  type="button"
                  onClick={handleTestActivate}
                  disabled={isProcessing || isTestActivating}
                  className="w-full text-center text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 pt-1 cursor-pointer"
                >
                  {isTestActivating ? 'در حال فعال‌سازی فوری...' : 'فعال‌سازی فوری تستی (بدون ورود به درگاه)'}
                </button>
              </div>

              {/* Manual Key Activation Collapsible */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowManualKey(!showManualKey)}
                  className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{showManualKey ? 'بستن فرم ورود کلید لایسنس' : 'لایسنس آفلاین خریداری کرده‌اید؟ ورود دستی کلید'}</span>
                </button>

                {showManualKey && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    <input
                      type="text"
                      value={manualKey}
                      onChange={(e) => setManualKey(e.target.value)}
                      placeholder="کد لایسنس توکن (مثلاً TK1_...)"
                      className="w-full px-3 py-2 text-xs font-mono bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualActivate}
                      disabled={isProcessing}
                      className="w-full justify-center text-xs"
                      icon={<Check className="w-3.5 h-3.5" />}
                    >
                      ثبت و فعال‌سازی لایسنس دستی
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
