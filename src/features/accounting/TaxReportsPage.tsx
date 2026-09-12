import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { VatReportSummary, Order, PurchaseOrder, Customer, Supplier } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatPersianDate, toPersianDigits } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import {
  FileText,
  Printer,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Building2,
} from 'lucide-react';

export const TaxReportsPage: React.FC = () => {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(() => (locale === 'fa' ? 1404 : 2026));
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    if (locale === 'fa' && selectedYear > 1500) {
      setSelectedYear(1404);
    } else if (locale !== 'fa' && selectedYear < 1500) {
      setSelectedYear(2026);
    }
  }, [locale]);

  const [vatReport, setVatReport] = useState<VatReportSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [activeTableTab, setActiveTableTab] = useState<'sales' | 'purchases'>('sales');

  const loadData = async () => {
    try {
      setLoading(true);
      const storage = storageManager.getAdapter();
      const reportPromise = storage.getVatReport
        ? storage.getVatReport({ year: selectedYear, quarter: selectedQuarter })
        : Promise.resolve({
            salesTaxableAmount: 0,
            salesVatAmount: 0,
            purchasesTaxableAmount: 0,
            purchasesVatAmount: 0,
            netVatPayable: 0,
            vatRate: 10,
            ordersCount: 0,
            purchasesCount: 0,
            periodLabel: '',
            salesInvoices: [],
            purchaseInvoices: [],
            year: selectedYear,
            quarter: selectedQuarter,
          } as VatReportSummary);

      const [report, allOrders, allPos, allCusts, allSups] = await Promise.all([
        reportPromise,
        storage.getOrders(),
        storage.getPurchaseOrders(),
        storage.getCustomers(),
        storage.getSuppliers(),
      ]);

      setVatReport(report);
      setOrders(allOrders || []);
      setPurchaseOrders(allPos || []);
      setCustomers(allCusts || []);
      setSuppliers(allSups || []);
    } catch (err) {
      console.error('Failed to load VAT report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedQuarter]);

  // Handle Print Action
  const handlePrint = () => {
    printElement('tax-report-printable-area', { title: `${t('accounting.vatReport')}_${selectedYear}_Q${selectedQuarter}` });
  };

  const quarterNames = {
    1: t('accounting.spring'),
    2: t('accounting.summer'),
    3: t('accounting.autumn'),
    4: t('accounting.winter'),
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Print Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-neutral-50 dark:bg-neutral-900/40 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neutral-500" />
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {t('accounting.selectYear')}:
            </span>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-28 h-9 text-xs"
            >
              {locale === 'fa' ? (
                <>
                  <option value={1404}>۱۴۰۴</option>
                  <option value={1403}>۱۴۰۳</option>
                  <option value={1402}>۱۴۰۲</option>
                </>
              ) : (
                <>
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </>
              )}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {t('accounting.selectQuarter')}:
            </span>
            <Select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(Number(e.target.value) as any)}
              className="w-48 h-9 text-xs"
            >
              <option value={1}>{t('accounting.spring')}</option>
              <option value={2}>{t('accounting.summer')}</option>
              <option value={3}>{t('accounting.autumn')}</option>
              <option value={4}>{t('accounting.winter')}</option>
            </Select>
          </div>
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
            onClick={handlePrint}
            size="sm"
            className="h-9 gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>{t('accounting.printTaxReport')}</span>
          </Button>
        </div>
      </div>

      {/* Official Tax Summary Header for Print / Display */}
      <Card id="tax-report-printable-area" className="p-6 border-neutral-200/80 dark:border-neutral-800 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-neutral-200/80 dark:border-neutral-800 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                {t('accounting.quarterlyDeclaration')} ({quarterNames[selectedQuarter]} سال {toPersianDigits(selectedYear)})
              </h2>
            </div>
            <p className="text-xs text-neutral-500">
              {t('accounting.vatDeclarationNote')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="primary" className="text-xs font-semibold px-2.5 py-1">
              {t('accounting.vatRate')}
            </Badge>
          </div>
        </div>

        {/* 4 Core Tax KPI Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Taxable Sales */}
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-xs">
              <span>{t('accounting.salesTaxable')}</span>
              <ArrowUpRight className="w-4 h-4 text-neutral-400" />
            </div>
            <p className="text-lg font-bold text-neutral-900 dark:text-white">
              {formatCurrency(vatReport?.salesTaxableAmount || (vatReport as any)?.taxable_sales || 0)}
            </p>
            <span className="text-[11px] text-neutral-400 block">
              تعداد: {toPersianDigits(vatReport?.ordersCount || (vatReport as any)?.sales_count || 0)} فاکتور فروش
            </span>
          </div>

          {/* 2. Output VAT (Collected from customers) */}
          <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 space-y-1">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 text-xs font-semibold">
              <span>{t('accounting.salesVat')}</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold text-blue-950 dark:text-blue-100">
              {formatCurrency(vatReport?.salesVatAmount || (vatReport as any)?.vat_collected || 0)}
            </p>
            <span className="text-[11px] text-blue-600/70 dark:text-blue-400/60 block">
              مالیات وصول‌شده از خریداران
            </span>
          </div>

          {/* 3. Taxable Purchases */}
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-xs">
              <span>{t('accounting.purchasesTaxable')}</span>
              <ArrowDownLeft className="w-4 h-4 text-neutral-400" />
            </div>
            <p className="text-lg font-bold text-neutral-900 dark:text-white">
              {formatCurrency(vatReport?.purchasesTaxableAmount || (vatReport as any)?.taxable_purchases || 0)}
            </p>
            <span className="text-[11px] text-neutral-400 block">
              تعداد: {toPersianDigits(vatReport?.purchasesCount || (vatReport as any)?.purchases_count || 0)} فاکتور خرید
            </span>
          </div>

          {/* 4. Input VAT Credit */}
          <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-1">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <span>{t('accounting.purchasesVat')}</span>
              <TrendingDown className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold text-emerald-950 dark:text-emerald-100">
              {formatCurrency(vatReport?.purchasesVatAmount || (vatReport as any)?.vat_paid || 0)}
            </p>
            <span className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60 block">
              اعتبار مالیاتی پرداختی به تامین‌کننده
            </span>
          </div>
        </div>

        {/* Final Net Tax Payable / Credit Banner */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
            (vatReport?.netVatPayable || (vatReport as any)?.net_vat_payable || 0) > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                (vatReport?.netVatPayable || (vatReport as any)?.net_vat_payable || 0) > 0
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold block">
                {(vatReport?.netVatPayable || (vatReport as any)?.net_vat_payable || 0) > 0
                  ? t('accounting.netVatPayable')
                  : t('accounting.netVatRefundable')}
              </span>
              <span className="text-[11px] opacity-80">
                {(vatReport?.netVatPayable || (vatReport as any)?.net_vat_payable || 0) > 0
                  ? 'مبلغ نهایی قابل واریز به حساب سازمان امور مالیاتی کشور'
                  : 'بستانکاری و اعتبار مالیاتی قابل استرداد یا انتقال به فصل بعد'}
              </span>
            </div>
          </div>

          <div className="text-xl font-black">
            {formatCurrency(Math.abs(vatReport?.netVatPayable || (vatReport as any)?.net_vat_payable || 0))}
          </div>
        </div>
      </Card>

      {/* Sub-Tabs: Sales vs Purchases Invoices */}
      <div className="space-y-4 print:mt-6">
        <div className="flex border-b border-neutral-200/80 dark:border-neutral-800 gap-4 print:hidden">
          <button
            onClick={() => setActiveTableTab('sales')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTableTab === 'sales'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            {t('accounting.salesInvoicesList')} ({toPersianDigits(orders.length)})
          </button>

          <button
            onClick={() => setActiveTableTab('purchases')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTableTab === 'purchases'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            {t('accounting.purchaseInvoicesList')} ({toPersianDigits(purchaseOrders.length)})
          </button>
        </div>

        {activeTableTab === 'sales' ? (
          <Card className="overflow-hidden border-neutral-200/80 dark:border-neutral-800">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-start">شماره فاکتور</th>
                    <th className="px-4 py-3 font-semibold text-start">تاریخ</th>
                    <th className="px-4 py-3 font-semibold text-start">مشتری</th>
                    <th className="px-4 py-3 font-semibold text-end">مبلغ خالص مشمول (تومان)</th>
                    <th className="px-4 py-3 font-semibold text-end">مالیات ارزش افزوده (۱۰٪)</th>
                    <th className="px-4 py-3 font-semibold text-end">جمع کل فاکتور</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-neutral-400">
                        فاکتور فروشی در این بازه زمانی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const cId = typeof order.customer_id === 'object' ? (order.customer_id as any)?.id : order.customer_id;
                      const customer = customers.find((c) => c.id === Number(cId));
                      const taxable = order.subtotal || Math.round((order.total || 0) / 1.1);
                      const tax = order.tax || Math.round(taxable * 0.1);
                      return (
                        <tr key={order.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20">
                          <td className="px-4 py-3 font-mono font-medium text-neutral-900 dark:text-white">
                            {order.order_number || `ORD-${order.id}`}
                          </td>
                          <td className="px-4 py-3 text-neutral-500">
                            {formatPersianDate(order.date_created)}
                          </td>
                          <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200">
                            {customer ? (customer.name || `${(customer as any).first_name || ''} ${(customer as any).last_name || ''}`.trim() || 'مشتری') : 'مشتری عمومی'}
                          </td>
                          <td className="px-4 py-3 text-end font-medium">
                            {formatCurrency(taxable)}
                          </td>
                          <td className="px-4 py-3 text-end font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrency(tax)}
                          </td>
                          <td className="px-4 py-3 text-end font-bold text-neutral-900 dark:text-white">
                            {formatCurrency(order.total)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden border-neutral-200/80 dark:border-neutral-800">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-start">شماره فاکتور خرید</th>
                    <th className="px-4 py-3 font-semibold text-start">تاریخ</th>
                    <th className="px-4 py-3 font-semibold text-start">تامین‌کننده</th>
                    <th className="px-4 py-3 font-semibold text-end">مبلغ خالص خرید (تومان)</th>
                    <th className="px-4 py-3 font-semibold text-end">اعتبار ارزش افزوده (۱۰٪)</th>
                    <th className="px-4 py-3 font-semibold text-end">جمع کل خرید</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-neutral-400">
                        فاکتور خریدی در این بازه زمانی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map((po) => {
                      const sId = typeof po.supplier_id === 'object' ? (po.supplier_id as any)?.id : po.supplier_id;
                      const sup = suppliers.find((s) => s.id === Number(sId));
                      const taxable = po.subtotal || Math.round((po.total || 0) / 1.1);
                      const tax = po.tax || Math.round(taxable * 0.1);
                      return (
                        <tr key={po.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20">
                          <td className="px-4 py-3 font-mono font-medium text-neutral-900 dark:text-white">
                            {po.purchase_number || `PO-${po.id}`}
                          </td>
                          <td className="px-4 py-3 text-neutral-500">
                            {formatPersianDate(po.date_created)}
                          </td>
                          <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200">
                            {sup?.name || po.supplier_name || 'تامین‌کننده'}
                          </td>
                          <td className="px-4 py-3 text-end font-medium">
                            {formatCurrency(taxable)}
                          </td>
                          <td className="px-4 py-3 text-end font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(tax)}
                          </td>
                          <td className="px-4 py-3 text-end font-bold text-neutral-900 dark:text-white">
                            {formatCurrency(po.total)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
