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
  PurchaseOrder,
  Category,
} from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import {
  BarChart3,
  TrendingUp,
  PackageX,
  PieChart,
  DollarSign,
  Shirt,
  Palette,
  Tag,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface OperationalExpense {
  id: string;
  title: string;
  amount: number;
  category: 'rent' | 'salary' | 'utilities' | 'packaging' | 'marketing' | 'other';
  date: string;
}

export const ReportsView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState<'best_sellers' | 'dead_stock' | 'pnl'>('best_sellers');
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, OrderItem[]>>({});
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filter states
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [deadStockDaysThreshold, setDeadStockDaysThreshold] = useState<number>(30);

  // P&L Custom Expenses state
  const [expenses, setExpenses] = useState<OperationalExpense[]>([
    { id: '1', title: 'اجاره مغازه / انبار', amount: 15000000, category: 'rent', date: '1403/06/01' },
    { id: '2', title: 'حقوق پرسنل و بسته‌بندی', amount: 12000000, category: 'salary', date: '1403/06/01' },
    { id: '3', title: 'هزینه ارسال و پستی', amount: 3500000, category: 'packaging', date: '1403/06/01' },
  ]);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<OperationalExpense['category']>('other');

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
        poRes,
        catsRes,
      ] = await Promise.all([
        adapter.getProducts(orgParams),
        adapter.getVariants(orgParams),
        adapter.getColors(orgParams),
        adapter.getSizes(orgParams),
        adapter.getInventoryItems(orgParams),
        adapter.getOrders(orgParams),
        adapter.getPurchaseOrders(orgParams),
        adapter.getCategories(orgParams),
      ]);

      setProducts(prodsRes || []);
      setVariants(varsRes || []);
      setColors(colsRes || []);
      setSizes(szsRes || []);
      setInventoryItems(invRes || []);
      setOrders(ordersRes || []);
      setPurchaseOrders(poRes || []);
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
        
        // Calculate days since last sale or creation
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
            productTitle: prod?.title || v.product_title || 'کالای تن‌خور',
            colorName: clr?.name || v.color_name || 'نامشخص',
            sizeName: sz?.name || v.size_name || 'نامشخص',
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
  }, [variants, inventoryItems, orders, orderItemsMap, deadStockDaysThreshold, productMap, colorMap, sizeMap]);

  // -------------------------------------------------------------
  // 3. PROFIT & LOSS (P&L) STATEMENT COMPUTATION
  // -------------------------------------------------------------
  const pnlData = useMemo(() => {
    // 1. Gross Revenue from Orders
    const grossRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    // 2. Cost of Goods Sold (COGS)
    let cogs = 0;
    allOrderItems.forEach((item) => {
      const variant = variantMap.get(typeof item.variant_id === 'object' ? (item.variant_id as any).id : item.variant_id);
      const qty = item.quantity || 1;
      const unitCost = variant?.cost || (item.unit_price * 0.55);
      cogs += unitCost * qty;
    });

    // 3. Purchase orders cost (procurement)
    const supplierPurchasesTotal = purchaseOrders.reduce((sum, po) => sum + (po.total || 0), 0);

    // 4. Operational Expenses
    const operationalExpensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

    // 5. Profit calculations
    const grossProfit = grossRevenue - cogs;
    const netProfit = grossProfit - operationalExpensesTotal;
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    return {
      grossRevenue,
      cogs,
      supplierPurchasesTotal,
      operationalExpensesTotal,
      grossProfit,
      netProfit,
      profitMargin,
    };
  }, [orders, allOrderItems, variantMap, purchaseOrders, expenses]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseTitle || !newExpenseAmount) return;
    const val = parseFloat(newExpenseAmount.replace(/,/g, ''));
    if (isNaN(val) || val <= 0) return;

    const newExp: OperationalExpense = {
      id: Date.now().toString(),
      title: newExpenseTitle,
      amount: val,
      category: newExpenseCategory,
      date: new Date().toLocaleDateString('fa-IR'),
    };
    setExpenses([...expenses, newExp]);
    setNewExpenseTitle('');
    setNewExpenseAmount('');
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const handlePrintReport = () => {
    printElement('tankhor-report-container', { title: `گزارش_تخصصی_${activeTab}` });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white p-6 rounded-2xl shadow-md border border-neutral-700">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <BarChart3 className="w-6 h-6" />
            </span>
            <h1 className="text-xl font-bold tracking-tight">گزارش‌ها و تحلیل‌های تخصصی پوشاک</h1>
          </div>
          <p className="text-xs text-neutral-300">
            تحلیل جامع پرفروش‌ترین سایزها و رنگ‌ها، آنالیز سرمایه‌های راکد (Dead Stock) و محاسبه دقیق سود و زیان
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handlePrintReport} icon={<Printer className="w-4 h-4" />}>
            چاپ و خروجی گزارش
          </Button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <button
          onClick={() => setActiveTab('best_sellers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'best_sellers'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Shirt className="w-4 h-4" />
          <span>پرفروش‌ترین سایزها و رنگ‌ها</span>
        </button>

        <button
          onClick={() => setActiveTab('dead_stock')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dead_stock'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <PackageX className="w-4 h-4" />
          <span>تحلیل مانده موجودی (Dead Stock)</span>
          {deadStockData.deadStockItems.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-mono">
              {toPersianDigits(deadStockData.deadStockItems.length)}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pnl')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pnl'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>محاسبه دقیق سود و زیان (P&L)</span>
        </button>
      </div>

      {/* Main Print Container */}
      <div id="tankhor-report-container" className="space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: BEST SELLING SIZES & COLORS */}
        {/* ========================================================================= */}
        {activeTab === 'best_sellers' && (
          <div className="space-y-6">
            {/* Overview Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">کل قطعات فروخته‌شده</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Shirt className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xl font-bold text-neutral-900 dark:text-white mt-2 font-mono">
                  {toPersianDigits(bestSellersData.totalSoldQty)} <span className="text-xs font-normal text-neutral-500">عدد</span>
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">تعداد کل پوشاک خارج‌شده از انبار</p>
              </Card>

              <Card className="p-4 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">پرفروش‌ترین سایز</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Tag className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xl font-bold text-neutral-900 dark:text-white mt-2">
                  {bestSellersData.sortedSizes[0]?.name || '---'}
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  {bestSellersData.sortedSizes[0] ? `${toPersianDigits(bestSellersData.sortedSizes[0].qty)} عدد فروش` : 'بدون سابقه فروش'}
                </p>
              </Card>

              <Card className="p-4 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">محبوب‌ترین رنگ</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Palette className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {bestSellersData.sortedColors[0]?.hex && (
                    <span
                      className="w-4 h-4 rounded-full border border-neutral-300 shrink-0"
                      style={{ backgroundColor: bestSellersData.sortedColors[0].hex }}
                    />
                  )}
                  <p className="text-xl font-bold text-neutral-900 dark:text-white">
                    {bestSellersData.sortedColors[0]?.name || '---'}
                  </p>
                </div>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-mono">
                  {bestSellersData.sortedColors[0] ? `${toPersianDigits(bestSellersData.sortedColors[0].qty)} عدد فروش` : 'بدون سابقه فروش'}
                </p>
              </Card>

              <Card className="p-4 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">درآمد کل حاصل از کاتالوگ</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
                  {formatCurrency(bestSellersData.totalSalesRev, activeOrganization?.currency)}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">بر اساس سفارشات ثبت‌شده</p>
              </Card>
            </div>

            {/* Split Grid: Size Breakdown & Color Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sizes Breakdown */}
              <Card className="p-5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">تفکیک فروش بر اساس سایزها</h3>
                  </div>
                  <Badge variant="neutral">رتبه‌بندی تقاضا</Badge>
                </div>

                {bestSellersData.sortedSizes.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-8">هنوز سفارشی با مشخصات سایز ثبت نشده است.</p>
                ) : (
                  <div className="space-y-3">
                    {bestSellersData.sortedSizes.map((sz, idx) => {
                      const sharePercent = bestSellersData.totalSoldQty > 0 ? Math.round((sz.qty / bestSellersData.totalSoldQty) * 100) : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">{sz.name}</span>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-neutral-500">{toPersianDigits(sz.qty)} عدد</span>
                              <span className="font-bold text-neutral-900 dark:text-white">٪{toPersianDigits(sharePercent)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
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
              <Card className="p-5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-purple-500" />
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">تفکیک فروش بر اساس رنگ‌ها</h3>
                  </div>
                  <Badge variant="neutral">رتبه‌بندی محبوبیت</Badge>
                </div>

                {bestSellersData.sortedColors.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-8">هنوز سفارشی با مشخصات رنگ ثبت نشده است.</p>
                ) : (
                  <div className="space-y-3">
                    {bestSellersData.sortedColors.map((clr, idx) => {
                      const sharePercent = bestSellersData.totalSoldQty > 0 ? Math.round((clr.qty / bestSellersData.totalSoldQty) * 100) : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              {clr.hex && (
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-neutral-300"
                                  style={{ backgroundColor: clr.hex }}
                                />
                              )}
                              <span className="font-bold text-neutral-800 dark:text-neutral-200">{clr.name}</span>
                            </div>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-neutral-500">{toPersianDigits(clr.qty)} عدد</span>
                              <span className="font-bold text-neutral-900 dark:text-white">٪{toPersianDigits(sharePercent)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
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
            <Card className="p-5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 space-y-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">جدول پرفروش‌ترین تنوع‌های محصولی (SKU Best Sellers)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 font-medium">
                    <tr>
                      <th className="p-3">کد کالا (SKU)</th>
                      <th className="p-3">نام محصول</th>
                      <th className="p-3">رنگ</th>
                      <th className="p-3">سایز</th>
                      <th className="p-3">تعداد فروخته‌شده</th>
                      <th className="p-3">مبلغ کل درآمد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {bestSellersData.sortedVariants.slice(0, 10).map((varStat, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                        <td className="p-3 font-mono font-bold text-neutral-900 dark:text-white">{varStat.sku}</td>
                        <td className="p-3 font-medium">{varStat.title}</td>
                        <td className="p-3">{varStat.color}</td>
                        <td className="p-3">{varStat.size}</td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{toPersianDigits(varStat.qty)}</td>
                        <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(varStat.revenue, activeOrganization?.currency)}
                        </td>
                      </tr>
                    ))}
                    {bestSellersData.sortedVariants.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-neutral-400">اطلاعاتی یافت نشد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DEAD STOCK ANALYSIS */}
        {/* ========================================================================= */}
        {activeTab === 'dead_stock' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <Card className="p-4 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">تحلیل کالاهای راکد و کم‌گردش</h3>
                  <p className="text-xs text-neutral-500">شناسایی سرمایه‌های بلوکه‌شده در انبار به منظور حراج و نقدسازی</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">آستانه عدم فروش:</span>
                <select
                  value={deadStockDaysThreshold}
                  onChange={(e) => setDeadStockDaysThreshold(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold"
                >
                  <option value={15}>بیش از ۱۵ روز راکد</option>
                  <option value={30}>بیش از ۳۰ روز راکد</option>
                  <option value={60}>بیش از ۶۰ روز راکد</option>
                  <option value={90}>بیش از ۹۰ روز راکد (بحرانی)</option>
                </select>
              </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                <span className="text-xs font-medium text-red-700 dark:text-red-400">سرمایه راکد کل در انبار</span>
                <p className="text-xl font-bold text-red-700 dark:text-red-400 mt-2 font-mono">
                  {formatCurrency(deadStockData.totalTiedCapital, activeOrganization?.currency)}
                </p>
                <p className="text-[11px] text-red-600/80 mt-1">محاسبه بر اساس قیمت خرید/خواب سرمایه</p>
              </Card>

              <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">تعداد کل قطعات راکد</span>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-2 font-mono">
                  {toPersianDigits(deadStockData.totalDeadUnits)} <span className="text-xs font-normal">عدد کالا</span>
                </p>
                <p className="text-[11px] text-amber-600/80 mt-1">اشغال‌کننده فضای قفسه‌ها</p>
              </Card>

              <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">تنوع‌های کالا بدون گردش</span>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-2 font-mono">
                  {toPersianDigits(deadStockData.deadStockItems.length)} <span className="text-xs font-normal">تنوع (SKU)</span>
                </p>
                <p className="text-[11px] text-blue-600/80 mt-1">نیازمند حراج یا تخفیف ویژه</p>
              </Card>
            </div>

            {/* Dead Stock Table */}
            <Card className="p-5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 space-y-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">فهرست کالاهای کم‌گردش (Dead Stock Items)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 font-medium">
                    <tr>
                      <th className="p-3">کد کالا (SKU)</th>
                      <th className="p-3">نام محصول</th>
                      <th className="p-3">رنگ / سایز</th>
                      <th className="p-3">موجودی راکد</th>
                      <th className="p-3">قیمت خرید (تامین)</th>
                      <th className="p-3">سرمایه بلوکه‌شده</th>
                      <th className="p-3">مدت راکد بودن</th>
                      <th className="p-3">وضعیت هشدار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {deadStockData.deadStockItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                        <td className="p-3 font-mono font-bold text-neutral-900 dark:text-white">{item.variant.sku}</td>
                        <td className="p-3 font-medium">{item.productTitle}</td>
                        <td className="p-3">{item.colorName} / {item.sizeName}</td>
                        <td className="p-3 font-mono font-bold text-amber-600">{toPersianDigits(item.stockQty)} عدد</td>
                        <td className="p-3 font-mono">{formatCurrency(item.unitCost, activeOrganization?.currency)}</td>
                        <td className="p-3 font-mono font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(item.totalTiedCapital, activeOrganization?.currency)}
                        </td>
                        <td className="p-3 font-mono">{toPersianDigits(item.daysInactive)} روز</td>
                        <td className="p-3">
                          {item.daysInactive >= 90 ? (
                            <Badge variant="danger">بحرانی (&gt;۹۰ روز)</Badge>
                          ) : item.daysInactive >= 60 ? (
                            <Badge variant="warning">متوسط (۶۰-۹۰ روز)</Badge>
                          ) : (
                            <Badge variant="info">نیازمند توجه</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                    {deadStockData.deadStockItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-neutral-400">کالای راکد با آستانه زمانی انتخاب شده یافت نشد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PROFIT & LOSS (P&L) */}
        {/* ========================================================================= */}
        {activeTab === 'pnl' && (
          <div className="space-y-6">
            {/* P&L Financial Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <span className="text-xs font-medium text-neutral-500">درآمد کل حاصل از فروش</span>
                <p className="text-xl font-bold text-neutral-900 dark:text-white mt-2 font-mono">
                  {formatCurrency(pnlData.grossRevenue, activeOrganization?.currency)}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">جمع فاکتورهای فروش</p>
              </Card>

              <Card className="p-4 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <span className="text-xs font-medium text-neutral-500">بهای تمام‌شده کالا (COGS)</span>
                <p className="text-xl font-bold text-neutral-900 dark:text-white mt-2 font-mono">
                  {formatCurrency(pnlData.cogs, activeOrganization?.currency)}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">قیمت خرید کالاها از تامین‌کننده</p>
              </Card>

              <Card className="p-4 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <span className="text-xs font-medium text-neutral-500">سود ناخالص (Gross Profit)</span>
                <p className={`text-xl font-bold mt-2 font-mono ${pnlData.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(pnlData.grossProfit, activeOrganization?.currency)}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">درآمد کسر شده از COGS</p>
              </Card>

              <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">سود خالص (Net Profit)</span>
                <p className={`text-2xl font-bold mt-2 font-mono ${pnlData.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
                  {formatCurrency(pnlData.netProfit, activeOrganization?.currency)}
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold mt-1 text-emerald-600">
                  <span>هامش سود خالص:</span>
                  <span className="font-mono">٪{toPersianDigits(Math.round(pnlData.profitMargin))}</span>
                </div>
              </Card>
            </div>

            {/* Operational Expenses Manager */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form to add Expense */}
              <Card className="p-5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 space-y-4">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">افزودن هزینه جاری جدید</h3>
                <form onSubmit={handleAddExpense} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">عنوان هزینه</label>
                    <Input
                      placeholder="مثلاً اجاره انبار، قبوض، بسته بندی..."
                      value={newExpenseTitle}
                      onChange={(e) => setNewExpenseTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">مبلغ (تومان)</label>
                    <Input
                      type="number"
                      placeholder="مبلغ به تومان..."
                      value={newExpenseAmount}
                      onChange={(e) => setNewExpenseAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">دسته‌بندی</label>
                    <select
                      value={newExpenseCategory}
                      onChange={(e) => setNewExpenseCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-medium"
                    >
                      <option value="rent">اجاره و رهن</option>
                      <option value="salary">حقوق و دستمزد</option>
                      <option value="utilities">قبوض و آب و برق</option>
                      <option value="packaging">بسته‌بندی و ارسال</option>
                      <option value="marketing">تبلیغات و بازاریابی</option>
                      <option value="other">سایر هزینه‌ها</option>
                    </select>
                  </div>

                  <Button type="submit" variant="primary" className="w-full" icon={<Plus className="w-4 h-4" />}>
                    ثبت هزینه در صورت سود و زیان
                  </Button>
                </form>
              </Card>

              {/* List of Custom Expenses */}
              <Card className="lg:col-span-2 p-5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">فهرست هزینه‌های جاری عملیاتی (Operational Expenses)</h3>
                  <span className="text-xs font-mono font-bold text-red-600">
                    جمع کل: {formatCurrency(pnlData.operationalExpensesTotal, activeOrganization?.currency)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 font-medium">
                      <tr>
                        <th className="p-3">عنوان هزینه</th>
                        <th className="p-3">دسته‌بندی</th>
                        <th className="p-3">تاریخ</th>
                        <th className="p-3">مبلغ</th>
                        <th className="p-3">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                          <td className="p-3 font-medium">{exp.title}</td>
                          <td className="p-3">
                            <Badge variant="neutral">{exp.category}</Badge>
                          </td>
                          <td className="p-3 font-mono">{toPersianDigits(exp.date)}</td>
                          <td className="p-3 font-mono font-bold text-red-600">
                            {formatCurrency(exp.amount, activeOrganization?.currency)}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {expenses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-neutral-400">هزینه‌ای ثبت نشده است.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
