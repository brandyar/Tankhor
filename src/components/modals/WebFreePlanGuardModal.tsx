import React, { useState } from 'react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager } from '../../storage';
import { directusClient } from '../../api/directus';
import { useProjectSettings } from '../../hooks/useProjectSettings';
import { Button } from '../ui/Button';
import { UpgradeToProModal } from './UpgradeToProModal';
import { PaymentResultModal } from './PaymentResultModal';
import { APP_VERSION } from '../../utils/version';
import {
  Download,
  Sparkles,
  Monitor,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Building2,
  LogOut,
  ChevronDown,
  Smartphone,
  Laptop,
  ArrowDownToLine,
  RefreshCw,
  CreditCard,
  Layers,
} from 'lucide-react';

export const WebFreePlanGuardModal: React.FC = () => {
  const { organizations, activeOrganization, selectOrganization, refreshOrganizations } = useOrganization();
  const { logout } = useAuth();
  const { settings } = useProjectSettings();

  const [isChecking, setIsChecking] = useState(false);
  const [isActivatingTrial, setIsActivatingTrial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleStartTrial = async () => {
    if (!activeOrganization) return;
    setIsActivatingTrial(true);
    setError(null);
    try {
      const res = await directusClient.startFreeTrial(activeOrganization.id);
      if (res && (res.isPro || res.plan === 'pro')) {
        await refreshOrganizations();
        storageManager.setMode('cloud_synced');
        setSuccess(true);
      } else {
        setError('خطا در فعال‌سازی تست رایگان.');
        setIsActivatingTrial(false);
      }
    } catch (err: any) {
      setError(err?.message || 'خطا در فعال‌سازی تست رایگان.');
      setIsActivatingTrial(false);
    }
  };

  const handleCheckPlanOnline = async () => {
    if (!activeOrganization) return;
    setIsChecking(true);
    setError(null);

    try {
      const res = await directusClient.checkOrganizationPlan();
      if (res && (res.isPro || res.plan === 'pro')) {
        await refreshOrganizations();
        storageManager.setMode('cloud_synced');
        setSuccess(true);
      } else {
        setError('اشتراک سازمان همچنان در وضعیت «رایگان» است. در صورت پرداخت، لطفاً چند لحظه بعد مجدداً بررسی را بزنید.');
        setIsChecking(false);
      }
    } catch (err: any) {
      setError(err?.message || 'خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
      setIsChecking(false);
    }
  };

  const handleDownloadApp = (platform: 'windows' | 'mac' | 'android') => {
    let targetUrl: string | null | undefined = null;
    let filename = '';

    if (platform === 'windows') {
      targetUrl = settings.windows_setup;
      filename = 'Tankhor-Desktop-Setup.exe';
    } else if (platform === 'mac') {
      targetUrl = settings.macos_setup;
      filename = 'Tankhor-Desktop.dmg';
    } else if (platform === 'android') {
      targetUrl = settings.adnroid_setup || settings.android_setup;
      filename = 'Tankhor-Android.apk';
    }

    if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
      const link = document.createElement('a');
      link.href = targetUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadNote(`دانلود نسخه ${platform === 'windows' ? 'ویندوز' : platform === 'mac' ? 'مک' : 'اندروید'} آغاز شد.`);
      setTimeout(() => setDownloadNote(null), 5000);
      return;
    }

    const fallbackContent = `TANKHOR Official Setup - ${platform.toUpperCase()}\n\nلینک مستقیم دریافت نسخه ${platform} از سرور به زودی بارگذاری می‌شود.\nOfficial Repository & Releases: https://tankhor.com/download`;
    const blob = new Blob([fallbackContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadNote(`راهنمای نصب نسخه ${platform === 'windows' ? 'ویندوز' : platform === 'mac' ? 'مک' : 'اندروید'} دریافت شد.`);
    setTimeout(() => setDownloadNote(null), 5000);
  };

  return (
    <div
      id="web-free-guard-viewport"
      className="min-h-screen w-full bg-slate-950/80 dark:bg-black/85 flex items-center justify-center p-4 sm:p-8 backdrop-blur-md overflow-y-auto"
    >
      <div
        id="web-free-guard-card"
        className="w-full max-w-4xl bg-white dark:bg-[#12141a] rounded-3xl shadow-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden flex flex-col my-auto transition-all"
      >
        {/* Header Section with Generous Negative Space */}
        <div className="p-8 sm:p-10 border-b border-slate-100 dark:border-neutral-800/80 bg-slate-50/50 dark:bg-[#161922]/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-black text-lg shadow-sm">
                ت
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  انتخاب نحوه استفاده از تن‌خور
                </h1>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  حساب کاربری شما فعال است • پلن فعلی سازمان: <strong className="text-slate-800 dark:text-neutral-200 font-bold">رایگان (Free)</strong>
                </p>
              </div>
            </div>

            {/* Active Organization Info */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-white dark:bg-[#1c202c] border border-slate-200 dark:border-neutral-700/70 px-3.5 py-1.5 rounded-2xl shadow-xs">
              <Building2 className="w-4 h-4 text-slate-400 dark:text-neutral-500" />
              <span className="text-xs text-slate-500 dark:text-neutral-400">سازمان:</span>
              <span className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                {activeOrganization?.name || 'سازمان من'}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-neutral-300 leading-relaxed max-w-3xl pt-1">
            نرم‌افزار مدیریت فروش و انبار تن‌خور به صورت <strong className="text-emerald-600 dark:text-emerald-400 font-bold">کاملاً رایگان و نامحدود</strong> روی ویندوز، مک و اندروید قابل استفاده است. در صورت تمایل به استفاده از همین پنل تحت وب و اتصال ابری، می‌توانید سازمان خود را به پلن <strong className="text-indigo-600 dark:text-indigo-400 font-bold">Pro</strong> ارتقا دهید.
          </p>
        </div>

        {/* Content Body: 2 Clear Columns with Ample Breathing Room */}
        <div className="p-8 sm:p-10 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs rounded-2xl flex items-center gap-3 font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-sm">پلن سازمان با موفقیت به Pro ارتقا یافت!</p>
                <p className="text-xs opacity-90 mt-0.5">در حال انتقال به میزکار ابری...</p>
              </div>
            </div>
          )}

          {downloadNote && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-300 text-xs rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{downloadNote}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Option 1: Native Apps (100% Free) */}
            <div className="flex flex-col justify-between p-7 sm:p-8 rounded-3xl bg-slate-50/70 dark:bg-[#161922] border border-slate-200/90 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#202534] border border-slate-200/80 dark:border-neutral-700/60 text-slate-800 dark:text-white flex items-center justify-center shadow-xs">
                    <Monitor className="w-6 h-6 text-slate-800 dark:text-white" />
                  </div>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1 rounded-full">
                    ۱۰۰٪ رایگان
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    دانلود رایگان نرم‌افزار
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                    نسخه دسکتاپ و موبایل با پایگاه داده محلی روی سیستم شما به صورت کاملاً آفلاین، نامحدود و رایگان اجرا می‌شود.
                  </p>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="space-y-2.5 pt-2">
                {/* Windows Download */}
                <a
                  href={settings.windows_setup || '#'}
                  onClick={(e) => {
                    if (!settings.windows_setup) {
                      e.preventDefault();
                      handleDownloadApp('windows');
                    }
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={settings.windows_setup ? undefined : 'Tankhor-Desktop-Setup.exe'}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1d222f] hover:bg-slate-100 dark:hover:bg-[#242a3a] border border-slate-200 dark:border-neutral-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white transition-all cursor-pointer shadow-xs group"
                >
                  <span className="flex items-center gap-2.5">
                    <Laptop className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                    <span>دانلود نسخه ویندوز (Windows)</span>
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-neutral-500">
                    <span className="text-[11px] font-mono">.exe</span>
                    <ArrowDownToLine className="w-4 h-4 group-hover:translate-y-0.5 transition-transform text-slate-600 dark:text-neutral-300" />
                  </div>
                </a>

                {/* macOS & Android Row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <a
                    href={settings.macos_setup || '#'}
                    onClick={(e) => {
                      if (!settings.macos_setup) {
                        e.preventDefault();
                        handleDownloadApp('mac');
                      }
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={settings.macos_setup ? undefined : 'Tankhor-Desktop.dmg'}
                    className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white dark:bg-[#1d222f] hover:bg-slate-100 dark:hover:bg-[#242a3a] border border-slate-200 dark:border-neutral-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-neutral-200 transition-all cursor-pointer shadow-xs group"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-400 group-hover:scale-110 transition-transform" />
                    <span>نسخه مک (macOS)</span>
                  </a>

                  <a
                    href={settings.adnroid_setup || settings.android_setup || '#'}
                    onClick={(e) => {
                      if (!settings.adnroid_setup && !settings.android_setup) {
                        e.preventDefault();
                        handleDownloadApp('android');
                      }
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={(settings.adnroid_setup || settings.android_setup) ? undefined : 'Tankhor-Android.apk'}
                    className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white dark:bg-[#1d222f] hover:bg-slate-100 dark:hover:bg-[#242a3a] border border-slate-200 dark:border-neutral-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-neutral-200 transition-all cursor-pointer shadow-xs group"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>نسخه اندروید</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Option 2: Upgrade to Pro Plan */}
            <div className="flex flex-col justify-between p-7 sm:p-8 rounded-3xl bg-indigo-50/40 dark:bg-[#171a27] border border-indigo-200/80 dark:border-indigo-900/60 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                    <Cloud className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/60 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    پلن ابری Pro
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    فعال‌سازی پنل ابری و تحت وب
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                    دسترسی آنلاین به همین پنل مرورگر، همگام‌سازی ابری زنده بین چندین دستگاه و اتصال نامحدود حساب‌های کاربران.
                  </p>
                </div>
              </div>

              {/* Upgrade Actions */}
              <div className="space-y-2.5 pt-2">
                {!activeOrganization?.has_used_trial ? (
                  <>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleStartTrial}
                      isLoading={isActivatingTrial}
                      icon={<Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />}
                      className="w-full justify-center text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl shadow-sm cursor-pointer"
                    >
                      شروع تست ۱۴ روزه رایگان Pro
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsUpgradeModalOpen(true)}
                      icon={<CreditCard className="w-4 h-4" />}
                      className="w-full justify-center text-xs font-semibold py-2.5 rounded-2xl bg-white dark:bg-[#1d222f] hover:bg-slate-50 dark:hover:bg-[#242a3a] text-slate-700 dark:text-neutral-300 border-slate-200 dark:border-neutral-700 cursor-pointer"
                    >
                      مشاهده قیمت‌ها و خرید اشتراک
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 text-center leading-relaxed">
                      مهلت تست ۱۴ روزه رایگان این سازمان به پایان رسیده است. جهت دسترسی به پنل تحت وب، اشتراک Pro را تمدید نمایید.
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setIsUpgradeModalOpen(true)}
                      icon={<CreditCard className="w-4 h-4" />}
                      className="w-full justify-center text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl shadow-sm cursor-pointer"
                    >
                      ارتقا به پلن Pro و پرداخت آنلاین
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCheckPlanOnline}
                      isLoading={isChecking}
                      icon={<RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />}
                      className="w-full justify-center text-xs font-medium py-2 rounded-2xl bg-white dark:bg-[#1d222f] hover:bg-slate-50 dark:hover:bg-[#242a3a] text-slate-700 dark:text-neutral-300 border-slate-200 dark:border-neutral-700 cursor-pointer"
                    >
                      بررسی مجدد وضعیت اشتراک
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer Controls: Organization Switcher & Logout */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-100 dark:border-neutral-800/80">
            {organizations.length > 1 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOrgSelector(!showOrgSelector)}
                  className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#1c202c] hover:bg-slate-200 dark:hover:bg-[#242a3a] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-400" />
                  <span>تغییر سازمان انتخابی</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {showOrgSelector && (
                  <div className="absolute start-0 bottom-full mb-2 w-72 bg-white dark:bg-[#1a1d26] rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-700 p-2 z-30 space-y-1">
                    <p className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-neutral-500">انتخاب سازمان:</p>
                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => {
                          selectOrganization(org.id);
                          setShowOrgSelector(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-start transition-colors cursor-pointer ${
                          org.id === activeOrganization?.id
                            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-[#242a3a] text-slate-700 dark:text-neutral-300'
                        }`}
                      >
                        <span className="truncate">{org.name}</span>
                        <span className="text-[10px] font-mono opacity-80 uppercase">({org.plan || 'free'})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-neutral-500">
                <Layers className="w-4 h-4" />
                <span>تن‌خور نسخه v{APP_VERSION}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ms-auto"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج از حساب کاربری</span>
            </button>
          </div>
        </div>
      </div>

      <UpgradeToProModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      <PaymentResultModal
        onRetryPayment={() => setIsUpgradeModalOpen(true)}
      />
    </div>
  );
};
