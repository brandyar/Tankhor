import React, { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, Tooltip, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import {
  TimeRange, DailySalesData, InventoryFlowData,
  CategoryStockData, StockHealthData, WarehouseStockData
} from './dashboardUtils';
import {
  TrendingUp, ArrowDownLeft, ArrowUpRight, PieChart as PieIcon,
  Layers, Package, Building2, Calendar, Sparkles
} from 'lucide-react';
import { Organization } from '../../types';
import { useTranslation } from '../../i18n';

interface DashboardAnalyticsChartsProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  salesData: DailySalesData[];
  inventoryFlowData: InventoryFlowData[];
  categoryStockData: CategoryStockData[];
  stockHealthData: StockHealthData[];
  warehouseStockData: WarehouseStockData[];
  canViewFinancials: boolean;
  activeOrganization: Organization | null;
  isPersian: boolean;
}

// Custom Tooltip for Sales & Revenue Area Chart
const CustomSalesTooltip = ({ active, payload, label, currency, isPersian, t }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as DailySalesData;
    return (
      <div className="bg-neutral-900 dark:bg-[#181a20] text-white p-3 rounded-lg shadow-xl border border-neutral-800 dark:border-neutral-700 text-xs font-sans space-y-1 min-w-[160px]">
        <p className="text-neutral-400 font-mono text-[11px] pb-1 border-b border-neutral-800 dark:border-neutral-700">
          {t('dashboard.date')} {data.displayDate || label}
        </p>
        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="text-neutral-300">{t('dashboard.salesAmount')}</span>
          <span className="font-bold text-emerald-400 font-mono">
            {formatCurrency(data.revenue, currency, isPersian)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-300">{t('dashboard.ordersCount')}</span>
          <span className="font-bold text-white font-mono">
            {isPersian ? toPersianDigits(data.ordersCount) : data.ordersCount} {t('dashboard.unitsCount')}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Inventory In/Out Bar Chart
const CustomFlowTooltip = ({ active, payload, label, isPersian, t }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as InventoryFlowData;
    return (
      <div className="bg-neutral-900 dark:bg-[#181a20] text-white p-3 rounded-lg shadow-xl border border-neutral-800 dark:border-neutral-700 text-xs font-sans space-y-1.5 min-w-[150px]">
        <p className="text-neutral-400 font-mono text-[11px] pb-1 border-b border-neutral-800 dark:border-neutral-700">
          {t('dashboard.date')} {data.displayDate || label}
        </p>
        <div className="flex items-center justify-between gap-4 text-emerald-400">
          <span className="flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            {t('dashboard.stockInflow')}:
          </span>
          <span className="font-bold font-mono">+{isPersian ? toPersianDigits(data.inflow) : data.inflow}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-rose-400">
          <span className="flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {t('dashboard.stockOutflow')}:
          </span>
          <span className="font-bold font-mono">-{isPersian ? toPersianDigits(data.outflow) : data.outflow}</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Category Donut
const CustomCategoryTooltip = ({ active, payload, isPersian, t }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as CategoryStockData;
    return (
      <div className="bg-neutral-900 dark:bg-[#181a20] text-white p-2.5 rounded-lg shadow-xl border border-neutral-800 dark:border-neutral-700 text-xs font-sans space-y-1">
        <p className="font-bold text-neutral-100">{data.name}</p>
        <div className="flex items-center justify-between gap-4 text-neutral-300">
          <span>{t('dashboard.totalStockLabel')}</span>
          <span className="font-mono font-bold text-white">{isPersian ? toPersianDigits(data.value) : data.value} {t('dashboard.unitsCount')}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-neutral-400 text-[11px]">
          <span>{t('dashboard.modelsCountLabel')}</span>
          <span className="font-mono">{isPersian ? toPersianDigits(data.productCount) : data.productCount} {t('dashboard.modelsCount')}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const DashboardAnalyticsCharts: React.FC<DashboardAnalyticsChartsProps> = ({
  timeRange,
  onTimeRangeChange,
  salesData,
  inventoryFlowData,
  categoryStockData,
  stockHealthData,
  warehouseStockData,
  canViewFinancials,
  activeOrganization,
  isPersian,
}) => {
  const { t } = useTranslation();
  const [salesMetricView, setSalesMetricView] = useState<'revenue' | 'orders'>('revenue');

  const totalCategoryStock = categoryStockData.reduce((acc, c) => acc + c.value, 0);

  return (
    <div className="space-y-6">
      {/* Time Range Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#13151a] p-3 sm:p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs transition-colors">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
          <Calendar className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          <span>{t('dashboard.timeRangeLabel')}</span>
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#181a20] p-1 rounded-lg w-full sm:w-auto">
          <button
            onClick={() => onTimeRangeChange('7d')}
            className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded-md transition-all ${
              timeRange === '7d'
                ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            {t('dashboard.last7Days')}
          </button>
          <button
            onClick={() => onTimeRangeChange('30d')}
            className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded-md transition-all ${
              timeRange === '30d'
                ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            {t('dashboard.last30Days')}
          </button>
          <button
            onClick={() => onTimeRangeChange('90d')}
            className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded-md transition-all ${
              timeRange === '90d'
                ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            {t('dashboard.last90Days')}
          </button>
          <button
            onClick={() => onTimeRangeChange('all')}
            className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded-md transition-all ${
              timeRange === 'all'
                ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            {t('dashboard.allTime')}
          </button>
        </div>
      </div>

      {/* Row 1: Primary Trends (Sales Revenue / Orders & Inventory Flow) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Sales / Orders Performance */}
        <Card
          title={canViewFinancials ? t('dashboard.salesTrendTitle') : t('dashboard.ordersTrendTitle')}
          subtitle={canViewFinancials ? t('dashboard.salesTrendSubtitle') : t('dashboard.ordersTrendSubtitle')}
          action={
            canViewFinancials && (
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#181a20] p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setSalesMetricView('revenue')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    salesMetricView === 'revenue'
                      ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  {t('dashboard.metricRevenue')}
                </button>
                <button
                  onClick={() => setSalesMetricView('orders')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    salesMetricView === 'orders'
                      ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  {t('dashboard.metricOrders')}
                </button>
              </div>
            )
          }
        >
          <div className="h-72 w-full pt-4">
            {salesData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 text-xs">
                <TrendingUp className="w-8 h-8 stroke-1 mb-2 text-neutral-300 dark:text-neutral-600" />
                <span>{t('dashboard.noDataTimeRange')}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.2} />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
                    axisLine={{ stroke: '#64748b', opacity: 0.3 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) =>
                      salesMetricView === 'revenue' && canViewFinancials
                        ? val >= 1000000
                          ? `${isPersian ? toPersianDigits(Math.round(val / 1000000)) : Math.round(val / 1000000)}M`
                          : val >= 1000
                          ? `${isPersian ? toPersianDigits(Math.round(val / 1000)) : Math.round(val / 1000)}k`
                          : isPersian ? toPersianDigits(val) : val
                        : isPersian ? toPersianDigits(val) : val
                    }
                  />
                  <Tooltip
                    content={
                      <CustomSalesTooltip
                        currency={activeOrganization?.currency}
                        isPersian={isPersian}
                        t={t}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey={salesMetricView === 'revenue' && canViewFinancials ? 'revenue' : 'ordersCount'}
                    stroke={salesMetricView === 'revenue' && canViewFinancials ? '#10b981' : '#3b82f6'}
                    strokeWidth={2.5}
                    fill={salesMetricView === 'revenue' && canViewFinancials ? 'url(#salesGrad)' : 'url(#ordersGrad)'}
                    dot={{ r: 3, fill: salesMetricView === 'revenue' && canViewFinancials ? '#10b981' : '#3b82f6' }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Chart 2: Inventory Movements (Inflow vs Outflow) */}
        <Card
          title={t('dashboard.stockFlowTitle')}
          subtitle={t('dashboard.stockFlowSubtitle')}
        >
          <div className="h-72 w-full pt-4">
            {inventoryFlowData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 text-xs">
                <Package className="w-8 h-8 stroke-1 mb-2 text-neutral-300 dark:text-neutral-600" />
                <span>{t('dashboard.noMovementTimeRange')}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryFlowData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.2} />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
                    axisLine={{ stroke: '#64748b', opacity: 0.3 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => (isPersian ? toPersianDigits(val) : val)}
                  />
                  <Tooltip content={<CustomFlowTooltip isPersian={isPersian} t={t} />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                    formatter={(val) => (
                      <span className="text-neutral-700 dark:text-neutral-300">
                        {val === 'inflow' ? t('dashboard.stockInflow') : t('dashboard.stockOutflow')}
                      </span>
                    )}
                  />
                  <Bar dataKey="inflow" name="inflow" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="outflow" name="outflow" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: Distribution Insights (Categories, Stock Health, Warehouse Allocations) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut 1: Category Stock Distribution */}
        <Card
          title={t('dashboard.categoryComposition')}
          subtitle={t('dashboard.categoryCompSubtitle')}
        >
          <div className="h-64 w-full relative flex items-center justify-center">
            {totalCategoryStock === 0 ? (
              <div className="text-center text-neutral-400 dark:text-neutral-500 text-xs">
                <PieIcon className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-600 stroke-1" />
                <span>{t('dashboard.noCategoryData')}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStockData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryStockData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomCategoryTooltip isPersian={isPersian} t={t} />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Category Legend List */}
          <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar border-t border-neutral-100 dark:border-neutral-800 pt-3">
            {categoryStockData.slice(0, 5).map((cat, idx) => {
              const pct = totalCategoryStock > 0 ? Math.round((cat.value / totalCategoryStock) * 100) : 0;
              return (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                    <span className="text-neutral-800 dark:text-neutral-200 font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-neutral-500 dark:text-neutral-400">{isPersian ? toPersianDigits(cat.value) : cat.value} {t('dashboard.unitsCount')}</span>
                    <span className="text-neutral-400 dark:text-neutral-500 font-normal">({isPersian ? toPersianDigits(pct) : pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Donut 2: Stock Health & Alert Status */}
        <Card
          title={t('dashboard.stockHealthTitle')}
          subtitle={t('dashboard.stockHealthSubtitle')}
        >
          <div className="space-y-4 pt-2">
            {stockHealthData.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">{isPersian ? toPersianDigits(item.value) : item.value} {t('products.variantsCount')}</span>
                    <span className="text-neutral-400 dark:text-neutral-500">({isPersian ? toPersianDigits(item.percentage) : item.percentage}%)</span>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-3 rounded-lg bg-neutral-50 dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
            <p className="flex items-center gap-1 font-bold text-neutral-800 dark:text-neutral-200 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {t('dashboard.smartStockRecommendation')}
            </p>
            {t('dashboard.smartStockTip')}
          </div>
        </Card>

        {/* Donut 3 / Bars: Warehouse Capacity Allocation */}
        <Card
          title={t('dashboard.warehouseDistribution')}
          subtitle={t('dashboard.warehouseDistSubtitle')}
        >
          <div className="space-y-4 pt-1">
            {warehouseStockData.length === 0 ? (
              <div className="text-center py-10 text-neutral-400 dark:text-neutral-500 text-xs">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-600 stroke-1" />
                <span>{t('dashboard.noWarehousesDefined')}</span>
              </div>
            ) : (
              warehouseStockData.map((wh, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#181a20]/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                      {wh.name}
                    </span>
                    <Badge variant="neutral">
                      {isPersian ? toPersianDigits(wh.variantsCount) : wh.variantsCount} {t('dashboard.activeVariantsCount')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400">{t('dashboard.stockQuantityLabel')}</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-[13px]">
                      {isPersian ? toPersianDigits(wh.stockCount) : wh.stockCount} <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">{t('dashboard.unitsCount')}</span>
                    </span>
                  </div>
                  {canViewFinancials && wh.totalValue > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>{t('dashboard.stockValueLabel')}</span>
                      <span className="font-mono text-neutral-700 dark:text-neutral-300">
                        {formatCurrency(wh.totalValue, activeOrganization?.currency, isPersian)}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
