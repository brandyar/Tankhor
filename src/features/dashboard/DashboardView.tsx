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
  Calendar, BarChart3, TrendingUp, Sparkles, HardDriveDownload, HardDriveUpload,
  ShoppingCart, PackagePlus, FileText, Truck, ArrowLeft, ArrowRight
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
  const { activeOrganization, permissions, refreshOrganizations } = useOrganization();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
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
    () => computeCategoryStock(categories, products, variants, isPersian),
    [categories, products, variants, isPersian]
  );

  const stockHealthData = useMemo(
    () => computeStockHealth(variants, isPersian),
    [variants, isPersian]
  );

  const warehouseStockData = useMemo(
    () => computeWarehouseDistribution(warehouses, variants, isPersian),
    [warehouses, variants, isPersian]
  );

  const topProducts = useMemo(
    () => computeTopProducts(products, variants, categories, movements, isPersian),
    [products, variants, categories, movements, isPersian]
  );

  const movementColumns: Column<InventoryMovement>[] = [
    {
      key: 'created_at',
      header: t('common.date'),
      render: (m) => <span className="text-slate-500 dark:text-neutral-400 font-mono text-[11px]">{formatDate(m.created_at, isPersian)}</span>,
    },
    {
      key: 'sku',
      header: t('common.sku'),
      render: (m) => <span className="font-bold text-slate-800 dark:text-neutral-200 font-mono text-xs">{m.sku || 'TNK-SKU'}</span>,
    },
    {
      key: 'type',
      header: t('dashboard.movementType'),
      render: (m) => {
        const isIn = m.type === 'purchase' || m.type === 'transfer_in' || m.type === 'return';
        let label: string = String(m.type);
        if (m.type === 'purchase') label = t('dashboard.purchaseIn');
        else if (m.type === 'sale') label = t('dashboard.saleOut');
        else if (m.type === 'return') label = t('dashboard.returnIn');
        else if (m.type === 'transfer_in') label = t('inventory.typeTransferIn');
        else if (m.type === 'transfer_out') label = t('inventory.typeTransferOut');
        else if (m.type === 'adjustment') label = t('inventory.stockAdjustment');

        return (
          <Badge variant={isIn ? 'success' : 'danger'}>
            <span className="flex items-center gap-1 text-[11px]">
              {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
              {label}
            </span>
          </Badge>
        );
      },
    },
    {
      key: 'quantity',
      header: t('orders.quantity'),
      render: (m) => (
        <span className="font-bold text-slate-900 dark:text-neutral-100 font-mono text-xs">
          {isPersian ? toPersianDigits(m.quantity) : m.quantity} {t('dashboard.unitsCount')}
        </span>
      ),
    },
    {
      key: 'reference_id',
      header: t('dashboard.referenceNumber'),
      render: (m) => <span className="text-slate-500 dark:text-neutral-400 font-mono text-xs">{m.reference_id || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Top Metric Ribbon (KPIs) - 4 report blocks moved to top */}
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
        onNavigate={onNavigate}
      />

      {/* 2. Four Operational Quick Access Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Quick Action 1: Create Order (ثبت سفارش) */}
        <button
          type="button"
          onClick={() => onNavigate('orders/create')}
          disabled={!permissions.canCreateOrders}
          className={`group relative overflow-hidden text-start p-4 sm:p-5 rounded-xl border bg-white dark:bg-[#13151a] transition-all shadow-xs ${
            permissions.canCreateOrders
              ? 'hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md cursor-pointer border-neutral-200/80 dark:border-neutral-800'
              : 'opacity-60 cursor-not-allowed border-neutral-200/60 dark:border-neutral-800/60'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/60 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white transition-all">
              <ShoppingCart className="w-6 h-6 transition-colors" />
            </div>
            <span className="p-1.5 rounded-lg text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 transition-colors">
              {isPersian ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {t('dashboard.actionCreateOrder')}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1 leading-relaxed">
              {t('dashboard.actionCreateOrderDesc')}
            </p>
          </div>
        </button>

        {/* Quick Action 2: Create Product (ایجاد محصول) */}
        <button
          type="button"
          onClick={() => onNavigate('products/create')}
          disabled={!permissions.canEditProducts}
          className={`group relative overflow-hidden text-start p-4 sm:p-5 rounded-xl border bg-white dark:bg-[#13151a] transition-all shadow-xs ${
            permissions.canEditProducts
              ? 'hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md cursor-pointer border-neutral-200/80 dark:border-neutral-800'
              : 'opacity-60 cursor-not-allowed border-neutral-200/60 dark:border-neutral-800/60'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/60 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-600 dark:group-hover:text-white transition-all">
              <PackagePlus className="w-6 h-6 transition-colors" />
            </div>
            <span className="p-1.5 rounded-lg text-neutral-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 transition-colors">
              {isPersian ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {t('dashboard.actionCreateProduct')}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1 leading-relaxed">
              {t('dashboard.actionCreateProductDesc')}
            </p>
          </div>
        </button>

        {/* Quick Action 3: Orders List (لیست سفارشات) */}
        <button
          type="button"
          onClick={() => onNavigate('orders/all')}
          disabled={!permissions.canViewOrders}
          className={`group relative overflow-hidden text-start p-4 sm:p-5 rounded-xl border bg-white dark:bg-[#13151a] transition-all shadow-xs ${
            permissions.canViewOrders
              ? 'hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md cursor-pointer border-neutral-200/80 dark:border-neutral-800'
              : 'opacity-60 cursor-not-allowed border-neutral-200/60 dark:border-neutral-800/60'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-900/60 group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white dark:group-hover:bg-purple-600 dark:group-hover:text-white transition-all">
              <FileText className="w-6 h-6 transition-colors" />
            </div>
            <span className="p-1.5 rounded-lg text-neutral-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/40 transition-colors">
              {isPersian ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {t('dashboard.actionOrdersList')}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1 leading-relaxed">
              {t('dashboard.actionOrdersListDesc')}
            </p>
          </div>
        </button>

        {/* Quick Action 4: Purchase Order (ثبت سفارش خرید) */}
        <button
          type="button"
          onClick={() => onNavigate('purchasing/orders/create')}
          disabled={!permissions.canViewPurchasing}
          className={`group relative overflow-hidden text-start p-4 sm:p-5 rounded-xl border bg-white dark:bg-[#13151a] transition-all shadow-xs ${
            permissions.canViewPurchasing
              ? 'hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md cursor-pointer border-neutral-200/80 dark:border-neutral-800'
              : 'opacity-60 cursor-not-allowed border-neutral-200/60 dark:border-neutral-800/60'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/60 group-hover:scale-105 group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-600 dark:group-hover:text-white transition-all">
              <Truck className="w-6 h-6 transition-colors" />
            </div>
            <span className="p-1.5 rounded-lg text-neutral-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:bg-amber-50 dark:group-hover:bg-amber-950/40 transition-colors">
              {isPersian ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              {t('dashboard.actionCreatePurchaseOrder')}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1 leading-relaxed">
              {t('dashboard.actionCreatePurchaseOrderDesc')}
            </p>
          </div>
        </button>
      </div>

      {/* Quick Start / Demo Data Banner if Database is Empty */}
      {!isLoading && products.length === 0 && (
        <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-blue-950/40 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in transition-colors">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{t('dashboard.emptyStateWelcome')}</h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed max-w-2xl">
                {t('dashboard.emptyStateDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap w-full md:w-auto justify-end">
            <Button
              variant="primary"
              size="sm"
              isLoading={isSeedingDemo}
              onClick={async () => {
                setIsSeedingDemo(true);
                try {
                  const targetOrgId = activeOrganization?.id ? Number(activeOrganization.id) : 1;
                  const res = await BackupManager.seedFashionDemoData(targetOrgId);
                  if (res.success) {
                    await refreshOrganizations();
                    await loadDashboardData();
                  }
                } catch (err) {
                  console.error('Error seeding demo data:', err);
                } finally {
                  setIsSeedingDemo(false);
                }
              }}
              icon={<Sparkles className="w-4 h-4" />}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs"
            >
              {t('dashboard.loadDemoData')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('settings/org')}
              icon={<HardDriveUpload className="w-4 h-4 text-blue-600" />}
              className="text-xs font-bold border-neutral-300 hover:bg-white"
            >
              {t('dashboard.restoreFromBackup')}
            </Button>
          </div>
        </div>
      )}

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

      {/* 5. Bottom Row: Recent Movements & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Movements Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title={t('dashboard.recentMovements')}
            subtitle={t('dashboard.recentMovementsSubtitle')}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('inventory/movements')}
              >
                {t('dashboard.viewAll')}
              </Button>
            }
          >
            <DataTable
              columns={movementColumns}
              data={movements.slice(0, 6)}
              keyExtractor={(m) => m.id}
              isLoading={isLoading}
              emptyMessage={t('dashboard.noMovementsLogged')}
            />
          </Card>
        </div>

        {/* System Status Sidebar */}
        <div className="space-y-6">
          <Card title={t('dashboard.systemStatus')}>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-bold">{t('dashboard.offlineReady')}</p>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/80 mt-0.5 leading-relaxed">
                    {t('dashboard.realtimeEngineNote')}
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
