import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Share2,
  Settings,
  Package,
  Layers,
  Phone,
  MessageCircle,
  Eye,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Save,
  Download,
  Info,
  Ruler,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { storageManager } from '../../storage';
import {
  Product,
  ProductVariant,
  Category,
  SizeGuideTemplate,
  SizeGuideMeasurement,
  SizeGuideValue,
  Size,
} from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProductImage } from '../../components/ui/ProductImage';
import { ModuleLockedCard } from '../../components/modules/ModuleLockedCard';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { PublicCatalogView } from './public/PublicCatalogView';
import { recommendSize, FitPreference } from './engine/sizeRecommendationEngine';

interface OnlineCatalogAdminViewProps {
  initialTab?: 'overview' | 'products' | 'size-engine';
  onTabChange?: (tab: 'overview' | 'products' | 'size-engine') => void;
}

export const OnlineCatalogAdminView: React.FC<OnlineCatalogAdminViewProps> = ({
  initialTab = 'overview',
  onTabChange,
}) => {
  const { t } = useTranslation();
  const { activeOrganization, updateActiveOrganization } = useOrganization();
  const { hasAccess } = useModuleAccess();

  const hasCatalogAccess = hasAccess('online_catalog');

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'size-engine'>(initialTab);

  // Keep internal tab in sync if parent changes initialTab (e.g. from sidebar sub-item click)
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabClick = (tab: 'overview' | 'products' | 'size-engine') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<SizeGuideTemplate[]>([]);
  const [measurements, setMeasurements] = useState<SizeGuideMeasurement[]>([]);
  const [guideValues, setGuideValues] = useState<SizeGuideValue[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Settings State
  const orgSettings = (activeOrganization as any)?.settings || {};
  const [bio, setBio] = useState(orgSettings.bio || '');
  const [whatsapp, setWhatsapp] = useState(orgSettings.whatsapp_number || activeOrganization?.phone || '');
  const [instagram, setInstagram] = useState(orgSettings.instagram || '');
  const [catalogEnabled, setCatalogEnabled] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Live Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Product visibility search
  const [productSearch, setProductSearch] = useState('');

  // Size Engine Simulator State
  const [simTemplateId, setSimTemplateId] = useState<number | ''>('');
  const [simMeasValues, setSimMeasValues] = useState<Record<number, number>>({});
  const [simFit, setSimFit] = useState<FitPreference>('regular');

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/c/${activeOrganization?.slug || activeOrganization?.id || 'demo'}`
    : `https://tankhor.com/c/${activeOrganization?.slug || 'store'}`;

  // Load store data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const adapter = storageManager.getAdapter();
        const orgId = activeOrganization?.id;

        const [pList, vList, cList, tList, sList] = await Promise.all([
          adapter.getProducts({ organization_id: orgId }).catch(() => []),
          adapter.getVariants({ organization_id: orgId }).catch(() => []),
          adapter.getCategories({ organization_id: orgId }).catch(() => []),
          adapter.getSizeGuideTemplates({ organization_id: orgId }).catch(() => []),
          adapter.getSizes({ organization_id: orgId }).catch(() => []),
        ]);

        let mList: SizeGuideMeasurement[] = [];
        let valList: SizeGuideValue[] = [];
        const initialTplId = tList[0]?.id;
        if (initialTplId) {
          [mList, valList] = await Promise.all([
            adapter.getSizeGuideMeasurements(initialTplId).catch(() => []),
            adapter.getSizeGuideValues(initialTplId).catch(() => []),
          ]);
        }

        if (isMounted) {
          setProducts(pList);
          setVariants(vList);
          setCategories(cList);
          setTemplates(tList);
          setMeasurements(mList);
          setGuideValues(valList);
          setSizes(sList);
          if (initialTplId && !simTemplateId) {
            setSimTemplateId(initialTplId);
          }
        }
      } catch (err) {
        console.warn('[OnlineCatalogAdminView] loadData error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeOrganization?.id]);

  // When simTemplateId changes, reload its measurements and values
  useEffect(() => {
    if (!simTemplateId) return;
    let isMounted = true;
    async function loadTemplateData() {
      try {
        const adapter = storageManager.getAdapter();
        const tplId = Number(simTemplateId);
        const [mList, valList] = await Promise.all([
          adapter.getSizeGuideMeasurements(tplId).catch(() => []),
          adapter.getSizeGuideValues(tplId).catch(() => []),
        ]);
        if (isMounted) {
          setMeasurements(mList);
          setGuideValues(valList);

          // Populate initial values for simulator sliders based on template values
          const newSimValues: Record<number, number> = {};
          mList.forEach((m) => {
            const vals = valList
              .filter((v) => Number(v.measurement_id) === Number(m.id) && Number(v.value) > 0)
              .map((v) => Number(v.value));
            if (vals.length > 0) {
              const mid = vals[Math.floor(vals.length / 2)] || 80;
              newSimValues[m.id] = Math.max(20, mid - 4);
            } else {
              newSimValues[m.id] = 80;
            }
          });
          setSimMeasValues(newSimValues);
        }
      } catch {
        // ignore
      }
    }
    loadTemplateData();
    return () => {
      isMounted = false;
    };
  }, [simTemplateId]);

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization) return;

    setIsSavingSettings(true);
    try {
      const updatedSettings = {
        ...((activeOrganization as any).settings || {}),
        bio,
        whatsapp_number: whatsapp,
        instagram,
        catalog_enabled: catalogEnabled,
      };

      await updateActiveOrganization({
        ...activeOrganization,
        ...({ settings: updatedSettings } as any),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('[OnlineCatalogAdminView] Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Dynamic Size Engine Simulator Calculation
  const activeSimTemplate = useMemo(() => {
    return templates.find((t) => Number(t.id) === Number(simTemplateId)) || null;
  }, [templates, simTemplateId]);

  const simTemplateMeasurements = useMemo(() => {
    if (!activeSimTemplate) return [];
    return measurements.filter((m) => Number(m.template_id) === Number(activeSimTemplate.id));
  }, [measurements, activeSimTemplate]);

  const simResult = useMemo(() => {
    if (!activeSimTemplate || simTemplateMeasurements.length === 0) return null;

    return recommendSize(
      {
        byMeasurementId: simMeasValues,
        fitPreference: simFit,
      },
      activeSimTemplate,
      simTemplateMeasurements,
      guideValues,
      sizes
    );
  }, [activeSimTemplate, simTemplateMeasurements, simMeasValues, simFit, guideValues, sizes]);

  if (!hasCatalogAccess) {
    return (
      <ModuleLockedCard
        moduleSlug="online_catalog"
        moduleName="کاتالوگ دیجیتال"
        description="ویترین اینترنتی و کاتالوگ دیجیتال اختصاصی، موتور هوشمند پیشنهاد سایز مشتری بر اساس ابعاد و استایل، دریافت سفارش و اشتراک‌گذاری سریع با QR کد"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="کاتالوگ دیجیتال"
        subtitle="ویترین اینترنتی اختصاصی برند شما با موتور هوشمند تطبیق سایز و ثبت سفارش مستقیم"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'لینک کپی شد' : 'کپی لینک ویترین'}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>مشاهده ویترین آنلاین</span>
            </Button>
          </div>
        }
      />

      {/* Minimal Tabs */}
      <div className="flex border-b border-neutral-200/80 dark:border-neutral-800 gap-6">
        <button
          type="button"
          onClick={() => handleTabClick('overview')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          تنظیمات کاتالوگ
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('products')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'products'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          کالاهای ویترین ({products.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('size-engine')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'size-engine'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          شبیه‌ساز موتور سایز
        </button>
      </div>

      {/* Tab 1: Overview & Settings */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Public Link & QR Code Card */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    لینک عمومی ویترین
                  </h3>
                  <p className="text-[11px] text-neutral-500">جهت قرار دادن در بیو اینستاگرام و پیام‌رسان‌ها</p>
                </div>
              </div>

              {/* Link Box */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-xl flex items-center justify-between gap-2 border border-neutral-200/80 dark:border-neutral-800">
                <span className="text-xs font-mono text-neutral-600 dark:text-neutral-300 truncate direction-ltr">
                  {publicUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-750 shrink-0 border border-neutral-200 dark:border-neutral-700"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Clean Vector QR Code */}
              <div className="mt-4 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex flex-col items-center text-center">
                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                      publicUrl
                    )}`}
                    alt="QR Code"
                    className="w-32 h-32"
                  />
                </div>
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 mt-3">
                  بارکد QR اختصاصی کاتالوگ
                </span>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  مناسب چاپ اتیکت و برچسب بسته‌بندی
                </p>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                    publicUrl
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  download="tankhor-qr.png"
                  className="mt-3 flex items-center gap-1.5 text-xs text-neutral-900 dark:text-neutral-100 font-semibold hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود فایل جهت چاپ</span>
                </a>
              </div>
            </Card>
          </div>

          {/* Settings Form */}
          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    تنظیمات ویترین اینترنتی
                  </h3>
                  <p className="text-[11px] text-neutral-500">مشخصات تماس و معرفی برند به خریداران</p>
                </div>
              </div>

              {saveSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>تنظیمات ویترین با موفقیت ذخیره شد.</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    معرفی برند / فروشگاه (بیوگرافی)
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="مثال: عرضه جدیدترین کالکشن‌های پوشاک با پارچه‌های باکیفیت و دوخت استاندارد..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#12141a] text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      شماره واتس‌اپ جهت دریافت سفارشات
                    </label>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#12141a] text-neutral-900 dark:text-neutral-100 font-mono text-end"
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">
                      سفارشات مشتریان مستقیماً به این خط هدایت خواهد شد.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      شناسه اینستاگرام
                    </label>
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="mybrand_ir"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#12141a] text-neutral-900 dark:text-neutral-100 font-mono text-end"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSavingSettings}
                    className="flex items-center gap-1.5"
                  >
                    {isSavingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSavingSettings ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</span>
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Products Showcase Manager */}
      {activeTab === 'products' && (
        <Card>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-neutral-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="جستجو در بین کالاها..."
                className="w-full ps-9 pe-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#12141a]"
              />
            </div>
            <span className="text-xs text-neutral-500 font-medium">
              کالاهای دارای قالب سایز: {products.filter((p) => p.size_guide_template_id).length} از {products.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold">
                  <th className="py-2.5 px-3">تصویر و نام کالا</th>
                  <th className="py-2.5 px-3">کد کالا</th>
                  <th className="py-2.5 px-3">قیمت</th>
                  <th className="py-2.5 px-3">قالب راهنمای سایز</th>
                  <th className="py-2.5 px-3 text-center">وضعیت ویترین</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {products
                  .filter((p) => !productSearch || p.title.toLowerCase().includes(productSearch.toLowerCase()))
                  .map((prod) => {
                    const tpl = templates.find((t) => Number(t.id) === Number(prod.size_guide_template_id));
                    const prodVariant = variants.find((v) => Number(v.product_id) === Number(prod.id));

                    return (
                      <tr key={`adm_prod_${prod.id}`} className="hover:bg-neutral-50 dark:hover:bg-neutral-850">
                        <td className="py-2.5 px-3 flex items-center gap-3">
                          <div className="w-10 h-13 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200/80 dark:border-neutral-700/80">
                            <ProductImage
                              src={prod.main_image || prodVariant?.image}
                              alt={prod.title}
                              containerClassName="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 overflow-hidden"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">{prod.title}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-500">{prodVariant?.sku || '-'}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                          {prodVariant?.price ? formatCurrency(prodVariant.price) : '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          {tpl ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium">
                              <Ruler className="w-3 h-3 text-neutral-500" />
                              {tpl.name}
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-[11px]">بدون قالب سایز</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-[10px]">
                            فعال در ویترین
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Dynamic Size Engine Simulator */}
      {activeTab === 'size-engine' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls: Strictly uses the selected template's actual measurements */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <Ruler className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  تنظیمات شبیه‌ساز راهنمای سایز
                </h3>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-neutral-700 dark:text-neutral-300">
                    انتخاب قالب راهنمای سایز:
                  </label>
                  <select
                    value={simTemplateId}
                    onChange={(e) => setSimTemplateId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#12141a] text-xs"
                  >
                    {templates.map((tpl) => (
                      <option key={`sim_tpl_${tpl.id}`} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic Inputs according to the selected template's actual measurements */}
                <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span className="block font-semibold text-neutral-700 dark:text-neutral-300">
                    اندازه‌های فرضی بدن (بر اساس ابعاد این قالب):
                  </span>

                  {simTemplateMeasurements.length === 0 ? (
                    <p className="text-[11px] text-neutral-400">
                      برای این قالب هیچ اندازه تخصصی تعریف نشده است.
                    </p>
                  ) : (
                    simTemplateMeasurements.map((m) => {
                      const cur = simMeasValues[m.id] || 80;
                      return (
                        <div key={`sim_meas_${m.id}`} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-medium text-neutral-800 dark:text-neutral-200">
                              {m.name}:
                            </span>
                            <span className="font-mono font-bold text-neutral-900 dark:text-white">
                              {toPersianDigits(cur)} {m.unit || 'cm'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="160"
                            value={cur}
                            onChange={(e) =>
                              setSimMeasValues((prev) => ({
                                ...prev,
                                [m.id]: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-neutral-900 dark:accent-white cursor-pointer"
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Fit Preference */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <label className="block font-semibold mb-1.5 text-neutral-700 dark:text-neutral-300">
                    استایل تن‌خور:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['snug', 'regular', 'relaxed'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSimFit(mode)}
                        className={`py-1.5 px-2 rounded-lg border text-center transition-colors cursor-pointer text-xs ${
                          simFit === mode
                            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-bold'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {mode === 'snug' ? 'جذب' : mode === 'relaxed' ? 'آزاد' : 'معمولی'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Engine Output Analysis */}
          <div className="lg:col-span-2">
            <Card>
              <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mb-4 pb-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>نتیجه محاسبات موتور سایز</span>
              </h3>

              {simResult && simResult.recommendedSize ? (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-neutral-500 font-medium">سایز پیشنهادی نهایی:</span>
                      <h4 className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5">
                        سایز {simResult.recommendedSize.name}
                      </h4>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
                        {simResult.fitDescriptionFa}
                      </p>
                    </div>
                    <div className="text-end">
                      <span className="px-3 py-1 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono font-bold text-xs">
                        {toPersianDigits(simResult.matchScore)}٪ تطابق
                      </span>
                    </div>
                  </div>

                  {/* Comparisons table */}
                  {simResult.comparisons.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold mb-2 text-neutral-800 dark:text-neutral-200">
                        تحلیل جزئیات آزادی و تن‌خور اندازه‌ها:
                      </h5>
                      <div className="space-y-2">
                        {simResult.comparisons.map((c) => (
                          <div
                            key={`comp_${c.measurementId}`}
                            className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 text-xs flex items-center justify-between"
                          >
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                              {c.measurementName}
                            </span>
                            <div className="flex items-center gap-3 font-mono text-[11px]">
                              <span>بدن: {toPersianDigits(c.userBodyValue)}</span>
                              <span>لباس: {toPersianDigits(c.garmentValue)}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  c.status === 'ideal'
                                    ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                                    : c.status === 'tight_risk'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                                }`}
                              >
                                {c.noteFa}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-neutral-400">
                  برای این قالب جدول اندازه تعریف نشده است.
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-6">
          <div className="w-full max-w-5xl h-[90vh] bg-white dark:bg-[#12141a] rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-neutral-200 dark:border-neutral-800">
            <div className="flex-1 overflow-y-auto">
              <PublicCatalogView
                previewOrg={activeOrganization}
                onClosePreview={() => setIsPreviewOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
