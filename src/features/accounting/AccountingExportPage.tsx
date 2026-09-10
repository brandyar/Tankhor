import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import {
  AccountingJournalEntry,
  Order,
  PurchaseOrder,
  Expense,
  PersonTransaction,
  FinancialAccount,
  Cheque,
} from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatPersianDate, formatDateNumeric, toPersianDigits } from '../../utils/formatters';
import { isoToJalali, jalaliToIsoString } from '../../utils/dateUtils';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  Filter,
  RefreshCw,
  Building,
  FileCheck,
} from 'lucide-react';

export const AccountingExportPage: React.FC = () => {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<'moadian' | 'sepidar' | 'holo' | 'journal'>('moadian');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'quarter' | 'year'>('month');

  // Loaded raw data
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<PersonTransaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const storage = storageManager.getAdapter();
      const [allOrders, allPos, allExpenses, allTrans, allAccounts, allCheques] = await Promise.all([
        storage.getOrders(),
        storage.getPurchaseOrders(),
        storage.getExpenses(),
        storage.getPersonTransactions(),
        storage.getFinancialAccounts(),
        storage.getCheques(),
      ]);

      setOrders(allOrders || []);
      setPurchaseOrders(allPos || []);
      setExpenses(allExpenses || []);
      setTransactions(allTrans || []);
      setAccounts(allAccounts || []);
      setCheques(allCheques || []);
    } catch (err) {
      console.error('Failed to load accounting data for export', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter raw data according to date period
  const filterDate = useMemo(() => {
    const now = new Date();
    if (locale === 'fa') {
      const jNow = isoToJalali(now.toISOString());
      if (periodFilter === 'month') {
        return jalaliToIsoString({ jy: jNow.jy, jm: jNow.jm, jd: 1 });
      }
      if (periodFilter === 'quarter') {
        const qStartMonth = Math.floor((jNow.jm - 1) / 3) * 3 + 1;
        return jalaliToIsoString({ jy: jNow.jy, jm: qStartMonth, jd: 1 });
      }
      if (periodFilter === 'year') {
        return jalaliToIsoString({ jy: jNow.jy, jm: 1, jd: 1 });
      }
      return null;
    }

    if (periodFilter === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return d.toISOString().split('T')[0];
    }
    if (periodFilter === 'quarter') {
      const d = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return d.toISOString().split('T')[0];
    }
    if (periodFilter === 'year') {
      const d = new Date(now.getFullYear(), 0, 1);
      return d.toISOString().split('T')[0];
    }
    return null;
  }, [periodFilter, locale]);

  const filteredOrders = useMemo(() => {
    if (!filterDate) return orders;
    return orders.filter((o) => (o.date_created ? o.date_created.slice(0, 10) >= filterDate : true));
  }, [orders, filterDate]);

  const filteredExpenses = useMemo(() => {
    if (!filterDate) return expenses;
    return expenses.filter((e) => (e.expense_date ? e.expense_date >= filterDate : true));
  }, [expenses, filterDate]);

  const filteredPurchases = useMemo(() => {
    if (!filterDate) return purchaseOrders;
    return purchaseOrders.filter((p) => (p.date_created ? p.date_created.slice(0, 10) >= filterDate : true));
  }, [purchaseOrders, filterDate]);

  // Construct Double-Entry Journal Articles
  const journalEntries: AccountingJournalEntry[] = useMemo(() => {
    const list: AccountingJournalEntry[] = [];

    // 1. Sales Entries
    filteredOrders.forEach((order) => {
      const date = order.date_created?.slice(0, 10) || new Date().toISOString().split('T')[0];
      const total = order.total || 0;
      const tax = order.tax || Math.round((total / 1.1) * 0.1);
      const subtotal = total - tax;

      // Debit: Accounts Receivable or Cash/Bank
      list.push({
        id: `sales-dr-${order.id}`,
        entry_number: `ACC-ORD-${order.id}`,
        entry_date: date,
        account_code: '110301',
        account_name: 'حساب‌های دریافتنی تجاری (مشتریان)',
        description: `فروش فاکتور #${order.order_number || order.id}`,
        debit: total,
        credit: 0,
        reference_type: 'order',
        reference_id: order.id,
      });

      // Credit: Sales Revenue
      list.push({
        id: `sales-cr-rev-${order.id}`,
        entry_number: `ACC-ORD-${order.id}`,
        entry_date: date,
        account_code: '410101',
        account_name: 'درآمد حاصل از فروش پوشاک و کالا',
        description: `درآمد فروش فاکتور #${order.order_number || order.id}`,
        debit: 0,
        credit: subtotal,
        reference_type: 'order',
        reference_id: order.id,
      });

      // Credit: Output VAT (if applicable)
      if (tax > 0) {
        list.push({
          id: `sales-cr-tax-${order.id}`,
          entry_number: `ACC-ORD-${order.id}`,
          entry_date: date,
          account_code: '210501',
          account_name: 'مالیات و عوارض ارزش افزوده پرداختنی (فروش)',
          description: `مالیات ارزش افزوده فاکتور #${order.order_number || order.id}`,
          debit: 0,
          credit: tax,
          reference_type: 'order',
          reference_id: order.id,
        });
      }
    });

    // 2. Expenses Entries
    filteredExpenses.forEach((exp) => {
      const date = exp.expense_date || new Date().toISOString().split('T')[0];
      const amount = exp.amount || 0;

      // Debit: Operating Expense
      list.push({
        id: `exp-dr-${exp.id}`,
        entry_number: `ACC-EXP-${exp.id}`,
        entry_date: date,
        account_code: '610201',
        account_name: `هزینه‌های جاری: ${exp.title}`,
        description: exp.description || exp.title,
        debit: amount,
        credit: 0,
        reference_type: 'expense',
        reference_id: exp.id,
      });

      // Credit: Cash / Bank
      list.push({
        id: `exp-cr-${exp.id}`,
        entry_number: `ACC-EXP-${exp.id}`,
        entry_date: date,
        account_code: '110101',
        account_name: 'موجودی نقد و بانک‌ها (صندوق / بانک)',
        description: `پرداخت بابت ${exp.title}`,
        debit: 0,
        credit: amount,
        reference_type: 'expense',
        reference_id: exp.id,
      });
    });

    // 3. Purchases Entries
    filteredPurchases.forEach((po) => {
      const date = po.date_created?.slice(0, 10) || new Date().toISOString().split('T')[0];
      const total = po.total || 0;
      const tax = po.tax || 0;
      const subtotal = total - tax;

      // Debit: Inventory (Goods purchased)
      list.push({
        id: `po-dr-inv-${po.id}`,
        entry_number: `ACC-PO-${po.id}`,
        entry_date: date,
        account_code: '110501',
        account_name: 'موجودی مواد و کالا (انبار پوشاک)',
        description: `خرید فاکتور #${po.purchase_number || po.id}`,
        debit: subtotal,
        credit: 0,
        reference_type: 'purchase_order',
        reference_id: po.id,
      });

      // Debit: Input VAT Credit (if applicable)
      if (tax > 0) {
        list.push({
          id: `po-dr-tax-${po.id}`,
          entry_number: `ACC-PO-${po.id}`,
          entry_date: date,
          account_code: '110701',
          account_name: 'اعتبار مالیات بر ارزش افزوده خرید',
          description: `اعتبار ارزش افزوده خرید #${po.purchase_number || po.id}`,
          debit: tax,
          credit: 0,
          reference_type: 'purchase_order',
          reference_id: po.id,
        });
      }

      // Credit: Accounts Payable (Suppliers)
      list.push({
        id: `po-cr-pay-${po.id}`,
        entry_number: `ACC-PO-${po.id}`,
        entry_date: date,
        account_code: '210101',
        account_name: 'حساب‌های پرداختنی تجاری (تامین‌کنندگان)',
        description: `بدهی فاکتور خرید #${po.purchase_number || po.id}`,
        debit: 0,
        credit: total,
        reference_type: 'purchase_order',
        reference_id: po.id,
      });
    });

    return list;
  }, [filteredOrders, filteredExpenses, filteredPurchases]);

  // Totals for debit & credit balance check
  const totalDebit = useMemo(() => {
    return journalEntries.reduce((acc, curr) => acc + (curr.debit || 0), 0);
  }, [journalEntries]);

  const totalCredit = useMemo(() => {
    return journalEntries.reduce((acc, curr) => acc + (curr.credit || 0), 0);
  }, [journalEntries]);

  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

  // Export to CSV Generator
  const handleExportCsv = () => {
    let csvContent = '';
    let fileName = '';

    if (exportFormat === 'moadian') {
      // Moadian & Art 169 Periodic Report Format
      fileName = `moadian_sales_report_${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = 'شماره فاکتور,تاریخ شمسی,شناسه خریدار,نام خریدار,مبلغ ناخالص (تومان),نرخ ارزش افزوده,مبلغ ارزش افزوده (تومان),مبلغ کل فاکتور\n';
      filteredOrders.forEach((o) => {
        const taxable = o.subtotal || Math.round((o.total || 0) / 1.1);
        const tax = o.tax || Math.round(taxable * 0.1);
        csvContent += `"${o.order_number || o.id}","${formatPersianDate(o.date_created)}","${o.customer_id || 'CONSUMER'}","${o.customer_name || 'مصرف‌کننده نهایی'}",${taxable},"10%",${tax},${o.total}\n`;
      });
    } else if (exportFormat === 'sepidar') {
      // Sepidar Standard Accounting Entry Format
      fileName = `sepidar_accounting_entries_${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = 'شماره سند,تاریخ,کد حساب معین,نام حساب معین,شرح آرتیکل,بدهکار,بستانکار,مرجع\n';
      journalEntries.forEach((entry) => {
        const formattedDate = formatDateNumeric(entry.entry_date);
        csvContent += `"${entry.entry_number}","${formattedDate}","${entry.account_code}","${entry.account_name}","${entry.description}",${entry.debit},${entry.credit},"${entry.reference_type || ''}"\n`;
      });
    } else if (exportFormat === 'holo') {
      // Holo Standard Accounting Format
      fileName = `holo_sanad_${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = 'کد حساب,عنوان حساب,بدهکار,بستانکار,شرح سند,تاریخ\n';
      journalEntries.forEach((entry) => {
        const formattedDate = formatDateNumeric(entry.entry_date);
        csvContent += `"${entry.account_code}","${entry.account_name}",${entry.debit},${entry.credit},"${entry.description}","${formattedDate}"\n`;
      });
    } else {
      // General Double Entry Journal Format
      fileName = `general_journal_double_entry_${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = 'شناسه سند,تاریخ,کد معین,نام معین حسابداری,شرح رویداد مالی,بدهکار (تومان),بستانکار (تومان)\n';
      journalEntries.forEach((entry) => {
        const formattedDate = formatDateNumeric(entry.entry_date);
        csvContent += `"${entry.entry_number}","${formattedDate}","${entry.account_code}","${entry.account_name}","${entry.description}",${entry.debit},${entry.credit}\n`;
      });
    }

    // Prepend UTF-8 BOM so Persian characters display correctly in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Format Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setExportFormat('moadian')}
          className={`p-4 rounded-xl border text-start transition-all cursor-pointer ${
            exportFormat === 'moadian'
              ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900/60 ring-1 ring-neutral-900 dark:ring-white'
              : 'border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-xs text-neutral-900 dark:text-white">سامانه مودیان</span>
          </div>
          <p className="text-[11px] text-neutral-500 line-clamp-2">
            صورت معاملات فصلی ماده ۱۶۹ مکرر سازمان امور مالیاتی
          </p>
        </button>

        <button
          type="button"
          onClick={() => setExportFormat('sepidar')}
          className={`p-4 rounded-xl border text-start transition-all cursor-pointer ${
            exportFormat === 'sepidar'
              ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900/60 ring-1 ring-neutral-900 dark:ring-white'
              : 'border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-xs text-neutral-900 dark:text-white">سپیدار سیستم</span>
          </div>
          <p className="text-[11px] text-neutral-500 line-clamp-2">
            سند حسابداری استاندارد با سرفصل‌های کدینگ معین سپیدار
          </p>
        </button>

        <button
          type="button"
          onClick={() => setExportFormat('holo')}
          className={`p-4 rounded-xl border text-start transition-all cursor-pointer ${
            exportFormat === 'holo'
              ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900/60 ring-1 ring-neutral-900 dark:ring-white'
              : 'border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="font-bold text-xs text-neutral-900 dark:text-white">نرم‌افزار هلو</span>
          </div>
          <p className="text-[11px] text-neutral-500 line-clamp-2">
            ورود اطلاعات اسناد روزانه به نرم‌افزار حسابداری هلو
          </p>
        </button>

        <button
          type="button"
          onClick={() => setExportFormat('journal')}
          className={`p-4 rounded-xl border text-start transition-all cursor-pointer ${
            exportFormat === 'journal'
              ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900/60 ring-1 ring-neutral-900 dark:ring-white'
              : 'border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="font-bold text-xs text-neutral-900 dark:text-white">دفتر روزنامه دوبل</span>
          </div>
          <p className="text-[11px] text-neutral-500 line-clamp-2">
            آرتیکل‌های تراز شده بدهکار و بستانکار عمومی
          </p>
        </button>
      </div>

      {/* Filter & Export Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-900/40 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-neutral-500" />
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {t('accounting.exportDateRange')}:
          </span>
          <Select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="w-44 h-9 text-xs"
          >
            <option value="month">{t('accounting.periodThisMonth')}</option>
            <option value="quarter">فصل جاری</option>
            <option value="year">{t('accounting.periodThisYear')}</option>
            <option value="all">{t('accounting.allAccountingRecords')}</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تازه‌سازی</span>
          </Button>

          <Button
            onClick={handleExportCsv}
            size="sm"
            className="h-9 gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>{t('accounting.downloadCsvBtn')}</span>
          </Button>
        </div>
      </div>

      {/* Balance Indicator Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
          isBalanced
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          {isBalanced ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('accounting.balancedJournal')}</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span>{t('accounting.unbalancedJournal')}</span>
            </>
          )}
          <span className="text-[11px] opacity-75 mr-2">
            ({toPersianDigits(journalEntries.length)} آرتیکل مالی)
          </span>
        </div>

        <div className="flex items-center gap-6 font-mono font-bold">
          <div>
            <span className="text-neutral-500 text-[11px] ml-1">{t('accounting.totalDebit')}:</span>
            <span>{formatCurrency(totalDebit)}</span>
          </div>
          <div>
            <span className="text-neutral-500 text-[11px] ml-1">{t('accounting.totalCredit')}:</span>
            <span>{formatCurrency(totalCredit)}</span>
          </div>
        </div>
      </div>

      {/* Preview Journal Table */}
      <Card className="overflow-hidden border-neutral-200/80 dark:border-neutral-800">
        <div className="bg-neutral-50 dark:bg-neutral-900/50 px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            {t('accounting.previewJournalEntries')}
          </span>
          <span className="text-[11px] text-neutral-400">
            {t('accounting.excelUtf8Notice')}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-xs text-start">
            <thead className="bg-neutral-100/60 dark:bg-neutral-900/40 text-neutral-500 border-b border-neutral-200/80 dark:border-neutral-800 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 font-semibold text-start">شماره سند / تاریخ</th>
                <th className="px-4 py-3 font-semibold text-start">{t('accounting.accountCode')}</th>
                <th className="px-4 py-3 font-semibold text-start">{t('accounting.accountName')}</th>
                <th className="px-4 py-3 font-semibold text-start">شرح آرتیکل سند</th>
                <th className="px-4 py-3 font-semibold text-end">{t('accounting.debit')} (تومان)</th>
                <th className="px-4 py-3 font-semibold text-end">{t('accounting.credit')} (تومان)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
              {journalEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-neutral-400">
                    هیچ تراکنشی در این بازه زمانی برای صدور سند حسابداری یافت نشد.
                  </td>
                </tr>
              ) : (
                journalEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20">
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-neutral-800 dark:text-neutral-200 font-medium">
                        {entry.entry_number}
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {formatPersianDate(entry.entry_date)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-neutral-600 dark:text-neutral-400">
                      {entry.account_code}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-white">
                      {entry.account_name}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-300 max-w-xs truncate">
                      {entry.description}
                    </td>
                    <td className="px-4 py-2.5 text-end font-mono font-semibold text-neutral-900 dark:text-white">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-end font-mono font-semibold text-neutral-900 dark:text-white">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
