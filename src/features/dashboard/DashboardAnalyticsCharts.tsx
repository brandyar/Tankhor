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
const CustomSalesTooltip = ({ active, payload, label, currency, isPersian }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as DailySalesData;
    return (
      <div className="bg-neutral-900 dark:bg-[#181a20] text-white p-3 rounded-lg shadow-xl border border-neutral-800 dark:border-neutral-700 text-xs font-sans space-y-1 min-w-[160px]">
        <p className="text-neutral-400 font-mono text-[11px] pb-1 border-b border-neutral-800 dark:border-neutral-700">
          تاریخ: {data.displayDate || label}
        </p>
        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="text-neutral-300">مبلغ فروش:</span>
          <span className="font-bold text-emerald-400 font-mono">
            {formatCurrency(data.revenue, currency, isPersian)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-300">تعداد سفارش:</span>
          <span className="font-bold text-white font-mono">
            {toPersianDigits(data.ordersCount)} عدد
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Inventory In/Out Bar Chart
const CustomFlowTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as InventoryFlowData;
    return (
      <div className="bg-neutral-900 dark:bg-[#181a20] text-white p-3 rounded-lg shadow-xl border border-neutral-800 dark:border-neutral-700 text-xs font-sans space-y-1.5 min-w-[150px]">
        <p className="text-neutral-400 font-mono text-[11px] pb-1 border-b border-neutral-800 dark:border-neutral-700">
          تاریخ: {data.displayDate || label}
        </p>
        <div className="flex items-center justify-between gap-4 text-emerald-400">
          <span className="flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            ورود به انبار:
          </span>
          <span className="font-bold font-mono">+{toPersianDigits(data.inflow)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-rose-400">
          <span className="flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            خروج از انبار:
          </span>
          <span className="font-bold font-mono">-{toPersianDigits(data.outflow)}</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Category Donut
const CustomCategoryTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as CategoryStockData;
    return (
      <div className="bg-neutral-900 dark:bg-[#181a20] text-white p-2.5 rounded-lg shadow-xl border border-neutral-800 dark:border-neutral-700 text-xs font-sans space-y-1">
        <p className="font-bold text-neutral-100">{data.name}</p>
        <div className="flex items-center justify-between gap-4 text-neutral-300">
          <span>موجودی کل:</span>
          <span className="font-mono font-bold text-white">{toPersianDigits(data.value)} عدد</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-neutral-400 text-[11px]">
          <span>تعداد مدل‌ها:</span>
          <span className="font-mono">{toPersianDigits(data.productCount)} مدل</span>
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
  const [salesMetricView, setSalesMetricView] = useState<'revenue' | 'orders'>('revenue');

  const totalCategoryStock = categoryStockData.reduce((acc, c) => acc + c.value, 0);

  return (
    <div className="space-y-6">
      {/* Time Range Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#13151a] p-3 sm:p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs transition-colors">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
          <Calendar className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          <span>بازه زمانی گزارشات و تحلیل‌ها:</span>
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
            ۷ روز گذشته
          </button>
          <button
            onClick={() => onTimeRangeChange('30d')}
            className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded-md transition-all ${
              timeRange === '30d'
                ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            ۳۰ روز گذشته
          </button>
          <button
            onClick={() => onTimeRangeChange('90d')}
            className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded-md transition-all ${
              timeRange === '90d'
                ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            ۳ ماه اخیر
          </button>
          <button
            onClick={() => onTimeRangeChange('all')}
            className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded-md transition-all ${
              timeRange === 'all'
                ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            کل دوره
          </button>
        </div>
      </div>

      {/* Row 1: Primary Trends (Sales Revenue / Orders & Inventory Flow) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Sales / Orders Performance */}
        <Card
          title={canViewFinancials ? 'تحلیل روند فروش و درآمد' : 'تحلیل تعداد سفارشات'}
          subtitle={canViewFinancials ? 'نمودار پیوسته گردش مالی و سفارش‌های ثبت‌شده' : 'نمودار توزیع سفارشات فروش در طول زمان'}
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
                  ریالی
                </button>
                <button
                  onClick={() => setSalesMetricView('orders')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    salesMetricView === 'orders'
                      ? 'bg-white dark:bg-[#13151a] text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  تعداد فروش
                </button>
              </div>
            )
          }
        >
          <div className="h-72 w-full pt-4">
            {salesData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 text-xs">
                <TrendingUp className="w-8 h-8 stroke-1 mb-2 text-neutral-300 dark:text-neutral-600" />
                <span>داده‌ای برای این بازه زمانی ثبت نشده است.</span>
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
                          ? `${toPersianDigits(Math.round(val / 1000000))}M`
                          : val >= 1000
                          ? `${toPersianDigits(Math.round(val / 1000))}k`
                          : toPersianDigits(val)
                        : toPersianDigits(val)
                    }
                  />
                  <Tooltip
                    content={
                      <CustomSalesTooltip
                        currency={activeOrganization?.currency}
                        isPersian={isPersian}
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
          title="گردش ورود و خروج کالا از انبار"
          subtitle="مقایسه خریدهای ورودی و مرجوعی‌ها در برابر فروش و خروج کالا"
        >
          <div className="h-72 w-full pt-4">
            {inventoryFlowData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 text-xs">
                <Package className="w-8 h-8 stroke-1 mb-2 text-neutral-300 dark:text-neutral-600" />
                <span>هیچ گردش کالایی در این بازه ثبت نشده است.</span>
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
                    tickFormatter={(val) => toPersianDigits(val)}
                  />
                  <Tooltip content={<CustomFlowTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                    formatter={(val) => (
                      <span className="text-neutral-700 dark:text-neutral-300">
                        {val === 'inflow' ? 'ورود به انبار' : 'خروج از انبار'}
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
          title="ترکیب دسته‌بندی‌های کالا"
          subtitle="سهم هر دسته‌بندی از کل موجودی فیزیکی"
        >
          <div className="h-64 w-full relative flex items-center justify-center">
            {totalCategoryStock === 0 ? (
              <div className="text-center text-neutral-400 dark:text-neutral-500 text-xs">
                <PieIcon className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-600 stroke-1" />
                <span>داده‌ای برای نمایش دسته‌بندی‌ها وجود ندارد.</span>
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
                  <Tooltip content={<CustomCategoryTooltip />} />
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
                    <span className="text-neutral-500 dark:text-neutral-400">{toPersianDigits(cat.value)} عدد</span>
                    <span className="text-neutral-400 dark:text-neutral-500 font-normal">({toPersianDigits(pct)}٪)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Donut 2: Stock Health & Alert Status */}
        <Card
          title="وضعیت سلامت موجودی انبار"
          subtitle="تفکیک تنوع‌ها بر اساس سطوح ریسک کسری"
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
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">{toPersianDigits(item.value)} تنوع</span>
                    <span className="text-neutral-400 dark:text-neutral-500">({toPersianDigits(item.percentage)}٪)</span>
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
              توصیه مدیریت هوشمند موجودی:
            </p>
            تنوع‌های با موجودی کمتر از ۵ عدد نیازمند ثبت سفارش خرید سریع برای جلوگیری از توقف فروش هستند.
          </div>
        </Card>

        {/* Donut 3 / Bars: Warehouse Capacity Allocation */}
        <Card
          title="توزیع موجودی در انبارها"
          subtitle="حجم کالای مستقر در هر انبار فیزیکی یا فروشگاه"
        >
          <div className="space-y-4 pt-1">
            {warehouseStockData.length === 0 ? (
              <div className="text-center py-10 text-neutral-400 dark:text-neutral-500 text-xs">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-600 stroke-1" />
                <span>هیچ انباری تعریف نشده است.</span>
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
                      {toPersianDigits(wh.variantsCount)} تنوع فعال
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400">موجودی کالا:</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-[13px]">
                      {toPersianDigits(wh.stockCount)} <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">عدد</span>
                    </span>
                  </div>
                  {canViewFinancials && wh.totalValue > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>ارزش موجودی:</span>
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
