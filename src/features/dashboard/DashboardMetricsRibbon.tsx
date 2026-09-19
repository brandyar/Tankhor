import React from 'react';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { Shirt, ShoppingBag, DollarSign, TrendingUp, AlertTriangle, PackageCheck } from 'lucide-react';
import { Organization } from '../../types';
import { useTranslation } from '../../i18n';

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
  onNavigate?: (route: string) => void;
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
  onNavigate,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {/* 1. Total Products & Catalog */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onNavigate?.('products/all')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate?.('products/all');
          }
        }}
        className="group relative overflow-hidden text-start p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#13151a] hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all shadow-xs cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/60 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-600 dark:group-hover:text-white transition-all">
            <Shirt className="w-6 h-6 transition-colors" />
          </div>
          <span className="caption-mono text-[11px] text-neutral-500 dark:text-neutral-400 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 font-medium">
            {t('dashboard.catalogModels')}
          </span>
        </div>
        <div className="mt-4">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight font-mono">
            {isPersian ? toPersianDigits(totalProducts) : totalProducts}
            <span className="text-xs font-normal text-neutral-400 font-sans ms-1.5">{t('dashboard.modelsCount')}</span>
          </h3>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 font-semibold">
              {isPersian ? toPersianDigits(totalVariants) : totalVariants}
            </span>
            <span>{t('dashboard.colorSizeVariants')}</span>
          </div>
        </div>
      </div>

      {/* 2. Total Stock Units & Value */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onNavigate?.('inventory/movements')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate?.('inventory/movements');
          }
        }}
        className="group relative overflow-hidden text-start p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#13151a] hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-md transition-all shadow-xs cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-100 dark:border-teal-900/60 group-hover:scale-105 group-hover:bg-teal-600 group-hover:text-white dark:group-hover:bg-teal-600 dark:group-hover:text-white transition-all">
            <ShoppingBag className="w-6 h-6 transition-colors" />
          </div>
          <span className="caption-mono text-[11px] text-neutral-500 dark:text-neutral-400 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 font-medium">
            {t('dashboard.totalWarehouseStock')}
          </span>
        </div>
        <div className="mt-4">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight font-mono">
            {isPersian ? toPersianDigits(totalStockCount) : totalStockCount}
            <span className="text-xs font-normal text-neutral-400 font-sans ms-1.5">{t('dashboard.unitsCount')}</span>
          </h3>
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>{t('dashboard.readyForSale')}</span>
          </div>
        </div>
      </div>

      {/* 3. Financial Sales / Revenue (or Orders Count) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onNavigate?.('orders/all')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate?.('orders/all');
          }
        }}
        className="group relative overflow-hidden text-start p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#13151a] hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-md transition-all shadow-xs cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-100 dark:border-sky-900/60 group-hover:scale-105 group-hover:bg-sky-600 group-hover:text-white dark:group-hover:bg-sky-600 dark:group-hover:text-white transition-all">
            {canViewFinancials ? (
              <DollarSign className="w-6 h-6 transition-colors" />
            ) : (
              <TrendingUp className="w-6 h-6 transition-colors" />
            )}
          </div>
          <span className="caption-mono text-[11px] text-neutral-500 dark:text-neutral-400 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 font-medium">
            {canViewFinancials ? t('dashboard.salesTurnover') : t('dashboard.totalOrders')}
          </span>
        </div>
        <div className="mt-4">
          {canViewFinancials ? (
            <>
              <h3
                className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight font-mono truncate"
                title={formatCurrency(totalSalesRevenue, activeOrganization?.currency, isPersian)}
              >
                {formatCurrency(totalSalesRevenue, activeOrganization?.currency, isPersian)}
              </h3>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                <span className="text-neutral-400">{t('dashboard.avgOrder')}</span>
                <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200 text-[11px]">
                  {formatCurrency(averageOrderValue, activeOrganization?.currency, isPersian)}
                </span>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight font-mono">
                {isPersian ? toPersianDigits(totalOrdersCount) : totalOrdersCount}
                <span className="text-xs font-normal text-neutral-400 font-sans ms-1.5">{t('navigation.orders')}</span>
              </h3>
              <div className="mt-2 flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{t('dashboard.activeOrders')}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Stock Health & Alert Indicator */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          const el = document.getElementById('dashboard-stock-alerts');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          } else if (onNavigate) {
            onNavigate('inventory/movements');
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const el = document.getElementById('dashboard-stock-alerts');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            } else if (onNavigate) {
              onNavigate('inventory/movements');
            }
          }
        }}
        className="group relative overflow-hidden text-start p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#13151a] hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all shadow-xs cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/80 dark:border-amber-800/60 group-hover:scale-105 group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-600 dark:group-hover:text-white transition-all">
            <AlertTriangle className="w-6 h-6 transition-colors" />
          </div>
          <span className="caption-mono text-[11px] text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg bg-amber-100/70 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/40 font-medium">
            {t('dashboard.stockAlerts')}
          </span>
        </div>
        <div className="mt-4">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-950 dark:text-amber-100 tracking-tight font-mono">
            {isPersian ? toPersianDigits(lowStockCount + outOfStockCount) : (lowStockCount + outOfStockCount)}
            <span className="text-xs font-normal text-amber-800/80 dark:text-amber-400 font-sans ms-1.5">{t('dashboard.criticalItems')}</span>
          </h3>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-medium font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-500 animate-pulse"></span>
              {isPersian ? toPersianDigits(outOfStockCount) : outOfStockCount} {t('dashboard.outOfStock')}
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium font-mono text-[11px]">
              {isPersian ? toPersianDigits(lowStockCount) : lowStockCount} {t('dashboard.lowStockThreshold')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
