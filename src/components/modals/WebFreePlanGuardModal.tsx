import React, { useState } from 'react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager } from '../../storage';
import { useProjectSettings } from '../../hooks/useProjectSettings';
import { Button } from '../ui/Button';
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
  ShieldAlert,
  Smartphone,
  ExternalLink,
  Laptop,
  ArrowDownToLine,
  RefreshCw,
} from 'lucide-react';

export const WebFreePlanGuardModal: React.FC = () => {
  const { organizations, activeOrganization, selectOrganization, updateActiveOrganization, refreshOrganizations } = useOrganization();
  const { logout } = useAuth();
  const { settings, loading: settingsLoading } = useProjectSettings();

  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);

  const handleInstantUpgrade = async () => {
    if (!activeOrganization) return;
    setIsUpgrading(true);
    setError(null);
    try {
      await updateActiveOrganization({
        plan: 'pro',
      });
      storageManager.setMode('cloud_synced');
      setSuccess(true);
      await refreshOrganizations();
    } catch (err: any) {
      setError(err?.message || 'خطا در ارتقای پلن به Pro. لطفاً مجدداً تلاش کنید.');
      setIsUpgrading(false);
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
      setDownloadNote(`در حال شروع دانلود نسخه ${platform === 'windows' ? 'ویندوز' : platform === 'mac' ? 'مک' : 'اندروید'}...`);
      setTimeout(() => setDownloadNote(null), 5000);
      return;
    }

    // Fallback if URL is not yet configured in Directus project_settings
    const fallbackContent = `TANKHOR Official Setup - ${platform.toUpperCase()}\n\nلینک مستقیم دریافت نسخه ${platform} از دایرکتوس به زودی بارگذاری می‌شود.\nOfficial Repository & Releases: https://tankhor.com/download`;
    const blob = new Blob([fallbackContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadNote(`فایل راهنمای نصب نسخه ${platform === 'windows' ? 'ویندوز' : platform === 'mac' ? 'مک' : 'اندروید'} دریافت شد.`);
    setTimeout(() => setDownloadNote(null), 5000);
  };

  return (
    <div
      id="web-free-guard-viewport"
      className="min-h-screen w-full bg-neutral-900/95 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md overflow-y-auto"
    >
      <div
        id="web-free-guard-card"
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col my-auto animate-scale-up"
      >
        {/* Banner Header */}
        <div className="relative bg-gradient-to-r from-neutral-950 via-neutral-900 to-blue-950 text-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wide uppercase text-amber-300 bg-amber-400/15 px-3 py-1 rounded-full border border-amber-400/30 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                محدودیت نسخه وب در پلن رایگان (Free)
              </span>
            </div>

            {/* Current Active Org & User info */}
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <span>سازمان انتخابی:</span>
              <strong className="text-white bg-white/10 px-2 py-0.5 rounded-lg font-mono">
                {activeOrganization?.name || 'سازمان من'}
              </strong>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            استفاده از سامانه تحت وب، ویژه نسخه حرفه‌ای (Pro) است
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 mt-2 leading-relaxed max-w-2xl">
            شما با موفقیت وارد شدید. در نسخه وب تن‌خور، دسترسی به پنل مدیریت نیازمند پلن <strong className="text-white font-bold">Pro</strong> است. جهت استفاده کاملاً رایگان، لطفاً <strong className="text-emerald-300">نسخه دسکتاپ یا اندروید</strong> را دانلود و نصب نمایید.
          </p>
        </div>

        {/* Content Body: Two Primary Options */}
        <div className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2.5 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p>پلن سازمان شما با موفقیت به Pro ارتقا یافت!</p>
                <p className="font-normal text-[11px] text-emerald-700 mt-0.5">در حال بارگذاری مجدد و راه‌اندازی میزکار ابری...</p>
              </div>
            </div>
          )}

          {downloadNote && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{downloadNote}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Option 1: Native Apps (100% Free with SQLite) */}
            <div className="flex flex-col justify-between p-5 rounded-2xl bg-neutral-50 border-2 border-neutral-200 hover:border-neutral-300 transition-all space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                    <Monitor className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    ۱۰۰٪ رایگان
                  </span>
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  دانلود نرم‌افزار تن‌خور (ویندوز / مک / اندروید)
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  نسخه‌های دسکتاپ و موبایل با پایگاه داده پرسرعت <strong className="text-neutral-900">SQLite</strong> روی دستگاه شما کاملاً رایگان، نامحدود و آفلاین اجرا می‌شوند.
                </p>
              </div>

              {/* Download Buttons for OS / Mobile */}
              <div className="space-y-2 pt-2 border-t border-neutral-200/60">
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
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800 transition-colors cursor-pointer shadow-2xs group text-decoration-none"
                >
                  <span className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                    <span>دانلود نسخه ویندوز (Windows)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-neutral-400">.exe</span>
                    <ArrowDownToLine className="w-3.5 h-3.5 text-neutral-500 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                </a>

                {/* macOS & Android Grid */}
                <div className="grid grid-cols-2 gap-2">
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
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[11px] font-bold text-neutral-700 transition-colors cursor-pointer shadow-2xs group text-decoration-none"
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-500 group-hover:scale-110 transition-transform" />
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
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-800 transition-colors cursor-pointer shadow-2xs group text-decoration-none"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span>نسخه اندروید (Android)</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Option 2: Upgrade to Pro Plan */}
            <div className="flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b from-blue-50/60 to-indigo-50/40 border-2 border-blue-200 hover:border-blue-300 transition-all space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                    پلن حرفه‌ای Pro
                  </span>
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  ارتقا سازمان به پلن Pro
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  دسترسی نامحدود به پنل تحت وب، همگام‌سازی ابری زنده بین چندین شعبه، و اتصال نامحدود حساب‌های پرسنل.
                </p>
              </div>

              {/* Instant Upgrade Action */}
              <div className="pt-2 border-t border-blue-100">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleInstantUpgrade}
                  isLoading={isUpgrading}
                  icon={<Sparkles className="w-4 h-4 text-amber-300" />}
                  className="w-full justify-center text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md py-2.5 cursor-pointer"
                >
                  ارتقا آنی سازمان به پلن Pro
                </Button>
              </div>
            </div>
          </div>

          {/* Footer Controls: Switch Organization or Logout */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-neutral-100">
            {organizations.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOrgSelector(!showOrgSelector)}
                  className="flex items-center gap-1.5 text-xs text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>تغییر سازمان انتخابی</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showOrgSelector && (
                  <div className="absolute start-0 bottom-full mb-2 w-64 bg-white rounded-2xl shadow-xl border border-neutral-200 p-1.5 z-20 space-y-1">
                    <p className="px-2.5 py-1 text-[11px] font-bold text-neutral-500">انتخاب سازمان:</p>
                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => {
                          selectOrganization(org.id);
                          setShowOrgSelector(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-start transition-colors cursor-pointer ${
                          org.id === activeOrganization?.id
                            ? 'bg-neutral-900 text-white font-bold'
                            : 'hover:bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        <span className="truncate">{org.name}</span>
                        <span className="text-[10px] font-mono opacity-80 uppercase">({org.plan || 'free'})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors cursor-pointer font-bold ms-auto"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600" />
              <span>خروج از حساب کاربری</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
