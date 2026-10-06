import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  CreditCard,
  Check,
  Copy,
  CheckCircle2,
  Printer,
  ScanLine,
  ShieldCheck,
  Globe,
  Sparkles,
  ShoppingBag,
  BarChart3,
  Users,
  FileSpreadsheet,
  Zap,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { PageHeader } from '../ui/PageHeader';
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
  const { systemModules, orgModules, hardwareId, activateLicense, refreshModules } = useModuleAccess();
  const isRtl = locale === 'fa';

  const [licenseKey, setLicenseKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [copiedHwId, setCopiedHwId] = useState(false);
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

  // Concise module highlights applicable to both Web and Desktop
  const getFeatureHighlights = () => {
    switch (moduleSlug) {
      case 'barcode':
        return [
          {
            icon: Printer,
            title: isRtl ? 'چاپ انواع لیبل و بارکد' : 'Thermal & Label Printing',
            description: isRtl
              ? 'طراحی و چاپ سریع روی انواع پرینترهای حرارتی و لیبل‌زن استاندارد.'
              : 'Fast printing on thermal and standard barcode label printers.',
          },
          {
            icon: ScanLine,
            title: isRtl ? 'اسکن و انبارگردانی سریع' : 'Fast Barcode Scanning',
            description: isRtl
              ? 'اسکن مستقیم بارکد در فاکتور و انبارگردانی برای حذف خطای کاربری.'
              : 'Direct barcode scanning in POS, orders, and stock movements.',
          },
          {
            icon: ShieldCheck,
            title: isRtl ? 'کارکرد یکپارچه وب و دسکتاپ' : 'Web & Desktop Support',
            description: isRtl
              ? 'لایسنس دائمی برای سازمان با عملکرد همگام در مرورگر و دسکتاپ.'
              : 'Permanent organization license supporting both web and desktop.',
          },
        ];
      case 'online_catalog':
        return [
          {
            icon: Globe,
            title: isRtl ? 'ویترین آنلاین برند شما' : 'Digital Brand Showcase',
            description: isRtl
              ? 'صفحه اینترنتی اختصاصی برای نمایش کالاها با لینک مستقیم و QR کد.'
              : 'Dedicated web showcase for products with direct links and QR codes.',
          },
          {
            icon: Sparkles,
            title: isRtl ? 'شبیه‌ساز هوشمند سایز' : 'Smart Size Finder',
            description: isRtl
              ? 'محاسبه خودکار و دقیق سایز مناسب خریدار بر اساس ابعاد و مشخصات لباس.'
              : 'Automated size recommendations based on garment measurements.',
          },
          {
            icon: ShoppingBag,
            title: isRtl ? 'ثبت و ارسال آسان سفارش' : 'Seamless Order Intake',
            description: isRtl
              ? 'امکان ارسال مستقیم سبد خرید خریداران به واتس‌اپ و سیستم فروش.'
              : 'Direct shopping cart dispatch to WhatsApp and store sales.',
          },
        ];
      case 'accounting':
        return [
          {
            icon: BarChart3,
            title: isRtl ? 'سود و زیان و خزانه‌داری' : 'P&L & Financial Control',
            description: isRtl
              ? 'کنترل خودکار درآمدها، هزینه‌ها، بهای تمام‌شده و مانده حساب‌ها.'
              : 'Automated tracking of revenues, COGS, expenses, and treasury.',
          },
          {
            icon: Users,
            title: isRtl ? 'معین اشخاص و چک‌ها' : 'Ledgers & Sayad Cheques',
            description: isRtl
              ? 'گردش حساب دقیق خریداران، تأمین‌کنندگان و رهگیری چک‌های صیادی.'
              : 'Customer/supplier debtor-creditor statements and cheques tracking.',
          },
          {
            icon: FileSpreadsheet,
            title: isRtl ? 'انطباق مالیاتی و خروجی اسناد' : 'Tax & Journal Exports',
            description: isRtl
              ? 'گزارش ارزش افزوده و خروجی استاندارد برای نرم‌افزارهای مالی سپیدار و هلو.'
              : 'VAT reports and double-entry export files for Sepidar and Holoo.',
          },
        ];
      case 'woocommerce':
        return [
          {
            icon: Zap,
            title: isRtl ? 'همگام‌سازی انبار و سایت' : 'Real-time Stock & Price Sync',
            description: isRtl
              ? 'بروزرسانی بلادرنگ موجودی و قیمت انواع پوشاک در فروشگاه آنلاین وردپرس.'
              : 'Real-time synchronization of stock and prices in WooCommerce.',
          },
          {
            icon: ShoppingBag,
            title: isRtl ? 'دریافت آنی سفارشات اینترنتی' : 'Automated Order Import',
            description: isRtl
              ? 'صدور خودکار فاکتور فروش در تن‌خور و کسر هوشمند کالاها از انبار.'
              : 'Instant Tankhor order generation and stock deduction upon sale.',
          },
          {
            icon: Globe,
            title: isRtl ? 'ارتباط مستقیم REST API' : 'Direct REST API Connection',
            description: isRtl
              ? 'اتصال امن و دوطرفه وب‌سرویس سازگار با وب و دسکتاپ بدون افزونه واسط.'
              : 'Secure two-way integration supporting both web and desktop.',
          },
        ];
      default:
        return [
          {
            icon: ShieldCheck,
            title: isRtl ? 'دسترسی همیشگی و دائمی' : 'Permanent Ownership',
            description: isRtl
              ? 'یک‌بار فعال‌سازی برای دسترسی همیشگی تمام کاربران بدون شارژ دوره‌ای.'
              : 'One-time license activation for all organization members.',
          },
          {
            icon: Globe,
            title: isRtl ? 'کارکرد یکپارچه وب و دسکتاپ' : 'Web & Desktop Hybrid',
            description: isRtl
              ? 'عملکرد هماهنگ در محیط مرورگر و نرم‌افزار نصبی دسکتاپ.'
              : 'Seamless operation in both web browser and native desktop.',
          },
          {
            icon: Zap,
            title: isRtl ? 'فعال‌سازی فوری و خودکار' : 'Instant Activation',
            description: isRtl
              ? 'تحویل و فعال‌سازی آنی بلافاصله پس از پرداخت یا ثبت کد لایسنس.'
              : 'Immediate activation via payment gateway or license code.',
          },
        ];
    }
  };

  const featureHighlights = getFeatureHighlights();
  const effectiveTitle = matchedModule?.name || moduleName;
  const effectiveSubtitle = description || matchedModule?.description || t('modules.moduleLockedDesc', 'این بخش به عنوان ماژول تکمیلی و تخصصی ارائه شده است.');

  return (
    <div id={id} className="space-y-6 max-w-4xl mx-auto">
      {/* Unified Page Header across all modules */}
      <PageHeader
        title={effectiveTitle}
        subtitle={effectiveSubtitle}
      />

      <Card className="border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-b from-amber-50/20 to-white dark:from-amber-950/10 dark:to-[#13151a]">
        <div className="p-4 sm:p-6 md:p-8 space-y-6 text-neutral-900 dark:text-neutral-100">
          {/* Header Row: Lock Icon, Name, Pro/Standalone Badges & Price + CTA */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold truncate">{effectiveTitle}</h2>
                  {isIncludedInPro ? (
                    <Badge variant="info">{t('modules.badgeIncludedInPro', 'شامل در Pro')}</Badge>
                  ) : (
                    <Badge variant="warning">{t('modules.badgeStandalone', 'خرید مجزا')}</Badge>
                  )}
                  <Badge variant="neutral">{t('modules.addonShort', 'ماژول تخصصی')}</Badge>
                </div>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  {effectiveSubtitle}
                </p>
              </div>
            </div>

            {/* Price & CTA Button (Stacked cleanly on mobile with full-width button) */}
            {formattedPrice && (
              <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center md:items-stretch lg:items-center gap-2.5 sm:gap-3 shrink-0 pt-2 sm:pt-0">
                <div className="text-start sm:text-end md:text-start lg:text-end bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2 rounded-xl border border-amber-200/50 dark:border-amber-900/40">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('modules.priceLabel', 'قیمت خرید دائمی')}</span>
                  <span className="text-sm sm:text-base font-bold text-amber-700 dark:text-amber-400">{formattedPrice}</span>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white shadow-md font-bold text-xs shrink-0 cursor-pointer w-full sm:w-auto justify-center"
                  icon={<CreditCard className="w-4 h-4" />}
                >
                  {t('modules.payWithZibal', 'خرید آنلاین و فعال‌سازی فوری')}
                </Button>
              </div>
            )}
          </div>

          {/* 3 Summary Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
            {featureHighlights.map((feat, idx) => {
              const FeatIcon = feat.icon;
              return (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 transition-all hover:border-amber-300 dark:hover:border-amber-800/60 space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                      <FeatIcon className="w-4 h-4" />
                    </div>
                    <span className="leading-tight">{feat.title}</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* License Activation Form & Hardware Fingerprint */}
          <div className="p-4 sm:p-5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200">
                <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{t('modules.enterLicenseTokenLabel', 'کد فعال‌سازی یا توکن لایسنس:')}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder={t('modules.licenseTokenPlaceholder', 'کد لایسنس دریافتی را اینجا قرار دهید...')}
                className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-neutral-900 dark:text-neutral-100"
              />
              <Button
                variant="primary"
                onClick={handleActivate}
                disabled={isActivating}
                className="w-full sm:w-auto justify-center"
                icon={<KeyRound className="w-4 h-4" />}
              >
                {isActivating ? t('common.loading', 'در حال بررسی...') : t('modules.activateButton', 'فعال‌سازی لایسنس')}
              </Button>
            </div>

            {/* Helper row: Hardware ID for offline/manual issuance */}
            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>{t('modules.hardwareIdLabel', 'شناسه دستگاه (جهت صدور لایسنس دستی):')}</span>
                <code className="px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200 select-all dir-ltr">
                  {hardwareId}
                </code>
              </div>
              <button
                type="button"
                onClick={handleCopyHardwareId}
                className="text-[11px] text-neutral-600 dark:text-neutral-300 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedHwId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedHwId ? t('common.copied', 'کپی شد') : t('modules.copyHwId', 'کپی شناسه')}</span>
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
        moduleName={effectiveTitle}
        onSuccess={() => {
          setIsPurchaseModalOpen(false);
          refreshModules();
          if (onUnlocked) onUnlocked();
        }}
      />
    </div>
  );
};
