import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n';
import { PosShift, Organization } from '../../../types';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import {
  Clock,
  Printer,
  Info,
  User,
  Building2,
  Wallet,
  Receipt,
  Banknote,
  CreditCard,
  ShoppingBag,
  StopCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface PosShiftActiveViewProps {
  displayedShift: PosShift;
  myOpenShift: PosShift | null;
  user: any;
  activeOrganization: Organization | null;
  hasAccounting: boolean;
  onPrintZReport: (shift: PosShift) => void;
  onCloseShift: (params: {
    closingBalance: number;
    closingNotes: string;
    isOtherCashierShift: boolean;
  }) => Promise<void>;
}

export const PosShiftActiveView: React.FC<PosShiftActiveViewProps> = ({
  displayedShift,
  myOpenShift,
  user,
  activeOrganization,
  hasAccounting,
  onPrintZReport,
  onCloseShift,
}) => {
  const { locale } = useTranslation();
  const isPersian = locale === 'fa';

  const [closingBalance, setClosingBalance] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expectedCash = useMemo(() => {
    const opening = Number(displayedShift.opening_balance) || 0;
    const cashSales = Number(displayedShift.total_cash_amount) || 0;
    return opening + cashSales;
  }, [displayedShift]);

  const countedCash = parseFloat(closingBalance.replace(/,/g, '')) || 0;
  const cashDiscrepancy = countedCash - expectedCash;

  const handleSubmitClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (closingBalance.trim() === '') {
      alert(
        isPersian
          ? 'لطفاً موجودی نقد شمارش شده پایان شیفت را وارد کنید.'
          : 'Please enter counted cash balance.'
      );
      return;
    }

    const cleanClosing = parseFloat(closingBalance.replace(/,/g, '')) || 0;
    const isOtherCashierShift = displayedShift.id !== myOpenShift?.id;
    const confirmMsg = isPersian
      ? `آیا از بستن شیفت صندوق #${displayedShift.id} (${
          displayedShift.user_name || displayedShift.user_email || 'صندوق‌دار'
        })${isOtherCashierShift ? ' به عنوان مدیر' : ''} با موجودی شمارش شده ${formatCurrency(
          cleanClosing,
          activeOrganization?.currency || 'TOMAN'
        )} اطمینان دارید؟`
      : `Are you sure you want to close shift #${displayedShift.id} with counted balance of ${formatCurrency(
          cleanClosing,
          activeOrganization?.currency || 'TOMAN'
        )}?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      await onCloseShift({
        closingBalance: cleanClosing,
        closingNotes,
        isOtherCashierShift,
      });
    } catch (err: any) {
      alert(
        isPersian ? `خطا در بستن شیفت: ${err.message}` : `Error closing shift: ${err.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Status Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/20 border border-emerald-500/30 dark:border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                {isPersian
                  ? `شیفت باز #${displayedShift.id}`
                  : `Open Shift #${displayedShift.id}`}
              </h4>
              <Badge variant="success">
                {isPersian ? 'درحال ثبت فروش' : 'Active'}
              </Badge>
              {displayedShift.id !== myOpenShift?.id && (
                <Badge variant="neutral">
                  {isPersian ? 'شیفت همکار (مشاهده مدیریتی)' : 'Colleague Shift'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {isPersian ? 'شروع شده در:' : 'Opened at:'}{' '}
              <span className="font-mono">{formatDate(displayedShift.opened_at || '')}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPrintZReport(displayedShift)}
            icon={<Printer className="w-3.5 h-3.5" />}
          >
            {isPersian ? 'پیش‌نمایش گزارش ژورنال' : 'Preview Z-Report'}
          </Button>
        </div>
      </div>

      {/* Notice when manager is inspecting another cashier's shift */}
      {displayedShift.id !== myOpenShift?.id && (
        <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="leading-relaxed">
            <span className="font-bold">
              {isPersian ? 'توجه مدیریتی:' : 'Management Note:'}
            </span>{' '}
            {isPersian
              ? `شما در حال بررسی عملکرد زنده شیفت صندوق‌دار «${
                  displayedShift.user_name || displayedShift.user_email
                }» هستید. فروش‌های جدید شما در صورت افتتاح شیفت اختصاصی در شیفت خودتان ثبت خواهند شد.`
              : `Viewing live metrics for cashier ${
                  displayedShift.user_name || displayedShift.user_email
                }.`}
          </div>
        </div>
      )}

      {/* Shift Assigned Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mb-1">
            <User className="w-3.5 h-3.5 text-indigo-500" />
            <span>{isPersian ? 'صندوق‌دار متصل به این شیفت' : 'Cashier'}</span>
          </div>
          <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
            {displayedShift.user_name ||
              displayedShift.user_email ||
              user?.email ||
              'کاربر سیستم'}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mb-1">
            <Building2 className="w-3.5 h-3.5 text-purple-500" />
            <span>{isPersian ? 'انبار / شعبه' : 'Warehouse'}</span>
          </div>
          <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
            {displayedShift.warehouse_name || (isPersian ? 'همه انبارها' : 'All Warehouses')}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mb-1">
            <Wallet className="w-3.5 h-3.5 text-amber-500" />
            <span>{isPersian ? 'صندوق / حساب مالی' : 'Cashbox / Account'}</span>
          </div>
          <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
            {displayedShift.account_name ||
              (hasAccounting
                ? isPersian
                  ? 'پیش‌فرض سیستم'
                  : 'Default'
                : isPersian
                ? 'غیرفعال (بدون ماژول)'
                : 'Disabled')}
          </div>
        </div>
      </div>

      {/* Real-time Sales Summary Grid */}
      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#14161d] border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-500" />
            <span>
              {isPersian ? 'عملکرد فروش زنده در طول این شیفت' : 'Live Sales Breakdown'}
            </span>
          </h5>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-bold">
            {displayedShift.total_orders_count || 0} {isPersian ? 'سفارش ثبت شده' : 'Orders'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-0.5">
              {isPersian ? 'موجودی اولیه (نقد)' : 'Opening Balance'}
            </span>
            <span className="text-xs font-black text-neutral-900 dark:text-neutral-100 font-mono">
              {formatCurrency(
                Number(displayedShift.opening_balance) || 0,
                activeOrganization?.currency || 'TOMAN'
              )}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mb-0.5 flex items-center gap-1">
              <Banknote className="w-3 h-3" />
              <span>{isPersian ? 'فروش نقدی' : 'Cash Sales'}</span>
            </span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(
                Number(displayedShift.total_cash_amount) || 0,
                activeOrganization?.currency || 'TOMAN'
              )}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
            <span className="text-[10px] text-blue-600 dark:text-blue-400 block mb-0.5 flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              <span>{isPersian ? 'فروش کارتخوان (POS)' : 'POS Sales'}</span>
            </span>
            <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
              {formatCurrency(
                Number(displayedShift.total_pos_amount) || 0,
                activeOrganization?.currency || 'TOMAN'
              )}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
            <span className="text-[10px] text-purple-600 dark:text-purple-400 block mb-0.5 flex items-center gap-1">
              <ShoppingBag className="w-3 h-3" />
              <span>{isPersian ? 'مجموع کل فروش' : 'Total Sales'}</span>
            </span>
            <span className="text-xs font-black text-purple-600 dark:text-purple-400 font-mono">
              {formatCurrency(
                Number(displayedShift.total_sales_amount) || 0,
                activeOrganization?.currency || 'TOMAN'
              )}
            </span>
          </div>
        </div>

        {/* Expected Cash in drawer */}
        <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold text-neutral-800 dark:text-neutral-200">
              {isPersian
                ? 'موجودی نقد مورد انتظار در کشوی صندوق:'
                : 'Expected Cash in Drawer:'}
            </span>
          </div>
          <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 font-mono">
            {formatCurrency(expectedCash, activeOrganization?.currency || 'TOMAN')}
          </span>
        </div>
      </div>

      {/* Close Shift Form */}
      <form
        onSubmit={handleSubmitClose}
        className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-[#14161d] border border-neutral-200 dark:border-neutral-800 space-y-3"
      >
        <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <StopCircle className="w-4 h-4 text-rose-500" />
          <span>
            {isPersian ? 'شمارش پایان شیفت و بستن نهایی' : 'Close Shift & Cash Balancing'}
          </span>
        </h5>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              {isPersian ? 'موجودی نقد شمرده شده پایان شیفت *' : 'Counted Physical Cash *'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                placeholder="0"
                className="w-full ps-3 pe-12 py-2 text-xs bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-neutral-900 dark:text-neutral-100 font-mono tracking-wider transition-all"
                required
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 font-bold">
                {activeOrganization?.currency === 'IRR' ? 'ریال' : 'تومان'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              {isPersian
                ? 'توضیحات و یادداشت پایانی (اختیاری)'
                : 'Closing Notes (Optional)'}
            </label>
            <input
              type="text"
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder={
                isPersian
                  ? 'علت مغایرت، تحویل به صندوق‌دار بعد و...'
                  : 'Shift handover notes...'
              }
              className="w-full px-3 py-2 text-xs bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100 transition-all"
            />
          </div>
        </div>

        {/* Discrepancy indicator */}
        {closingBalance.trim() !== '' && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
              cashDiscrepancy === 0
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : cashDiscrepancy < 0
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {cashDiscrepancy === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span className="font-bold">
                {cashDiscrepancy === 0
                  ? isPersian
                    ? 'تراز صندوق دقیق و بدون مغایرت است.'
                    : 'Cashbox is perfectly balanced.'
                  : cashDiscrepancy < 0
                  ? isPersian
                    ? 'هشدار کسری نقد در صندوق:'
                    : 'Cash Shortage Warning:'
                  : isPersian
                  ? 'مازاد نقد در صندوق:'
                  : 'Cash Surplus:'}
              </span>
            </div>

            <span className="font-mono font-black text-sm">
              {cashDiscrepancy === 0
                ? '0'
                : formatCurrency(
                    Math.abs(cashDiscrepancy),
                    activeOrganization?.currency || 'TOMAN'
                  )}
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="danger"
            type="submit"
            isLoading={isSubmitting}
            icon={<StopCircle className="w-4 h-4" />}
          >
            {displayedShift.id !== myOpenShift?.id
              ? isPersian
                ? 'بستن شیفت صندوق‌دار (مدیر)'
                : 'Close Colleague Shift'
              : isPersian
              ? 'ثبت و بستن نهایی شیفت'
              : 'Close & Finalize Shift'}
          </Button>
        </div>
      </form>
    </div>
  );
};
