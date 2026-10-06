import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import {
  Product,
  ProductVariant,
  Color,
  Size,
  Order,
  OrderItem,
  InventoryItem,
  Category,
} from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import {
  TrendingUp,
  Shirt,
  Palette,
  Tag,
  Printer,
  PackageCheck,
  Layers,
} from 'lucide-react';

const getEntityId = (val: any): number | undefined => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'object') {
    return val.id !== undefined && val.id !== null ? Number(val.id) : undefined;
  }
  const num = Number(val);
  return isNaN(num) ? undefined : num;
};

export const ApparelReportPage: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';
  const formatNumber = (n: number | string) => (isPersian ? toPersianDigits(n) : String(n));

  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, OrderItem[]>>({});

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgParams = activeOrganization?.id ? { organization_id: activeOrganization.id } : {};

      const [prodsRes, varsRes, colsRes, szsRes, ordersRes] = await Promise.all([
        adapter.getProducts(orgParams),
        adapter.getVariants(orgParams),
        adapter.getColors(orgParams),
        adapter.getSizes(orgParams),
        adapter.getOrders(orgParams),
      ]);

      const validProducts = Array.isArray(prodsRes) ? prodsRes.filter((p): p is Product => Boolean(p && p.id)) : [];
      const validVariants = Array.isArray(varsRes) ? varsRes.filter((v): v is ProductVariant => Boolean(v && v.id)) : [];
      const validColors = Array.isArray(colsRes) ? colsRes.filter((c): c is Color => Boolean(c && c.id)) : [];
      const validSizes = Array.isArray(szsRes) ? szsRes.filter((s): s is Size => Boolean(s && s.id)) : [];
      const validOrders = Array.isArray(ordersRes) ? ordersRes.filter((o): o is Order => Boolean(o && o.id)) : [];

      setProducts(validProducts);
      setVariants(validVariants);
      setColors(validColors);
      setSizes(validSizes);
      setOrders(validOrders);

      const itemsMap: Record<number, OrderItem[]> = {};
      if (validOrders.length > 0) {
        await Promise.all(
          validOrders.map(async (o) => {
            if (!o || !o.id) return;
            try {
              if (Array.isArray((o as any).items) && (o as any).items.length > 0) {
                itemsMap[o.id] = (o as any).items;
                return;
              }
              const items = await adapter.getOrderItems(o.id);
              if (Array.isArray(items) && items.length > 0) {
                itemsMap[o.id] = items.filter((item): item is OrderItem => Boolean(item && (item.id || item.variant_id || (item as any).product_variant_id)));
              } else {
                itemsMap[o.id] = [];
              }
            } catch {
              itemsMap[o.id] = [];
            }
          })
        );
      }
      setOrderItemsMap(itemsMap);
    } catch (err) {
      console.error('[ApparelReportPage] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const colorMap = useMemo(() => new Map(colors.map((c) => [c.id, c])), [colors]);
  const sizeMap = useMemo(() => new Map(sizes.map((s) => [s.id, s])), [sizes]);
  const variantMap = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const allOrderItems = useMemo(() => {
    return Object.values(orderItemsMap).flat().filter(Boolean);
  }, [orderItemsMap]);

  // Calculations
  const bestSellersData = useMemo(() => {
    const sizeStats: Record<string, { name: string; id?: number; qty: number; revenue: number }> = {};
    const colorStats: Record<string, { name: string; hex?: string; id?: number; qty: number; revenue: number }> = {};
    const variantStats: Record<number, { sku: string; title: string; color: string; size: string; qty: number; revenue: number }> = {};

    let totalSoldQty = 0;
    let totalSalesRev = 0;

    allOrderItems.forEach((item) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unit_price) || 0;
      const rev = qty * price;

      totalSoldQty += qty;
      totalSalesRev += rev;

      const rawVId = item.variant_id ?? (item as any).product_variant_id;
      const vId = getEntityId(rawVId);
      const v = vId !== undefined ? variantMap.get(vId) : undefined;

      // Color
      const cId = v ? getEntityId(v.color_id) : getEntityId((item as any).color_id);
      const colorObj = cId !== undefined ? colorMap.get(cId) : (typeof (item as any).color === 'object' ? (item as any).color : undefined);
      const colorName = colorObj?.name || v?.color_name || (typeof (item as any).color === 'string' ? (item as any).color : undefined) || t('reports.unknownLabel');

      if (!colorStats[colorName]) {
        colorStats[colorName] = {
          name: colorName,
          hex: colorObj?.hex_code || colorObj?.hex,
          id: cId,
          qty: 0,
          revenue: 0,
        };
      }
      colorStats[colorName].qty += qty;
      colorStats[colorName].revenue += rev;

      // Size
      const sId = v ? getEntityId(v.size_id) : getEntityId((item as any).size_id);
      const sizeObj = sId !== undefined ? sizeMap.get(sId) : (typeof (item as any).size === 'object' ? (item as any).size : undefined);
      const sizeName = sizeObj?.name || v?.size_name || (typeof (item as any).size === 'string' ? (item as any).size : undefined) || t('reports.unknownLabel');

      if (!sizeStats[sizeName]) {
        sizeStats[sizeName] = {
          name: sizeName,
          id: sId,
          qty: 0,
          revenue: 0,
        };
      }
      sizeStats[sizeName].qty += qty;
      sizeStats[sizeName].revenue += rev;

      // Variant (SKU)
      if (vId !== undefined) {
        if (!variantStats[vId]) {
          const pId = v ? getEntityId(v.product_id) : undefined;
          const prod = pId !== undefined ? productMap.get(pId) : undefined;
          variantStats[vId] = {
            sku: v?.sku || (item as any).sku || `VAR-${vId}`,
            title: prod?.title || v?.product_title || (item as any).product_title || t('reports.defaultProductTitle'),
            color: colorName,
            size: sizeName,
            qty: 0,
            revenue: 0,
          };
        }
        variantStats[vId].qty += qty;
        variantStats[vId].revenue += rev;
      }
    });

    const sortedSizes = Object.values(sizeStats).sort((a, b) => b.qty - a.qty);
    const sortedColors = Object.values(colorStats).sort((a, b) => b.qty - a.qty);
    const sortedSkus = Object.values(variantStats).sort((a, b) => b.qty - a.qty).slice(0, 10);

    return {
      totalSoldQty,
      totalSalesRev,
      sortedSizes,
      sortedColors,
      sortedSkus,
    };
  }, [allOrderItems, variantMap, colorMap, sizeMap, productMap, t]);

  const handlePrint = () => {
    printElement('apparel-report-container', {
      title: isPersian ? 'گزارش_تحلیل_اقلام_و_مد' : 'Tankhor_Fashion_Analytics_Report',
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* Page Header */}
      <div className="no-print">
        <PageHeader
          title={t('reports.tabApparel', 'تحلیل اقلام و کاتالوگ')}
          subtitle={t('reports.bestSellersSubtitle', 'تحلیل تقاضای مشتریان و توزیع رنگ‌ها و سایزهای محبوب')}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              icon={<Printer className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />}
            >
              {t('reports.printReportBtn')}
            </Button>
          }
        />
      </div>

      <div id="apparel-report-container" className="space-y-8">
        {/* ========================================================================= */}
        {/* SECTION 1: TOP STATS CARDS (FIXED MOBILE CUTOFF & NO ELLIPSIS) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Units */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {t('reports.totalUnitsSold')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight font-mono break-words">
                  {formatNumber(bestSellersData.totalSoldQty)}{' '}
                  <span className="text-xs font-normal text-neutral-500 font-sans">{t('reports.unitsUnit')}</span>
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{t('reports.totalGarmentsDispatched')}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center shrink-0 border border-neutral-200/80 dark:border-neutral-700">
                <Shirt className="w-5 h-5" />
              </div>
            </div>
          </Card>

          {/* Best Selling Size */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {t('reports.bestSellingSize')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight font-mono break-words">
                  {bestSellersData.sortedSizes[0]?.name || '---'}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  <Tag className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {bestSellersData.sortedSizes[0]
                      ? `${formatNumber(bestSellersData.sortedSizes[0].qty)} ${t('reports.unitsSold')}`
                      : t('reports.noSalesRecorded')}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200/80 dark:border-amber-800">
                <Tag className="w-5 h-5" />
              </div>
            </div>
          </Card>

          {/* Most Popular Color */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {t('reports.mostPopularColor')}
                </p>
                <div className="flex items-center gap-2">
                  {bestSellersData.sortedColors[0]?.hex && (
                    <span
                      className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: bestSellersData.sortedColors[0].hex }}
                    />
                  )}
                  <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight break-words">
                    {bestSellersData.sortedColors[0]?.name || '---'}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                  <Palette className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {bestSellersData.sortedColors[0]
                      ? `${formatNumber(bestSellersData.sortedColors[0].qty)} ${t('reports.unitsSold')}`
                      : t('reports.noSalesRecorded')}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 flex items-center justify-center shrink-0 border border-purple-200/80 dark:border-purple-800">
                <Palette className="w-5 h-5" />
              </div>
            </div>
          </Card>

          {/* Catalog Turnover */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {t('reports.catalogRevenueTurnover')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight font-mono break-words">
                  {formatCurrency(bestSellersData.totalSalesRev, activeOrganization?.currency, isPersian)}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('reports.basedOnOrders')}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200/80 dark:border-emerald-800">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: SIZES & COLORS BREAKDOWN GRIDS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Size Breakdown */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-neutral-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('reports.sizesBreakdownTitle')}
                </h3>
              </div>
              <Badge variant="neutral" size="sm">
                {formatNumber(bestSellersData.sortedSizes.length)} {t('reports.sizeRankingBadge')}
              </Badge>
            </div>

            {bestSellersData.sortedSizes.length === 0 ? (
              <p className="py-8 text-center text-xs text-neutral-500">
                {t('reports.noSizeOrdersYet')}
              </p>
            ) : (
              <div className="space-y-3">
                {bestSellersData.sortedSizes.slice(0, 8).map((sz, idx) => {
                  const percent = bestSellersData.totalSoldQty > 0 ? (sz.qty / bestSellersData.totalSoldQty) * 100 : 0;
                  return (
                    <div key={sz.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-[10px] font-bold flex items-center justify-center">
                            {formatNumber(idx + 1)}
                          </span>
                          <span className="font-bold text-neutral-900 dark:text-white font-mono">{sz.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-500 font-mono">
                          <span>{formatNumber(sz.qty)} {t('reports.unitsUnit')}</span>
                          <span className="text-neutral-400">({formatNumber(percent.toFixed(1))}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, Math.max(3, percent))}%` }}
                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Color Breakdown */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-neutral-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('reports.colorsBreakdownTitle')}
                </h3>
              </div>
              <Badge variant="neutral" size="sm">
                {formatNumber(bestSellersData.sortedColors.length)} {t('reports.colorPopularityBadge')}
              </Badge>
            </div>

            {bestSellersData.sortedColors.length === 0 ? (
              <p className="py-8 text-center text-xs text-neutral-500">
                {t('reports.noColorOrdersYet')}
              </p>
            ) : (
              <div className="space-y-3">
                {bestSellersData.sortedColors.slice(0, 8).map((clr, idx) => {
                  const percent = bestSellersData.totalSoldQty > 0 ? (clr.qty / bestSellersData.totalSoldQty) * 100 : 0;
                  return (
                    <div key={clr.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-[10px] font-bold flex items-center justify-center">
                            {formatNumber(idx + 1)}
                          </span>
                          {clr.hex && (
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                              style={{ backgroundColor: clr.hex }}
                            />
                          )}
                          <span className="font-bold text-neutral-900 dark:text-white">{clr.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-500 font-mono">
                          <span>{formatNumber(clr.qty)} {t('reports.unitsUnit')}</span>
                          <span className="text-neutral-400">({formatNumber(percent.toFixed(1))}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, Math.max(3, percent))}%` }}
                          className="bg-purple-500 h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: TOP SKUS BEST SELLERS TABLE & RESPONSIVE CARDS */}
        {/* ========================================================================= */}
        <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                {t('reports.topSkusTitle')}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('reports.topSkusSubtitle')}
              </p>
            </div>
            <Badge variant="neutral" size="sm">
              {t('reports.top10Badge')}
            </Badge>
          </div>

          {bestSellersData.sortedSkus.length === 0 ? (
            <p className="py-8 text-center text-xs text-neutral-500">
              {t('reports.noDataRecorded')}
            </p>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                <table className="w-full text-xs text-start">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 border-b border-neutral-200/80 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-3 text-start">{t('reports.colSku')}</th>
                      <th className="py-3 px-3 text-start">{t('reports.colProduct')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colColor')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colSize')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colUnitsSold')}</th>
                      <th className="py-3 px-3 text-end">{t('reports.colTotalRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                    {bestSellersData.sortedSkus.map((sku, idx) => (
                      <tr key={sku.sku + idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-3 font-bold font-mono text-neutral-900 dark:text-white">
                          {sku.sku}
                        </td>
                        <td className="py-3 px-3 font-medium text-neutral-900 dark:text-neutral-100">
                          {sku.title}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="neutral" size="sm">{sku.color}</Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="neutral" size="sm">{sku.size}</Badge>
                        </td>
                        <td className="py-3 px-3 text-center font-bold font-mono text-neutral-900 dark:text-white">
                          {formatNumber(sku.qty)}
                        </td>
                        <td className="py-3 px-3 text-end font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(sku.revenue, activeOrganization?.currency, isPersian)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-2.5">
                {bestSellersData.sortedSkus.map((sku, idx) => (
                  <div
                    key={sku.sku + idx}
                    className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-neutral-900 dark:text-white truncate">
                          {sku.title}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono">
                          {sku.sku}
                        </p>
                      </div>
                      <span className="font-bold font-mono text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                        {formatCurrency(sku.revenue, activeOrganization?.currency, isPersian)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="neutral" size="sm">{sku.color}</Badge>
                        <Badge variant="neutral" size="sm">{sku.size}</Badge>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-neutral-700 dark:text-neutral-300">
                        {formatNumber(sku.qty)} {t('reports.unitsUnit')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
