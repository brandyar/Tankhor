import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { Customer, Supplier, PersonTransaction } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DateInput } from '../../components/ui/DateInput';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatPersianDate, toPersianDigits } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import {
  Users,
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Receipt,
  FileText,
  Printer,
  Trash2,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Building,
  User,
  RefreshCw,
} from 'lucide-react';

interface PartySummary {
  id: string | number;
  name: string;
  type: 'customer' | 'supplier' | 'other';
  phone?: string;
  balance: number; // positive = owes us (debtor), negative = we owe them (creditor)
  credit_limit?: number;
}

export const PersonLedgersPage: React.FC = () => {
  const { t } = useTranslation();
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [selectedParty, setSelectedParty] = useState<PartySummary | null>(null);
  const [transactions, setTransactions] = useState<PersonTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'supplier' | 'debtor' | 'creditor'>('all');

  // New Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState<Partial<PersonTransaction>>({
    party_type: 'customer',
    customer_id: undefined,
    supplier_id: undefined,
    party_name: '',
    transaction_type: 'receive_money',
    amount: 0,
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'card_transfer',
    description: '',
    reference_code: '',
  });

  const loadParties = async () => {
    try {
      setLoading(true);
      const adapter = storageManager.getAdapter();
      const [customers, suppliers, allTx] = await Promise.all([
        adapter.getCustomers(),
        adapter.getSuppliers(),
        adapter.getPersonTransactions(),
      ]);

      const partyList: PartySummary[] = [];

      // Customers
      customers.forEach((c) => {
        partyList.push({
          id: c.id,
          name: c.name,
          type: 'customer',
          phone: c.phone || undefined,
          balance: Number(c.balance) || 0,
          credit_limit: c.credit_limit,
        });
      });

      // Suppliers
      suppliers.forEach((s) => {
        partyList.push({
          id: s.id,
          name: s.name,
          type: 'supplier',
          phone: s.phone || undefined,
          balance: Number(s.balance) || 0,
        });
      });

      setParties(partyList);

      if (!selectedParty && partyList.length > 0) {
        setSelectedParty(partyList[0]);
      } else if (selectedParty) {
        const updated = partyList.find((p) => p.id === selectedParty.id && p.type === selectedParty.type);
        if (updated) setSelectedParty(updated);
      }
    } catch (err) {
      console.error('[PersonLedgersPage] Error loading parties:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactionsForParty = async (party: PartySummary) => {
    try {
      setTxLoading(true);
      const adapter = storageManager.getAdapter();
      const allTx = await adapter.getPersonTransactions();

      const filtered = allTx.filter((tx) => {
        if (party.type === 'customer') {
          const cId = typeof tx.customer_id === 'object' ? (tx.customer_id as any)?.id : tx.customer_id;
          return String(cId) === String(party.id) || (tx.party_name && tx.party_name === party.name);
        } else if (party.type === 'supplier') {
          const sId = typeof tx.supplier_id === 'object' ? (tx.supplier_id as any)?.id : tx.supplier_id;
          return String(sId) === String(party.id) || (tx.party_name && tx.party_name === party.name);
        }
        return tx.party_name === party.name;
      });

      // Sort by transaction_date ascending for running balance calculation
      const sorted = [...filtered].sort(
        (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
      );

      // Compute running balance:
      // In Iranian ledger format for customers:
      // debit (بدهکار): order_invoice, pay_money -> increases customer debt (+)
      // credit (بستانکار): receive_money -> decreases customer debt (-)
      let running = 0;
      const computed = sorted.map((item) => {
        const debit = item.debit_amount || 0;
        const credit = item.credit_amount || 0;
        running += (debit - credit);
        return {
          ...item,
          running_balance: running,
        };
      });

      // Reverse back for display (newest first)
      setTransactions(computed.reverse());
    } catch (err) {
      console.error('[PersonLedgersPage] Error loading transactions:', err);
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    loadParties();
  }, []);

  useEffect(() => {
    if (selectedParty) {
      loadTransactionsForParty(selectedParty);
    }
  }, [selectedParty]);

  const handleOpenNewTransaction = (party?: PartySummary) => {
    const target = party || selectedParty;
    setTxForm({
      party_type: target ? target.type : 'customer',
      customer_id: target?.type === 'customer' ? target.id : undefined,
      supplier_id: target?.type === 'supplier' ? target.id : undefined,
      party_name: target?.name || '',
      transaction_type: target?.type === 'supplier' ? 'pay_money' : 'receive_money',
      amount: 0,
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method: 'card_transfer',
      description: '',
      reference_code: '',
    });
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.amount || Number(txForm.amount) <= 0) {
      alert('لطفاً مبلغ معتبر تراکنش را وارد کنید.');
      return;
    }

    try {
      const adapter = storageManager.getAdapter();
      const amount = Number(txForm.amount);
      const isReceive = txForm.transaction_type === 'receive_money';
      const isPay = txForm.transaction_type === 'pay_money';

      const payload: Partial<PersonTransaction> = {
        ...txForm,
        amount,
        debit_amount: isPay ? amount : 0,
        credit_amount: isReceive ? amount : 0,
      };

      await adapter.savePersonTransaction(payload);
      setIsTxModalOpen(false);
      await loadParties();
      if (selectedParty) {
        await loadTransactionsForParty(selectedParty);
      }
    } catch (err) {
      console.error('[PersonLedgersPage] Failed to save transaction:', err);
      alert('خطا در ثبت تراکنش مالی.');
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm('آیا از حذف این تراکنش اطمینان دارید؟')) return;
    try {
      const adapter = storageManager.getAdapter();
      await adapter.deletePersonTransaction(id);
      await loadParties();
      if (selectedParty) {
        await loadTransactionsForParty(selectedParty);
      }
    } catch (err) {
      console.error('[PersonLedgersPage] Failed to delete transaction:', err);
    }
  };

  const handlePrintLedger = () => {
    if (!selectedParty) return;
    printElement('printable-party-ledger', { title: `صورت‌حساب_${selectedParty.name}` });
  };

  // Filtered parties list
  const filteredParties = parties.filter((p) => {
    if (filterType === 'customer' && p.type !== 'customer') return false;
    if (filterType === 'supplier' && p.type !== 'supplier') return false;
    if (filterType === 'debtor' && p.balance <= 0) return false;
    if (filterType === 'creditor' && p.balance >= 0) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <span>{t('accounting.personsTitle')}</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t('accounting.personsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenNewTransaction()}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('accounting.newTransaction')}
          </Button>
        </div>
      </div>

      {/* Main Layout: Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Party Directory (4 cols) */}
        <Card className="lg:col-span-4 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-4">
          {/* Search & Filter Buttons */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute start-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="جستجوی شخص یا شماره تلفن..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all ${
                  filterType === 'all'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                همه ({toPersianDigits(parties.length)})
              </button>
              <button
                onClick={() => setFilterType('customer')}
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all ${
                  filterType === 'customer'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                مشتریان
              </button>
              <button
                onClick={() => setFilterType('supplier')}
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all ${
                  filterType === 'supplier'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                تامین‌کنندگان
              </button>
              <button
                onClick={() => setFilterType('debtor')}
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all ${
                  filterType === 'debtor'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-emerald-600'
                }`}
              >
                بدهکاران (طلب)
              </button>
              <button
                onClick={() => setFilterType('creditor')}
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all ${
                  filterType === 'creditor'
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-rose-600'
                }`}
              >
                بستانکاران (بدهی)
              </button>
            </div>
          </div>

          {/* Party List items */}
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto custom-scrollbar pe-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-neutral-500">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                در حال بارگذاری اشخاص...
              </div>
            ) : filteredParties.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                طرف‌حسابی یافت نشد.
              </div>
            ) : (
              filteredParties.map((p) => {
                const isSelected = selectedParty?.id === p.id && selectedParty?.type === p.type;
                const isDebtor = p.balance > 0;
                const isCreditor = p.balance < 0;

                return (
                  <div
                    key={`${p.type}-${p.id}`}
                    onClick={() => setSelectedParty(p)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                      isSelected
                        ? 'border-neutral-950 dark:border-white bg-neutral-50 dark:bg-neutral-800/80 shadow-xs'
                        : 'border-neutral-100 dark:border-neutral-800/60 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                          {p.type === 'customer' ? <User className="w-3.5 h-3.5" /> : <Building className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="font-bold text-neutral-900 dark:text-neutral-100">
                            {p.name}
                          </p>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {p.phone || (p.type === 'customer' ? 'مشتری' : 'تامین‌کننده')}
                          </span>
                        </div>
                      </div>

                      <div className="text-end">
                        <div className={`font-bold font-mono ${
                          isDebtor
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isCreditor
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-neutral-500'
                        }`}>
                          {formatCurrency(Math.abs(p.balance))}
                        </div>
                        <span className={`text-[10px] ${
                          isDebtor ? 'text-emerald-600' : isCreditor ? 'text-rose-600' : 'text-neutral-400'
                        }`}>
                          {isDebtor ? 'بدهکار (طلب ما)' : isCreditor ? 'بستانکار (بدهی ما)' : 'تسویه'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Side: Account Statement & Ledger (8 cols) */}
        <Card id="printable-party-ledger" className="lg:col-span-8 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-5">
          {selectedParty ? (
            <>
              {/* Selected Party Summary Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/60">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900">
                    {selectedParty.type === 'customer' ? <User className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                        {selectedParty.name}
                      </h3>
                      <Badge variant={selectedParty.type === 'customer' ? 'default' : 'neutral'}>
                        {selectedParty.type === 'customer' ? 'مشتری' : 'تامین‌کننده'}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500 font-mono mt-0.5">
                      شماره تماس: {selectedParty.phone || 'ثبت نشده'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-end">
                    <span className="text-[11px] text-neutral-500">مانده حساب نهایی:</span>
                    <div className={`text-base font-bold font-mono ${
                      selectedParty.balance > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : selectedParty.balance < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-neutral-500'
                    }`}>
                      {formatCurrency(Math.abs(selectedParty.balance))}
                      <span className="text-xs font-normal ms-1">
                        ({selectedParty.balance > 0 ? 'بدهکار' : selectedParty.balance < 0 ? 'بستانکار' : 'بی‌حساب'})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrintLedger}
                      title="چاپ صورتحساب"
                      icon={<Printer className="w-3.5 h-3.5" />}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenNewTransaction(selectedParty)}
                      icon={<Plus className="w-3.5 h-3.5" />}
                    >
                      ثبت تراکنش
                    </Button>
                  </div>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-neutral-500" />
                    <span>گردش حساب و ریز اسناد مالی</span>
                  </h4>
                  <span className="text-xs text-neutral-400">
                    تعداد اسناد: {toPersianDigits(transactions.length)}
                  </span>
                </div>

                {txLoading ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                    در حال دریافت سوابق تراکنش‌ها...
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                    هنوز هیچ سند مالی یا تراکنشی برای این شخص ثبت نشده است.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-500">
                        <tr>
                          <th className="py-2.5 px-3 text-start font-semibold">تاریخ</th>
                          <th className="py-2.5 px-3 text-start font-semibold">شرح سند</th>
                          <th className="py-2.5 px-3 text-start font-semibold">شماره پیگیری / فاکتور</th>
                          <th className="py-2.5 px-3 text-start font-semibold text-rose-600">بدهکار (+)</th>
                          <th className="py-2.5 px-3 text-start font-semibold text-emerald-600">بستانکار (-)</th>
                          <th className="py-2.5 px-3 text-start font-semibold">مانده</th>
                          <th className="py-2.5 px-3 text-center font-semibold">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                        {transactions.map((tx) => {
                          const isManual = !tx.order_id && !tx.purchase_order_id;
                          return (
                            <tr key={tx.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-neutral-600 dark:text-neutral-300">
                                {formatPersianDate(tx.transaction_date)}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                                  {tx.transaction_type === 'order_invoice' && 'فاکتور فروش کالا'}
                                  {tx.transaction_type === 'purchase_invoice' && 'فاکتور خرید کالا'}
                                  {tx.transaction_type === 'receive_money' && 'دریافت وجه'}
                                  {tx.transaction_type === 'pay_money' && 'پرداخت وجه'}
                                  {tx.transaction_type === 'adjustment' && 'اصلاحیه حساب'}
                                </div>
                                {tx.description && (
                                  <div className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                                    {tx.description}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-neutral-500">
                                {tx.order_number || tx.purchase_number || tx.reference_code || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                                {tx.debit_amount ? formatCurrency(tx.debit_amount) : '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {tx.credit_amount ? formatCurrency(tx.credit_amount) : '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-white">
                                {tx.running_balance !== undefined ? formatCurrency(Math.abs(tx.running_balance)) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isManual && tx.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => tx.id && handleDeleteTransaction(tx.id)}
                                    className="text-rose-500 hover:text-rose-700"
                                    title="حذف سند"
                                    icon={<Trash2 className="w-3 h-3" />}
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-24 text-center text-xs text-neutral-400">
              {t('accounting.selectPartyFirst')}
            </div>
          )}
        </Card>
      </div>

      {/* New Transaction Modal */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        title="ثبت دریافت / پرداخت وجه"
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                نوع شخص *
              </label>
              <select
                value={txForm.party_type || 'customer'}
                onChange={(e) => {
                  const pType = e.target.value as any;
                  setTxForm({
                    ...txForm,
                    party_type: pType,
                    customer_id: undefined,
                    supplier_id: undefined,
                    party_name: '',
                  });
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="customer">مشتری</option>
                <option value="supplier">تامین‌کننده</option>
                <option value="other">سایر طرف‌حساب‌ها</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                نوع عملیات مالی *
              </label>
              <select
                value={txForm.transaction_type || 'receive_money'}
                onChange={(e) => setTxForm({ ...txForm, transaction_type: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="receive_money">دریافت وجه از طرف‌حساب (بستانکار شدن شخص)</option>
                <option value="pay_money">پرداخت وجه به طرف‌حساب (بدهکار شدن شخص)</option>
                <option value="adjustment">اصلاحیه حساب</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              انتخاب طرف‌حساب *
            </label>
            {txForm.party_type === 'customer' ? (
              <select
                value={txForm.customer_id ? String(txForm.customer_id) : ''}
                onChange={(e) => {
                  const target = parties.find((p) => String(p.id) === e.target.value && p.type === 'customer');
                  setTxForm({
                    ...txForm,
                    customer_id: e.target.value,
                    party_name: target?.name || '',
                  });
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                required
              >
                <option value="">-- انتخاب مشتری --</option>
                {parties
                  .filter((p) => p.type === 'customer')
                  .map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} {p.phone ? `(${p.phone})` : ''}
                    </option>
                  ))}
              </select>
            ) : txForm.party_type === 'supplier' ? (
              <select
                value={txForm.supplier_id ? String(txForm.supplier_id) : ''}
                onChange={(e) => {
                  const target = parties.find((p) => String(p.id) === e.target.value && p.type === 'supplier');
                  setTxForm({
                    ...txForm,
                    supplier_id: Number(e.target.value),
                    party_name: target?.name || '',
                  });
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                required
              >
                <option value="">-- انتخاب تامین‌کننده --</option>
                {parties
                  .filter((p) => p.type === 'supplier')
                  .map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} {p.phone ? `(${p.phone})` : ''}
                    </option>
                  ))}
              </select>
            ) : (
              <Input
                label="نام شخص / سازمان *"
                placeholder="نام کامل طرف‌حساب..."
                value={txForm.party_name || ''}
                onChange={(e) => setTxForm({ ...txForm, party_name: e.target.value })}
                required
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="مبلغ تراکنش (تومان) *"
              type="number"
              min="0"
              placeholder="0"
              value={txForm.amount ? String(txForm.amount) : ''}
              onChange={(e) => setTxForm({ ...txForm, amount: Number(e.target.value) })}
              required
            />

            <DateInput
              label="تاریخ تراکنش *"
              value={txForm.transaction_date || ''}
              onChange={(iso) => setTxForm({ ...txForm, transaction_date: iso })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                روش پرداخت
              </label>
              <select
                value={txForm.payment_method || 'card_transfer'}
                onChange={(e) => setTxForm({ ...txForm, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="card_transfer">کارت به کارت / پایا</option>
                <option value="cash">نقدی / صندوق</option>
                <option value="bank_account">حساب بانکی مستقیم</option>
                <option value="cheque">چک صیادی</option>
              </select>
            </div>

            <Input
              label="شماره پیگیری / سند بانکی"
              placeholder="مثال: REF-54321"
              value={txForm.reference_code || ''}
              onChange={(e) => setTxForm({ ...txForm, reference_code: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              شرح و توضیحات سند
            </label>
            <textarea
              rows={2}
              placeholder="بابت تسویه فاکتور، بیعانه، پیش‌پرداخت..."
              value={txForm.description || ''}
              onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsTxModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              ثبت نهایی سند
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
