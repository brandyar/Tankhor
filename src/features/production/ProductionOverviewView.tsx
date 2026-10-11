import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { RawMaterial, ProductionOrder, Contractor } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import {
  Scissors,
  Boxes,
  FileText,
  Users,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Shirt,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface ProductionOverviewProps {
  onNavigateSubRoute: (subRoute: string) => void;
}

export const ProductionOverviewView: React.FC<ProductionOverviewProps> = ({
  onNavigateSubRoute,
}) => {
  const { t, isPersian } = useTranslation();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mats, ords, ctrs] = await Promise.all([
        storageManager.getRawMaterials(),
        storageManager.getProductionOrders(),
        storageManager.getContractors(),
      ]);
      setMaterials(mats || []);
      setOrders(ords || []);
      setContractors(ctrs || []);
    } catch (err) {
      console.error('Error loading production overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeOrders = orders.filter((o) => o.status === 'cutting' || o.status === 'in_progress');
  const lowStockMaterials = materials.filter(
    (m) => m.min_stock !== undefined && m.min_stock !== null && m.current_stock <= (m.min_stock || 0)
  );
  const totalContractorBalance = contractors.reduce((sum, c) => sum + (c.current_balance || 0), 0);
  const totalProductionUnits = orders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + (o.total_quantity || 0), 0);

  const formatNum = (num: number) => (isPersian ? toPersianDigits(num) : num.toString());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">پیش‌نویس</span>;
      case 'cutting':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">در حال برش</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">در حال دوخت / برون‌سپاری</span>;
      case 'qc':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">کنترل کیفیت</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">تکمیل‌شده</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">لغوشده</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 text-neutral-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="پیشخوان و آمار تولید"
        subtitle="خلاصه وضعیت سفارشات در حال ساخت، موجودی متریال و بدهکاری پیمانکاران"
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Production Orders */}
        <Card className="p-4 flex items-center gap-4 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800/50 shrink-0">
            <Scissors className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate">دستورکارهای فعال</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-white font-mono">
                {formatNum(activeOrders.length)}
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">سفارش در جریان</span>
            </div>
          </div>
        </Card>

        {/* Low Stock Materials Alert */}
        <Card className="p-4 flex items-center gap-4 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/50 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate">کسری متریال و خرج‌کار</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">
                {formatNum(lowStockMaterials.length)}
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">آیتم زیر نقطه سفارش</span>
            </div>
          </div>
        </Card>

        {/* Total Contractor Ledger Balance */}
        <Card className="p-4 flex items-center gap-4 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800/50 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate">طلب پیمانکاران (مزد‌دوز)</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-neutral-900 dark:text-white font-mono">
                {formatCurrency(totalContractorBalance)}
              </span>
            </div>
          </div>
        </Card>

        {/* Total Completed Garments */}
        <Card className="p-4 flex items-center gap-4 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/50 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate">تولید تکمیل‌شده</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatNum(totalProductionUnits)}
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">عدد پوشاک</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions & Navigation Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          onClick={() => onNavigateSubRoute('production/orders')}
          className="p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Scissors className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-amber-600 dark:text-amber-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white mt-4">ثبت دستور کار جدید (حواله برش)</h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            تعیین تیراژ تولید، کسر خودکار متریال بر اساس BOM و برون‌سپاری به خیاط
          </p>
        </Card>

        <Card
          onClick={() => onNavigateSubRoute('production/materials')}
          className="p-5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent hover:border-blue-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Boxes className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white mt-4">مدیریت پارچه و خرج‌کار</h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            ورود متریال به انبار، تعریف فی متریال، نخ، زیپ، دکمه، لایی و کاور
          </p>
        </Card>

        <Card
          onClick={() => onNavigateSubRoute('production/boms')}
          className="p-5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent hover:border-emerald-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white mt-4">تعریف فرمول ساخت (BOM)</h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            شناسنامه الگوی تولید هر محصول همراه با درصد ضایعات و محاسبه تخمینی بهای تمام‌شده
          </p>
        </Card>
      </div>

      {/* Recent Production Orders Table */}
      <Card className="p-5 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">آخرین دستورکارهای تولید</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateSubRoute('production/orders')}
            className="text-xs"
          >
            مشاهده همه دستورکارها »
          </Button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-neutral-400">در حال بارگذاری اطلاعات...</div>
        ) : orders.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
            <p className="text-xs text-neutral-500">هیچ دستور کار تولیدی ثبت نشده است.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateSubRoute('production/orders')}
              className="mt-3 text-xs"
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              ایجاد اولین دستور کار
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold">
                <tr>
                  <th className="px-3 py-2 text-start">شماره دستورکار</th>
                  <th className="px-3 py-2 text-start">محصول</th>
                  <th className="px-3 py-2 text-center">تیراژ (عدد)</th>
                  <th className="px-3 py-2 text-center">وضعیت</th>
                  <th className="px-3 py-2 text-end">بهای تمام‌شده تخمینی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {orders.slice(0, 5).map((ord) => (
                  <tr key={`recent_ord_${ord.id}`} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40">
                    <td className="px-3 py-2.5 font-mono font-bold text-neutral-900 dark:text-white">
                      {ord.order_number}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-neutral-800 dark:text-neutral-200">
                      {ord.product_name || `محصول کد ${ord.product_id}`}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-neutral-900 dark:text-white font-mono">
                      {formatNum(ord.total_quantity)}
                    </td>
                    <td className="px-3 py-2.5 text-center">{getStatusBadge(ord.status)}</td>
                    <td className="px-3 py-2.5 text-end font-mono font-bold text-neutral-900 dark:text-white">
                      {formatCurrency((ord.estimated_unit_cost || 0) * ord.total_quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
