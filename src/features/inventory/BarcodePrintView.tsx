import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { ProductVariant, Product, Color, Size, Brand, Category } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import { generateBarcodeSvg, generateRandomBarcode } from '../../utils/barcode';
import {
  Printer,
  Barcode as BarcodeIcon,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Sliders,
  Eye,
  RefreshCw,
  Tag,
  Layers,
  Shirt,
  Copy,
  Plus,
  Minus,
  Check,
  RotateCcw,
} from 'lucide-react';

interface PrintItem {
  variant: ProductVariant;
  copies: number;
}

type LabelTemplate = 'thermal_50x30' | 'thermal_40x25' | 'hangtag_60x40' | 'a4_sheet_24' | 'a4_sheet_40';

export const BarcodePrintView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [selectedBrandId, setSelectedBrandId] = useState<number | ''>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');

  // Selection Map: variantId -> copies count
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});

  // Label Design Config
  const [template, setTemplate] = useState<LabelTemplate>('thermal_50x30');
  const [showStoreName, setShowStoreName] = useState(true);
  const [customStoreName, setCustomStoreName] = useState(activeOrganization?.name || 'تن‌خور (TANKHOR)');
  const [showProductTitle, setShowProductTitle] = useState(true);
  const [showColorSize, setShowColorSize] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showBarcodeLines, setShowBarcodeLines] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [customFooterNote, setCustomFooterNote] = useState('تعویض کالا تا ۴۸ ساعت با ارائه فاکتور');
  const [showFooterNote, setShowFooterNote] = useState(false);

  const printSectionRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;

      const [vList, pList, cList, sList, bList, catList] = await Promise.all([
        adapter.getVariants({ organization_id: orgId }),
        adapter.getProducts({ organization_id: orgId }),
        adapter.getColors({ organization_id: orgId }),
        adapter.getSizes({ organization_id: orgId }),
        adapter.getBrands({ organization_id: orgId }),
        adapter.getCategories({ organization_id: orgId }),
      ]);

      setVariants(vList);
      setProducts(pList);
      setColors(cList);
      setSizes(sList);
      setBrands(bList);
      setCategories(catList);
    } catch (err) {
      console.error('[BarcodePrintView] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  // Filtered variants
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      // Search
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchSku = v.sku.toLowerCase().includes(term);
        const matchBarcode = v.barcode && v.barcode.toLowerCase().includes(term);
        const matchTitle = v.product_title && v.product_title.toLowerCase().includes(term);
        if (!matchSku && !matchBarcode && !matchTitle) return false;
      }

      // Product filter
      if (selectedProductId !== '') {
        const pId = typeof v.product_id === 'number' ? v.product_id : (v.product_id as any)?.id;
        if (pId !== selectedProductId) return false;
      }

      // Category / Brand filter via parent product
      if (selectedBrandId !== '' || selectedCategoryId !== '') {
        const prod = products.find((p) => p.id === (typeof v.product_id === 'number' ? v.product_id : (v.product_id as any)?.id));
        if (selectedBrandId !== '') {
          const bId = prod && (typeof prod.brand_id === 'number' ? prod.brand_id : (prod.brand_id as any)?.id);
          if (bId !== selectedBrandId) return false;
        }
        if (selectedCategoryId !== '') {
          const cId = prod && (typeof prod.category_id === 'number' ? prod.category_id : (prod.category_id as any)?.id);
          if (cId !== selectedCategoryId) return false;
        }
      }

      return true;
    });
  }, [variants, products, search, selectedProductId, selectedBrandId, selectedCategoryId]);

  // Selection handlers
  const handleToggleSelect = (variantId: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[variantId]) {
        delete next[variantId];
      } else {
        next[variantId] = 1;
      }
      return next;
    });
  };

  const handleSetCopies = (variantId: number, count: number) => {
    const val = Math.max(0, count);
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (val <= 0) {
        delete next[variantId];
      } else {
        next[variantId] = val;
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      filteredVariants.forEach((v) => {
        if (!next[v.id]) {
          next[v.id] = 1;
        }
      });
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedItems({});
  };

  const handleMatchStockCopies = () => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      filteredVariants.forEach((v) => {
        const stock = Math.max(1, Number(v.stock_quantity) || 1);
        next[v.id] = stock;
      });
      return next;
    });
  };

  // Generate barcode on the fly if missing
  const handleGenerateBarcodeForVariant = async (variant: ProductVariant) => {
    const newBarcode = generateRandomBarcode();
    try {
      const adapter = storageManager.getAdapter();
      const updated = await adapter.saveVariant({
        ...variant,
        barcode: newBarcode,
      });

      setVariants((prev) => prev.map((v) => (v.id === updated.id ? { ...v, barcode: newBarcode } : v)));
    } catch (err) {
      console.error('Error generating barcode for variant:', err);
    }
  };

  // Generate missing barcodes for all selected
  const handleGenerateAllMissingBarcodes = async () => {
    const selectedVariantList = variants.filter((v) => selectedItems[v.id]);
    const missing = selectedVariantList.filter((v) => !v.barcode);
    if (missing.length === 0) {
      alert('همه تنوع‌های انتخاب شده دارای بارکد هستند.');
      return;
    }

    try {
      const adapter = storageManager.getAdapter();
      for (const v of missing) {
        const newBarcode = generateRandomBarcode();
        await adapter.saveVariant({
          ...v,
          barcode: newBarcode,
        });
      }
      await loadData();
      alert(`بارکد جدید برای ${missing.length} تنوع کالا با موفقیت تولید شد.`);
    } catch (err) {
      console.error('Error batch generating barcodes:', err);
    }
  };

  // Prepared print list (flattens copies)
  const printQueue = useMemo(() => {
    const queue: { variant: ProductVariant; color?: Color; size?: Size; copyIndex: number }[] = [];
    Object.entries(selectedItems).forEach(([vIdStr, count]) => {
      const vId = Number(vIdStr);
      const v = variants.find((item) => item.id === vId);
      if (!v) return;

      const color = colors.find((c) => c.id === (typeof v.color_id === 'number' ? v.color_id : (v.color_id as any)?.id));
      const size = sizes.find((s) => s.id === (typeof v.size_id === 'number' ? v.size_id : (v.size_id as any)?.id));

      const copiesCount = Number(count) || 0;
      for (let i = 0; i < copiesCount; i++) {
        queue.push({
          variant: v,
          color,
          size,
          copyIndex: i + 1,
        });
      }
    });
    return queue;
  }, [selectedItems, variants, colors, sizes]);

  const totalSelectedVariants = Object.keys(selectedItems).length;
  const totalPrintLabels = printQueue.length;

  const handlePrint = () => {
    if (totalPrintLabels === 0) {
      alert('لطفاً حداقل یک کالا را برای چاپ انتخاب کنید.');
      return;
    }
    printElement('tankhor-print-container', { title: 'چاپ_لیبل_کالا' });
  };

  // Sample variant for preview
  const samplePrintItem = useMemo(() => {
    if (printQueue.length > 0) return printQueue[0];
    if (variants.length > 0) {
      const v = variants[0];
      const color = colors.find((c) => c.id === (typeof v.color_id === 'number' ? v.color_id : (v.color_id as any)?.id));
      const size = sizes.find((s) => s.id === (typeof v.size_id === 'number' ? v.size_id : (v.size_id as any)?.id));
      return { variant: v, color, size, copyIndex: 1 };
    }
    return null;
  }, [printQueue, variants, colors, sizes]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="no-print">
        <PageHeader
          title="تولید و چاپ بارکد و لیبل کالا"
          subtitle="طراحی، تولید بارکد اختصاصی استاندارد، و چاپ حرارتی و برچسبی برای تمام تنوع‌ها"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateAllMissingBarcodes}
                icon={<Sparkles className="w-4 h-4 text-amber-600" />}
              >
                تولید بارکد برای بدون‌بارکدها
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePrint}
                disabled={totalPrintLabels === 0}
                icon={<Printer className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                چاپ {toPersianDigits(totalPrintLabels)} عدد لیبل
              </Button>
            </div>
          }
        />
      </div>

      {/* Screen Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* Left Col (7 cols): Variant Selector */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            {/* Search & Filter Bar */}
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="جستجو بر اساس نام، SKU یا بارکد..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<Search className="w-4 h-4" />}
                  className="sm:col-span-3"
                />
                <Select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                  options={[
                    { value: '', label: 'همه محصولات' },
                    ...products.map((p) => ({ value: p.id, label: p.title })),
                  ]}
                />
                <Select
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value ? Number(e.target.value) : '')}
                  options={[
                    { value: '', label: 'همه برندها' },
                    ...brands.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                />
                <Select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : '')}
                  options={[
                    { value: '', label: 'همه دسته‌بندی‌ها' },
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>

              {/* Bulk Select Action Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-xs">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleSelectAllFiltered}>
                    <CheckSquare className="w-3.5 h-3.5 me-1 text-neutral-600" />
                    انتخاب همه ({toPersianDigits(filteredVariants.length)})
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleMatchStockCopies}>
                    <Copy className="w-3.5 h-3.5 me-1 text-neutral-600" />
                    تعداد مطابق با موجودی انبار
                  </Button>
                  {totalSelectedVariants > 0 && (
                    <Button size="sm" variant="ghost" onClick={handleDeselectAll} className="text-red-600 hover:bg-red-50">
                      لغو انتخاب
                    </Button>
                  )}
                </div>

                <div className="text-neutral-500 font-mono font-medium">
                  انتخاب شده: <span className="font-bold text-neutral-900">{toPersianDigits(totalSelectedVariants)}</span> تنوع |
                  کل برچسب‌ها: <span className="font-bold text-emerald-700">{toPersianDigits(totalPrintLabels)}</span> عدد
                </div>
              </div>
            </div>

            {/* Variants Selection List Table */}
            <div className="max-h-[520px] overflow-y-auto overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-neutral-100 dark:bg-[#181a20] text-neutral-700 dark:text-neutral-300 font-bold border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">انتخاب</th>
                    <th className="px-3 py-2.5">نام محصول و تنوع</th>
                    <th className="px-3 py-2.5">شناسه SKU</th>
                    <th className="px-3 py-2.5">بارکد</th>
                    <th className="px-3 py-2.5">موجودی</th>
                    <th className="px-3 py-2.5">قیمت</th>
                    <th className="px-3 py-2.5 w-28 text-center">تعداد چاپ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 bg-white dark:bg-[#13151a]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-neutral-500 dark:text-neutral-400">
                        در حال بارگذاری لیست کالاها...
                      </td>
                    </tr>
                  ) : filteredVariants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-neutral-500 dark:text-neutral-400">
                        هیچ تنوعی مطابق فیلتر یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredVariants.map((v, vIdx) => {
                      const isSelected = !!selectedItems[v.id];
                      const copies = selectedItems[v.id] || 0;
                      const color = colors.find((c) => c.id === (typeof v.color_id === 'number' ? v.color_id : (v.color_id as any)?.id));
                      const size = sizes.find((s) => s.id === (typeof v.size_id === 'number' ? v.size_id : (v.size_id as any)?.id));

                      return (
                        <tr
                          key={`bar_var_${v.id}_${vIdx}`}
                          className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(v.id)}
                              className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">{v.product_title || 'محصول بدون عنوان'}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                              {color && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-black/20"
                                  style={{ backgroundColor: color.hex || '#000' }}
                                />
                              )}
                              <span>{v.color_name || color?.name || '-'}</span>
                              <span>/</span>
                              <span className="font-bold">{v.size_name || size?.name || '-'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                            {v.sku}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px]">
                            {v.barcode ? (
                              <span className="text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                                {toPersianDigits(v.barcode)}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleGenerateBarcodeForVariant(v)}
                                className="text-[10px] h-6 px-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                title="تولید بارکد جدید"
                              >
                                <Sparkles className="w-3 h-3 me-1 text-amber-500" />
                                ساخت بارکد
                              </Button>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-neutral-600 dark:text-neutral-400">
                            {toPersianDigits(v.stock_quantity || 0)}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {v.price ? formatCurrency(v.price, activeOrganization?.currency, isPersian) : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSetCopies(v.id, copies - 1)}
                                className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center justify-center font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={copies}
                                onChange={(e) => handleSetCopies(v.id, parseInt(e.target.value) || 0)}
                                className="w-12 h-6 text-center text-xs font-mono font-bold bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-1 focus:ring-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleSetCopies(v.id, copies + 1)}
                                className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center justify-center font-bold"
                              >
                                +
                              </button>
                            </div>
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

        {/* Right Col (5 cols): Label Settings & Live Preview */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>تنظیمات قالب و نمایش لیبل</span>
            </h3>

            <div className="space-y-3 text-xs">
              {/* Template selection */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">قالب ابعاد برچسب / کاغذ چاپ</label>
                <Select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as LabelTemplate)}
                  options={[
                    { value: 'thermal_50x30', label: '🏷️ لیبل حرارتی استاندارد (50mm × 30mm)' },
                    { value: 'thermal_40x25', label: '🏷️ لیبل حرارتی کوچک (40mm × 25mm)' },
                    { value: 'hangtag_60x40', label: '🏷️ اتیکت آویز و کارت لباس (60mm × 40mm)' },
                    { value: 'a4_sheet_24', label: '📄 برگه A4 برچسبی ۲۴ تایی (۳ در ۸)' },
                    { value: 'a4_sheet_40', label: '📄 برگه A4 برچسبی ۴۰ تایی (۴ در ۱۰)' },
                  ]}
                />
              </div>

              {/* Elements Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>نام فروشگاه / برند</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProductTitle}
                    onChange={(e) => setShowProductTitle(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>عنوان کالا</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showColorSize}
                    onChange={(e) => setShowColorSize(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>رنگ و سایز</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSku}
                    onChange={(e) => setShowSku(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>کد SKU کالا</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBarcodeLines}
                    onChange={(e) => setShowBarcodeLines(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>میله‌های بارکد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBarcodeText}
                    onChange={(e) => setShowBarcodeText(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>ارقام بارکد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer col-span-2">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-neutral-900">قیمت فروش (تومان)</span>
                </label>
              </div>

              {/* Custom texts */}
              <div className="space-y-2 pt-2 border-t border-neutral-100">
                {showStoreName && (
                  <div>
                    <label className="block text-[11px] text-neutral-600 mb-0.5">متن نام فروشگاه روی لیبل</label>
                    <Input
                      value={customStoreName}
                      onChange={(e) => setCustomStoreName(e.target.value)}
                      placeholder="نام فروشگاه..."
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Live Preview Card */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                <span>پیش‌نمایش زنده لیبل</span>
              </h3>
              <Badge variant="neutral">مقیاس واقعی 1:1</Badge>
            </div>

            <div className="bg-neutral-100/70 p-6 rounded-xl border border-dashed border-neutral-300 flex items-center justify-center min-h-[220px]">
              {samplePrintItem ? (
                <div
                  className="bg-white text-black p-2.5 rounded shadow-sm border border-neutral-300 font-sans select-none"
                  style={{
                    width: template === 'thermal_40x25' ? '180px' : template === 'hangtag_60x40' ? '240px' : '220px',
                    minHeight: template === 'thermal_40x25' ? '120px' : '140px',
                  }}
                >
                  {/* Label Header */}
                  {showStoreName && (
                    <div className="text-center font-extrabold text-[11px] tracking-tight border-b border-black/10 pb-0.5 mb-1 truncate">
                      {customStoreName}
                    </div>
                  )}

                  {/* Product Title */}
                  {showProductTitle && (
                    <div className="text-center font-bold text-[10px] line-clamp-1 mb-0.5">
                      {samplePrintItem.variant.product_title || 'نام محصول نمونه'}
                    </div>
                  )}

                  {/* Color & Size */}
                  {showColorSize && (
                    <div className="flex items-center justify-between text-[9px] font-semibold bg-neutral-100 px-1 py-0.5 rounded my-1">
                      <span>رنگ: {samplePrintItem.variant.color_name || samplePrintItem.color?.name || '-'}</span>
                      <span className="font-bold font-mono">سایز: {samplePrintItem.variant.size_name || samplePrintItem.size?.name || '-'}</span>
                    </div>
                  )}

                  {/* SKU */}
                  {showSku && (
                    <div className="text-center font-mono text-[9px] text-neutral-700 tracking-wider">
                      {samplePrintItem.variant.sku}
                    </div>
                  )}

                  {/* Barcode SVG */}
                  {showBarcodeLines && (
                    <div
                      className="my-1"
                      dangerouslySetInnerHTML={{
                        __html: generateBarcodeSvg(samplePrintItem.variant.barcode || samplePrintItem.variant.sku || '626123456789', {
                          height: 28,
                          barWidth: 1.3,
                        }),
                      }}
                    />
                  )}

                  {/* Barcode digits */}
                  {showBarcodeText && (
                    <div className="text-center font-mono text-[9px] font-bold tracking-widest leading-none">
                      {samplePrintItem.variant.barcode ? toPersianDigits(samplePrintItem.variant.barcode) : samplePrintItem.variant.sku}
                    </div>
                  )}

                  {/* Price */}
                  {showPrice && (
                    <div className="text-center mt-1.5 pt-1 border-t border-black/10 font-bold text-[11px]">
                      قیمت: <span className="font-mono text-[12px]">{samplePrintItem.variant.price ? formatCurrency(samplePrintItem.variant.price, 'TOMAN', isPersian) : '۰ تومان'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-neutral-400 text-xs">
                  کالایی برای پیش‌نمایش یافت نشد
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                آماده برای چاپ: <strong className="text-neutral-900">{toPersianDigits(totalPrintLabels)}</strong> لیبل
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePrint}
                disabled={totalPrintLabels === 0}
                icon={<Printer className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                ارسال به پرینتر
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT SECTION (Visible ONLY when window.print() is executed) */}
      {/* ========================================================================= */}
      <div id="tankhor-print-container" ref={printSectionRef} className="print-only">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media screen {
              .print-only {
                display: none !important;
              }
            }
            @media print {
              @page {
                size: auto;
                margin: 0mm;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
              }
              .no-print {
                display: none !important;
              }
              .print-only {
                display: block !important;
                width: 100% !important;
                background: #ffffff !important;
              }
              .print-label-item {
                box-sizing: border-box !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                background: #ffffff !important;
                color: #000000 !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                text-align: center !important;
                overflow: hidden !important;
              }

              /* Thermal 50x30mm */
              .tpl-thermal_50x30 {
                width: 50mm !important;
                height: 30mm !important;
                padding: 2mm !important;
                page-break-after: always !important;
              }

              /* Thermal 40x25mm */
              .tpl-thermal_40x25 {
                width: 40mm !important;
                height: 25mm !important;
                padding: 1.5mm !important;
                page-break-after: always !important;
              }

              /* Hangtag 60x40mm */
              .tpl-hangtag_60x40 {
                width: 60mm !important;
                height: 40mm !important;
                padding: 2.5mm !important;
                page-break-after: always !important;
              }

              /* A4 Sheets */
              .a4-grid-24 {
                display: grid !important;
                grid-template-columns: repeat(3, 70mm) !important;
                grid-auto-rows: 37mm !important;
                gap: 0mm !important;
                padding: 5mm !important;
              }
              .a4-grid-40 {
                display: grid !important;
                grid-template-columns: repeat(4, 52.5mm) !important;
                grid-auto-rows: 29.7mm !important;
                gap: 0mm !important;
                padding: 5mm !important;
              }
            }
          `
        }} />

        <div className={`
          ${template === 'a4_sheet_24' ? 'a4-grid-24' : ''}
          ${template === 'a4_sheet_40' ? 'a4-grid-40' : ''}
        `}>
          {printQueue.map((item, idx) => {
            const barcodeVal = item.variant.barcode || item.variant.sku || '626123456789';
            return (
              <div
                key={`${item.variant.id}_${idx}`}
                className={`print-label-item tpl-${template} font-sans`}
              >
                {showStoreName && (
                  <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '1px', borderBottom: '0.5px solid #ccc', paddingBottom: '1px' }}>
                    {customStoreName}
                  </div>
                )}

                {showProductTitle && (
                  <div style={{ fontSize: '7.5pt', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.variant.product_title}
                  </div>
                )}

                {showColorSize && (
                  <div style={{ fontSize: '7pt', display: 'flex', justifyContent: 'space-between', margin: '1px 0', borderTop: '0.5px solid #eee', borderBottom: '0.5px solid #eee', padding: '1px 0' }}>
                    <span>رنگ: {item.variant.color_name || item.color?.name || '-'}</span>
                    <span style={{ fontWeight: 'bold' }}>سایز: {item.variant.size_name || item.size?.name || '-'}</span>
                  </div>
                )}

                {showSku && (
                  <div style={{ fontSize: '6.5pt', fontFamily: 'monospace' }}>
                    {item.variant.sku}
                  </div>
                )}

                {showBarcodeLines && (
                  <div
                    style={{ margin: '1px 0' }}
                    dangerouslySetInnerHTML={{
                      __html: generateBarcodeSvg(barcodeVal, {
                        height: template === 'thermal_40x25' ? 20 : 26,
                        barWidth: 1.2,
                      }),
                    }}
                  />
                )}

                {showBarcodeText && (
                  <div style={{ fontSize: '7pt', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px' }}>
                    {barcodeVal ? toPersianDigits(barcodeVal) : item.variant.sku}
                  </div>
                )}

                {showPrice && item.variant.price !== undefined && (
                  <div style={{ fontSize: '8pt', fontWeight: 'bold', marginTop: '2px', borderTop: '0.5px solid #ccc', paddingTop: '1px' }}>
                    قیمت: {formatCurrency(item.variant.price, 'TOMAN', isPersian)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
