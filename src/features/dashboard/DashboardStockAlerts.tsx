import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toPersianDigits, formatCurrency } from '../../utils/formatters';
import { TopProductMetric } from './dashboardUtils';
import { ProductVariant, Organization } from '../../types';
import { ProductImage } from '../../components/ui/ProductImage';
import {
  AlertTriangle, ArrowUpRight, Plus, RefreshCw, Shirt,
  CheckCircle2, ShoppingCart, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useTranslation } from '../../i18n';

interface DashboardStockAlertsProps {
  topProducts: TopProductMetric[];
  lowStockVariants: ProductVariant[];
  onNavigate: (route: string) => void;
  canManageInventory: boolean;
  canCreateOrders: boolean;
  canViewPurchasing: boolean;
  activeOrganization: Organization | null;
  isPersian: boolean;
}

export const DashboardStockAlerts: React.FC<DashboardStockAlertsProps> = ({
  topProducts,
  lowStockVariants,
  onNavigate,
  canManageInventory,
  canCreateOrders,
  canViewPurchasing,
  activeOrganization,
  isPersian,
}) => {
  const { t, isRtl } = useTranslation();

  return (
    <div id="dashboard-stock-alerts" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 scroll-mt-6">
      {/* 1. Top High Demand / Best Performing Models */}
      <Card
        title={t('dashboard.topSellingModels')}
        subtitle={t('dashboard.topSellingSubtitle')}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('products/all')}
            icon={isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          >
            {t('dashboard.viewCatalog')}
          </Button>
        }
      >
        {topProducts.length === 0 ? (
          <div className="py-8 text-center text-neutral-400 dark:text-neutral-500 text-xs">
            <Shirt className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-600 stroke-1" />
            <span>{t('dashboard.noProductsInCatalog')}</span>
          </div>
        ) : (
          <>
            {/* Desktop Row-by-Row List */}
            <div className="hidden sm:block divide-y divide-neutral-100 dark:divide-neutral-800">
              {topProducts.map((p, idx) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {isPersian ? toPersianDigits(idx + 1) : (idx + 1)}
                    </span>
                    <ProductImage
                      src={p.image}
                      alt={p.title}
                      fallbackText={p.title}
                      containerClassName="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700 shadow-2xs"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm truncate">
                        {p.title}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-2 mt-0.5">
                        <span>{p.categoryName}</span>
                        <span>•</span>
                        <span>{isPersian ? toPersianDigits(p.variantsCount) : p.variantsCount} {t('dashboard.colorSizeVariants')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/50 dark:border-neutral-700/50">
                      {isPersian ? toPersianDigits(p.totalStock) : p.totalStock} {t('dashboard.unitsInStock')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Cards List */}
            <div className="block sm:hidden space-y-2.5">
              {topProducts.map((p, idx) => (
                <div
                  key={`mob_top_${p.id}`}
                  className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      {isPersian ? toPersianDigits(idx + 1) : (idx + 1)}
                    </span>
                    <ProductImage
                      src={p.image}
                      alt={p.title}
                      fallbackText={p.title}
                      containerClassName="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700 shadow-2xs"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-neutral-900 dark:text-neutral-100 text-xs truncate">
                        {p.title}
                      </p>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                        {p.categoryName} • {isPersian ? toPersianDigits(p.variantsCount) : p.variantsCount} تنوع
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-end">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700">
                      {isPersian ? toPersianDigits(p.totalStock) : p.totalStock} {t('dashboard.unitsCount')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* 2. Urgent Stock Replenishment Needed */}
      <Card
        title={t('dashboard.replenishmentAlert')}
        subtitle={t('dashboard.replenishmentSubtitle')}
        action={
          canViewPurchasing ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('purchasing/orders')}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              {t('dashboard.createPurchaseOrder')}
            </Button>
          ) : undefined
        }
      >
        {lowStockVariants.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-200 dark:border-emerald-800/50">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="font-bold text-emerald-800 dark:text-emerald-300">{t('dashboard.idealStockStatus')}</p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{t('dashboard.idealStockSubtitle')}</p>
          </div>
        ) : (
          <>
            {/* Desktop Row-by-Row List */}
            <div className="hidden sm:block divide-y divide-neutral-100 dark:divide-neutral-800 max-h-[340px] overflow-y-auto custom-scrollbar">
              {lowStockVariants.slice(0, 6).map((v) => {
                const qty = v.stock_quantity || 0;
                const isOut = qty <= 0;

                return (
                  <div key={v.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                          {v.sku}
                        </span>
                        {isOut ? (
                          <Badge variant="danger">{t('dashboard.outOfStock')}</Badge>
                        ) : (
                          <Badge variant="warning">
                            {isPersian ? toPersianDigits(qty) : qty} {t('dashboard.unitsRemaining')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1.5">
                        <span>{v.product_title || t('products.product')}</span>
                        {v.color_name && (
                          <>
                            <span>•</span>
                            <span>{t('products.color')}: {v.color_name}</span>
                          </>
                        )}
                        {v.size_name && (
                          <>
                            <span>•</span>
                            <span>{t('products.size')}: {v.size_name}</span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canManageInventory && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[11px] h-7 px-2"
                          onClick={() => onNavigate('inventory/movements')}
                          icon={<RefreshCw className="w-3 h-3 text-neutral-600 dark:text-neutral-400" />}
                        >
                          {t('dashboard.stockInAction')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Cards List */}
            <div className="block sm:hidden space-y-2.5">
              {lowStockVariants.slice(0, 6).map((v) => {
                const qty = v.stock_quantity || 0;
                const isOut = qty <= 0;

                return (
                  <div
                    key={`mob_low_${v.id}`}
                    className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                          {v.sku}
                        </span>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {v.product_title || t('products.product')}
                          {v.color_name ? ` • ${v.color_name}` : ''}
                          {v.size_name ? ` • ${v.size_name}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isOut ? (
                          <Badge variant="danger">{t('dashboard.outOfStock')}</Badge>
                        ) : (
                          <Badge variant="warning">
                            {isPersian ? toPersianDigits(qty) : qty} {t('dashboard.unitsRemaining')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {canManageInventory && (
                      <div className="pt-1 border-t border-neutral-200/60 dark:border-neutral-800 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[11px] h-7 px-2.5"
                          onClick={() => onNavigate('inventory/movements')}
                          icon={<RefreshCw className="w-3 h-3 text-neutral-600 dark:text-neutral-400" />}
                        >
                          {t('dashboard.stockInAction')}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
