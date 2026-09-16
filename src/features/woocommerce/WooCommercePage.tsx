import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { storageManager } from '../../storage';
import { WooCommerceSettings, WooCommerceLog, Warehouse, FinancialAccount, ProductVariant, InventoryItem } from '../../types';
import {
  testWooCommerceConnection,
  syncStockToWooCommerce,
  syncPricesToWooCommerce,
  importOrdersFromWooCommerce,
  TestConnectionResult,
  SyncStockResult,
  SyncPricesResult,
  ImportOrdersResult,
} from '../../api/woocommerce';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ModuleLockedCard } from '../../components/modules/ModuleLockedCard';
import { formatPersianDate, toPersianDigits } from '../../utils/formatters';
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Settings,
  ArrowUpDown,
  ShoppingBag,
  Boxes,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Database,
  Layers,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
} from 'lucide-react';

export interface WooCommercePageProps {
  initialTab?: 'overview' | 'settings' | 'mappings' | 'logs';
  onNavigateTab?: (tab: 'overview' | 'settings' | 'mappings' | 'logs') => void;
}

export const WooCommercePage: React.FC<WooCommercePageProps> = ({
  initialTab = 'overview',
  onNavigateTab,
}) => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const { hasAccess } = useModuleAccess();
  const isRtl = locale === 'fa';

  const hasWcAccess = hasAccess('woocommerce');

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'mappings' | 'logs'>(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (tab: 'overview' | 'settings' | 'mappings' | 'logs') => {
    setActiveTab(tab);
    onNavigateTab?.(tab);
  };

  // Data states
  const [settings, setSettings] = useState<Partial<WooCommerceSettings>>({
    site_url: '',
    consumer_key: '',
    consumer_secret: '',
    warehouse_id: null,
    financial_account_id: null,
    auto_sync_stock: true,
    auto_sync_price: false,
    auto_import_orders: true,
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<WooCommerceLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Connection & action states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [isSyncingStock, setIsSyncingStock] = useState(false);
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [isImportingOrders, setIsImportingOrders] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [searchMapping, setSearchMapping] = useState('');

  const activeOrgId = activeOrganization?.id ? Number(activeOrganization.id) : 1;

  // Webhook URL
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/woocommerce/webhook?org_id=${activeOrgId}`
    : `https://my.tankhor.com/api/woocommerce/webhook?org_id=${activeOrgId}`;

  // Load initial data
  const loadData = async () => {
    try {
      setLoading(true);
      const [loadedSettings, loadedWarehouses, loadedAccounts, loadedVariants, loadedInv, loadedLogs] = await Promise.all([
        storageManager.getWooCommerceSettings({ organization_id: activeOrgId }).catch(() => null),
        storageManager.getWarehouses({ organization_id: activeOrgId }).catch(() => []),
        storageManager.getFinancialAccounts({ organization_id: activeOrgId }).catch(() => []),
        storageManager.getProductVariants({ organization_id: activeOrgId }).catch(() => []),
        storageManager.getInventoryItems({ organization_id: activeOrgId }).catch(() => []),
        storageManager.getWooCommerceLogs({ organization_id: activeOrgId, limit: 100 }).catch(() => []),
      ]);

      if (loadedSettings) {
        setSettings(loadedSettings);
      }
      setWarehouses(loadedWarehouses || []);
      setFinancialAccounts(loadedAccounts || []);
      setVariants(loadedVariants || []);
      setInventoryItems(loadedInv || []);
      setLogs(loadedLogs || []);
    } catch (err: any) {
      console.error('[WooCommercePage] loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrgId]);

  // Test Connection
  const handleTestConnection = async () => {
    if (!settings.site_url || !settings.consumer_key || !settings.consumer_secret) {
      setFeedbackMessage({
        text: 'لطفاً ابتدا آدرس سایت، Consumer Key و Consumer Secret را در تب تنظیمات تکمیل کنید.',
        isError: true,
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setFeedbackMessage(null);

    try {
      const res = await testWooCommerceConnection({
        site_url: settings.site_url,
        consumer_key: settings.consumer_key,
        consumer_secret: settings.consumer_secret,
      });

      setTestResult(res);
      if (res.success) {
        setFeedbackMessage({ text: `اتصال موفق: ${res.store_name} (${res.wc_version})`, isError: false });
        // Save connection status
        await storageManager.saveWooCommerceSettings({
          ...settings,
          organization_id: activeOrgId,
          sync_status: 'connected',
        });
      } else {
        setFeedbackMessage({ text: res.error || 'خطا در برقراری ارتباط با ووکامرس.', isError: true });
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'خطا در ارتباط با سرور.', isError: true });
    } finally {
      setIsTesting(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);
    setFeedbackMessage(null);

    try {
      const saved = await storageManager.saveWooCommerceSettings({
        ...settings,
        organization_id: activeOrgId,
      });
      setSettings(saved);
      setFeedbackMessage({ text: t('woocommerce.saveSuccess', 'تنظیمات با موفقیت ذخیره شد.'), isError: false });
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'خطا در ذخیره تنظیمات.', isError: true });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Sync Stock
  const handleSyncStock = async () => {
    if (!settings.site_url || !settings.consumer_key || !settings.consumer_secret) {
      setFeedbackMessage({ text: 'تنظیمات ووکامرس کامل نیست. لطفاً ابتدا در تب تنظیمات آنها را تکمیل کنید.', isError: true });
      return;
    }

    setIsSyncingStock(true);
    setFeedbackMessage(null);

    try {
      const res: SyncStockResult = await syncStockToWooCommerce({
        organization_id: activeOrgId,
        warehouse_id: settings.warehouse_id,
        site_url: settings.site_url,
        consumer_key: settings.consumer_key,
        consumer_secret: settings.consumer_secret,
      });

      if (res.success) {
        setFeedbackMessage({
          text: `موجودی با موفقیت ارسال شد: تعداد ${res.updatedCount} کالا/تنوع در ووکامرس بروز گردید (${res.missingSkuCount} قلم فاقد SKU بودند).`,
          isError: false,
        });
        await loadData();
      } else {
        setFeedbackMessage({ text: res.error || 'خطا در ارسال موجودی به سایت.', isError: true });
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'خطا در ارسال موجودی.', isError: true });
    } finally {
      setIsSyncingStock(false);
    }
  };

  // Sync Prices
  const handleSyncPrices = async () => {
    if (!settings.site_url || !settings.consumer_key || !settings.consumer_secret) {
      setFeedbackMessage({ text: 'تنظیمات ووکامرس کامل نیست.', isError: true });
      return;
    }

    setIsSyncingPrices(true);
    setFeedbackMessage(null);

    try {
      const res: SyncPricesResult = await syncPricesToWooCommerce({
        organization_id: activeOrgId,
        site_url: settings.site_url,
        consumer_key: settings.consumer_key,
        consumer_secret: settings.consumer_secret,
      });

      if (res.success) {
        setFeedbackMessage({
          text: `قیمت‌ها با موفقیت ارسال شد: تعداد ${res.updatedCount} کالا بروزرسانی گردید.`,
          isError: false,
        });
        await loadData();
      } else {
        setFeedbackMessage({ text: res.error || 'خطا در ارسال قیمت‌ها به سایت.', isError: true });
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'خطا در ارسال قیمت‌ها.', isError: true });
    } finally {
      setIsSyncingPrices(false);
    }
  };

  // Import Orders
  const handleImportOrders = async () => {
    if (!settings.site_url || !settings.consumer_key || !settings.consumer_secret) {
      setFeedbackMessage({ text: 'تنظیمات ووکامرس کامل نیست.', isError: true });
      return;
    }

    setIsImportingOrders(true);
    setFeedbackMessage(null);

    try {
      const res: ImportOrdersResult = await importOrdersFromWooCommerce({
        organization_id: activeOrgId,
        warehouse_id: settings.warehouse_id,
        financial_account_id: settings.financial_account_id,
        site_url: settings.site_url,
        consumer_key: settings.consumer_key,
        consumer_secret: settings.consumer_secret,
      });

      if (res.success) {
        setFeedbackMessage({
          text: `سفارشات آنلاین بررسی شد: تعداد ${res.importedOrdersCount} سفارش جدید دریافت گردید (${res.skippedCount} سفارش قبلاً ثبت شده بودند).`,
          isError: false,
        });
        await loadData();
      } else {
        setFeedbackMessage({ text: res.error || 'خطا در دریافت سفارشات از سایت.', isError: true });
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'خطا در دریافت سفارشات.', isError: true });
    } finally {
      setIsImportingOrders(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  // If module is locked for this organization
  if (!hasWcAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <ModuleLockedCard
          moduleSlug="woocommerce"
          moduleName="همگام‌سازی با ووکامرس"
          description="اتصال دوطرفه و خودکار انبار تن‌خور با وب‌سایت وردپرس ووکامرس: همگام‌سازی بلادرنگ موجودی، قیمت‌ها و دریافت خودکار سفارشات فروشگاه آنلاین."
          onUnlocked={loadData}
        />
      </div>
    );
  }

  // Variant stats
  const totalVariantsCount = variants.length;
  const withSkuCount = variants.filter((v) => (v.sku || v.barcode)?.trim()).length;
  const missingSkuCount = totalVariantsCount - withSkuCount;

  // Filtered variants for mappings tab
  const filteredVariants = variants.filter((v) => {
    if (!searchMapping.trim()) return true;
    const q = searchMapping.toLowerCase();
    return (
      (v.product_title || '').toLowerCase().includes(q) ||
      (v.sku || '').toLowerCase().includes(q) ||
      (v.barcode || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {t('woocommerce.title', 'همگام‌سازی با ووکامرس (WooCommerce)')}
              </h1>
              <Badge variant="success" className="text-xs">
                {settings.site_url ? 'پیکربندی شده' : 'نیاز به تنظیمات'}
              </Badge>
            </div>
            <p className="text-sm text-neutral-400 mt-0.5">
              {t('woocommerce.subtitle', 'اتصال دوطرفه تن‌خور با فروشگاه اینترنتی وردپرس: همگام‌سازی موجودی، قیمت‌ها و دریافت خودکار سفارشات')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs border-neutral-700 hover:bg-neutral-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${loading ? 'animate-spin' : ''}`} />
            بروزرسانی داده‌ها
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTesting || !settings.site_url}
            className="text-xs bg-violet-600 hover:bg-violet-500 text-white border-0"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ml-1.5 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'در حال بررسی...' : 'بررسی اتصال ووکامرس'}
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedbackMessage.isError
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            {feedbackMessage.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 underline mr-4"
          >
            بستن
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-800 gap-2 overflow-x-auto pb-px">
        {[
          { key: 'overview' as const, label: t('woocommerce.overviewTab', 'پیشخوان همگام‌سازی'), icon: Boxes },
          { key: 'mappings' as const, label: t('woocommerce.mappingsTab', 'تطبیق کالاها و کد SKU'), icon: Layers },
          { key: 'logs' as const, label: t('woocommerce.logsTab', 'گزارش و لاگ‌های رویداد'), icon: Clock },
          { key: 'settings' as const, label: t('woocommerce.settingsTab', 'تنظیمات و احراز هویت'), icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.key === 'logs' && logs.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                  {toPersianDigits(logs.length)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-neutral-900/60 border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">وضعیت اتصال فروشگاه</span>
                <Globe className="w-4 h-4 text-violet-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-base font-bold text-white truncate max-w-[200px]" title={settings.site_url || 'تنظیم نشده'}>
                  {settings.site_url ? settings.site_url.replace(/^https?:\/\//, '') : 'تنظیم نشده'}
                </span>
              </div>
              <div className="mt-2 text-xs text-neutral-500 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${settings.site_url ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                {settings.site_url ? 'آماده همگام‌سازی' : 'نیازمند تکمیل آدرس'}
              </div>
            </Card>

            <Card className="p-4 bg-neutral-900/60 border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">کل تنوع‌های کالا</span>
                <Boxes className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{toPersianDigits(totalVariantsCount)}</span>
                <span className="text-xs text-neutral-400">قلم</span>
              </div>
              <div className="mt-2 text-xs text-emerald-400">
                {toPersianDigits(withSkuCount)} دارای کد SKU جهت تطبیق
              </div>
            </Card>

            <Card className="p-4 bg-neutral-900/60 border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">انبار متصل فروش اینترنتی</span>
                <ShoppingBag className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-base font-bold text-white">
                  {warehouses.find((w) => w.id === settings.warehouse_id)?.name || 'همه انبارها'}
                </span>
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                کسر خودکار موجودی از این انبار
              </div>
            </Card>

            <Card className="p-4 bg-neutral-900/60 border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">تعداد رویدادها و لاگ‌ها</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{toPersianDigits(logs.length)}</span>
                <span className="text-xs text-neutral-400">رکورد</span>
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                آخرین عملیات: {logs[0]?.date_created ? formatPersianDate(logs[0].date_created) : 'ندارد'}
              </div>
            </Card>
          </div>

          {/* Core Action Triggers */}
          <Card className="p-6 bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-[#18181c] border-neutral-800">
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-violet-400" />
              عملیات همگام‌سازی دستی و آنی
            </h2>
            <p className="text-xs text-neutral-400 mb-6">
              با استفاده از دکمه‌های زیر می‌توانید اطلاعات انبار و سفارشات را به سرعت بین تن‌خور و ووکامرس یکسان‌سازی نمایید:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Action 1: Sync Stock */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-white font-medium text-sm">
                    <Boxes className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>ارسال موجودی انبار به سایت</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                    موجودی فعلی کالاها در انبار منتخب محاسبه شده و بر اساس SKU در فروشگاه ووکامرس بروزرسانی می‌شود.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSyncStock}
                  disabled={isSyncingStock || !settings.site_url}
                  icon={<Boxes className={`w-3.5 h-3.5 ${isSyncingStock ? 'animate-spin' : ''}`} />}
                  className="mt-4 w-full justify-center bg-blue-600 hover:bg-blue-500 text-white text-xs border-0 cursor-pointer"
                >
                  {isSyncingStock ? 'در حال ارسال موجودی...' : 'همگام‌سازی موجودی انبار'}
                </Button>
              </div>

              {/* Action 2: Sync Prices */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-white font-medium text-sm">
                    <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>ارسال قیمت‌های فروش به سایت</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                    آخرین قیمت‌های فروش تعریف شده برای تنوع‌ها به قیمت عادی (Regular Price) محصولات ووکامرس منتقل می‌گردد.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncPrices}
                  disabled={isSyncingPrices || !settings.site_url}
                  icon={<ArrowUpRight className={`w-3.5 h-3.5 ${isSyncingPrices ? 'animate-spin' : ''}`} />}
                  className="mt-4 w-full justify-center border-neutral-700 hover:bg-neutral-800 text-white text-xs cursor-pointer"
                >
                  {isSyncingPrices ? 'در حال ارسال قیمت‌ها...' : 'همگام‌سازی قیمت‌ها'}
                </Button>
              </div>

              {/* Action 3: Import Orders */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-white font-medium text-sm">
                    <ShoppingBag className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>دریافت سفارشات ووکامرس</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                    سفارشات جدید و در حال پردازش سایت دریافت شده و به عنوان فاکتور فروش اینترنتی در تن‌خور درج می‌شوند.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleImportOrders}
                  disabled={isImportingOrders || !settings.site_url}
                  icon={<ShoppingBag className={`w-3.5 h-3.5 ${isImportingOrders ? 'animate-spin' : ''}`} />}
                  className="mt-4 w-full justify-center bg-violet-600 hover:bg-violet-500 text-white text-xs border-0 cursor-pointer"
                >
                  {isImportingOrders ? 'در حال دریافت سفارشات...' : 'دریافت سفارشات آنلاین'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Missing SKU Warning Card */}
          {missingSkuCount > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-300">
                  {toPersianDigits(missingSkuCount)} قلم کالا فاقد کد SKU یا بارکد هستند
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  ووکامرس تطبیق محصولات را از طریق فیلد SKU (شناسه محصول) انجام می‌دهد. برای اینکه موجودی و قیمت این کالاها به طور خودکار همگام شود، لطفاً در بخش محصولات برای آنها کد SKU اختصاص دهید.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTabChange('mappings')}
                  className="mt-2 text-xs text-amber-400 hover:text-amber-300 p-0 h-auto underline"
                >
                  مشاهده کالاهای بدون SKU در تب تطبیق کالاها
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-4xl">
          <Card className="p-6 bg-neutral-900/60 border-neutral-800">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-violet-400" />
              تنظیمات احراز هویت REST API ووکامرس
            </h2>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Site URL */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  آدرس وب‌سایت فروشگاه (Site URL) <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={settings.site_url || ''}
                  onChange={(e) => setSettings({ ...settings, site_url: e.target.value })}
                  dir="ltr"
                  className="bg-neutral-950 border-neutral-800 text-left font-mono text-sm"
                  required
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  آدرس کامل دامنه فروشگاه با https یا http (مثال: https://myshop.ir)
                </p>
              </div>

              {/* Consumer Key & Secret */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    کلید مصرف‌کننده (Consumer Key) <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={settings.consumer_key || ''}
                    onChange={(e) => setSettings({ ...settings, consumer_key: e.target.value })}
                    dir="ltr"
                    className="bg-neutral-950 border-neutral-800 text-left font-mono text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    رمز مصرف‌کننده (Consumer Secret) <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="password"
                    placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={settings.consumer_secret || ''}
                    onChange={(e) => setSettings({ ...settings, consumer_secret: e.target.value })}
                    dir="ltr"
                    className="bg-neutral-950 border-neutral-800 text-left font-mono text-sm"
                    required
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 text-xs text-neutral-400 space-y-1">
                <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
                  نحوه دریافت کلیدها از وردپرس:
                </span>
                <p className="leading-relaxed">
                  وارد مدیریت وردپرس شوید ➔ ووکامرس ➔ پیکربندی ➔ تب پیشرفته ➔ کلیدهای REST API ➔ دکمه «افزودن کلید» ➔ دسترسی را روی «خواندن/نوشتن (Read/Write)» قرار دهید.
                </p>
              </div>

              {/* Warehouse & Financial Account selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-800">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    انبار متصل جهت بررسی موجودی و ثبت خروج
                  </label>
                  <select
                    value={settings.warehouse_id || ''}
                    onChange={(e) => setSettings({ ...settings, warehouse_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm focus:outline-none focus:border-violet-500"
                  >
                    <option value="">همه انبارها (موجودی تجمیعی)</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.is_default ? '(انبار پیش‌فرض)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    موجودی ارسالی به سایت از این انبار استخراج می‌شود.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    حساب بانکی یا درگاه پیش‌فرض تسویه سفارشات
                  </label>
                  <select
                    value={settings.financial_account_id || ''}
                    onChange={(e) => setSettings({ ...settings, financial_account_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full h-10 px-3 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm focus:outline-none focus:border-violet-500"
                  >
                    <option value="">بدون ثبت دریافت مالی خودکار</option>
                    {financialAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    در صورت انتخاب، مبالغ سفارشات آنلاین بلافاصله به این حساب بستانکار می‌شود.
                  </p>
                </div>
              </div>

              {/* Automatic toggles */}
              <div className="pt-3 border-t border-neutral-800 space-y-3">
                <h3 className="text-xs font-semibold text-neutral-300">رفتار و خودکارسازی</h3>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.auto_sync_stock)}
                    onChange={(e) => setSettings({ ...settings, auto_sync_stock: e.target.checked })}
                    className="rounded border-neutral-700 bg-neutral-900 text-violet-600 focus:ring-0 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-medium text-white">ارسال خودکار تغییرات موجودی انبار</span>
                    <p className="text-[11px] text-neutral-500">
                      هنگام ثبت فاکتور یا ورود/خروج کالا، موجودی جدید در ووکامرس ثبت شود.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.auto_sync_price)}
                    onChange={(e) => setSettings({ ...settings, auto_sync_price: e.target.checked })}
                    className="rounded border-neutral-700 bg-neutral-900 text-violet-600 focus:ring-0 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-medium text-white">ارسال خودکار تغییرات قیمت</span>
                    <p className="text-[11px] text-neutral-500">
                      با ویرایش قیمت کالا در تن‌خور، قیمت عادی محصول در ووکامرس بروزرسانی شود.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.auto_import_orders)}
                    onChange={(e) => setSettings({ ...settings, auto_import_orders: e.target.checked })}
                    className="rounded border-neutral-700 bg-neutral-900 text-violet-600 focus:ring-0 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-medium text-white">دریافت خودکار سفارشات جدید (وب‌هوک)</span>
                    <p className="text-[11px] text-neutral-500">
                      به محض ثبت سفارش در سایت ووکامرس، فاکتور در تن‌خور ایجاد و موجودی کسر گردد.
                    </p>
                  </div>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-neutral-800">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSavingSettings}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-sm"
                >
                  {isSavingSettings ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !settings.site_url}
                  className="text-sm border-neutral-700 hover:bg-neutral-800"
                >
                  {isTesting ? 'در حال تست...' : 'تست اتصال'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Webhook Configuration Card */}
          <Card className="p-6 bg-neutral-900/60 border-neutral-800">
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-emerald-400" />
              تنظیم وب‌هوک سفارشات لحظه‌ای در ووکامرس
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              برای اینکه به محض پرداخت یا ثبت هر سفارش در سایت ووکامرس، سفارش بدون تأخیر در تن‌خور ثبت شود، آدرس زیر را در وردپرس کپی کنید:
            </p>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                dir="ltr"
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 rounded-lg text-xs font-mono text-neutral-300 text-left"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyWebhook}
                className="shrink-0 border-neutral-700 hover:bg-neutral-800 text-xs text-white"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedWebhook ? 'کپی شد' : 'کپی لینک'}
              </Button>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 space-y-1">
              <span className="font-semibold text-neutral-300">مراحل در وردپرس:</span>
              <p>۱. منوی ووکامرس ➔ پیکربندی ➔ پیشرفته ➔ وب‌هوک‌ها ➔ افزودن وب‌هوک</p>
              <p>۲. وضعیت را روی <strong>«فعال»</strong> بگذارید.</p>
              <p>۳. موضوع (Topic) را <strong>«سفارش ایجاد شد (Order created)»</strong> انتخاب کنید.</p>
              <p>۴. آدرس تحویل (Delivery URL) را برابر لینک بالا قرار داده و ذخیره نمایید.</p>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: SKU Mappings */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">تطبیق و شناسایی کالاها (SKU)</h2>
              <p className="text-xs text-neutral-400">
                هر کالایی که در تن‌خور دارای کد SKU باشد با شناسه محصول متناظر در ووکامرس منطبق می‌شود.
              </p>
            </div>

            <div className="w-full sm:w-72">
              <Input
                placeholder="جستجو در عنوان یا SKU..."
                value={searchMapping}
                onChange={(e) => setSearchMapping(e.target.value)}
                className="bg-neutral-900 border-neutral-800 text-sm h-9"
              />
            </div>
          </div>

          <Card className="bg-neutral-900/60 border-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 px-4">شناسه</th>
                    <th className="py-3 px-4">نام و تنوع کالا</th>
                    <th className="py-3 px-4">کد SKU</th>
                    <th className="py-3 px-4">بارکد</th>
                    <th className="py-3 px-4">وضعیت تطبیق</th>
                    <th className="py-3 px-4">قیمت در تن‌خور</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                  {filteredVariants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-500">
                        هیچ کالایی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredVariants.map((v) => {
                      const sku = (v.sku || v.barcode || '').trim();
                      const hasSku = Boolean(sku);

                      return (
                        <tr key={v.id} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="py-3 px-4 text-neutral-500 font-mono">#{v.id}</td>
                          <td className="py-3 px-4 font-medium text-white">{v.product_title || v.sku || `تنوع #${v.id}`}</td>
                          <td className="py-3 px-4 font-mono text-neutral-300" dir="ltr">
                            {v.sku || <span className="text-neutral-600">-</span>}
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-400" dir="ltr">
                            {v.barcode || <span className="text-neutral-600">-</span>}
                          </td>
                          <td className="py-3 px-4">
                            {hasSku ? (
                              <Badge variant="success" className="text-[10px]">
                                <CheckCircle2 className="w-3 h-3 ml-1" />
                                قابل همگام‌سازی با SKU
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="text-[10px]">
                                فاقد کد SKU
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-neutral-300">
                            {v.price ? `${toPersianDigits(Number(v.price).toLocaleString())} تومان` : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">لاگ‌ها و وقایع همگام‌سازی</h2>
              <p className="text-xs text-neutral-400">
                تاریخچه تراکنش‌های ارسال موجودی، قیمت و دریافت سفارشات از ووکامرس
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              className="text-xs border-neutral-700 hover:bg-neutral-800 cursor-pointer"
            >
              بروزرسانی لاگ‌ها
            </Button>
          </div>

          <Card className="bg-neutral-900/60 border-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 px-4">زمان رویداد</th>
                    <th className="py-3 px-4">نوع عملیات</th>
                    <th className="py-3 px-4">جهت</th>
                    <th className="py-3 px-4">وضعیت</th>
                    <th className="py-3 px-4">توضیحات و جزئیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-500">
                        هنوز هیچ رویدادی برای همگام‌سازی ووکامرس ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const isSuccess = log.status === 'success' || log.status === 'info';
                      return (
                        <tr key={log.id} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                            {formatPersianDate(log.date_created)}
                          </td>
                          <td className="py-3 px-4 font-medium text-white whitespace-nowrap">
                            {log.action === 'sync_stock' && 'همگام‌سازی موجودی'}
                            {log.action === 'sync_prices' && 'همگام‌سازی قیمت‌ها'}
                            {log.action === 'import_orders' && 'دریافت سفارشات'}
                            {log.action === 'webhook_order' && 'وب‌هوک سفارش آنی'}
                            {log.action === 'test_connection' && 'تست اتصال'}
                            {!['sync_stock', 'sync_prices', 'import_orders', 'webhook_order', 'test_connection'].includes(log.action) && log.action}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {log.direction === 'inbound' ? (
                              <span className="flex items-center gap-1 text-violet-400">
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                ورودی به تن‌خور
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-blue-400">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                ارسال به ووکامرس
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge variant={isSuccess ? 'success' : 'error'} className="text-[10px]">
                              {isSuccess ? 'موفق' : 'خطا'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-neutral-300 leading-relaxed">
                            {log.message}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
