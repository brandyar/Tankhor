import React, { useState, useEffect, useRef } from 'react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager, isTauriEnvironment } from '../../storage';
import { directusClient } from '../../api/directus';
import { useProjectSettings } from '../../hooks/useProjectSettings';
import { CloudMigrationManager, MigrationStepProgress } from '../../storage/cloudMigrationManager';
import { Button } from '../ui/Button';
import { toPersianDigits } from '../../utils/formatters';
import { openExternalUrl } from '../../utils/desktop';
import {
  Sparkles,
  Cloud,
  CheckCircle2,
  X,
  Zap,
  ShieldCheck,
  Users,
  Smartphone,
  CreditCard,
  Check,
  RefreshCw,
  Lock,
  UploadCloud,
  AlertCircle,
  Clock,
  ChevronLeft,
  ExternalLink,
  Laptop,
  Radio,
} from 'lucide-react';

interface UpgradeToProModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PlanOption {
  months: number;
  title: string;
  priceTomans: number;
  discountPercent: number;
  badge?: string;
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    months: 1,
    title: '۱ ماهه',
    priceTomans: 490000,
    discountPercent: 0,
  },
  {
    months: 3,
    title: '۳ ماهه (فصلی)',
    priceTomans: 1290000,
    discountPercent: 12,
    badge: 'محبوب‌ترین',
  },
  {
    months: 6,
    title: '۶ ماهه',
    priceTomans: 2390000,
    discountPercent: 18,
  },
  {
    months: 12,
    title: '۱۲ ماهه (یک‌ساله)',
    priceTomans: 4490000,
    discountPercent: 24,
    badge: 'بیشترین تخفیف',
  },
];

export const UpgradeToProModal: React.FC<UpgradeToProModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeOrganization, refreshOrganizations } = useOrganization();
  const { isCloudAuthenticated, openLoginModal } = useAuth();
  const { settings } = useProjectSettings();

  const [selectedMonths, setSelectedMonths] = useState<number>(3);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isTestActivating, setIsTestActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);

  // Desktop & External Payment Waiting State
  const [waitingPayment, setWaitingPayment] = useState<{
    trackId: number | string;
    paymentUrl: string;
    amountTomans: number;
    durationMonths: number;
  } | null>(null);
  const pollingTimerRef = useRef<any>(null);

  // Cloud Data Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationStepProgress | null>(null);
  const [migrationDone, setMigrationDone] = useState(false);
  const [migrationStats, setMigrationStats] = useState<{ total: number; errors: string[] } | null>(null);

  // Polling for Desktop/External payment confirmation
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
        const res = await directusClient.checkOrganizationPlan();
        if (res && (res.isPro || res.plan === 'pro')) {
          clearInterval(checkInterval);
          pollingTimerRef.current = null;
          await refreshOrganizations();
          storageManager.setMode('cloud_synced');
          setWaitingPayment(null);
          setSuccess(true);
        }
      } catch (e) {
        // silent retry
      }
    }, 3500);

    pollingTimerRef.current = checkInterval;

    return () => {
      clearInterval(checkInterval);
      pollingTimerRef.current = null;
    };
  }, [waitingPayment, success, refreshOrganizations]);

  if (!isOpen) return null;

  const currentPlan = PLAN_OPTIONS.find((p) => p.months === selectedMonths) || PLAN_OPTIONS[1];

  /**
   * Real Online Payment via Zibal Gateway
   */
  const handleInitiatePayment = async () => {
    if (!activeOrganization?.id) return;
    setError(null);
    setIsProcessingPayment(true);

    if (!isCloudAuthenticated) {
      openLoginModal();
      setIsProcessingPayment(false);
      return;
    }

    try {
      const res = await directusClient.requestPayment({
        organizationId: activeOrganization.id,
        durationMonths: selectedMonths,
        simulate: false,
      });

      if (res && res.paymentUrl) {
        const isDesktop = isTauriEnvironment();
        if (isDesktop) {
          // Open in default system browser for desktop app
          await openExternalUrl(res.paymentUrl);
          setWaitingPayment({
            trackId: res.trackId || '-',
            paymentUrl: res.paymentUrl,
            amountTomans: currentPlan.priceTomans,
            durationMonths: selectedMonths,
          });
        } else {
          // Direct redirect for web app
          window.location.href = res.paymentUrl;
        }
      } else {
        setError(res?.error || 'خطا در دریافت نشانی درگاه پرداخت زیبال.');
      }
    } catch (err: any) {
      console.error('[UpgradeToProModal] Payment request failed:', err);
      setError(err?.message || 'خطا در ایجاد تراکنش در درگاه پرداخت زیبال.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  /**
   * 1-Click Test Activation (for preview testing without real bank card)
   */
  const handleTestActivate = async () => {
    if (!activeOrganization?.id) return;
    setError(null);
    setIsTestActivating(true);

    if (!isCloudAuthenticated) {
      openLoginModal();
      setIsTestActivating(false);
      return;
    }

    try {
      const res = await directusClient.testActivateSubscription({
        organizationId: activeOrganization.id,
        durationMonths: selectedMonths,
      });

      if (res && res.success) {
        await refreshOrganizations();
        setSubscriptionDetails(res.subscription);
        setSuccess(true);
      } else {
        setError(res?.error || 'خطا در فعال‌سازی اشتراک آزمایشی.');
      }
    } catch (err: any) {
      console.error('[UpgradeToProModal] Test activation failed:', err);
      setError(err?.message || 'خطا در فعال‌سازی نسخه Pro.');
    } finally {
      setIsTestActivating(false);
    }
  };

  /**
   * Check Online Plan Status
   */
  const handleCheckPlanOnline = async () => {
    if (!activeOrganization) return;
    setIsChecking(true);
    setError(null);

    if (!isCloudAuthenticated) {
      openLoginModal();
      setIsChecking(false);
      return;
    }

    try {
      const res = await directusClient.checkOrganizationPlan();

      if (res && (res.isPro || res.plan === 'pro')) {
        await refreshOrganizations();
        setSuccess(true);
      } else {
        setError('اشتراک این سازمان هنوز در وضعیت «رایگان (Free)» است. در صورت پرداخت، چند لحظه بعد مجدداً بررسی کنید.');
      }
    } catch (err: any) {
      setError(err?.message || 'خطا در ارتباط با سرور.');
    } finally {
      setIsChecking(false);
    }
  };

  /**
   * Start local-to-cloud data migration
   */
  const handleStartMigration = async () => {
    if (!activeOrganization?.id) return;
    setIsMigrating(true);
    setError(null);

    try {
      const res = await CloudMigrationManager.migrateLocalToCloud(
        activeOrganization.id,
        (progress) => {
          setMigrationProgress(progress);
        }
      );

      storageManager.setMode('cloud_synced');
      setMigrationDone(true);
      setMigrationStats({ total: res.totalMigrated, errors: res.errors });
    } catch (err: any) {
      setError(err?.message || 'خطا در فرآیند انتقال داده‌های محلی به سرور ابری');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleFinishAndActivate = () => {
    storageManager.setMode('cloud_synced');
    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <div
      id="upgrade-pro-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isChecking && !isMigrating && !isProcessingPayment) onClose();
      }}
    >
      <div
        id="upgrade-pro-modal-card"
        className="w-full max-w-xl max-h-[92vh] bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col animate-scale-up"
      >
        {/* Header Ribbon */}
        <div className="relative bg-gradient-to-r from-neutral-950 via-blue-950 to-indigo-950 text-white p-5 sm:p-6 pb-6">
          <button
            onClick={onClose}
            disabled={isChecking || isMigrating || isProcessingPayment}
            className="absolute top-4 end-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-xl bg-amber-400 text-neutral-950 flex items-center justify-center font-black shadow-md">
              <Sparkles className="w-4 h-4 text-neutral-950" />
            </div>
            <span className="text-[11px] font-bold tracking-wide uppercase text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              ارتقا به نسخه حرفه‌ای (Pro)
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-1">
            فعال‌سازی اشتراک Pro و همگام‌سازی ابری
          </h2>
          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
            دسترسی نامحدود به پنل تحت وب، همگام‌سازی چندشعبه‌ای و اتصال تیم فروش و انبار
          </p>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(92vh-140px)]">
          {/* Active Org Context */}
          <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700/80 text-xs">
            <span className="text-neutral-700 dark:text-neutral-300">
              سازمان فعال: <strong className="text-neutral-900 dark:text-neutral-100">{activeOrganization?.name || 'سازمان من'}</strong>
            </span>
            <span className="px-2.5 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              پلن فعلی: {activeOrganization?.plan === 'pro' ? 'حرفه‌ای (Pro)' : 'رایگان (Free)'}
            </span>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-800 dark:text-red-300 text-xs rounded-xl leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Pro Confirmed - Migration Wizard View */}
          {success && !migrationDone && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>اشتراک حرفه‌ای (Pro) با موفقیت فعال گردید!</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                آیا مایلید اطلاعات ذخیره شده قبلی (کالاها، سایزها، تنوع‌ها و فاکتورها) به صورت خودکار به پایگاه داده سرور ابری منتقل شوند؟
              </p>

              {subscriptionDetails && (
                <div className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">شماره تراکنش / پیگیری:</span>
                    <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{subscriptionDetails.Transaction_id || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 dark:text-neutral-400">مبلغ پرداخت شده:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">{subscriptionDetails.transaction_amount || '-'}</span>
                  </div>
                </div>
              )}

              {isMigrating && migrationProgress && (
                <div className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    <span className="flex items-center gap-1.5">
                      <UploadCloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-bounce" />
                      در حال انتقال: {migrationProgress.step}
                    </span>
                    <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                      {migrationProgress.current} از {migrationProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 transition-all duration-300 rounded-full"
                      style={{
                        width: `${
                          migrationProgress.total > 0
                            ? Math.round((migrationProgress.current / migrationProgress.total) * 100)
                            : 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStartMigration}
                  isLoading={isMigrating}
                  icon={<UploadCloud className="w-4 h-4" />}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  انتقال خودکار اطلاعات به سرور ابری
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFinishAndActivate}
                  disabled={isMigrating}
                  className="text-xs"
                >
                  ورود بدون انتقال اطلاعات
                </Button>
              </div>
            </div>
          )}

          {/* Migration Complete View */}
          {migrationDone && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-blue-900 dark:text-blue-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>فرآیند مهاجرت اطلاعات با موفقیت تکمیل شد!</span>
              </div>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                تعداد <strong>{toPersianDigits(migrationStats?.total || 0)} رکورد</strong> با حفظ کامل پیوندهای کلید خارجی به سرور ابری منتقل شد.
              </p>
              <Button variant="primary" size="sm" onClick={handleFinishAndActivate} className="w-full text-xs font-bold">
                ورود به سامانه ابری تن‌خور
              </Button>
            </div>
          )}

          {/* Waiting For External / Desktop Payment */}
          {waitingPayment && !success && !migrationDone && (
            <div className="p-4 sm:p-5 bg-gradient-to-b from-blue-50/80 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800/80 rounded-2xl space-y-4 animate-scale-up">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <Laptop className="w-5 h-5 text-white" />
                  </div>
                  <span className="absolute -top-1 -end-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                  </span>
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    درگاه پرداخت زیبال در مرورگر شما باز شد
                  </h3>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed">
                    لطفاً فرآیند پرداخت را در مرورگر سیستم خود تکمیل فرمایید. این پنجره به صورت خودکار منتظر تأییدیه پرداخت می‌ماند.
                  </p>
                </div>
              </div>

              {/* Transaction Details Box */}
              <div className="bg-white dark:bg-neutral-800/90 rounded-xl p-3 border border-blue-100 dark:border-neutral-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">شناسه پیگیری تراکنش (Track ID):</span>
                  <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                    {toPersianDigits(waitingPayment.trackId)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">مبلغ قابل پرداخت:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {toPersianDigits(waitingPayment.amountTomans.toLocaleString('fa-IR'))} تومان
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">دوره انتخابی:</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    {toPersianDigits(waitingPayment.durationMonths)} ماهه
                  </span>
                </div>
              </div>

              {/* Live Status Indicator */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-100/60 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 text-xs font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
                <span>در حال رصد لحظه‌ای و دریافت خودکار تأییدیه پرداخت از سرور...</span>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCheckPlanOnline}
                  isLoading={isChecking}
                  icon={<RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />}
                  className="w-full justify-center text-xs font-bold py-2.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  پرداخت را انجام دادم (بررسی و فعال‌سازی فوری)
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openExternalUrl(waitingPayment.paymentUrl)}
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                    className="flex-1 justify-center text-[11px] cursor-pointer"
                  >
                    باز کردن مجدد درگاه در مرورگر
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWaitingPayment(null)}
                    className="flex-1 justify-center text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer"
                  >
                    تغییر پلن یا انصراف
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!success && !migrationDone && !waitingPayment && (
            <>
              {/* Plan Selection Cards */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center justify-between">
                  <span>مدت زمان اشتراک را انتخاب کنید:</span>
                  <span className="text-[11px] font-normal text-neutral-500 dark:text-neutral-400">پرداخت امن از طریق شبکه شاپرک</span>
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  {PLAN_OPTIONS.map((plan) => {
                    const isSelected = selectedMonths === plan.months;
                    return (
                      <div
                        key={plan.months}
                        onClick={() => setSelectedMonths(plan.months)}
                        className={`relative p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 shadow-sm'
                            : 'bg-white dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700/80 hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        {plan.badge && (
                          <span className="absolute -top-2.5 end-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                            {plan.badge}
                          </span>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{plan.title}</span>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                            isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-neutral-300 dark:border-neutral-600'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                            {toPersianDigits(plan.priceTomans.toLocaleString('fa-IR'))} <span className="text-[11px] font-normal text-neutral-500 dark:text-neutral-400">تومان</span>
                          </p>
                          {plan.discountPercent > 0 && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                              {toPersianDigits(plan.discountPercent)}٪ تخفیف اقتصادی
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pro Feature Highlights */}
              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>مزایای پلن حرفه‌ای Pro:</span>
                </h3>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60">
                    <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-neutral-800 dark:text-neutral-200 font-medium">همگام‌سازی نامحدود ابری</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60">
                    <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-neutral-800 dark:text-neutral-200 font-medium">دسترسی تحت وب و موبایل</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-neutral-800 dark:text-neutral-200 font-medium">کاربران و پرسنل نامحدود</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-neutral-800 dark:text-neutral-200 font-medium">پشتیبان‌گیری ابری روزانه</span>
                  </div>
                </div>
              </div>

              {/* Payment Actions */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleInitiatePayment()}
                  isLoading={isProcessingPayment}
                  icon={<CreditCard className="w-4 h-4" />}
                  className="w-full justify-center text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md py-3 cursor-pointer"
                >
                  پرداخت آنلاین با درگاه زیبال (مبلغ: {toPersianDigits(currentPlan.priceTomans.toLocaleString('fa-IR'))} تومان)
                </Button>

                <div className="flex items-center justify-center pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCheckPlanOnline}
                    isLoading={isChecking}
                    icon={<RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />}
                    className="text-[11px] w-full justify-center"
                  >
                    استعلام وضعیت اشتراک از سرور
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
