import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import {
  Order,
  OrderItem,
  Product,
  ProductVariant,
  Category,
  Customer,
} from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { DateInput } from '../../components/ui/DateInput';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCurrency, toPersianDigits, formatDate } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import {
  calculateDateRange,
  DatePresetKey,
} from './utils/reportDateRanges';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Receipt,
  Percent,
  ShoppingCart,
  ShoppingBag,
  Download,
  Printer,
  Search,
  Layers,
  ArrowUpRight,
  Filter,
  BarChart2,
  Package,
} from 'lucide-react';

export const SalesReportPage: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';
  const formatNumber = (n: number | string) => (isPersian ? toPersianDigits(n) : String(n));

  const [isLoading, setIsLoading] = useState(true);

  // Raw Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, OrderItem[]>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Filter States
  const [preset, setPreset] = useState<DatePresetKey>('thisMonth');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chartGrouping, setChartGrouping] = useState<'day' | 'month'>('day');

  // Initialize date range
  useEffect(() => {
    const range = calculateDateRange('thisMonth', isPersian);
    setCustomFrom(range.from);
    setCustomTo(range.to);
  }, [isPersian]);

  const handlePresetChange = (newPreset: DatePresetKey) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const range = calculateDateRange(newPreset, isPersian);
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgParams = activeOrganization?.id ? { organization_id: activeOrganization.id } : {};

      const [ordersRes, prodsRes, varsRes, catsRes, custsRes] = await Promise.all([
        adapter.getOrders(orgParams),
        adapter.getProducts(orgParams),
        adapter.getVariants(orgParams),
        adapter.getCategories(orgParams),
        adapter.getCustomers(orgParams),
      ]);

      const validOrders = Array.isArray(ordersRes) ? ordersRes.filter((o): o is Order => Boolean(o && o.id)) : [];
      const validProds = Array.isArray(prodsRes) ? prodsRes.filter((p): p is Product => Boolean(p && p.id)) : [];
      const validVars = Array.isArray(varsRes) ? varsRes.filter((v): v is ProductVariant => Boolean(v && v.id)) : [];
      const validCats = Array.isArray(catsRes) ? catsRes.filter((c): c is Category => Boolean(c && c.id)) : [];
      const validCusts = Array.isArray(custsRes) ? custsRes.filter((c): c is Customer => Boolean(c && c.id)) : [];

      setOrders(validOrders);
      setProducts(validProds);
      setVariants(validVars);
      setCategories(validCats);
      setCustomers(validCusts);

      // Load order items
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
      console.error('[SalesReportPage] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Maps
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const variantMap = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // Filtered Orders in selected Date Range
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!order) return false;

      // Date check
      const orderDateStr = order.order_date || order.date_created || '';
      const orderIso = orderDateStr.slice(0, 10);
      if (customFrom && orderIso < customFrom) return false;
      if (customTo && orderIso > customTo) return false;

      // Status check
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      // Payment status check
      if (paymentFilter !== 'all' && order.payment_status !== paymentFilter) return false;

      // Channel check
      if (channelFilter === 'online' && !order.channel?.toLowerCase().includes('online') && !order.channel?.toLowerCase().includes('woo')) return false;
      if (channelFilter === 'store' && (order.channel?.toLowerCase().includes('online') || order.channel?.toLowerCase().includes('woo'))) return false;

      return true;
    });
  }, [orders, customFrom, customTo, statusFilter, paymentFilter, channelFilter]);

  // Financial & Profit Calculations
  const reportMetrics = useMemo(() => {
    let grossSales = 0;
    let totalDiscounts = 0;
    let netSales = 0;
    let totalCogs = 0;
    let totalUnits = 0;

    const categoryStats: Record<string, { name: string; revenue: number; cogs: number; profit: number; qty: number }> = {};
    const productStats: Record<number, { title: string; sku: string; categoryName: string; revenue: number; cogs: number; profit: number; qty: number }> = {};
    const timelineMap: Record<string, { date: string; revenue: number; cogs: number; profit: number; ordersCount: number }> = {};

    filteredOrders.forEach((order) => {
      const orderItems = orderItemsMap[order.id] || [];
      const orderTotal = Number(order.total) || (Number((order as any).total_amount) || 0);
      const orderDiscount = Number(order.discount) || (Number((order as any).discount_amount) || 0);

      let orderItemGrossSum = 0;
      let orderCogsSum = 0;
      let orderUnitsSum = 0;

      orderItems.forEach((item) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const grossItem = qty * unitPrice;
        orderItemGrossSum += grossItem;
        orderUnitsSum += qty;

        // Resolve cost
        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
        const variant = vId ? variantMap.get(Number(vId)) : undefined;
        const itemCost = item.unit_cost !== undefined && item.unit_cost !== null
          ? Number(item.unit_cost)
          : variant?.cost !== undefined && variant?.cost !== null
          ? Number(variant.cost)
          : unitPrice * 0.6; // fallback 60% standard apparel ratio

        const itemCogs = qty * itemCost;
        orderCogsSum += itemCogs;

        // Resolve Product & Category for breakdown
        const pId = variant ? (typeof variant.product_id === 'object' ? (variant.product_id as any)?.id : Number(variant.product_id)) : undefined;
        const product = pId ? productMap.get(pId) : undefined;
        const catId = product ? (typeof product.category_id === 'object' ? (product.category_id as any)?.id : Number(product.category_id)) : undefined;
        const cat = catId ? categoryMap.get(catId) : undefined;
        const catName = cat?.name || t('reports.unknownLabel');

        // Category aggregator
        if (!categoryStats[catName]) {
          categoryStats[catName] = { name: catName, revenue: 0, cogs: 0, profit: 0, qty: 0 };
        }
        categoryStats[catName].revenue += grossItem;
        categoryStats[catName].cogs += itemCogs;
        categoryStats[catName].profit += (grossItem - itemCogs);
        categoryStats[catName].qty += qty;

        // Product aggregator
        if (pId) {
          if (!productStats[pId]) {
            productStats[pId] = {
              title: product?.title || variant?.sku || t('reports.defaultProductTitle'),
              sku: variant?.sku || `SKU-${pId}`,
              categoryName: catName,
              revenue: 0,
              cogs: 0,
              profit: 0,
              qty: 0,
            };
          }
          productStats[pId].revenue += grossItem;
          productStats[pId].cogs += itemCogs;
          productStats[pId].profit += (grossItem - itemCogs);
          productStats[pId].qty += qty;
        }
      });

      // If order had items, use item sums; otherwise fallback to order fields
      const finalGross = orderItemGrossSum > 0 ? orderItemGrossSum : orderTotal + orderDiscount;
      const finalNet = orderTotal > 0 ? orderTotal : finalGross - orderDiscount;
      const finalCogs = orderCogsSum > 0 ? orderCogsSum : finalNet * 0.6;

      grossSales += finalGross;
      totalDiscounts += orderDiscount;
      netSales += finalNet;
      totalCogs += finalCogs;
      totalUnits += orderUnitsSum > 0 ? orderUnitsSum : 1;

      // Timeline mapping
      const dateKey = (order.order_date || order.date_created || '2024-01-01').slice(0, chartGrouping === 'month' ? 7 : 10);
      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { date: dateKey, revenue: 0, cogs: 0, profit: 0, ordersCount: 0 };
      }
      timelineMap[dateKey].revenue += finalNet;
      timelineMap[dateKey].cogs += finalCogs;
      timelineMap[dateKey].profit += (finalNet - finalCogs);
      timelineMap[dateKey].ordersCount += 1;
    });

    const grossProfit = netSales - totalCogs;
    const profitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const aov = filteredOrders.length > 0 ? netSales / filteredOrders.length : 0;

    // Sort timeline chronologically
    const timelineData = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date));

    // Sort categories by revenue/profit
    const sortedCategories = Object.values(categoryStats).sort((a, b) => b.profit - a.profit);

    // Sort top products by profit
    const sortedProducts = Object.values(productStats).sort((a, b) => b.profit - a.profit).slice(0, 10);

    return {
      grossSales,
      totalDiscounts,
      netSales,
      totalCogs,
      grossProfit,
      profitMargin,
      totalOrdersCount: filteredOrders.length,
      aov,
      totalUnits,
      timelineData,
      sortedCategories,
      sortedProducts,
    };
  }, [filteredOrders, orderItemsMap, variantMap, productMap, categoryMap, chartGrouping, t]);

  // Filtered detailed orders for table
  const searchedOrders = useMemo(() => {
    if (!searchQuery.trim()) return filteredOrders;
    const q = searchQuery.toLowerCase().trim();
    return filteredOrders.filter((o) => {
      const custId = typeof o.customer_id === 'object' ? (o.customer_id as any)?.id : o.customer_id;
      const cust = custId ? customerMap.get(Number(custId)) : undefined;
      const custName = cust?.name || o.customer_name || '';
      return (
        o.order_number?.toLowerCase().includes(q) ||
        custName.toLowerCase().includes(q)
      );
    });
  }, [filteredOrders, searchQuery, customerMap]);

  // Export to CSV with UTF-8 BOM
  const handleExportCsv = () => {
    const headers = [
      t('reports.colOrderNumber'),
      t('reports.colDate'),
      t('reports.colCustomer'),
      t('reports.colItems'),
      t('reports.colNetSales'),
      t('reports.colCogs'),
      t('reports.colProfit'),
      t('reports.colMargin'),
      t('reports.colPaymentStatus'),
    ];

    const rows = searchedOrders.map((o) => {
      const custId = typeof o.customer_id === 'object' ? (o.customer_id as any)?.id : o.customer_id;
      const cust = custId ? customerMap.get(Number(custId)) : undefined;
      const custName = cust?.name || o.customer_name || '---';

      const items = orderItemsMap[o.id] || [];
      let cogs = 0;
      let units = 0;
      items.forEach((item) => {
        const qty = Number(item.quantity) || 1;
        units += qty;
        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
        const v = vId ? variantMap.get(Number(vId)) : undefined;
        const cost = item.unit_cost !== undefined ? Number(item.unit_cost) : (v?.cost || (Number(item.unit_price) * 0.6));
        cogs += (qty * cost);
      });

      const net = Number(o.total) || 0;
      const finalCogs = cogs > 0 ? cogs : net * 0.6;
      const profit = net - finalCogs;
      const margin = net > 0 ? ((profit / net) * 100).toFixed(1) : '0';

      return [
        o.order_number || `#${o.id}`,
        o.order_date || o.date_created?.slice(0, 10) || '',
        custName,
        units || 1,
        net,
        finalCogs,
        profit,
        `${margin}%`,
        o.payment_status || 'unpaid',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tankhor_sales_profit_${customFrom}_${customTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    printElement('sales-profit-report-container', {
      title: isPersian ? 'گزارش_فروش_و_سودآوری_تن‌خور' : 'Tankhor_Sales_Profit_Report',
    });
  };

  // Max value in timeline chart for scale
  const maxTimelineRevenue = useMemo(() => {
    const max = Math.max(...reportMetrics.timelineData.map((d) => Math.max(d.revenue, d.cogs, d.profit)), 1000);
    return max;
  }, [reportMetrics.timelineData]);

  const presetButtons: { key: DatePresetKey; label: string }[] = [
    { key: 'today', label: t('reports.rangeToday') },
    { key: 'yesterday', label: t('reports.rangeYesterday') },
    { key: 'last7days', label: t('reports.rangeLast7Days') },
    { key: 'last30days', label: t('reports.rangeLast30Days') },
    { key: 'thisMonth', label: t('reports.rangeThisMonth') },
    { key: 'lastMonth', label: t('reports.rangeLastMonth') },
    { key: 'thisSeason', label: t('reports.rangeThisSeason') },
    { key: 'thisYear', label: t('reports.rangeThisYear') },
    { key: 'allTime', label: t('reports.rangeAllTime') },
    { key: 'custom', label: t('reports.rangeCustom') },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* Page Header */}
      <div className="no-print">
        <PageHeader
          title={t('reports.tabSalesProfit', 'گزارش فروش و سودآوری')}
          subtitle={t('reports.salesTrendsSubtitle', 'تحلیل جامع درآمد فروش، بهای تمام‌شده کالا و حاشیه سود بر اساس بازه‌های زمانی')}
        />
      </div>

      {/* Time Range & Controls Bar */}
      <Card className="relative z-20 p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
        {/* Preset Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neutral-500 shrink-0" />
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 shrink-0">
              {t('reports.rangePreset')}
            </span>
          </div>

          {/* Quick Presets Buttons (Scrollable on mobile) */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
            {presetButtons.map((btn) => (
              <button
                key={btn.key}
                type="button"
                onClick={() => handlePresetChange(btn.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  preset === btn.key
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Range & Extra Filters */}
        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <DateInput
            label={t('reports.fromDate')}
            value={customFrom}
            onChange={(val) => {
              setCustomFrom(val);
              setPreset('custom');
            }}
          />
          <DateInput
            label={t('reports.toDate')}
            value={customTo}
            onChange={(val) => {
              setCustomTo(val);
              setPreset('custom');
            }}
          />

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
              {t('reports.filterStatus')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-3 rounded-lg text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-1 focus:ring-neutral-400 outline-hidden"
            >
              <option value="all">{t('reports.allStatuses')}</option>
              <option value="completed">تکمیل‌شده (Completed)</option>
              <option value="confirmed">تایید‌شده (Confirmed)</option>
              <option value="processing">در حال پردازش (Processing)</option>
              <option value="draft">پیش‌نویس (Draft)</option>
              <option value="cancelled">لغو شده (Cancelled)</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
              {t('reports.filterPayment')}
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full h-9 px-3 rounded-lg text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-1 focus:ring-neutral-400 outline-hidden"
            >
              <option value="all">{t('reports.allPayments')}</option>
              <option value="paid">پرداخت‌شده (Paid)</option>
              <option value="partially_paid">پرداخت ناقص (Partially Paid)</option>
              <option value="pending">در انتظار (Pending)</option>
              <option value="refunded">مسترد شده (Refunded)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-xs"
              onClick={handleExportCsv}
              icon={<Download className="w-3.5 h-3.5 text-neutral-500" />}
            >
              {t('reports.exportCsv')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs shrink-0"
              onClick={handlePrint}
              title={t('reports.printReportBtn')}
            >
              <Printer className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Printable Container */}
      <div id="sales-profit-report-container" className="relative z-10 space-y-8">
        {/* ========================================================================= */}
        {/* SECTION 1: CORE FINANCIAL & PROFITABILITY KPIS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Net Sales */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {t('reports.netSales')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight font-mono break-words">
                  {formatCurrency(reportMetrics.netSales, activeOrganization?.currency, isPersian)}
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t('reports.netSalesDesc')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center shrink-0 border border-neutral-200/80 dark:border-neutral-700">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </Card>

          {/* COGS (Cost of Goods Sold) */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {t('reports.cogs')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight font-mono break-words">
                  {formatCurrency(reportMetrics.totalCogs, activeOrganization?.currency, isPersian)}
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t('reports.cogsDesc')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0 border border-neutral-200/80 dark:border-neutral-700">
                <Package className="w-5 h-5" />
              </div>
            </div>
          </Card>

          {/* Gross Profit */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {t('reports.grossProfit')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight font-mono break-words">
                  {formatCurrency(reportMetrics.grossProfit, activeOrganization?.currency, isPersian)}
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t('reports.grossProfitDesc')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200/80 dark:border-emerald-800">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </Card>

          {/* Profit Margin % */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                  {t('reports.profitMargin')}
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight font-mono break-words">
                  %{formatNumber(reportMetrics.profitMargin.toFixed(1))}
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t('reports.profitMarginDesc')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 border border-blue-200/80 dark:border-blue-800">
                <Percent className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Secondary KPIs Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 sm:p-4 bg-neutral-50/50 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/60">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('reports.grossSales')}
            </p>
            <p className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white font-mono mt-1">
              {formatCurrency(reportMetrics.grossSales, activeOrganization?.currency, isPersian)}
            </p>
          </Card>

          <Card className="p-3 sm:p-4 bg-neutral-50/50 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/60">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('reports.discounts')}
            </p>
            <p className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">
              {formatCurrency(reportMetrics.totalDiscounts, activeOrganization?.currency, isPersian)}
            </p>
          </Card>

          <Card className="p-3 sm:p-4 bg-neutral-50/50 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/60">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('reports.totalOrdersCount')}
            </p>
            <p className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white font-mono mt-1">
              {formatNumber(reportMetrics.totalOrdersCount)}{' '}
              <span className="text-xs font-normal text-neutral-500">سفارش</span>
            </p>
          </Card>

          <Card className="p-3 sm:p-4 bg-neutral-50/50 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/60">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('reports.averageOrderValue')}
            </p>
            <p className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white font-mono mt-1">
              {formatCurrency(reportMetrics.aov, activeOrganization?.currency, isPersian)}
            </p>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: TIMELINE CHARTS (REVENUE vs COST vs PROFIT) */}
        {/* ========================================================================= */}
        <Card className="p-4 sm:p-6 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3">
            {/* Header Row: Title & Day/Month Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                  {t('reports.salesTrendsTitle')}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t('reports.salesTrendsSubtitle')}
                </p>
              </div>

              {/* Day / Month Toggle */}
              <div className="bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg flex items-center shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setChartGrouping('day')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                    chartGrouping === 'day'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-bold'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {t('reports.groupByDay')}
                </button>
                <button
                  type="button"
                  onClick={() => setChartGrouping('month')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                    chartGrouping === 'month'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs font-bold'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {t('reports.groupByMonth')}
                </button>
              </div>
            </div>

            {/* Legend Items: Clean single-line badge strip without awkward text wrapping */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs overflow-x-auto custom-scrollbar py-0.5">
              <div className="flex items-center gap-1.5 shrink-0 bg-neutral-100/80 dark:bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-200/70 dark:border-neutral-700/70">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 dark:bg-neutral-200 shrink-0" />
                <span className="text-neutral-700 dark:text-neutral-300 whitespace-nowrap text-xs font-medium">
                  {t('reports.chartRevenue')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 bg-neutral-100/80 dark:bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-200/70 dark:border-neutral-700/70">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 dark:bg-neutral-500 shrink-0" />
                <span className="text-neutral-700 dark:text-neutral-300 whitespace-nowrap text-xs font-medium">
                  {t('reports.chartCost')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/70 dark:border-emerald-800/70">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-emerald-800 dark:text-emerald-300 whitespace-nowrap text-xs font-medium">
                  {t('reports.chartProfit')}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline Bar Chart Visualizer */}
          {reportMetrics.timelineData.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              {t('reports.noOrdersInPeriod')}
            </div>
          ) : (
            <div className="pt-4 overflow-x-auto custom-scrollbar">
              <div className="min-w-[600px] h-60 flex items-end gap-2 sm:gap-3 px-2 pb-6 border-b border-neutral-200/80 dark:border-neutral-800">
                {reportMetrics.timelineData.map((d) => {
                  const revHeight = Math.max(8, (d.revenue / maxTimelineRevenue) * 180);
                  const costHeight = Math.max(4, (d.cogs / maxTimelineRevenue) * 180);
                  const profitHeight = Math.max(4, (Math.max(0, d.profit) / maxTimelineRevenue) * 180);

                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col gap-1 p-2.5 bg-neutral-900 text-white text-[10px] rounded-lg shadow-xl z-20 whitespace-nowrap pointer-events-none">
                        <span className="font-bold border-b border-neutral-700 pb-1">{d.date}</span>
                        <div className="flex justify-between gap-3">
                          <span className="text-neutral-400">{t('reports.chartRevenue')}:</span>
                          <span className="font-mono">{formatCurrency(d.revenue, activeOrganization?.currency, isPersian)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-neutral-400">{t('reports.chartCost')}:</span>
                          <span className="font-mono">{formatCurrency(d.cogs, activeOrganization?.currency, isPersian)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-emerald-400 font-bold">
                          <span>{t('reports.chartProfit')}:</span>
                          <span className="font-mono">{formatCurrency(d.profit, activeOrganization?.currency, isPersian)}</span>
                        </div>
                      </div>

                      {/* Bars Group */}
                      <div className="w-full flex items-end justify-center gap-1 h-48">
                        {/* Revenue Bar */}
                        <div
                          style={{ height: `${revHeight}px` }}
                          className="w-2 sm:w-3.5 bg-neutral-800 dark:bg-neutral-200 rounded-t-sm transition-all group-hover:opacity-90"
                        />
                        {/* Cost Bar */}
                        <div
                          style={{ height: `${costHeight}px` }}
                          className="w-2 sm:w-3.5 bg-neutral-400 dark:bg-neutral-600 rounded-t-sm transition-all group-hover:opacity-90"
                        />
                        {/* Profit Bar */}
                        <div
                          style={{ height: `${profitHeight}px` }}
                          className="w-2 sm:w-3.5 bg-emerald-500 rounded-t-sm transition-all group-hover:opacity-90"
                        />
                      </div>

                      {/* Date Label */}
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono truncate max-w-[50px]">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* ========================================================================= */}
        {/* SECTION 3: CATEGORIES & TOP PROFITABLE PRODUCTS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Profit Share */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
            <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                {t('reports.categoryProfitTitle')}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('reports.categoryProfitSubtitle')}
              </p>
            </div>

            {reportMetrics.sortedCategories.length === 0 ? (
              <p className="py-8 text-center text-xs text-neutral-500">
                {t('reports.noOrdersInPeriod')}
              </p>
            ) : (
              <div className="space-y-3.5">
                {reportMetrics.sortedCategories.map((cat) => {
                  const profitRatio = reportMetrics.grossProfit > 0 ? (cat.profit / reportMetrics.grossProfit) * 100 : 0;
                  const margin = cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(1) : '0';

                  return (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-900 dark:text-white">{cat.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-neutral-500 font-mono">
                            فروش: {formatCurrency(cat.revenue, activeOrganization?.currency, isPersian)}
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            سود: {formatCurrency(cat.profit, activeOrganization?.currency, isPersian)} ({margin}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, Math.max(4, profitRatio))}%` }}
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Top Profitable Products */}
          <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
            <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                {t('reports.topProfitableProductsTitle')}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('reports.topProfitableSubtitle')}
              </p>
            </div>

            {reportMetrics.sortedProducts.length === 0 ? (
              <p className="py-8 text-center text-xs text-neutral-500">
                {t('reports.noOrdersInPeriod')}
              </p>
            ) : (
              <div className="space-y-2.5">
                {reportMetrics.sortedProducts.slice(0, 5).map((p, idx) => {
                  const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : '0';

                  return (
                    <div
                      key={p.sku + idx}
                      className="p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                          {formatNumber(idx + 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                            {p.title}
                          </p>
                          <p className="text-[10px] text-neutral-500 font-mono">
                            {p.sku} • {p.categoryName}
                          </p>
                        </div>
                      </div>

                      <div className="text-end shrink-0">
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          +{formatCurrency(p.profit, activeOrganization?.currency, isPersian)}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono">
                          {formatNumber(p.qty)} عدد ({margin}%)
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 4: DETAILED ORDERS TABLE & RESPONSIVE MOBILE CARDS */}
        {/* ========================================================================= */}
        <Card className="p-4 sm:p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                {t('reports.detailedOrdersTitle')}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('reports.detailedOrdersSubtitle')}
              </p>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-64">
              <Input
                placeholder={t('reports.searchOrdersPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4 text-neutral-400" />}
              />
            </div>
          </div>

          {searchedOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              {t('reports.noOrdersInPeriod')}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                <table className="w-full text-xs text-start">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 border-b border-neutral-200/80 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-3 text-start">{t('reports.colOrderNumber')}</th>
                      <th className="py-3 px-3 text-start">{t('reports.colDate')}</th>
                      <th className="py-3 px-3 text-start">{t('reports.colCustomer')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colItems')}</th>
                      <th className="py-3 px-3 text-end">{t('reports.colNetSales')}</th>
                      <th className="py-3 px-3 text-end">{t('reports.colCogs')}</th>
                      <th className="py-3 px-3 text-end">{t('reports.colProfit')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colMargin')}</th>
                      <th className="py-3 px-3 text-center">{t('reports.colPaymentStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                    {searchedOrders.map((o) => {
                      const custId = typeof o.customer_id === 'object' ? (o.customer_id as any)?.id : o.customer_id;
                      const cust = custId ? customerMap.get(Number(custId)) : undefined;
                      const custName = cust?.name || o.customer_name || '---';

                      const items = orderItemsMap[o.id] || [];
                      let cogs = 0;
                      let units = 0;
                      items.forEach((item) => {
                        const qty = Number(item.quantity) || 1;
                        units += qty;
                        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
                        const v = vId ? variantMap.get(Number(vId)) : undefined;
                        const cost = item.unit_cost !== undefined ? Number(item.unit_cost) : (v?.cost || (Number(item.unit_price) * 0.6));
                        cogs += (qty * cost);
                      });

                      const net = Number(o.total) || 0;
                      const finalCogs = cogs > 0 ? cogs : net * 0.6;
                      const profit = net - finalCogs;
                      const margin = net > 0 ? ((profit / net) * 100).toFixed(1) : '0';

                      return (
                        <tr key={o.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                          <td className="py-3 px-3 font-bold font-mono text-neutral-900 dark:text-white">
                            {o.order_number || `#${o.id}`}
                          </td>
                          <td className="py-3 px-3 text-neutral-600 dark:text-neutral-400 font-mono">
                            {formatDate(o.order_date || o.date_created, isPersian)}
                          </td>
                          <td className="py-3 px-3 font-medium text-neutral-900 dark:text-neutral-100">
                            {custName}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-neutral-600 dark:text-neutral-400">
                            {formatNumber(units || 1)}
                          </td>
                          <td className="py-3 px-3 text-end font-bold font-mono text-neutral-900 dark:text-white">
                            {formatCurrency(net, activeOrganization?.currency, isPersian)}
                          </td>
                          <td className="py-3 px-3 text-end font-mono text-neutral-600 dark:text-neutral-400">
                            {formatCurrency(finalCogs, activeOrganization?.currency, isPersian)}
                          </td>
                          <td className="py-3 px-3 text-end font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(profit, activeOrganization?.currency, isPersian)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold ${
                              Number(margin) >= 30
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : Number(margin) >= 15
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            }`}>
                              %{formatNumber(margin)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Badge
                              variant={
                                o.payment_status === 'paid'
                                  ? 'success'
                                  : o.payment_status === 'partially_paid'
                                  ? 'warning'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {o.payment_status === 'paid'
                                ? 'تسویه'
                                : o.payment_status === 'partially_paid'
                                ? 'ناقص'
                                : 'پرداخت‌نشده'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden space-y-3">
                {searchedOrders.map((o) => {
                  const custId = typeof o.customer_id === 'object' ? (o.customer_id as any)?.id : o.customer_id;
                  const cust = custId ? customerMap.get(Number(custId)) : undefined;
                  const custName = cust?.name || o.customer_name || '---';

                  const items = orderItemsMap[o.id] || [];
                  let cogs = 0;
                  let units = 0;
                  items.forEach((item) => {
                    const qty = Number(item.quantity) || 1;
                    units += qty;
                    const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
                    const v = vId ? variantMap.get(Number(vId)) : undefined;
                    const cost = item.unit_cost !== undefined ? Number(item.unit_cost) : (v?.cost || (Number(item.unit_price) * 0.6));
                    cogs += (qty * cost);
                  });

                  const net = Number(o.total) || 0;
                  const finalCogs = cogs > 0 ? cogs : net * 0.6;
                  const profit = net - finalCogs;
                  const margin = net > 0 ? ((profit / net) * 100).toFixed(1) : '0';

                  return (
                    <div
                      key={o.id}
                      className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold font-mono text-xs text-neutral-900 dark:text-white">
                          {o.order_number || `#${o.id}`}
                        </span>
                        <Badge
                          variant={
                            o.payment_status === 'paid'
                              ? 'success'
                              : o.payment_status === 'partially_paid'
                              ? 'warning'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {o.payment_status === 'paid'
                            ? 'تسویه'
                            : o.payment_status === 'partially_paid'
                            ? 'ناقص'
                            : 'پرداخت‌نشده'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-600 dark:text-neutral-300 font-medium">
                          {custName}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {formatDate(o.order_date || o.date_created, isPersian)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <p className="text-[10px] text-neutral-400">فروش</p>
                          <p className="font-bold font-mono text-neutral-900 dark:text-white mt-0.5">
                            {formatCurrency(net, activeOrganization?.currency, isPersian)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-400">بهای خرید</p>
                          <p className="font-mono text-neutral-500 mt-0.5">
                            {formatCurrency(finalCogs, activeOrganization?.currency, isPersian)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">سود خالص</p>
                          <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {formatCurrency(profit, activeOrganization?.currency, isPersian)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
