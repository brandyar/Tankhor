import React from 'react';
import { Card } from '../../components/ui/Card';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { ShoppingBag, Shirt, DollarSign, AlertTriangle, TrendingUp, ArrowUpRight, PackageCheck } from 'lucide-react';
import { Organization } from '../../types';

interface DashboardMetricsRibbonProps {
  totalProducts: number;
  totalVariants: number;
  totalStockCount: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalOrdersCount: number;
  totalSalesRevenue: number;
  averageOrderValue: number;
  canViewFinancials: boolean;
  activeOrganization: Organization | null;
  isPersian: boolean;
}

export const DashboardMetricsRibbon: React.FC<DashboardMetricsRibbonProps> = ({
  totalProducts,
  totalVariants,
  totalStockCount,
  totalValue,
  lowStockCount,
  outOfStockCount,
  totalOrdersCount,
  totalSalesRevenue,
  averageOrderValue,
  canViewFinancials,
  activeOrganization,
  isPersian,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {/* 1. Total Products & Catalog */}
      <Card className="hover:border-neutral-300 transition-all shadow-xs group">
        <div className="flex items-start justify-between">
          <div>
            <p className="caption-mono text-neutral-500">کاتالوگ و مدل‌ها</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
              {toPersianDigits(totalProducts)}
              <span className="text-xs font-normal text-neutral-400 font-sans ms-1.5">مدل کالا</span>
            </h3>
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 font-mono text-[11px] text-neutral-800 font-semibold">
                {toPersianDigits(totalVariants)}
              </span>
              <span>تنوع رنگ و سایز</span>
            </div>
          </div>
          <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center border border-neutral-200/80 group-hover:scale-105 transition-transform">
            <Shirt className="w-5 h-5" />
          </div>
        </div>
      </Card>

      {/* 2. Total Stock Units & Value */}
      <Card className="hover:border-neutral-300 transition-all shadow-xs group">
        <div className="flex items-start justify-between">
          <div>
            <p className="caption-mono text-neutral-500">موجودی کل انبار</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
              {toPersianDigits(totalStockCount)}
              <span className="text-xs font-normal text-neutral-400 font-sans ms-1.5">عدد کالا</span>
            </h3>
            <div className="mt-2.5 flex items-center gap-1 text-xs text-emerald-700 font-medium">
              <PackageCheck className="w-3.5 h-3.5" />
              <span>موجود و آماده فروش در انبار</span>
            </div>
          </div>
          <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center border border-neutral-200/80 group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>
      </Card>

      {/* 3. Financial Sales / Revenue (or Orders Count for warehouse/viewer) */}
      {canViewFinancials ? (
        <Card className="hover:border-neutral-300 transition-all shadow-xs group">
          <div className="flex items-start justify-between">
            <div>
              <p className="caption-mono text-neutral-500">فروش و گردش ریالی</p>
              <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono truncate max-w-[200px]" title={formatCurrency(totalSalesRevenue, activeOrganization?.currency, isPersian)}>
                {formatCurrency(totalSalesRevenue, activeOrganization?.currency, isPersian)}
              </h3>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-neutral-600">
                <span className="text-neutral-400">میانگین فاکتور:</span>
                <span className="font-mono font-bold text-neutral-800 text-[11px]">
                  {formatCurrency(averageOrderValue, activeOrganization?.currency, isPersian)}
                </span>
              </div>
            </div>
            <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center border border-neutral-200/80 group-hover:scale-105 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>
      ) : (
        <Card className="hover:border-neutral-300 transition-all shadow-xs group">
          <div className="flex items-start justify-between">
            <div>
              <p className="caption-mono text-neutral-500">تعداد کل فاکتورها</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                {toPersianDigits(totalOrdersCount)}
                <span className="text-xs font-normal text-neutral-400 font-sans ms-1.5">سفارش</span>
              </h3>
              <div className="mt-2.5 flex items-center gap-1 text-xs text-blue-700">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>ثبت سفارشات فعال</span>
              </div>
            </div>
            <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center border border-neutral-200/80 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
        </Card>
      )}

      {/* 4. Stock Health & Alert Indicator */}
      <Card className="hover:border-amber-300 transition-all shadow-xs group bg-gradient-to-br from-white to-amber-50/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="caption-mono text-amber-900">هشدارهای موجودی</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-950 tracking-tight mt-2 font-mono">
              {toPersianDigits(lowStockCount + outOfStockCount)}
              <span className="text-xs font-normal text-amber-800/80 font-sans ms-1.5">مورد بحرانی</span>
            </h3>
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-rose-700 font-medium font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                {toPersianDigits(outOfStockCount)} ناموجود
              </span>
              <span className="text-neutral-300">|</span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-medium font-mono text-[11px]">
                {toPersianDigits(lowStockCount)} در مرز کسری
              </span>
            </div>
          </div>
          <div className="w-11 h-11 bg-amber-50 text-amber-800 rounded-xl flex items-center justify-center border border-amber-200/80 group-hover:scale-105 transition-transform shadow-2xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </Card>
    </div>
  );
};
