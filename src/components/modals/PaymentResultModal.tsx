import React, { useEffect, useState } from 'react';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Button } from '../ui/Button';
import { toPersianDigits } from '../../utils/formatters';
import { CheckCircle2, XCircle, Sparkles, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';

interface PaymentResultState {
  isOpen: boolean;
  status: 'success' | 'module_success' | 'failed';
  trackId?: string | null;
  refNumber?: string | null;
  orgId?: string | null;
  plan?: string | null;
  message?: string | null;
  moduleSlug?: string | null;
  moduleName?: string | null;
}

export const PaymentResultModal: React.FC<{ onRetryPayment?: () => void }> = ({ onRetryPayment }) => {
  const { refreshOrganizations, activeOrganization } = useOrganization();
  const [result, setResult] = useState<PaymentResultState>({
    isOpen: false,
    status: 'success',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get('payment');

      if (paymentStatus === 'success' || paymentStatus === 'module_success' || paymentStatus === 'failed') {
        const trackId = urlParams.get('track_id');
        const refNumber = urlParams.get('ref_number');
        const orgId = urlParams.get('org_id');
        const plan = urlParams.get('plan');
        const message = urlParams.get('message');
        const moduleSlug = urlParams.get('module');
        const moduleName = urlParams.get('module_name');

        setResult({
          isOpen: true,
          status: paymentStatus as any,
          trackId,
          refNumber,
          orgId,
          plan,
          message,
          moduleSlug,
          moduleName,
        });

        // If subscription success, refresh organization and unlock cloud mode
        if (paymentStatus === 'success') {
          refreshOrganizations().catch(console.error);
          storageManager.setMode('cloud_synced');
        }

        // If module success, dispatch an event so all useModuleAccess hooks re-fetch
        if (paymentStatus === 'module_success') {
          window.dispatchEvent(new CustomEvent('tankhor_module_activated', { detail: { slug: moduleSlug } }));
        }

        // Clean query parameters from URL without reloading
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (e) {
      console.warn('Failed to parse payment url parameters:', e);
    }
  }, [refreshOrganizations]);

  if (!result.isOpen) return null;

  const handleClose = () => {
    setResult((prev) => ({ ...prev, isOpen: false }));
    // If it was a module purchase, reload or refresh route to show the unlocked screen
    if (result.status === 'module_success') {
      window.dispatchEvent(new CustomEvent('tankhor_module_activated', { detail: { slug: result.moduleSlug } }));
    }
  };

  const handleRetry = () => {
    handleClose();
    if (onRetryPayment) {
      onRetryPayment();
    }
  };

  const isModule = result.status === 'module_success';

  return (
    <div
      id="payment-result-modal-backdrop"
      className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id="payment-result-card"
        className="w-full max-w-md bg-white dark:bg-[#15171e] rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden animate-scale-up"
      >
        {result.status === 'success' || result.status === 'module_success' ? (
          <>
            {/* Header Success Banner */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 end-0 -mt-4 -me-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-md">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">پرداخت با موفقیت انجام شد</h2>
              <p className="text-xs text-emerald-100 mt-1">
                {isModule
                  ? `لایسنس دائمی ماژول «${result.moduleName || result.moduleSlug || 'تخصصی'}» با موفقیت فعال گردید.`
                  : 'اشتراک سازمان شما با موفقیت به پلن حرفه‌ای (Pro) ارتقا یافت.'}
              </p>
            </div>

            {/* Content Details */}
            <div className="p-6 space-y-4">
              <div className="bg-neutral-50 dark:bg-neutral-900/60 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {isModule ? 'ماژول فعال شده:' : 'پلن فعال شده:'}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    {isModule ? (result.moduleName || 'تولید و چاپ بارکد') : 'حرفه‌ای (Pro Plan)'}
                  </span>
                </div>

                {isModule && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">نوع لایسنس:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">
                      لایسنس دائمی (Lifetime)
                    </span>
                  </div>
                )}

                {result.trackId && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">شماره پیگیری زیبال (Track ID):</span>
                    <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {toPersianDigits(result.trackId)}
                    </span>
                  </div>
                )}

                {result.refNumber && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">شماره ارجاع بانکی (Ref Number):</span>
                    <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {toPersianDigits(result.refNumber)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">سازمان:</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    {activeOrganization?.name || 'سازمان شما'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">وضعیت دسترسی:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {isModule ? 'فعال آفلاین و آنلاین دائمی' : 'فعال و نامحدود ابری'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 text-center leading-relaxed">
                {isModule
                  ? 'کلید امضا شده لایسنس ماژول روی سازمان شما ثبت شد و هم‌اکنون آماده استفاده است.'
                  : 'تمام امکانات ابری، پنل تحت وب و همگام‌سازی چند شعبه‌ای برای سازمان شما فعال گردید.'}
              </p>

              <div className="pt-2">
                <Button
                  variant="primary"
                  onClick={handleClose}
                  className="w-full justify-center text-xs font-bold py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
                  icon={<ArrowLeft className="w-4 h-4" />}
                >
                  {isModule ? 'ورود به ماژول' : 'ورود به سامانه'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header Failed Banner */}
            <div className="bg-gradient-to-br from-red-600 to-rose-700 p-6 text-white text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-md">
                <XCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">پرداخت ناموفق یا لغو شده</h2>
              <p className="text-xs text-red-100 mt-1">
                تراکنش درگاه زیبال تکمیل نشد یا توسط کاربر لغو گردید.
              </p>
            </div>

            {/* Content Details */}
            <div className="p-6 space-y-4">
              <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-4 border border-red-200 dark:border-red-900/40 space-y-2 text-xs text-red-700 dark:text-red-300">
                <p className="font-bold">علت:</p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {result.message || 'پرداخت از طریق درگاه بانکی تکمیل نگردید. مبلغی از حساب شما کسر نشده یا در صورت کسر، ظرف ۷۲ ساعت توسط بانک مسترد خواهد شد.'}
                </p>
                {result.trackId && (
                  <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    کد پیگیری: {toPersianDigits(result.trackId)}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {onRetryPayment && (
                  <Button
                    variant="primary"
                    onClick={handleRetry}
                    className="flex-1 justify-center text-xs font-bold py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white cursor-pointer"
                    icon={<RefreshCw className="w-4 h-4" />}
                  >
                    تلاش مجدد
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 justify-center text-xs font-bold py-2.5 cursor-pointer"
                >
                  بستن
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
