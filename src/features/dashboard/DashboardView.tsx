import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatCurrency, formatDate, toPersianDigits } from '../../utils/formatters';
import {
  ShoppingBag, Shirt, DollarSign, AlertTriangle,
  Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, CheckCircle2,
  Calendar, BarChart3, TrendingUp, Sparkles, HardDriveDownload, HardDriveUpload
} from 'lucide-react';
import { BackupManager } from '../../storage/backupManager';
import {
  Product, ProductVariant, InventoryMovement, Order, Category, Warehouse
} from '../../types';
import {
  TimeRange, computeSalesTrend, computeInventoryFlow, computeCategoryStock,
  computeStockHealth, computeWarehouseDistribution, computeTopProducts
} from './dashboardUtils';
import { DashboardMetricsRibbon } from './DashboardMetricsRibbon';
import { DashboardAnalyticsCharts } from './DashboardAnalyticsCharts';
import { DashboardStockAlerts } from './DashboardStockAlerts';

interface DashboardViewProps {
  onNavigate: (route: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { t, locale } = useTranslation();
  const { activeOrganization, permissions } = useOrganization();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const isPersian = locale === 'fa';

  const loadDashboardData = async () => {
    const orgId = activeOrganization?.id;
    if (!orgId) {
      setProducts([]);
      setVariants([]);
      setMovements([]);
      setOrders([]);
      setCategories([]);
      setWarehouses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();

      const [pList, vList, mList, oList, cList, wList] = await Promise.all([
        adapter.getProducts({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
        adapter.getInventoryMovements({ organization_id: orgId }),
        adapter.getOrders({ organization_id: orgId }),
        adapter.getCategories({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
      ]);

      setProducts(pList);
      setVariants(vList);
      setMovements(mList);
      setOrders(oList);
      setCategories(cList);
      setWarehouses(wList);
    } catch (err) {
      console.error('[DashboardData] Error loading metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrganization?.id) {
      loadDashboardData();
    } else {
      setProducts([]);
      setVariants([]);
      setMovements([]);
      setOrders([]);
      setCategories([]);
      setWarehouses([]);
      setIsLoading(false);
    }

    const handleDataRestored = () => {
      if (activeOrganization?.id) {
        loadDashboardData();
      }
    };
    window.addEventListener('tankhor_data_restored', handleDataRestored);
    return () => {
      window.removeEventListener('tankhor_data_restored', handleDataRestored);
    };
  }, [activeOrganization?.id]);

  // Overall Aggregations
  const totalStockCount = variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
  const totalValue = variants.reduce((acc, v) => acc + (v.stock_quantity || 0) * (v.price || 0), 0);
  const lowStockVariants = useMemo(
    () => variants.filter((v) => (v.stock_quantity || 0) <= 5),
    [variants]
  );
  const lowStockCount = useMemo(
    () => variants.filter((v) => (v.stock_quantity || 0) > 0 && (v.stock_quantity || 0) <= 5).length,
    [variants]
  );
  const outOfStockCount = useMemo(
    () => variants.filter((v) => (v.stock_quantity || 0) <= 0).length,
    [variants]
  );

  const totalSalesRevenue = useMemo(
    () => orders.reduce((acc, o) => acc + Number(o.total || 0), 0),
    [orders]
  );

  const averageOrderValue = useMemo(
    () => (orders.length > 0 ? Math.round(totalSalesRevenue / orders.length) : 0),
    [orders, totalSalesRevenue]
  );

  // Analytical Computed Data for Charts
  const salesData = useMemo(
    () => computeSalesTrend(orders, timeRange, isPersian),
    [orders, timeRange, isPersian]
  );

  const inventoryFlowData = useMemo(
    () => computeInventoryFlow(movements, timeRange, isPersian),
    [movements, timeRange, isPersian]
  );

  const categoryStockData = useMemo(
    () => computeCategoryStock(categories, products, variants),
    [categories, products, variants]
  );

  const stockHealthData = useMemo(
    () => computeStockHealth(variants),
    [variants]
  );

  const warehouseStockData = useMemo(
    () => computeWarehouseDistribution(warehouses, variants),
    [warehouses, variants]
  );

  const topProducts = useMemo(
    () => computeTopProducts(products, variants, categories, movements),
    [products, variants, categories, movements]
  );

  const movementColumns: Column<InventoryMovement>[] = [
    {
      key: 'created_at',
      header: t('common.date'),
      render: (m) => <span className="text-slate-500 font-mono text-[11px]">{formatDate(m.created_at, isPersian)}</span>,
    },
    {
      key: 'sku',
      header: t('common.sku'),
      render: (m) => <span className="font-bold text-slate-800 font-mono text-xs">{m.sku || 'TNK-SKU'}</span>,
    },
    {
      key: 'type',
      header: 'نوع گردش',
      render: (m) => {
        const isIn = m.type === 'purchase' || m.type === 'transfer_in' || m.type === 'return';
        return (
          <Badge variant={isIn ? 'success' : 'danger'}>
            <span className="flex items-center gap-1 text-[11px]">
              {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
              {m.type === 'purchase' ? 'ورود خرید' : m.type === 'sale' ? 'خروج فروش' : m.type === 'return' ? 'مرجوعی' : m.type}
            </span>
          </Badge>
        );
      },
    },
    {
      key: 'quantity',
      header: 'تعداد',
      render: (m) => (
        <span className="font-bold text-slate-900 font-mono text-xs">
          {toPersianDigits(m.quantity)} عدد
        </span>
      ),
    },
    {
      key: 'reference_id',
      header: 'مرجع / شماره سند',
      render: (m) => <span className="text-slate-500 font-mono text-xs">{m.reference_id || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Vercel Ambient Hero Banner */}
      <div className="relative overflow-hidden bg-white border border-neutral-200/80 rounded-xl p-6 sm:p-8 shadow-vercel-sm bg-mesh-gradient">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <img
                src="/logo-dark.png"
                alt="تن‌خور"
                className="h-7 w-auto object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-neutral-900 text-white font-medium">
                TANKHOR PLATFORM
              </span>
              <span className="font-mono text-[11px] text-neutral-500">
                {activeOrganization?.name || 'سازمان پیش‌فرض'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
              پیشخوان گزارشات و مدیریت جامع تن‌خور
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              نمای زنده از موجودی انبارها، وضعیت سفارشات، گردش کالا و تحلیل شاخص‌های عملکرد کسب‌وکار
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {permissions.canCreateOrders && (
              <Button
                variant="primary"
                onClick={() => onNavigate('orders/create')}
                icon={<Plus className="w-4 h-4" />}
              >
                ثبت سفارش جدید
              </Button>
            )}
            {permissions.canEditProducts && (
              <Button
                variant="secondary"
                onClick={() => onNavigate('products/all')}
                icon={<Shirt className="w-4 h-4" />}
              >
                افزودن کالا
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Start / Demo Data Banner if Database is Empty */}
      {!isLoading && products.length === 0 && (
        <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">به نرم‌افزار تن‌خور خوش آمدید!</h3>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed max-w-2xl">
                پایگاه داده شما خالی است. می‌توانید با یک کلیک <strong>«اطلاعات نمونه بوتیک پوشاک»</strong> (شامل پالتو، هودی، جین، کفش، انبارها، جداول سایز و فاکتورها) را بارگذاری نموده یا فایل پشتیبان سیستم قبلی خود را بازیابی کنید.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap w-full md:w-auto justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const res = BackupManager.seedFashionDemoData(activeOrganization?.id || 1);
                if (res.success) {
                  loadDashboardData();
                }
              }}
              icon={<Sparkles className="w-4 h-4" />}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs"
            >
              بارگذاری داده‌های نمونه پوشاک
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('settings/org')}
              icon={<HardDriveUpload className="w-4 h-4 text-blue-600" />}
              className="text-xs font-bold border-neutral-300 hover:bg-white"
            >
              بازیابی از فایل پشتیبان
            </Button>
          </div>
        </div>
      )}

      {/* 2. Top Metric Ribbon (KPIs) */}
      <DashboardMetricsRibbon
        totalProducts={products.length}
        totalVariants={variants.length}
        totalStockCount={totalStockCount}
        totalValue={totalValue}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
        totalOrdersCount={orders.length}
        totalSalesRevenue={totalSalesRevenue}
        averageOrderValue={averageOrderValue}
        canViewFinancials={permissions.canViewFinancials}
        activeOrganization={activeOrganization}
        isPersian={isPersian}
      />

      {/* 3. Recharts Analytics Suite (Trends, Inflow/Outflow, Donut Distribution, Warehouse Allocation) */}
      <DashboardAnalyticsCharts
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        salesData={salesData}
        inventoryFlowData={inventoryFlowData}
        categoryStockData={categoryStockData}
        stockHealthData={stockHealthData}
        warehouseStockData={warehouseStockData}
        canViewFinancials={permissions.canViewFinancials}
        activeOrganization={activeOrganization}
        isPersian={isPersian}
      />

      {/* 4. High-Demand Products & Critical Low-Stock Alerts */}
      <DashboardStockAlerts
        topProducts={topProducts}
        lowStockVariants={lowStockVariants}
        onNavigate={onNavigate}
        canManageInventory={permissions.canManageInventory}
        canCreateOrders={permissions.canCreateOrders}
        canViewPurchasing={permissions.canViewPurchasing}
        activeOrganization={activeOrganization}
        isPersian={isPersian}
      />

      {/* 5. Bottom Row: Recent Movements & Quick Action Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Movements Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title={t('dashboard.recentMovements')}
            subtitle="آخرین اسناد ورود، خروج، انتقال و تعدیل موجودی در انبار"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('inventory/movements')}
              >
                مشاهده همه
              </Button>
            }
          >
            <DataTable
              columns={movementColumns}
              data={movements.slice(0, 6)}
              keyExtractor={(m) => m.id}
              isLoading={isLoading}
              emptyMessage="هیچ گردش کالایی ثبت نشده است."
            />
          </Card>
        </div>

        {/* Shortcuts & Status Sidebar */}
        <div className="space-y-6">
          <Card title={t('dashboard.quickActions')}>
            <div className="space-y-2">
              {permissions.canCreateOrders && (
                <Button
                  variant="secondary"
                  className="w-full justify-start text-xs font-medium"
                  onClick={() => onNavigate('orders/create')}
                  icon={<Plus className="w-4 h-4 text-neutral-700" />}
                >
                  {t('dashboard.newOrder')}
                </Button>
              )}
              {permissions.canEditProducts && (
                <Button
                  variant="secondary"
                  className="w-full justify-start text-xs font-medium"
                  onClick={() => onNavigate('products/all')}
                  icon={<Shirt className="w-4 h-4 text-neutral-700" />}
                >
                  {t('dashboard.addProduct')}
                </Button>
              )}
              {permissions.canManageInventory && (
                <Button
                  variant="secondary"
                  className="w-full justify-start text-xs font-medium"
                  onClick={() => onNavigate('inventory/movements')}
                  icon={<RefreshCw className="w-4 h-4 text-neutral-700" />}
                >
                  {t('dashboard.newMovement')}
                </Button>
              )}
              {permissions.canViewProducts && (
                <Button
                  variant="secondary"
                  className="w-full justify-start text-xs font-medium"
                  onClick={() => onNavigate('products/size-guides')}
                  icon={<BarChart3 className="w-4 h-4 text-neutral-700" />}
                >
                  {t('dashboard.sizeGuideTemplate')}
                </Button>
              )}
            </div>
          </Card>

          <Card title={t('dashboard.systemStatus')}>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-bold">{t('dashboard.offlineReady')}</p>
                  <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                    تمامی محاسبات آماری و گزارشات به‌صورت بلادرنگ (Real-time) از دیتابیس محلی استخراج و نمایش داده می‌شوند.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
