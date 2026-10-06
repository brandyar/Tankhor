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
} from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import {
  PackageX,
  Printer,
  AlertTriangle,
  TrendingDown,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

const getEntityId = (val: any): number | undefined => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'object') {
    return val.id !== undefined && val.id !== null ? Number(val.id) : undefined;
  }
  const num = Number(val);
  return isNaN(num) ? undefined : num;
};

interface DeadStockItem {
  variant: ProductVariant;
  productTitle: string;
  colorName: string;
  sizeName: string;
  stockQty: number;
  unitCost: number;
  totalTiedCapital: number;
  daysInactive: number;
  soldQty: number;
}

export const InventoryPerformancePage: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';
  const formatNumber = (n: number | string) => (isPersian ? toPersianDigits(n) : String(n));

  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, OrderItem[]>>({});
  const [deadStockDaysThreshold, setDeadStockDaysThreshold] = useState<number>(30);

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgParams = activeOrganization?.id ? { organization_id: activeOrganization.id } : {};

      const [prodsRes, varsRes, colsRes, szsRes, invRes, ordersRes] = await Promise.all([
        adapter.getProducts(orgParams),
        adapter.getVariants(orgParams),
        adapter.getColors(orgParams),
        adapter.getSizes(orgParams),
        adapter.getInventoryItems(orgParams),
        adapter.getOrders(orgParams),
      ]);

      const validProducts = Array.isArray(prodsRes) ? prodsRes.filter((p): p is Product => Boolean(p && p.id)) : [];
      const validVariants = Array.isArray(varsRes) ? varsRes.filter((v): v is ProductVariant => Boolean(v && v.id)) : [];
      const validColors = Array.isArray(colsRes) ? colsRes.filter((c): c is Color => Boolean(c && c.id)) : [];
      const validSizes = Array.isArray(szsRes) ? szsRes.filter((s): s is Size => Boolean(s && s.id)) : [];
      const validInventory = Array.isArray(invRes) ? invRes.filter((i): i is InventoryItem => Boolean(i && i.id)) : [];
      const validOrders = Array.isArray(ordersRes) ? ordersRes.filter((o): o is Order => Boolean(o && o.id)) : [];

      setProducts(validProducts);
      setVariants(validVariants);
      setColors(validColors);
      setSizes(validSizes);
      setInventoryItems(validInventory);
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
              itemsMap[o.id] = Array.isArray(items) ? items : [];
            } catch {
              itemsMap[o.id] = [];
            }
          })
        );
      }
      setOrderItemsMap(itemsMap);
    } catch (err) {
      console.error('[InventoryPerformancePage] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const colorMap = useMemo(() => new Map(colors.map((c) => [c.id, c])), [colors]);
  const sizeMap = useMemo(() => new Map(sizes.map((s) => [s.id, s])), [sizes]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const deadStockData = useMemo(() => {
    // Map of variant sales info
    const variantSales: Record<number, { lastSaleDate: string; soldQty: number }> = {};

    orders.forEach((order) => {
      const items = orderItemsMap[order.id] || [];
      const orderDate = order.order_date || order.date_created || '2024-01-01';

      items.forEach((item) => {
        const rawVId = item.variant_id ?? (item as any).product_variant_id;
        const vId = getEntityId(rawVId);
        if (vId !== undefined) {
          const qty = Number(item.quantity) || 1;
          if (!variantSales[vId]) {
            variantSales[vId] = { lastSaleDate: orderDate, soldQty: 0 };
          }
          variantSales[vId].soldQty += qty;
          if (new Date(orderDate).getTime() > new Date(variantSales[vId].lastSaleDate).getTime()) {
            variantSales[vId].lastSaleDate = orderDate;
          }
        }
      });
    });

    const deadStockItems: DeadStockItem[] = [];
    let totalTiedCapital = 0;
    let totalDeadUnits = 0;

    variants.forEach((v) => {
      // Find current on-hand stock
      const stockItems = inventoryItems.filter((i) => {
        const iVid = getEntityId(i.variant_id);
        return iVid === v.id;
      });

      const stockCount = stockItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      if (stockCount > 0) {
        const salesInfo = variantSales[v.id];
        const soldQty = salesInfo ? salesInfo.soldQty : 0;

        const lastDateStr = salesInfo?.lastSaleDate || v.date_created || '2024-01-01';
        const daysDiff = Math.max(15, Math.floor((Date.now() - new Date(lastDateStr).getTime()) / (1000 * 3600 * 24)));

        if (daysDiff >= deadStockDaysThreshold || soldQty === 0) {
          const pId = getEntityId(v.product_id);
          const prod = pId !== undefined ? productMap.get(pId) : undefined;
          const clrId = getEntityId(v.color_id);
          const clr = clrId !== undefined ? colorMap.get(clrId) : null;
          const szId = getEntityId(v.size_id);
          const sz = szId !== undefined ? sizeMap.get(szId) : null;

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

  const handlePrint = () => {
    printElement('dead-stock-report-container', {
      title: isPersian ? 'گزارش_کالاهای_راکد_تن‌خور' : 'Tankhor_Dead_Stock_Report',
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* Header & Controls */}
      <div className="no-print">
        <PageHeader
          title={t('reports.tabInventoryPerformance', 'عملکرد انبار و کالاهای راکد')}
          subtitle={t('reports.deadStockSectionSubtitle', 'شناسایی اقلام بدون گردش به تفکیک سایز، رنگ و ارزش سرمایه بلوکه‌شده')}
          actions={
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {/* Threshold Selector */}
              <div className="flex items-center justify-between sm:justify-start gap-2 bg-neutral-100 dark:bg-neutral-800/80 px-3 py-2 sm:py-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 min-w-0">
                <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 whitespace-nowrap shrink-0">
                  {t('reports.inactiveThreshold')}
                </span>
                <select
                  value={deadStockDaysThreshold}
                  onChange={(e) => setDeadStockDaysThreshold(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-neutral-900 dark:text-white outline-hidden cursor-pointer truncate max-w-[150px] sm:max-w-none text-end sm:text-start"
                >
                  <option value={15}>{t('reports.opt15Days')}</option>
                  <option value={30}>{t('reports.opt30Days')}</option>
                  <option value={60}>{t('reports.opt60Days')}</option>
                  <option value={90}>{t('reports.opt90Days')}</option>
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="w-full sm:w-auto justify-center shrink-0"
                icon={<Printer className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />}
              >
                {t('reports.printReportBtn')}
              </Button>
            </div>
          }
        />
      </div>

      <div id="dead-stock-report-container" className="space-y-8">
        {/* ========================================================================= */}
        {/* SECTION 1: DEAD STOCK SUMMARY CARDS (NO CUTOFFS ON MOBILE) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Blocked Capital */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-red-700 dark:text-red-400">
                  {t('reports.tiedCapitalTitle')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-red-600 dark:text-red-400 tracking-tight font-mono break-words">
                  {formatCurrency(deadStockData.totalTiedCapital, activeOrganization?.currency, isPersian)}
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t('reports.tiedCapitalDesc')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 flex items-center justify-center shrink-0 border border-red-200/80 dark:border-red-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </Card>

          {/* Total Stagnant Units */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {t('reports.totalDeadUnitsTitle')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight font-mono break-words">
                  {formatNumber(deadStockData.totalDeadUnits)}{' '}
                  <span className="text-xs font-normal text-neutral-500 font-sans">{t('reports.unitsUnit')}</span>
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t('reports.totalDeadUnitsDesc')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center shrink-0 border border-neutral-200/80 dark:border-neutral-700">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
          </Card>

          {/* Inactive Variants Count */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {t('reports.inactiveVariantsTitle')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight font-mono break-words">
                  {formatNumber(deadStockData.deadStockItems.length)}{' '}
                  <span className="text-xs font-normal text-neutral-500 font-sans">{t('reports.variantsUnit')}</span>
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t('reports.inactiveVariantsDesc')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0 border border-neutral-200/80 dark:border-neutral-700">
                <PackageX className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: DEAD STOCK ITEMS LIST (DUAL TABLE / CARDS VIEW) */}
        {/* ========================================================================= */}
        <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                {t('reports.deadStockTableTitle')}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('reports.deadStockTableSubtitle')}
              </p>
            </div>
            <Badge variant="neutral" size="sm">
              {formatNumber(deadStockData.deadStockItems.length)} {t('reports.itemsBadge')}
            </Badge>
          </div>

          {deadStockData.deadStockItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {t('reports.noDeadStockFound')}
            </div>
          ) : (
            <div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                <table className="w-full text-xs text-start">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 border-b border-neutral-200/80 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-3 text-start">{t('reports.colSku')}</th>
                      <th className="py-3 px-3 text-start">{t('reports.colProduct')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colColor')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colSize')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colStockDead')}</th>
                      <th className="py-3 px-3 text-end">{t('reports.colUnitCost')}</th>
                      <th className="py-3 px-3 text-end">{t('reports.colBlockedCapital')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colInactiveDays')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                    {deadStockData.deadStockItems.map((item, idx) => (
                      <tr key={item.variant.sku + idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-3 font-bold font-mono text-neutral-900 dark:text-white">
                          {item.variant.sku}
                        </td>
                        <td className="py-3 px-3 font-medium text-neutral-900 dark:text-neutral-100">
                          {item.productTitle}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="neutral" size="sm">{item.colorName}</Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="neutral" size="sm">{item.sizeName}</Badge>
                        </td>
                        <td className="py-3 px-3 text-center font-bold font-mono text-red-600 dark:text-red-400">
                          {formatNumber(item.stockQty)}
                        </td>
                        <td className="py-3 px-3 text-end font-mono text-neutral-600 dark:text-neutral-400">
                          {formatCurrency(item.unitCost, activeOrganization?.currency, isPersian)}
                        </td>
                        <td className="py-3 px-3 text-end font-bold font-mono text-neutral-900 dark:text-white">
                          {formatCurrency(item.totalTiedCapital, activeOrganization?.currency, isPersian)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-neutral-600 dark:text-neutral-400">
                          {formatNumber(item.daysInactive)} {t('reports.daysUnit')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge
                            variant={item.daysInactive >= 90 ? 'danger' : item.daysInactive >= 60 ? 'warning' : 'neutral'}
                            size="sm"
                          >
                            {item.daysInactive >= 90
                              ? t('reports.statusCritical')
                              : item.daysInactive >= 60
                              ? t('reports.statusWarning')
                              : t('reports.statusAttention')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {deadStockData.deadStockItems.map((item, idx) => (
                  <div
                    key={item.variant.sku + idx}
                    className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-neutral-900 dark:text-white truncate">
                          {item.productTitle}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono">
                          {item.variant.sku}
                        </p>
                      </div>
                      <Badge
                        variant={item.daysInactive >= 90 ? 'danger' : item.daysInactive >= 60 ? 'warning' : 'neutral'}
                        size="sm"
                      >
                        {item.daysInactive >= 90
                          ? t('reports.statusCritical')
                          : item.daysInactive >= 60
                          ? t('reports.statusWarning')
                          : t('reports.statusAttention')}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                      <Badge variant="neutral" size="sm">{item.colorName}</Badge>
                      <Badge variant="neutral" size="sm">{item.sizeName}</Badge>
                      <span className="text-[10px] text-neutral-400 font-mono ms-auto flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatNumber(item.daysInactive)} {t('reports.daysUnit')}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-neutral-400 block">موجودی راکد</span>
                        <span className="font-bold font-mono text-red-600 dark:text-red-400">
                          {formatNumber(item.stockQty)} عدد
                        </span>
                      </div>
                      <div className="text-end">
                        <span className="text-[10px] text-neutral-400 block">سرمایه بلوکه‌شده</span>
                        <span className="font-bold font-mono text-neutral-900 dark:text-white">
                          {formatCurrency(item.totalTiedCapital, activeOrganization?.currency, isPersian)}
                        </span>
                      </div>
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
