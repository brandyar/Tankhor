import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatCurrency, formatDate, toPersianDigits } from '../../utils/formatters';
import {
  ShoppingBag, Shirt, DollarSign, AlertTriangle,
  Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, CheckCircle2
} from 'lucide-react';
import { Product, ProductVariant, InventoryMovement, Order } from '../../types';

interface DashboardViewProps {
  onNavigate: (route: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isPersian = locale === 'fa';

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const adapter = storageManager.getAdapter();
        const orgId = activeOrganization?.id;

        const [pList, vList, mList, oList] = await Promise.all([
          adapter.getProducts({ organization_id: orgId }),
          adapter.getVariants({ organization_id: orgId }),
          adapter.getInventoryMovements({ organization_id: orgId }),
          adapter.getOrders({ organization_id: orgId }),
        ]);

        setProducts(pList);
        setVariants(vList);
        setMovements(mList);
        setOrders(oList);
      } catch (err) {
        console.error('[DashboardData] Error loading metrics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [activeOrganization]);

  // Calculations
  const totalStockCount = variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
  const totalValue = variants.reduce((acc, v) => acc + (v.stock_quantity || 0) * (v.price || 0), 0);
  const lowStockCount = variants.filter((v) => (v.stock_quantity || 0) <= 5).length;

  const movementColumns: Column<InventoryMovement>[] = [
    {
      key: 'created_at',
      header: t('common.date'),
      render: (m) => <span className="text-slate-500 font-mono text-[11px]">{formatDate(m.created_at, isPersian)}</span>,
    },
    {
      key: 'sku',
      header: t('common.sku'),
      render: (m) => <span className="font-bold text-slate-800">{m.sku || 'TNK-SKU'}</span>,
    },
    {
      key: 'type',
      header: 'نوع گردش',
      render: (m) => {
        const isIn = m.type === 'purchase' || m.type === 'transfer_in' || m.type === 'return';
        return (
          <Badge variant={isIn ? 'success' : 'danger'}>
            <span className="flex items-center gap-1">
              {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
              {m.type === 'purchase' ? 'ورود خرید' : m.type === 'sale' ? 'خروج فروش' : m.type}
            </span>
          </Badge>
        );
      },
    },
    {
      key: 'quantity',
      header: 'تعداد',
      render: (m) => (
        <span className="font-bold text-slate-900">
          {toPersianDigits(m.quantity)} عدد
        </span>
      ),
    },
    {
      key: 'reference_id',
      header: 'مرجع',
      render: (m) => <span className="text-slate-500">{m.reference_id || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Vercel Ambient Hero Banner */}
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
                TANKHOR PLATFORM v1.0
              </span>
              <span className="font-mono text-[11px] text-neutral-500">
                {activeOrganization?.name || 'سازمان پیش‌فرض'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
              {t('dashboard.welcomeMessage')}.
            </h1>
            <p className="text-sm text-neutral-600 leading-relaxed">
              {t('dashboard.overviewSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => onNavigate('products/all')}
              icon={<Plus className="w-4 h-4" />}
            >
              {t('dashboard.addProduct')}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="caption-mono">{t('dashboard.totalProducts')}</p>
              <h3 className="text-3xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                {toPersianDigits(products.length)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-neutral-100 text-neutral-900 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="caption-mono">{t('dashboard.totalVariants')}</p>
              <h3 className="text-3xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                {toPersianDigits(variants.length)}{' '}
                <span className="text-xs font-mono font-normal text-neutral-400">({toPersianDigits(totalStockCount)})</span>
              </h3>
            </div>
            <div className="w-10 h-10 bg-neutral-100 text-neutral-900 rounded-lg flex items-center justify-center">
              <Shirt className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="caption-mono">{t('dashboard.totalStockValue')}</p>
              <h3 className="text-2xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                {formatCurrency(totalValue, activeOrganization?.currency, isPersian)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-neutral-100 text-neutral-900 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="caption-mono">{t('dashboard.lowStockItems')}</p>
              <h3 className="text-3xl font-extrabold text-neutral-900 tracking-tight mt-2 font-mono">
                {toPersianDigits(lowStockCount)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-amber-50 text-amber-800 rounded-lg flex items-center justify-center border border-amber-200/80">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Row: Recent Movements & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Movements Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title={t('dashboard.recentMovements')}
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
              data={movements.slice(0, 5)}
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
              <Button
                variant="secondary"
                className="w-full justify-start text-xs font-medium"
                onClick={() => onNavigate('products/all')}
                icon={<Plus className="w-4 h-4 text-neutral-700" />}
              >
                {t('dashboard.addProduct')}
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start text-xs font-medium"
                onClick={() => onNavigate('orders/create')}
                icon={<Plus className="w-4 h-4 text-neutral-700" />}
              >
                {t('dashboard.newOrder')}
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start text-xs font-medium"
                onClick={() => onNavigate('inventory/movements')}
                icon={<RefreshCw className="w-4 h-4 text-neutral-700" />}
              >
                {t('dashboard.newMovement')}
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start text-xs font-medium"
                onClick={() => onNavigate('products/size-guides')}
                icon={<Shirt className="w-4 h-4 text-neutral-700" />}
              >
                {t('dashboard.sizeGuideTemplate')}
              </Button>
            </div>
          </Card>

          <Card title={t('dashboard.systemStatus')}>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-bold">{t('dashboard.offlineReady')}</p>
                  <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                    تمامی اطلاعات روی دستگاه محلی شما نگهداری شده و بدون نیاز به اینترنت سریعاً ذخیره می‌شود.
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
