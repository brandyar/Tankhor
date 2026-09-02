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
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import {
  BarChart3,
  TrendingUp,
  PackageX,
  DollarSign,
  Shirt,
  Palette,
  Tag,
  Printer,
  Plus,
  Trash2,
  AlertTriangle,
  PackageCheck,
  TrendingDown,
  Layers,
  Sparkles,
} from 'lucide-react';

interface OperationalExpense {
  id: string;
  title: string;
  amount: number;
  category: 'rent' | 'salary' | 'utilities' | 'packaging' | 'marketing' | 'other';
  date: string;
}

export const ReportsView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';

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
  const [deadStockDaysThreshold, setDeadStockDaysThreshold] = useState<number>(30);

  // P&L Custom Expenses state
  const [expenses, setExpenses] = useState<OperationalExpense[]>([
    { id: '1', title: 'اجاره فروشگاه و انبار مرکزی', amount: 15000000, category: 'rent', date: '1403/06/01' },
    { id: '2', title: 'حقوق پرسنل، خیاطی و بسته‌بندی', amount: 12000000, category: 'salary', date: '1403/06/01' },
    { id: '3', title: 'هزینه بسته‌بندی، کارتن و ارسال پستی', amount: 3500000, category: 'packaging', date: '1403/06/01' },
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

    // 3. Purchase orders cost
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
    <div className="space-y-6 pb-12 font-sans">
      {/* Page Header */}
      <div className="no-print">
        <PageHeader
          title="گزارش‌ها و تحلیل‌های تخصصی پوشاک"
          subtitle="تحلیل جامع پرفروش‌ترین سایزها و رنگ‌ها، آنالیز سرمایه‌های راکد (Dead Stock) و محاسبه دقیق سود و زیان"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintReport}
                icon={<Printer className="w-4 h-4 text-neutral-600" />}
              >
                چاپ و خروجی گزارش
              </Button>
            </div>
          }
        />
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200/80 pb-3 no-print">
        <button
          type="button"
          onClick={() => setActiveTab('best_sellers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'best_sellers'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <Shirt className="w-4 h-4" />
          <span>پرفروش‌ترین سایزها و رنگ‌ها</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dead_stock')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dead_stock'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <PackageX className="w-4 h-4" />
          <span>تحلیل مانده موجودی (Dead Stock)</span>
          {deadStockData.deadStockItems.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-600 text-white font-mono font-bold">
              {toPersianDigits(deadStockData.deadStockItems.length)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pnl')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pnl'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>محاسبه دقیق سود و زیان (P&L)</span>
        </button>
      </div>

      {/* Main Report Content Container */}
      <div id="tankhor-report-container" className="space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: BEST SELLING SIZES & COLORS */}
        {/* ========================================================================= */}
        {activeTab === 'best_sellers' && (
          <div className="space-y-6">
            {/* Overview Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <Card className="hover:border-neutral-300 transition-all shadow-xs group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-neutral-500">کل قطعات فروخته‌شده</p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                      {toPersianDigits(bestSellersData.totalSoldQty)}
                      <span className="text-xs font-normal text-neutral-400 font-sans ms-1.5">عدد</span>
                    </h3>
                    <div className="mt-2.5 flex items-center gap-1 text-xs text-neutral-600">
                      <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>کل پوشاک خارج‌شده از انبار</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center border border-neutral-200/80 group-hover:scale-105 transition-transform">
                    <Shirt className="w-5 h-5" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-neutral-300 transition-all shadow-xs group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-neutral-500">پرفروش‌ترین سایز</p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                      {bestSellersData.sortedSizes[0]?.name || '---'}
                    </h3>
                    <div className="mt-2.5 flex items-center gap-1 text-xs text-amber-700 font-mono font-medium">
                      <Tag className="w-3.5 h-3.5" />
                      <span>{bestSellersData.sortedSizes[0] ? `${toPersianDigits(bestSellersData.sortedSizes[0].qty)} عدد فروش` : 'بدون سابقه فروش'}</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 bg-amber-50 text-amber-900 rounded-xl flex items-center justify-center border border-amber-200/80 group-hover:scale-105 transition-transform">
                    <Tag className="w-5 h-5" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-neutral-300 transition-all shadow-xs group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-neutral-500">محبوب‌ترین رنگ</p>
                    <div className="flex items-center gap-2 mt-2">
                      {bestSellersData.sortedColors[0]?.hex && (
                        <span
                          className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: bestSellersData.sortedColors[0].hex }}
                        />
                      )}
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                        {bestSellersData.sortedColors[0]?.name || '---'}
                      </h3>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1 text-xs text-purple-700 font-mono font-medium">
                      <Palette className="w-3.5 h-3.5" />
                      <span>{bestSellersData.sortedColors[0] ? `${toPersianDigits(bestSellersData.sortedColors[0].qty)} عدد فروش` : 'بدون سابقه فروش'}</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 bg-purple-50 text-purple-900 rounded-xl flex items-center justify-center border border-purple-200/80 group-hover:scale-105 transition-transform">
                    <Palette className="w-5 h-5" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-neutral-300 transition-all shadow-xs group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-neutral-500">گردش درآمد کاتالوگ</p>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono truncate max-w-[200px]" title={formatCurrency(bestSellersData.totalSalesRev, activeOrganization?.currency, isPersian)}>
                      {formatCurrency(bestSellersData.totalSalesRev, activeOrganization?.currency, isPersian)}
                    </h3>
                    <div className="mt-2.5 flex items-center gap-1 text-xs text-emerald-700 font-medium">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>بر اساس سفارشات تحویل‌شده</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 bg-emerald-50 text-emerald-900 rounded-xl flex items-center justify-center border border-emerald-200/80 group-hover:scale-105 transition-transform">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Split Grid: Size Breakdown & Color Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sizes Breakdown */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-neutral-900">تفکیک تقاضا بر اساس سایزها</h3>
                  </div>
                  <Badge variant="neutral">رتبه‌بندی سایز</Badge>
                </div>

                {bestSellersData.sortedSizes.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-8">هنوز سفارشی با مشخصات سایز ثبت نشده است.</p>
                ) : (
                  <div className="space-y-3.5">
                    {bestSellersData.sortedSizes.map((sz, idx) => {
                      const sharePercent = bestSellersData.totalSoldQty > 0 ? Math.round((sz.qty / bestSellersData.totalSoldQty) * 100) : 0;
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-neutral-900">{sz.name}</span>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-neutral-500">{toPersianDigits(sz.qty)} عدد</span>
                              <span className="font-bold text-neutral-900">٪{toPersianDigits(sharePercent)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
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
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-bold text-neutral-900">تفکیک فروش بر اساس رنگ‌ها</h3>
                  </div>
                  <Badge variant="neutral">محبوبیت رنگ</Badge>
                </div>

                {bestSellersData.sortedColors.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-8">هنوز سفارشی با مشخصات رنگ ثبت نشده است.</p>
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
                              <span className="font-bold text-neutral-900">{clr.name}</span>
                            </div>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-neutral-500">{toPersianDigits(clr.qty)} عدد</span>
                              <span className="font-bold text-neutral-900">٪{toPersianDigits(sharePercent)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
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
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">جدول پرفروش‌ترین تنوع‌های محصولی (SKU Best Sellers)</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">رتبه‌بندی بیشترین فروش عددی و ریالی در تنوع‌های پوشاک</p>
                </div>
                <Badge variant="neutral">Top 10 SKUs</Badge>
              </div>

              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                    <tr>
                      <th className="p-3">کد کالا (SKU)</th>
                      <th className="p-3">نام محصول</th>
                      <th className="p-3">رنگ</th>
                      <th className="p-3">سایز</th>
                      <th className="p-3 text-center">تعداد فروخته‌شده</th>
                      <th className="p-3 text-left">مبلغ کل درآمد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {bestSellersData.sortedVariants.slice(0, 10).map((varStat, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="p-3 font-mono font-bold text-neutral-900">{varStat.sku}</td>
                        <td className="p-3 font-medium text-neutral-800">{varStat.title}</td>
                        <td className="p-3 text-neutral-600">{varStat.color}</td>
                        <td className="p-3 font-bold text-neutral-800">{varStat.size}</td>
                        <td className="p-3 text-center font-mono font-bold text-neutral-900">{toPersianDigits(varStat.qty)}</td>
                        <td className="p-3 text-left font-mono font-bold text-emerald-700">
                          {formatCurrency(varStat.revenue, activeOrganization?.currency, isPersian)}
                        </td>
                      </tr>
                    ))}
                    {bestSellersData.sortedVariants.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-neutral-400">سابقه‌ای ثبت نشده است.</td>
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
            <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200/70 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">تحلیل کالاهای راکد و کم‌گردش</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">شناسایی سرمایه‌های بلوکه‌شده در انبار به منظور حراج و نقدسازی</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-medium text-neutral-600 shrink-0">آستانه عدم گردش:</span>
                <select
                  value={deadStockDaysThreshold}
                  onChange={(e) => setDeadStockDaysThreshold(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-bold text-neutral-900 focus:ring-1 focus:ring-neutral-900"
                >
                  <option value={15}>بیش از ۱۵ روز بدون فروش</option>
                  <option value={30}>بیش از ۳۰ روز بدون فروش</option>
                  <option value={60}>بیش از ۶۰ روز بدون فروش</option>
                  <option value={90}>بیش از ۹۰ روز (خواب سرمایه بحرانی)</option>
                </select>
              </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
              <Card className="hover:border-rose-300 transition-all shadow-xs bg-gradient-to-br from-white to-rose-50/20">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-rose-900">سرمایه راکد بلوکه‌شده</p>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-rose-950 tracking-tight mt-2 font-mono">
                      {formatCurrency(deadStockData.totalTiedCapital, activeOrganization?.currency, isPersian)}
                    </h3>
                    <p className="text-[11px] text-rose-700/80 mt-1">محاسبه بر اساس بهای تمام‌شده خرید کالا</p>
                  </div>
                  <div className="w-11 h-11 bg-rose-50 text-rose-800 rounded-xl flex items-center justify-center border border-rose-200/80">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-amber-300 transition-all shadow-xs bg-gradient-to-br from-white to-amber-50/20">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-amber-900">تعداد کل قطعات راکد</p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-950 tracking-tight mt-2 font-mono">
                      {toPersianDigits(deadStockData.totalDeadUnits)}
                      <span className="text-xs font-normal text-amber-800/80 font-sans ms-1.5">عدد</span>
                    </h3>
                    <p className="text-[11px] text-amber-700/80 mt-1">اشغال‌کننده فضای قفسه‌ها و انبار</p>
                  </div>
                  <div className="w-11 h-11 bg-amber-50 text-amber-800 rounded-xl flex items-center justify-center border border-amber-200/80">
                    <PackageX className="w-5 h-5" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-neutral-300 transition-all shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-neutral-500">تنوع‌های کالا بدون گردش</p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                      {toPersianDigits(deadStockData.deadStockItems.length)}
                      <span className="text-xs font-normal text-neutral-400 font-sans ms-1.5">تنوع (SKU)</span>
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-1">پیشنهاد تخفیف ویژه یا بسته‌های پیشنهادی</p>
                  </div>
                  <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center border border-neutral-200/80">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Dead Stock Table */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">فهرست کالاهای کم‌گردش و راکد (Dead Stock Items)</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">اقلام بدون فروش بر اساس فیلتر زمانی انتخابی</p>
                </div>
                <Badge variant="neutral">{toPersianDigits(deadStockData.deadStockItems.length)} کالا</Badge>
              </div>

              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                    <tr>
                      <th className="p-3">کد کالا (SKU)</th>
                      <th className="p-3">نام محصول</th>
                      <th className="p-3">رنگ / سایز</th>
                      <th className="p-3 text-center">موجودی راکد</th>
                      <th className="p-3 text-left">قیمت تامین</th>
                      <th className="p-3 text-left">سرمایه بلوکه‌شده</th>
                      <th className="p-3 text-center">مدت راکد</th>
                      <th className="p-3 text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {deadStockData.deadStockItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="p-3 font-mono font-bold text-neutral-900">{item.variant.sku}</td>
                        <td className="p-3 font-medium text-neutral-800">{item.productTitle}</td>
                        <td className="p-3 text-neutral-600">{item.colorName} / {item.sizeName}</td>
                        <td className="p-3 text-center font-mono font-bold text-amber-700">{toPersianDigits(item.stockQty)} عدد</td>
                        <td className="p-3 text-left font-mono text-neutral-700">{formatCurrency(item.unitCost, activeOrganization?.currency, isPersian)}</td>
                        <td className="p-3 text-left font-mono font-bold text-rose-700">
                          {formatCurrency(item.totalTiedCapital, activeOrganization?.currency, isPersian)}
                        </td>
                        <td className="p-3 text-center font-mono text-neutral-800">{toPersianDigits(item.daysInactive)} روز</td>
                        <td className="p-3 text-center">
                          {item.daysInactive >= 90 ? (
                            <Badge variant="error">بحرانی (&gt;۹۰ روز)</Badge>
                          ) : item.daysInactive >= 60 ? (
                            <Badge variant="warning">هشدار (۶۰-۹۰ روز)</Badge>
                          ) : (
                            <Badge variant="neutral">نیازمند توجه</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                    {deadStockData.deadStockItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-neutral-400">کالای راکد با آستانه زمانی انتخاب شده یافت نشد.</td>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <Card className="hover:border-neutral-300 transition-all shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-neutral-500">درآمد کل فروش (Revenue)</p>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                      {formatCurrency(pnlData.grossRevenue, activeOrganization?.currency, isPersian)}
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-1">جمع کل فاکتورهای فروش</p>
                  </div>
                  <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center border border-neutral-200/80">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-neutral-300 transition-all shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-neutral-500">بهای تمام‌شده (COGS)</p>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                      {formatCurrency(pnlData.cogs, activeOrganization?.currency, isPersian)}
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-1">هزینه خرید کالا از تامین‌کننده</p>
                  </div>
                  <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center border border-neutral-200/80">
                    <Shirt className="w-5 h-5" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-neutral-300 transition-all shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-neutral-500">سود ناخالص (Gross Profit)</p>
                    <h3 className={`text-xl sm:text-2xl font-extrabold tracking-tight mt-2 font-mono ${pnlData.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(pnlData.grossProfit, activeOrganization?.currency, isPersian)}
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-1">درآمد کسر شده از بهای تمام‌شده</p>
                  </div>
                  <div className="w-11 h-11 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center border border-emerald-200/80">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </Card>

              <Card className="hover:border-emerald-300 transition-all shadow-xs bg-gradient-to-br from-white to-emerald-50/30 border-emerald-200/80">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="caption-mono text-emerald-900">سود خالص نهایی (Net Profit)</p>
                    <h3 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 font-mono ${pnlData.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                      {formatCurrency(pnlData.netProfit, activeOrganization?.currency, isPersian)}
                    </h3>
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-800 font-bold">
                      <span>حاشیه سود خالص:</span>
                      <span className="font-mono">٪{toPersianDigits(Math.round(pnlData.profitMargin))}</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 bg-emerald-100 text-emerald-900 rounded-xl flex items-center justify-center border border-emerald-300/80">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Operational Expenses Manager */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form to add Expense */}
              <Card className="p-5 space-y-4">
                <div className="border-b border-neutral-100 pb-3">
                  <h3 className="text-sm font-bold text-neutral-900">افزودن هزینه جاری جدید</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">ثبت مخارج عملیاتی جهت کسر از سود ناخالص</p>
                </div>

                <form onSubmit={handleAddExpense} className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-neutral-700 mb-1 block">عنوان هزینه</label>
                    <Input
                      placeholder="مثلاً اجاره انبار، قبوض، بسته بندی..."
                      value={newExpenseTitle}
                      onChange={(e) => setNewExpenseTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-700 mb-1 block">مبلغ (تومان)</label>
                    <Input
                      type="number"
                      placeholder="مبلغ به تومان..."
                      value={newExpenseAmount}
                      onChange={(e) => setNewExpenseAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-700 mb-1 block">دسته‌بندی هزینه</label>
                    <select
                      value={newExpenseCategory}
                      onChange={(e) => setNewExpenseCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-900 focus:ring-1 focus:ring-neutral-900"
                    >
                      <option value="rent">اجاره و رهن</option>
                      <option value="salary">حقوق و دستمزد</option>
                      <option value="utilities">قبوض و انشعابات</option>
                      <option value="packaging">بسته‌بندی و ارسال</option>
                      <option value="marketing">تبلیغات و بازاریابی</option>
                      <option value="other">سایر هزینه‌های متفرقه</option>
                    </select>
                  </div>

                  <Button type="submit" variant="primary" className="w-full mt-2" icon={<Plus className="w-4 h-4" />}>
                    ثبت هزینه در صورت سود و زیان
                  </Button>
                </form>
              </Card>

              {/* List of Custom Expenses */}
              <Card className="lg:col-span-2 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">فهرست هزینه‌های جاری عملیاتی (Operational Expenses)</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">مخارج ثبت‌شده ماه جاری</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-700">
                    مجموع هزینه‌ها: {formatCurrency(pnlData.operationalExpensesTotal, activeOrganization?.currency, isPersian)}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                      <tr>
                        <th className="p-3">عنوان هزینه</th>
                        <th className="p-3">دسته‌بندی</th>
                        <th className="p-3">تاریخ</th>
                        <th className="p-3 text-left">مبلغ</th>
                        <th className="p-3 text-center w-12">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 bg-white">
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="p-3 font-medium text-neutral-900">{exp.title}</td>
                          <td className="p-3">
                            <Badge variant="neutral">{exp.category}</Badge>
                          </td>
                          <td className="p-3 font-mono text-neutral-600">{toPersianDigits(exp.date)}</td>
                          <td className="p-3 text-left font-mono font-bold text-rose-700">
                            {formatCurrency(exp.amount, activeOrganization?.currency, isPersian)}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="حذف هزینه"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {expenses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-neutral-400">هیچ هزینه‌ای ثبت نشده است.</td>
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
