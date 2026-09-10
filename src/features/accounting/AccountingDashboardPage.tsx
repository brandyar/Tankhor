import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { ProfitLossSummary, Expense, PersonTransaction } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatPersianDate, toPersianDigits } from '../../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  ShoppingBag,
  Truck,
  Layers,
  FileSpreadsheet,
  Scale,
  FileText,
} from 'lucide-react';

interface AccountingDashboardPageProps {
  onNavigateSubRoute?: (subRoute: string) => void;
  onOpenNewExpense?: () => void;
  onOpenNewTransaction?: () => void;
}

export const AccountingDashboardPage: React.FC<AccountingDashboardPageProps> = ({
  onNavigateSubRoute,
  onOpenNewExpense,
  onOpenNewTransaction,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ProfitLossSummary | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<PersonTransaction[]>([]);
  const [period, setPeriod] = useState<'all' | 'month' | 'year'>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const adapter = storageManager.getAdapter();
      const pnl = await adapter.getProfitLossSummary({ period });
      const exps = await adapter.getExpenses({ limit: 5 });
      const txs = await adapter.getPersonTransactions({ limit: 5 });

      setSummary(pnl);
      setRecentExpenses(exps);
      setRecentTransactions(txs);
    } catch (err) {
      console.error('[AccountingDashboard] Error loading financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const isNetProfitable = (summary?.net_profit || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Top Action & Period Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900/80 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t('accounting.periodAll')}:
          </span>
          <div className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1">
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                period === 'all'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {t('accounting.periodAll')}
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                period === 'month'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {t('accounting.periodThisMonth')}
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                period === 'year'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {t('accounting.periodThisYear')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenNewExpense && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenNewExpense}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              {t('accounting.newExpense')}
            </Button>
          )}
          {onOpenNewTransaction && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenNewTransaction}
              icon={<Wallet className="w-3.5 h-3.5" />}
            >
              {t('accounting.newTransaction')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            title={t('common.refresh')}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          />
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Revenue */}
        <Card className="p-4 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('accounting.totalRevenue')}
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              {loading ? '...' : formatCurrency(summary?.total_revenue || 0)}
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              مجموع فاکتورهای فروش قطعی
            </p>
          </div>
        </Card>

        {/* 2. COGS (بهای تمام‌شده) */}
        <Card className="p-4 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('accounting.totalCogs')}
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              {loading ? '...' : formatCurrency(summary?.total_cogs || 0)}
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              بهای خرید کالاهای فروخته‌شده
            </p>
          </div>
        </Card>

        {/* 3. Operating Expenses */}
        <Card className="p-4 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('accounting.totalExpenses')}
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">
              {loading ? '...' : formatCurrency(summary?.total_expenses || 0)}
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              هزینه‌های جاری، اجاره، حقوق و تنخواه
            </p>
          </div>
        </Card>

        {/* 4. Net Operating Profit */}
        <Card className={`p-4 border ${
          isNetProfitable
            ? 'border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10'
            : 'border-rose-200/80 dark:border-rose-800/60 bg-rose-50/20 dark:bg-rose-950/10'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('accounting.netProfit')}
            </span>
            <div className={`p-2 rounded-lg border ${
              isNetProfitable
                ? 'bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-700/50'
                : 'bg-rose-100/60 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-300/60 dark:border-rose-700/50'
            }`}>
              {isNetProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className={`text-lg font-bold ${
                isNetProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {loading ? '...' : formatCurrency(summary?.net_profit || 0)}
              </h3>
              <Badge variant={isNetProfitable ? 'success' : 'error'}>
                {toPersianDigits(summary?.net_margin_percentage?.toFixed(1) || 0)}%
              </Badge>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              سود ناخالص: {formatCurrency(summary?.gross_profit || 0)}
            </p>
          </div>
        </Card>
      </div>

      {/* Secondary Balance Sheet KPIs: Receivables vs Payables */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Receivables (مطالبات از مشتریان) */}
        <Card className="p-4 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('accounting.receivables')}
            </span>
            <h4 className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {loading ? '...' : formatCurrency(summary?.total_receivables || 0)}
            </h4>
            <span className="text-[10px] text-neutral-400">مانده بدهکاری مشتریان به سازمان</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/50">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </Card>

        {/* Payables (بدهی به تامین‌کنندگان) */}
        <Card className="p-4 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('accounting.payables')}
            </span>
            <h4 className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1">
              {loading ? '...' : formatCurrency(summary?.total_payables || 0)}
            </h4>
            <span className="text-[10px] text-neutral-400">مانده بستانکاری تامین‌کنندگان از سازمان</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200/50">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </Card>

        {/* Net Working Capital */}
        <Card className="p-4 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('accounting.netWorkingCapital')}
            </span>
            <h4 className="text-base font-bold text-neutral-900 dark:text-white mt-1">
              {loading
                ? '...'
                : formatCurrency((summary?.total_receivables || 0) - (summary?.total_payables || 0))}
            </h4>
            <span className="text-[10px] text-neutral-400">خالص مطالبات منهای تعهدات</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200/50">
            <Wallet className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Expense Categories Breakdown & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Expenses Breakdown */}
        <Card className="p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-neutral-500" />
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('accounting.topExpenseCategories')}
                </h4>
              </div>
              {onNavigateSubRoute && (
                <button
                  onClick={() => onNavigateSubRoute('accounting/expenses')}
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  مشاهده همه
                </button>
              )}
            </div>

            {summary?.expenses_by_category && summary.expenses_by_category.length > 0 ? (
              <div className="space-y-3">
                {summary.expenses_by_category.map((cat, idx) => {
                  const totalExp = summary.total_expenses || 1;
                  const percentage = Math.min(100, Math.round((cat.amount / totalExp) * 100));

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {cat.category_title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900 dark:text-white font-mono">
                            {formatCurrency(cat.amount)}
                          </span>
                          <span className="text-neutral-400 text-[10px]">
                            ({toPersianDigits(percentage)}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-neutral-900 dark:bg-neutral-100 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-400">
                {t('accounting.noExpenses')}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-500">مجموع کل هزینه‌ها</span>
            <span className="font-bold text-neutral-900 dark:text-white font-mono">
              {formatCurrency(summary?.total_expenses || 0)}
            </span>
          </div>
        </Card>

        {/* Recent Financial Transactions / Person Ledger Entries */}
        <Card className="p-5 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-500" />
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('accounting.recentTransactions')}
                </h4>
              </div>
              {onNavigateSubRoute && (
                <button
                  onClick={() => onNavigateSubRoute('accounting/persons')}
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  دفاتر معین
                </button>
              )}
            </div>

            {recentTransactions.length > 0 ? (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {recentTransactions.map((tx) => {
                  const isReceive = tx.transaction_type === 'receive_money';
                  const isPay = tx.transaction_type === 'pay_money';

                  return (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md ${
                          isReceive
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30'
                            : isPay
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-950/30'
                        }`}>
                          {isReceive ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            {tx.party_name || 'طرف‌حساب نامشخص'}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            {tx.description || (isReceive ? 'دریافت وجه' : 'پرداخت وجه')}
                          </p>
                        </div>
                      </div>

                      <div className="text-end">
                        <span className={`font-bold font-mono ${
                          isReceive ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-white'
                        }`}>
                          {isReceive ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <p className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                          {formatPersianDate(tx.transaction_date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-400">
                {t('accounting.noTransactions')}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            {onOpenNewTransaction && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center"
                onClick={onOpenNewTransaction}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                {t('accounting.newTransaction')}
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Phase 3: Advanced Modules Quick Links */}
      {onNavigateSubRoute && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <Card
            onClick={() => onNavigateSubRoute('accounting/landed-costs')}
            className="p-4 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {t('navigation.landedCosts')}
                </h4>
                <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                  تسهیم کرایه حمل و ترخیص بر اقلام فاکتور خرید
                </p>
              </div>
            </div>
          </Card>

          <Card
            onClick={() => onNavigateSubRoute('accounting/tax')}
            className="p-4 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {t('navigation.taxReports')}
                </h4>
                <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                  محاسبه ارزش افزوده فصلی و اعتبار مالیاتی
                </p>
              </div>
            </div>
          </Card>

          <Card
            onClick={() => onNavigateSubRoute('accounting/export')}
            className="p-4 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {t('navigation.accountingExport')}
                </h4>
                <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                  خروجی اکسل سامانه مودیان، سپیدار و هلو
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
