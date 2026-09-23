import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Phone,
  MessageCircle,
  Share2,
  X,
  Ruler,
  CheckCircle2,
  Package,
  Layers,
  ArrowLeft,
  ExternalLink,
  Store,
  Send,
  Check,
} from 'lucide-react';
import {
  Product,
  ProductVariant,
  Category,
  Size,
  SizeGuideTemplate,
  SizeGuideMeasurement,
  SizeGuideValue,
  Organization,
} from '../../../types';
import { storageManager } from '../../../storage';
import { ProductImage } from '../../../components/ui/ProductImage';
import { formatCurrency, toPersianDigits } from '../../../utils/formatters';
import { SmartSizeFinderModal } from '../components/SmartSizeFinderModal';

interface PublicCatalogViewProps {
  organizationSlug?: string;
  previewOrg?: Organization | null;
  onClosePreview?: () => void;
}

export const PublicCatalogView: React.FC<PublicCatalogViewProps> = ({
  organizationSlug,
  previewOrg,
  onClosePreview,
}) => {
  const [org, setOrg] = useState<Organization | null>(previewOrg || null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [templates, setTemplates] = useState<SizeGuideTemplate[]>([]);
  const [measurements, setMeasurements] = useState<SizeGuideMeasurement[]>([]);
  const [guideValues, setGuideValues] = useState<SizeGuideValue[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');

  // Selected product detail modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);

  // Smart size finder modal
  const [isSizeFinderOpen, setIsSizeFinderOpen] = useState(false);
  const [sizeFinderProduct, setSizeFinderProduct] = useState<Product | null>(null);

  // Inquiry modal
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  // Copy share feedback
  const [copiedLink, setCopiedLink] = useState(false);

  const orgSettings = (org as any)?.settings || {};

  // Load catalog data
  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      try {
        const slug = organizationSlug || previewOrg?.slug;
        const adapter = storageManager.getAdapter();

        // 1. Resolve Organization
        let activeOrg: Organization | null = previewOrg || null;
        if (!activeOrg && slug) {
          const orgs = await adapter.getOrganizations().catch(() => []);
          activeOrg = orgs.find((o) => o.slug === slug || String(o.id) === slug) || null;
        }

        // Try backend public endpoint if needed
        if (!activeOrg && slug) {
          try {
            const resp = await fetch(`/api/public-catalog/${encodeURIComponent(slug)}`);
            if (resp.ok) {
              const data = await resp.json();
              if (data.organization && isMounted) {
                setOrg(data.organization);
                setProducts(data.products || []);
                setCategories(data.categories || []);
                setTemplates(data.sizeGuides?.templates || []);
                setMeasurements(data.sizeGuides?.measurements || []);
                setGuideValues(data.sizeGuides?.values || []);
                setSizes(data.sizeGuides?.sizes || []);
                setIsLoading(false);
                return;
              }
            }
          } catch {
            // fallback to local
          }
        }

        if (activeOrg && isMounted) {
          setOrg(activeOrg);
          const orgId = activeOrg.id;

          const [pList, vList, cList, sList, tList] = await Promise.all([
            adapter.getProducts({ organization_id: orgId }).catch(() => []),
            adapter.getVariants({ organization_id: orgId }).catch(() => []),
            adapter.getCategories({ organization_id: orgId }).catch(() => []),
            adapter.getSizes({ organization_id: orgId }).catch(() => []),
            adapter.getSizeGuideTemplates({ organization_id: orgId }).catch(() => []),
          ]);

          // Load all measurements & values across templates for this org
          let allMeas: SizeGuideMeasurement[] = [];
          let allVals: SizeGuideValue[] = [];

          if (tList.length > 0) {
            const measPromises = tList.map((tpl) =>
              adapter.getSizeGuideMeasurements(tpl.id).catch(() => [])
            );
            const valPromises = tList.map((tpl) =>
              adapter.getSizeGuideValues(tpl.id).catch(() => [])
            );
            const measResults = await Promise.all(measPromises);
            const valResults = await Promise.all(valPromises);
            allMeas = measResults.flat();
            allVals = valResults.flat();
          }

          if (isMounted) {
            setProducts(pList.filter((p) => p.status === 'published' || !p.status));
            setVariants(vList);
            setCategories(cList);
            setSizes(sList);
            setTemplates(tList);
            setMeasurements(allMeas);
            setGuideValues(allVals);
          }
        }
      } catch (err) {
        console.warn('[PublicCatalogView] Error loading catalog:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [organizationSlug, previewOrg]);

  // When a product is selected, ensure its specific measurements and values are loaded if missing
  useEffect(() => {
    if (!selectedProduct?.size_guide_template_id) return;
    const tplId = Number(selectedProduct.size_guide_template_id);
    const hasMeas = measurements.some((m) => Number(m.template_id) === tplId);
    if (hasMeas) return;

    let isMounted = true;
    async function loadTemplateSpecificData() {
      try {
        const adapter = storageManager.getAdapter();
        const [mList, valList] = await Promise.all([
          adapter.getSizeGuideMeasurements(tplId).catch(() => []),
          adapter.getSizeGuideValues(tplId).catch(() => []),
        ]);
        if (isMounted) {
          setMeasurements((prev) => [...prev, ...mList]);
          setGuideValues((prev) => [...prev, ...valList]);
        }
      } catch {
        // ignore
      }
    }
    loadTemplateSpecificData();
    return () => {
      isMounted = false;
    };
  }, [selectedProduct?.size_guide_template_id, measurements]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const prodVariants = variants.filter((v) => Number(v.product_id) === Number(p.id));
      const hasMatchingSku = prodVariants.some(
        (v) => v.sku && v.sku.toLowerCase().includes(search.toLowerCase())
      );

      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        hasMatchingSku;

      const matchCategory =
        selectedCategory === 'all' || Number(p.category_id) === Number(selectedCategory);

      return matchSearch && matchCategory;
    });
  }, [products, variants, search, selectedCategory]);

  const handleShareLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleOpenSmartSize = (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSizeFinderProduct(prod);
    setIsSizeFinderOpen(true);
  };

  // WhatsApp order link generator
  const getWhatsAppLink = (prod: Product, chosenSize?: Size | null) => {
    const phone = orgSettings.whatsapp_number || org?.phone || '989000000000';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const sizeText = chosenSize ? ` با سایز ${chosenSize.name}` : '';
    const text = encodeURIComponent(
      `سلام وقت بخیر، من در ویترین آنلاین محصول «${prod.title}»${sizeText} را دیدم و قصد ثبت سفارش دارم.`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone || !selectedProduct) return;

    setIsSubmittingInquiry(true);
    try {
      await fetch('/api/public-catalog/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: org?.id,
          product_id: selectedProduct.id,
          product_title: selectedProduct.title,
          size_name: selectedSize?.name,
          customer_name: customerName,
          customer_phone: customerPhone,
          note: customerNote,
        }),
      }).catch(() => null);

      setInquirySuccess(true);
      setTimeout(() => {
        setIsInquiryModalOpen(false);
        setInquirySuccess(false);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerNote('');
      }, 2000);
    } catch (err) {
      console.warn('[Inquiry] Error:', err);
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  // Resolve template for size finder product or selected product
  const activeProductForSize = sizeFinderProduct || selectedProduct;
  const activeTemplateForSize = useMemo(() => {
    if (!activeProductForSize?.size_guide_template_id) return templates[0] || null;
    return (
      templates.find((t) => Number(t.id) === Number(activeProductForSize.size_guide_template_id)) ||
      templates[0] ||
      null
    );
  }, [activeProductForSize, templates]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0c0d10] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mb-3 shadow-sm animate-pulse">
          <Store className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          در حال بارگذاری کاتالوگ...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0c0d10] text-neutral-900 dark:text-neutral-100 font-sans pb-20 selection:bg-neutral-900 selection:text-white" dir="rtl">
      {/* Top Banner when in Admin Preview Mode */}
      {previewOrg && (
        <div className="sticky top-0 z-50 bg-neutral-900 text-white px-4 py-2 flex items-center justify-between text-xs border-b border-neutral-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium">پیش‌نمایش زنده ویترین اینترنتی برند</span>
          </div>
          {onClosePreview && (
            <button
              onClick={onClosePreview}
              className="flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer"
            >
              <span>بازگشت به پنل مدیریت</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-[#12141a] border-b border-neutral-200/80 dark:border-neutral-800 pt-7 pb-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 text-center sm:text-start">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center text-xl font-bold border border-neutral-200 dark:border-neutral-800 shrink-0">
                {org?.name ? org.name.charAt(0) : 'T'}
              </div>
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                    {org?.name || 'کاتالوگ آنلاین'}
                  </h1>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-lg leading-relaxed">
                  {orgSettings.bio || 'کاتالوگ رسمی پوشاک و منسوجات، با قابلیت انتخاب هوشمند سایز'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'لینک کپی شد' : 'اشتراک‌گذاری'}</span>
              </button>

              {(org?.phone || orgSettings.whatsapp_number) && (
                <a
                  href={`tel:${org?.phone || orgSettings.whatsapp_number}`}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>تماس با فروشگاه</span>
                </a>
              )}
            </div>
          </div>

          {/* Search & Categories */}
          <div className="mt-6 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی مدل، نام پوشاک یا کد کالا..."
                className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:border-neutral-400 dark:focus:border-neutral-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                    : 'bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                همه ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={`cat_btn_${cat.id}`}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#12141a] rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
            <Package className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              کالایی با این مشخصات یافت نشد
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1">
              لطفاً عنوان جستجو یا فیلتر دسته‌بندی را تغییر دهید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
            {filteredProducts.map((prod) => {
              const prodVariants = variants.filter((v) => Number(v.product_id) === Number(prod.id));
              const firstVariant = prodVariants[0] || null;
              const hasStock = prodVariants.length === 0 || prodVariants.some((v) => (v.stock_quantity ?? 1) > 0);
              const imgSrc = prod.main_image || firstVariant?.image;

              return (
                <div
                  key={`catalog_card_${prod.id}`}
                  onClick={() => {
                    setSelectedProduct(prod);
                    setSelectedVariant(firstVariant);
                    if (firstVariant?.size_id) {
                      const s = sizes.find((sz) => Number(sz.id) === Number(firstVariant.size_id));
                      if (s) setSelectedSize(s);
                    }
                  }}
                  className="group bg-white dark:bg-[#12141a] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  {/* Large Apparel Product Image */}
                  <div className="relative aspect-[3/4] w-full bg-neutral-100 dark:bg-neutral-850 overflow-hidden">
                    <ProductImage
                      src={imgSrc}
                      alt={prod.title}
                      containerClassName="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-850 overflow-hidden"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Stock badge */}
                    <div className="absolute top-2.5 start-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          hasStock
                            ? 'bg-neutral-900/90 text-white dark:bg-white/90 dark:text-neutral-900'
                            : 'bg-neutral-600/90 text-neutral-200'
                        }`}
                      >
                        {hasStock ? 'موجود' : 'ناموجود'}
                      </span>
                    </div>

                    {/* Quick Size Finder Trigger */}
                    {prod.size_guide_template_id && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenSmartSize(prod, e)}
                        title="راهنمای هوشمند سایز"
                        className="absolute bottom-2.5 end-2.5 p-2 rounded-xl bg-white/90 dark:bg-neutral-900/90 hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-neutral-900 text-neutral-800 dark:text-neutral-200 transition-colors shadow-xs"
                      >
                        <Ruler className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                        {prod.title}
                      </h3>
                      {firstVariant?.sku && (
                        <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                          کد: {firstVariant.sku}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white font-mono">
                        {firstVariant?.price ? formatCurrency(firstVariant.price) : 'استعلام قیمت'}
                      </span>
                      <span className="text-[11px] text-neutral-500 font-semibold group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                        مشاهده
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#12141a] overflow-hidden shadow-2xl border border-neutral-200/90 dark:border-neutral-800 animate-in zoom-in-95 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {/* Product Photo: High prominence */}
              <div className="relative aspect-[3/4] sm:aspect-auto w-full min-h-[300px] sm:min-h-[420px] bg-neutral-100 dark:bg-neutral-850">
                <ProductImage
                  src={selectedProduct.main_image || selectedVariant?.image}
                  alt={selectedProduct.title}
                  containerClassName="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-850 overflow-hidden"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Product Info & Actions */}
              <div className="p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                        {selectedProduct.title}
                      </h2>
                      {selectedVariant?.sku && (
                        <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                          کد کالا: {selectedVariant.sku}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <span className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white font-mono">
                      {selectedVariant?.price ? formatCurrency(selectedVariant.price) : 'تماس جهت استعلام'}
                    </span>
                  </div>

                  {selectedProduct.description && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2.5 leading-relaxed line-clamp-4">
                      {selectedProduct.description}
                    </p>
                  )}

                  {/* Smart Size Recommendation Trigger */}
                  {selectedProduct.size_guide_template_id && (
                    <div className="mt-4 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-neutral-700 dark:text-neutral-300 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                              راهنمای هوشمند سایز
                            </p>
                            <p className="text-[10px] text-neutral-500">
                              محاسبه دقیق بر اساس اندازه لباس
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenSmartSize(selectedProduct)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold transition-colors cursor-pointer shrink-0"
                        >
                          یافتن سایز من
                        </button>
                      </div>

                      {selectedSize && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between text-xs">
                          <span className="text-neutral-500 text-[11px]">سایز انتخابی شما:</span>
                          <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                            {selectedSize.name}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Direct Action Buttons */}
                <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                  <a
                    href={getWhatsAppLink(selectedProduct, selectedSize)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>سفارش در واتس‌اپ</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setIsInquiryModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-900 dark:text-neutral-100 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>ثبت درخواست خرید</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inquiry Modal */}
      {isInquiryModalOpen && selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsInquiryModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12141a] p-5 sm:p-6 shadow-xl border border-neutral-200/90 dark:border-neutral-800 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                درخواست خرید «{selectedProduct.title}»
              </h3>
              <button
                type="button"
                onClick={() => setIsInquiryModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inquirySuccess ? (
              <div className="py-8 text-center animate-in zoom-in-95">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  درخواست شما با موفقیت ثبت شد
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  فروشگاه در اسرع وقت جهت هماهنگی با شما تماس خواهد گرفت.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitInquiry} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    نام و نام خانوادگی
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: علی محمدی"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1a1d24]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    شماره تماس همراه
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1a1d24] font-mono text-end"
                  />
                </div>

                {selectedSize && (
                  <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 text-xs flex justify-between border border-neutral-200/60 dark:border-neutral-800">
                    <span className="text-neutral-500">سایز انتخابی:</span>
                    <span className="font-bold font-mono">{selectedSize.name}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    توضیحات (اختیاری)
                  </label>
                  <textarea
                    rows={2}
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="رنگ دلخواه یا یادداشت تحویل..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1a1d24]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingInquiry}
                  className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold transition-colors cursor-pointer mt-2"
                >
                  {isSubmittingInquiry ? 'در حال ثبت...' : 'ارسال درخواست'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Smart Size Finder Modal */}
      {isSizeFinderOpen && activeProductForSize && activeTemplateForSize && (
        <SmartSizeFinderModal
          isOpen={isSizeFinderOpen}
          onClose={() => {
            setIsSizeFinderOpen(false);
            setSizeFinderProduct(null);
          }}
          productTitle={activeProductForSize.title}
          template={activeTemplateForSize}
          measurements={measurements}
          values={guideValues}
          availableSizes={sizes}
          onSelectSize={(sz) => {
            setSelectedSize(sz);
          }}
        />
      )}
    </div>
  );
};
