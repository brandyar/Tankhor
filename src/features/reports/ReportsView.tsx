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
  PackageX,
  Shirt,
  Palette,
  Tag,
  Printer,
  AlertTriangle,
  PackageCheck,
  TrendingDown,
  Layers,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
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
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, OrderItem[]>>({});
  const [, setCategories] = useState<Category[]>([]);

  // Filter states
  const [deadStockDaysThreshold, setDeadStockDaysThreshold] = useState<number>(30);

  useEffect(() => {
    loadReportData();
  }, [activeOrganization]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgParams = activeOrganization ? { organization_id: activeOrganization.id } : {};

      const [
        prodsRes,
        varsRes,
        colsRes,
        szsRes,
        invRes,
        ordersRes,
        catsRes,
      ] = await Promise.all([
        adapter.getProducts(orgParams),
        adapter.getVariants(orgParams),
        adapter.getColors(orgParams),
        adapter.getSizes(orgParams),
        adapter.getInventoryItems(orgParams),
        adapter.getOrders(orgParams),
        adapter.getCategories(orgParams),
      ]);

      setProducts(prodsRes || []);
      setVariants(varsRes || []);
      setColors(colsRes || []);
      setSizes(szsRes || []);
      setInventoryItems(invRes || []);
      setOrders(ordersRes || []);
      setCategories(catsRes || []);

      // Fetch order items for each order
      const itemsMap: Record<number, OrderItem[]> = {};
      if (ordersRes && ordersRes.length > 0) {
        await Promise.all(
          ordersRes.map(async (o) => {
            try {
              const items = await adapter.getOrderItems(o.id);
              itemsMap[o.id] = items || [];
            } catch {
              itemsMap[o.id] = [];
            }
          })
        );
      }
      setOrderItemsMap(itemsMap);
    } catch (err) {
      console.error('[ReportsView] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Maps for quick lookup
  const colorMap = useMemo(() => new Map(colors.map((c) => [c.id, c])), [colors]);
  const sizeMap = useMemo(() => new Map(sizes.map((s) => [s.id, s])), [sizes]);
  const variantMap = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Combined Order Items
  const allOrderItems = useMemo(() => {
    return Object.values(orderItemsMap).flat();
  }, [orderItemsMap]);

  // -------------------------------------------------------------
  // 1. BEST SELLING SIZES & COLORS COMPUTATION
  // -------------------------------------------------------------
  const bestSellersData = useMemo(() => {
    const sizeStats: Record<string, { name: string; id?: number; qty: number; revenue: number }> = {};
    const colorStats: Record<string, { name: string; hex?: string; id?: number; qty: number; revenue: number }> = {};
    const variantStats: Record<number, { sku: string; title: string; color: string; size: string; qty: number; revenue: number }> = {};

    let totalSoldQty = 0;
    let totalSalesRev = 0;

    allOrderItems.forEach((item) => {
      const variant = variantMap.get(typeof item.variant_id === 'object' ? (item.variant_id as any).id : item.variant_id);
      const qty = item.quantity || 1;
      const rev = item.total || (item.unit_price * qty);

      totalSoldQty += qty;
      totalSalesRev += rev;

      if (variant) {
        // Size aggregation
        const szObj = variant.size_id ? sizeMap.get(typeof variant.size_id === 'object' ? (variant.size_id as any).id : variant.size_id) : null;
        const sizeName = szObj?.name || variant.size_name || 'سایز نامشخص';
        if (!sizeStats[sizeName]) {
          sizeStats[sizeName] = { name: sizeName, id: szObj?.id, qty: 0, revenue: 0 };
        }
        sizeStats[sizeName].qty += qty;
        sizeStats[sizeName].revenue += rev;

        // Color aggregation
        const clrObj = variant.color_id ? colorMap.get(typeof variant.color_id === 'object' ? (variant.color_id as any).id : variant.color_id) : null;
        const colorName = clrObj?.name || variant.color_name || 'رنگ نامشخص';
        if (!colorStats[colorName]) {
          colorStats[colorName] = { name: colorName, hex: clrObj?.hex || '#94a3b8', id: clrObj?.id, qty: 0, revenue: 0 };
        }
        colorStats[colorName].qty += qty;
        colorStats[colorName].revenue += rev;

        // Variant aggregation
        const prod = typeof variant.product_id === 'object' ? variant.product_id : productMap.get(variant.product_id as number);
        const prodTitle = prod?.title || variant.product_title || 'کالا';
        if (!variantStats[variant.id]) {
          variantStats[variant.id] = {
            sku: variant.sku,
            title: prodTitle,
            color: colorName,
            size: sizeName,
            qty: 0,
            revenue: 0,
          };
        }
        variantStats[variant.id].qty += qty;
        variantStats[variant.id].revenue += rev;
      }
    });

    // Convert to sorted arrays
    const sortedSizes = Object.values(sizeStats).sort((a, b) => b.qty - a.qty);
    const sortedColors = Object.values(colorStats).sort((a, b) => b.qty - a.qty);
    const sortedVariants = Object.values(variantStats).sort((a, b) => b.qty - a.qty);

    return {
      sortedSizes,
      sortedColors,
      sortedVariants,
      totalSoldQty,
      totalSalesRev,
    };
  }, [allOrderItems, variantMap, sizeMap, colorMap, productMap]);

  // -------------------------------------------------------------
  // 2. DEAD STOCK ANALYSIS COMPUTATION
  // -------------------------------------------------------------
  const deadStockData = useMemo(() => {
    // Collect sales date for variants
    const variantSalesMap: Record<number, { lastSaleDate: string; totalSold: number }> = {};
    orders.forEach((ord) => {
      const items = orderItemsMap[ord.id] || [];
      items.forEach((item) => {
        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any).id : item.variant_id;
        if (!variantSalesMap[vId]) {
          variantSalesMap[vId] = { lastSaleDate: ord.date_created || '', totalSold: 0 };
        }
        variantSalesMap[vId].totalSold += item.quantity || 1;
        if (ord.date_created && ord.date_created > variantSalesMap[vId].lastSaleDate) {
          variantSalesMap[vId].lastSaleDate = ord.date_created;
        }
      });
    });

    const deadStockItems: Array<{
      variant: ProductVariant;
      productTitle: string;
      colorName: string;
      sizeName: string;
      stockQty: number;
      unitCost: number;
      totalTiedCapital: number;
      daysInactive: number;
      soldQty: number;
    }> = [];

    let totalTiedCapital = 0;
    let totalDeadUnits = 0;

    variants.forEach((v) => {
      const stock = inventoryItems
        .filter((inv) => (typeof inv.variant_id === 'object' ? (inv.variant_id as any).id : inv.variant_id) === v.id)
        .reduce((sum, inv) => sum + (inv.quantity || 0), 0);

      const stockCount = stock > 0 ? stock : (v.stock_quantity || 0);

      if (stockCount > 0) {
        const salesInfo = variantSalesMap[v.id];
        const soldQty = salesInfo ? salesInfo.totalSold : 0;

        const lastDateStr = salesInfo?.lastSaleDate || v.date_created || '2024-01-01';
        const daysDiff = Math.max(15, Math.floor((Date.now() - new Date(lastDateStr).getTime()) / (1000 * 3600 * 24)));

        if (daysDiff >= deadStockDaysThreshold || soldQty === 0) {
          const prod = typeof v.product_id === 'object' ? v.product_id : productMap.get(v.product_id as number);
          const clr = v.color_id ? colorMap.get(typeof v.color_id === 'object' ? (v.color_id as any).id : v.color_id) : null;
          const sz = v.size_id ? sizeMap.get(typeof v.size_id === 'object' ? (v.size_id as any).id : v.size_id) : null;

          const unitCost = v.cost || (v.price ? v.price * 0.6 : 150000);
          const tiedCap = stockCount * unitCost;

          totalTiedCapital += tiedCap;
          totalDeadUnits += stockCount;

          deadStockItems.push({
            variant: v,
            productTitle: prod?.title || v.product_title || t('reports.defaultProductTitle'),
            colorName: clr?.name || v.color_name || t('reports.unknownLabel'),
            sizeName: sz?.name || v.size_name || t('reports.unknownLabel'),
            stockQty: stockCount,
            unitCost,
            totalTiedCapital: tiedCap,
            daysInactive: daysDiff,
            soldQty,
          });
        }
      }
    });

    deadStockItems.sort((a, b) => b.totalTiedCapital - a.totalTiedCapital);

    return {
      deadStockItems,
      totalTiedCapital,
      totalDeadUnits,
    };
  }, [variants, inventoryItems, orders, orderItemsMap, deadStockDaysThreshold, productMap, colorMap, sizeMap, t]);

  const handlePrintReport = () => {
    printElement('tankhor-report-container', { title: isPersian ? 'گزارش_تحلیلی_تن‌خور' : 'Tankhor_Analytics_Report' });
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Page Header */}
      <div className="no-print">
        <PageHeader
          title={t('reports.title')}
          subtitle={t('reports.subtitle')}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintReport}
                icon={<Printer className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />}
              >
                {t('reports.printReportBtn')}
              </Button>
            </div>
          }
        />
      </div>

      {/* Main Report Content Container */}
      <div id="tankhor-report-container" className="space-y-10">
        {/* ========================================================================= */}
        {/* SECTION 1: BEST SELLING SIZES & COLORS */}
        {/* ========================================================================= */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
                <Shirt className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">{t('reports.bestSellersTitle')}</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-300 mt-0.5">{t('reports.bestSellersSubtitle')}</p>
              </div>
            </div>
          </div>

          {/* Overview Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <Card className="hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="caption-mono text-neutral-600 dark:text-neutral-300 font-bold">{t('reports.totalUnitsSold')}</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mt-2 font-mono">
                    {formatNumber(bestSellersData.totalSoldQty)}
                    <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400 font-sans ms-1.5">{t('reports.unitsUnit')}</span>
                  </h3>
                  <div className="mt-2.5 flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300">
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('reports.totalGarmentsDispatched')}</span>
                  </div>
                </div>
                <div className="w-11 h-11 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl flex items-center justify-center border border-neutral-200/80 dark:border-neutral-700 group-hover:scale-105 transition-transform">
                  <Shirt className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="caption-mono text-neutral-600 dark:text-neutral-300 font-bold">{t('reports.bestSellingSize')}</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mt-2 font-mono">
                    {bestSellersData.sortedSizes[0]?.name || '---'}
                  </h3>
                  <div className="mt-2.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 font-mono font-medium">
                    <Tag className="w-3.5 h-3.5" />
                    <span>{bestSellersData.sortedSizes[0] ? `${formatNumber(bestSellersData.sortedSizes[0].qty)} ${t('reports.unitsSold')}` : t('reports.noSalesRecorded')}</span>
                  </div>
                </div>
                <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-xl flex items-center justify-center border border-amber-200/80 dark:border-amber-800/60 group-hover:scale-105 transition-transform">
                  <Tag className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="caption-mono text-neutral-600 dark:text-neutral-300 font-bold">{t('reports.mostPopularColor')}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {bestSellersData.sortedColors[0]?.hex && (
                      <span
                        className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: bestSellersData.sortedColors[0].hex }}
                      />
                    )}
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                      {bestSellersData.sortedColors[0]?.name || '---'}
                    </h3>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1 text-xs text-purple-700 dark:text-purple-300 font-mono font-medium">
                    <Palette className="w-3.5 h-3.5" />
                    <span>{bestSellersData.sortedColors[0] ? `${formatNumber(bestSellersData.sortedColors[0].qty)} ${t('reports.unitsSold')}` : t('reports.noSalesRecorded')}</span>
                  </div>
                </div>
                <div className="w-11 h-11 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 rounded-xl flex items-center justify-center border border-purple-200/80 dark:border-purple-800/60 group-hover:scale-105 transition-transform">
                  <Palette className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="caption-mono text-neutral-600 dark:text-neutral-300 font-bold">{t('reports.catalogRevenueTurnover')}</p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight mt-2 font-mono truncate max-w-[200px]" title={formatCurrency(bestSellersData.totalSalesRev, activeOrganization?.currency, isPersian)}>
                    {formatCurrency(bestSellersData.totalSalesRev, activeOrganization?.currency, isPersian)}
                  </h3>
                  <div className="mt-2.5 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{t('reports.basedOnOrders')}</span>
                  </div>
                </div>
                <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/60 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </div>

          {/* Split Grid: Size Breakdown & Color Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sizes Breakdown */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('reports.sizesBreakdownTitle')}</h3>
                </div>
                <Badge variant="neutral">{t('reports.sizeRankingBadge')}</Badge>
              </div>

              {bestSellersData.sortedSizes.length === 0 ? (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-8">{t('reports.noSizeOrdersYet')}</p>
              ) : (
                <div className="space-y-3.5">
                  {bestSellersData.sortedSizes.map((sz, idx) => {
                    const sharePercent = bestSellersData.totalSoldQty > 0 ? Math.round((sz.qty / bestSellersData.totalSoldQty) * 100) : 0;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-900 dark:text-white">{sz.name}</span>
                          <div className="flex items-center gap-3 font-mono">
                            <span className="text-neutral-600 dark:text-neutral-300">{formatNumber(sz.qty)} {t('reports.unitsUnit')}</span>
                            <span className="font-bold text-neutral-900 dark:text-white">
                              {isPersian ? `٪${formatNumber(sharePercent)}` : `${sharePercent}%`}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.max(4, sharePercent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Colors Breakdown */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('reports.colorsBreakdownTitle')}</h3>
                </div>
                <Badge variant="neutral">{t('reports.colorPopularityBadge')}</Badge>
              </div>

              {bestSellersData.sortedColors.length === 0 ? (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-8">{t('reports.noColorOrdersYet')}</p>
              ) : (
                <div className="space-y-3.5">
                  {bestSellersData.sortedColors.map((clr, idx) => {
                    const sharePercent = bestSellersData.totalSoldQty > 0 ? Math.round((clr.qty / bestSellersData.totalSoldQty) * 100) : 0;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {clr.hex && (
                              <span
                                className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                                style={{ backgroundColor: clr.hex }}
                              />
                            )}
                            <span className="font-bold text-neutral-900 dark:text-white">{clr.name}</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono">
                            <span className="text-neutral-600 dark:text-neutral-300">{formatNumber(clr.qty)} {t('reports.unitsUnit')}</span>
                            <span className="font-bold text-neutral-900 dark:text-white">
                              {isPersian ? `٪${formatNumber(sharePercent)}` : `${sharePercent}%`}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.max(4, sharePercent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Top Product Variants Ranking Table */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('reports.topSkusTitle')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-300 mt-0.5">{t('reports.topSkusSubtitle')}</p>
              </div>
              <Badge variant="neutral">{t('reports.top10Badge')}</Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className={`w-full text-xs ${isPersian ? 'text-right' : 'text-left'}`}>
                <thead className="bg-neutral-50 dark:bg-[#181a20] text-neutral-800 dark:text-neutral-100 font-bold border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="p-3">{t('reports.colSku')}</th>
                    <th className="p-3">{t('reports.colProduct')}</th>
                    <th className="p-3">{t('reports.colColor')}</th>
                    <th className="p-3">{t('reports.colSize')}</th>
                    <th className="p-3 text-center">{t('reports.colUnitsSold')}</th>
                    <th className="p-3 text-start">{t('reports.colTotalRevenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-[#13151a]">
                  {bestSellersData.sortedVariants.slice(0, 10).map((varStat, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-neutral-900 dark:text-white">{varStat.sku}</td>
                      <td className="p-3 font-medium text-neutral-800 dark:text-neutral-200">{varStat.title}</td>
                      <td className="p-3 text-neutral-700 dark:text-neutral-300">{varStat.color}</td>
                      <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">{varStat.size}</td>
                      <td className="p-3 text-center font-mono font-bold text-neutral-900 dark:text-white">{formatNumber(varStat.qty)}</td>
                      <td className="p-3 text-start font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(varStat.revenue, activeOrganization?.currency, isPersian)}
                      </td>
                    </tr>
                  ))}
                  {bestSellersData.sortedVariants.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-neutral-400 dark:text-neutral-500">{t('reports.noDataRecorded')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: DEAD STOCK ANALYSIS */}
        {/* ========================================================================= */}
        <section className="space-y-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center border border-rose-200/70 dark:border-rose-900/50">
                <PackageX className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">{t('reports.deadStockSectionTitle')}</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-300 mt-0.5">{t('reports.deadStockSectionSubtitle')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 no-print">
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 shrink-0">{t('reports.inactiveThreshold')}</span>
              <select
                value={deadStockDaysThreshold}
                onChange={(e) => setDeadStockDaysThreshold(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#181a20] text-xs font-bold text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-400"
              >
                <option value={15} className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">{t('reports.opt15Days')}</option>
                <option value={30} className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">{t('reports.opt30Days')}</option>
                <option value={60} className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">{t('reports.opt60Days')}</option>
                <option value={90} className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">{t('reports.opt90Days')}</option>
              </select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <Card className="hover:border-rose-300 dark:hover:border-rose-700 transition-all shadow-xs bg-gradient-to-br from-white to-rose-50/20 dark:from-[#181a20] dark:to-rose-950/40 dark:border-neutral-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="caption-mono text-rose-900 dark:text-rose-300 font-bold">{t('reports.tiedCapitalTitle')}</p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-rose-950 dark:text-rose-200 tracking-tight mt-2 font-mono">
                    {formatCurrency(deadStockData.totalTiedCapital, activeOrganization?.currency, isPersian)}
                  </h3>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/90 mt-1">{t('reports.tiedCapitalDesc')}</p>
                </div>
                <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 rounded-xl flex items-center justify-center border border-rose-200/80 dark:border-rose-900/50">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="hover:border-amber-300 dark:hover:border-amber-700 transition-all shadow-xs bg-gradient-to-br from-white to-amber-50/20 dark:from-[#181a20] dark:to-amber-950/40 dark:border-neutral-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="caption-mono text-amber-900 dark:text-amber-300 font-bold">{t('reports.totalDeadUnitsTitle')}</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-950 dark:text-amber-200 tracking-tight mt-2 font-mono">
                    {formatNumber(deadStockData.totalDeadUnits)}
                    <span className="text-xs font-normal text-amber-800/80 dark:text-amber-300/90 font-sans ms-1.5">{t('reports.unitsUnit')}</span>
                  </h3>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-300/90 mt-1">{t('reports.totalDeadUnitsDesc')}</p>
                </div>
                <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-xl flex items-center justify-center border border-amber-200/80 dark:border-amber-900/50">
                  <PackageX className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <p className="caption-mono text-neutral-600 dark:text-neutral-300 font-bold">{t('reports.inactiveVariantsTitle')}</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mt-2 font-mono">
                    {formatNumber(deadStockData.deadStockItems.length)}
                    <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400 font-sans ms-1.5">{t('reports.variantsUnit')}</span>
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-300 mt-1">{t('reports.inactiveVariantsDesc')}</p>
                </div>
                <div className="w-11 h-11 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl flex items-center justify-center border border-neutral-200/80 dark:border-neutral-700">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </div>

          {/* Dead Stock Table */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('reports.deadStockTableTitle')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-300 mt-0.5">{t('reports.deadStockTableSubtitle')}</p>
              </div>
              <Badge variant="neutral">{formatNumber(deadStockData.deadStockItems.length)} {t('reports.itemsBadge')}</Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className={`w-full text-xs ${isPersian ? 'text-right' : 'text-left'}`}>
                <thead className="bg-neutral-50 dark:bg-[#181a20] text-neutral-800 dark:text-neutral-100 font-bold border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="p-3">{t('reports.colSku')}</th>
                    <th className="p-3">{t('reports.colProduct')}</th>
                    <th className="p-3">{t('reports.colColorSize')}</th>
                    <th className="p-3 text-center">{t('reports.colStockDead')}</th>
                    <th className="p-3 text-start">{t('reports.colUnitCost')}</th>
                    <th className="p-3 text-start">{t('reports.colBlockedCapital')}</th>
                    <th className="p-3 text-center">{t('reports.colInactiveDays')}</th>
                    <th className="p-3 text-center">{t('reports.colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-[#13151a]">
                  {deadStockData.deadStockItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-neutral-900 dark:text-white">{item.variant.sku}</td>
                      <td className="p-3 font-medium text-neutral-800 dark:text-neutral-200">{item.productTitle}</td>
                      <td className="p-3 text-neutral-700 dark:text-neutral-300">{item.colorName} / {item.sizeName}</td>
                      <td className="p-3 text-center font-mono font-bold text-amber-700 dark:text-amber-300">
                        {formatNumber(item.stockQty)} {t('reports.unitsUnit')}
                      </td>
                      <td className="p-3 text-start font-mono text-neutral-700 dark:text-neutral-300">
                        {formatCurrency(item.unitCost, activeOrganization?.currency, isPersian)}
                      </td>
                      <td className="p-3 text-start font-mono font-bold text-rose-700 dark:text-rose-400">
                        {formatCurrency(item.totalTiedCapital, activeOrganization?.currency, isPersian)}
                      </td>
                      <td className="p-3 text-center font-mono text-neutral-800 dark:text-neutral-200">
                        {formatNumber(item.daysInactive)} {t('reports.daysUnit')}
                      </td>
                      <td className="p-3 text-center">
                        {item.daysInactive >= 90 ? (
                          <Badge variant="error">{t('reports.statusCritical')}</Badge>
                        ) : item.daysInactive >= 60 ? (
                          <Badge variant="warning">{t('reports.statusWarning')}</Badge>
                        ) : (
                          <Badge variant="neutral">{t('reports.statusAttention')}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {deadStockData.deadStockItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-neutral-400 dark:text-neutral-500">
                        {t('reports.noDeadStockFound')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};
