import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toPersianDigits, formatCurrency } from '../../utils/formatters';
import { TopProductMetric } from './dashboardUtils';
import { ProductVariant, Organization } from '../../types';
import {
  AlertTriangle, ArrowUpRight, Plus, RefreshCw, Shirt,
  CheckCircle2, ShoppingCart, ChevronLeft
} from 'lucide-react';

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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Top High Demand / Best Performing Models */}
      <Card
        title="کالاهای پرطرفدار و پرفروش"
        subtitle="مدل‌های دارای بالاترین گردش فروش و تقاضا در فروشگاه"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('products/all')}
            icon={<ChevronLeft className="w-4 h-4" />}
          >
            مشاهده کاتالوگ
          </Button>
        }
      >
        <div className="divide-y divide-neutral-100">
          {topProducts.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 text-xs">
              <Shirt className="w-8 h-8 mx-auto mb-2 text-neutral-300 stroke-1" />
              <span>هنوز محصولی در کاتالوگ ثبت نشده است.</span>
            </div>
          ) : (
            topProducts.map((p, idx) => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {toPersianDigits(idx + 1)}
                  </span>
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.title}
                      className="w-10 h-10 rounded-lg object-cover border border-neutral-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0 border border-neutral-200">
                      <Shirt className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900 text-xs sm:text-sm truncate">
                      {p.title}
                    </p>
                    <p className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                      <span>{p.categoryName}</span>
                      <span>•</span>
                      <span>{toPersianDigits(p.variantsCount)} تنوع رنگ/سایز</span>
                    </p>
                  </div>
                </div>

                <div className="text-end shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-neutral-100 text-neutral-800">
                    {toPersianDigits(p.totalStock)} عدد موجود
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* 2. Urgent Stock Replenishment Needed */}
      <Card
        title="هشدار کسری موجودی و نیاز به شارژ (Low Stock Alert)"
        subtitle="تنوع‌هایی که موجودی فیزیکی آن‌ها به مرز بحرانی (زیر ۵ عدد) رسیده است"
        action={
          canViewPurchasing ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('purchasing/orders')}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              سفارش خرید
            </Button>
          ) : undefined
        }
      >
        <div className="divide-y divide-neutral-100 max-h-[340px] overflow-y-auto custom-scrollbar">
          {lowStockVariants.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="font-bold text-emerald-800">وضعیت موجودی انبار کاملاً ایده‌آل است</p>
              <p className="text-[11px] text-neutral-400 mt-1">هیچ کالایی در وضعیت اتمام یا کسری بحرانی قرار ندارد.</p>
            </div>
          ) : (
            lowStockVariants.slice(0, 6).map((v) => {
              const qty = v.stock_quantity || 0;
              const isOut = qty <= 0;

              return (
                <div key={v.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-neutral-900 text-xs">
                        {v.sku}
                      </span>
                      {isOut ? (
                        <Badge variant="danger">ناموجود</Badge>
                      ) : (
                        <Badge variant="warning">
                          {toPersianDigits(qty)} عدد باقی‌مانده
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-1.5">
                      <span>{v.product_title || 'محصول'}</span>
                      {v.color_name && (
                        <>
                          <span>•</span>
                          <span>رنگ: {v.color_name}</span>
                        </>
                      )}
                      {v.size_name && (
                        <>
                          <span>•</span>
                          <span>سایز: {v.size_name}</span>
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
                        icon={<RefreshCw className="w-3 h-3 text-neutral-600" />}
                      >
                        ورود به انبار
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};
