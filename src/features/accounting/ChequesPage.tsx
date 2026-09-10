import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { useOrganization } from '../../context/OrganizationContext';
import {
  Cheque,
  ChequeType,
  ChequeStatus,
  FinancialAccount,
} from '../../types/accounting';
import { Customer, Supplier } from '../../types';
import { formatCurrency, formatPersianDate } from '../../utils/formatters';
import { DateInput } from '../../components/ui/DateInput';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Building2,
  Calendar,
  CreditCard,
  Copy,
  Check,
  Edit2,
  Trash2,
  RefreshCw,
  TrendingUp,
  FileText,
  ShieldCheck,
} from 'lucide-react';

export const ChequesPage: React.FC = () => {
  const { t } = useTranslation();
  const storage = storageManager.getAdapter();
  const { currentOrganization } = useOrganization();

  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'received' | 'issued' | 'alerts'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isChequeModalOpen, setIsChequeModalOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusActionCheque, setStatusActionCheque] = useState<Cheque | null>(null);
  const [newStatus, setNewStatus] = useState<ChequeStatus>('cleared');
  const [targetAccountId, setTargetAccountId] = useState<number | ''>('');

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [formState, setFormState] = useState<{
    type: ChequeType;
    sayad_id: string;
    cheque_number: string;
    bank_name: string;
    branch_name: string;
    account_number: string;
    drawer_name: string;
    customer_id: number | '';
    supplier_id: number | '';
    amount: number | '';
    issue_date: string;
    due_date: string;
    alert_days_before: number;
    notes: string;
  }>({
    type: 'received',
    sayad_id: '',
    cheque_number: '',
    bank_name: '',
    branch_name: '',
    account_number: '',
    drawer_name: '',
    customer_id: '',
    supplier_id: '',
    amount: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    alert_days_before: 3,
    notes: '',
  });

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const [chkList, accList, custList, supList] = await Promise.all([
        storage.getCheques({ organization_id: currentOrganization.id }),
        storage.getFinancialAccounts({ organization_id: currentOrganization.id }),
        storage.getCustomers({ organization_id: currentOrganization.id }),
        storage.getSuppliers({ organization_id: currentOrganization.id }),
      ]);
      setCheques(chkList);
      setAccounts(accList);
      setCustomers(custList);
      setSuppliers(supList);
    } catch (err) {
      console.error('Error loading cheques data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOrganization?.id]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenNewCheque = (type: ChequeType = 'received') => {
    setEditingCheque(null);
    setFormState({
      type,
      sayad_id: '',
      cheque_number: '',
      bank_name: '',
      branch_name: '',
      account_number: '',
      drawer_name: '',
      customer_id: '',
      supplier_id: '',
      amount: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      alert_days_before: 3,
      notes: '',
    });
    setIsChequeModalOpen(true);
  };

  const handleOpenEditCheque = (chk: Cheque) => {
    setEditingCheque(chk);
    const custId = typeof chk.customer_id === 'object' ? (chk.customer_id as any)?.id : chk.customer_id;
    const supId = typeof chk.supplier_id === 'object' ? (chk.supplier_id as any)?.id : chk.supplier_id;

    setFormState({
      type: chk.type,
      sayad_id: chk.sayad_id,
      cheque_number: chk.cheque_number,
      bank_name: chk.bank_name,
      branch_name: chk.branch_name || '',
      account_number: chk.account_number || '',
      drawer_name: chk.drawer_name,
      customer_id: custId || '',
      supplier_id: supId || '',
      amount: chk.amount,
      issue_date: chk.issue_date,
      due_date: chk.due_date,
      alert_days_before: chk.alert_days_before || 3,
      notes: chk.notes || '',
    });
    setIsChequeModalOpen(true);
  };

  const handleSaveCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id || !formState.sayad_id || !formState.cheque_number || !formState.amount) return;

    try {
      const payload: Partial<Cheque> = {
        id: editingCheque?.id,
        organization_id: currentOrganization.id,
        type: formState.type,
        sayad_id: formState.sayad_id.trim(),
        cheque_number: formState.cheque_number.trim(),
        bank_name: formState.bank_name.trim(),
        branch_name: formState.branch_name.trim() || undefined,
        account_number: formState.account_number.trim() || undefined,
        drawer_name: formState.drawer_name.trim(),
        customer_id: formState.type === 'received' && formState.customer_id ? Number(formState.customer_id) : null,
        supplier_id: formState.type === 'issued' && formState.supplier_id ? Number(formState.supplier_id) : null,
        amount: Number(formState.amount),
        issue_date: formState.issue_date,
        due_date: formState.due_date,
        alert_days_before: Number(formState.alert_days_before) || 3,
        status: editingCheque ? editingCheque.status : 'registered',
        notes: formState.notes.trim() || undefined,
      };

      await storage.saveCheque(payload);
      setIsChequeModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Error saving cheque:', err);
    }
  };

  const handleDeleteCheque = async (id: number) => {
    if (confirm(t('accounting.deleteChequeConfirm'))) {
      try {
        await storage.deleteCheque(id);
        loadData();
      } catch (err) {
        console.error('Error deleting cheque:', err);
      }
    }
  };

  const handleOpenStatusModal = (chk: Cheque) => {
    setStatusActionCheque(chk);
    setNewStatus(chk.status === 'registered' ? 'in_bank' : 'cleared');
    const defaultAcc = accounts.find((a) => a.is_default) || accounts[0];
    setTargetAccountId(defaultAcc?.id ?? '');
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusActionCheque?.id) return;

    try {
      await storage.updateChequeStatus(
        statusActionCheque.id,
        newStatus,
        targetAccountId ? Number(targetAccountId) : undefined
      );
      setIsStatusModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Error updating cheque status:', err);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const totalReceived = cheques.filter((c) => c.type === 'received').reduce((sum, c) => sum + Number(c.amount), 0);
    const totalIssued = cheques.filter((c) => c.type === 'issued').reduce((sum, c) => sum + Number(c.amount), 0);
    const pendingClearing = cheques.filter((c) => c.status === 'in_bank').reduce((sum, c) => sum + Number(c.amount), 0);
    const bounced = cheques.filter((c) => c.status === 'bounced').reduce((sum, c) => sum + Number(c.amount), 0);
    const dueAlerts = cheques.filter((c) => {
      if (c.status === 'cleared' || c.status === 'cancelled' || c.status === 'returned') return false;
      const days = c.days_until_due ?? 0;
      return days <= (c.alert_days_before || 3);
    });

    return {
      totalReceived,
      totalIssued,
      pendingClearing,
      bounced,
      dueAlertsCount: dueAlerts.length,
      dueAlerts,
    };
  }, [cheques]);

  // Filtered List
  const filteredCheques = useMemo(() => {
    return cheques.filter((chk) => {
      if (activeTab === 'received' && chk.type !== 'received') return false;
      if (activeTab === 'issued' && chk.type !== 'issued') return false;
      if (activeTab === 'alerts') {
        if (chk.status === 'cleared' || chk.status === 'cancelled' || chk.status === 'returned') return false;
        const days = chk.days_until_due ?? 0;
        if (days > (chk.alert_days_before || 3)) return false;
      }

      if (statusFilter !== 'all' && chk.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          chk.sayad_id.includes(q) ||
          chk.cheque_number.includes(q) ||
          chk.bank_name.toLowerCase().includes(q) ||
          chk.drawer_name.toLowerCase().includes(q) ||
          (chk.customer_name && chk.customer_name.toLowerCase().includes(q)) ||
          (chk.supplier_name && chk.supplier_name.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [cheques, activeTab, statusFilter, searchQuery]);

  const getStatusBadge = (status: ChequeStatus) => {
    switch (status) {
      case 'cleared':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            {t('accounting.statusCleared')}
          </span>
        );
      case 'in_bank':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
            <Clock className="w-3 h-3" />
            {t('accounting.statusInBank')}
          </span>
        );
      case 'bounced':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
            <XCircle className="w-3 h-3" />
            {t('accounting.statusBounced')}
          </span>
        );
      case 'transferred':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
            <ArrowRightLeft className="w-3 h-3" />
            {t('accounting.statusTransferred')}
          </span>
        );
      case 'cancelled':
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {t('accounting.statusCancelled')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
            <FileText className="w-3 h-3" />
            {t('accounting.statusRegistered')}
          </span>
        );
    }
  };

  const formatSayadId = (id: string) => {
    if (!id || id.length !== 16) return id;
    return `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('accounting.chequesTitle')}</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t('accounting.chequesSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleOpenNewCheque('issued')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>ثبت چک پرداختی</span>
          </button>

          <button
            onClick={() => handleOpenNewCheque('received')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('accounting.newCheque')} (دریافتی)</span>
          </button>
        </div>
      </div>

      {/* Due Date Alert Banner */}
      {stats.dueAlertsCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                توجه: {stats.dueAlertsCount} فقره چک در آستانه سررسید یا سررسید گذشته دارید!
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                برای جلوگیری از برگشت چک‌ها یا پیگیری به موقع وصول مطالبات، وضعیت این چک‌ها را بررسی کنید.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('alerts')}
            className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            مشاهده چک‌های هشدار
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('accounting.totalReceivedAmount')}</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(stats.totalReceived)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('accounting.totalIssuedAmount')}</span>
            <ArrowUpRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(stats.totalIssued)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('accounting.pendingClearingAmount')}</span>
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(stats.pendingClearing)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('accounting.bouncedAmount')}</span>
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-lg font-bold text-red-600 dark:text-red-400">
            {formatCurrency(stats.bounced)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              { id: 'all', label: 'همه چک‌ها' },
              { id: 'received', label: t('accounting.receivedCheques') },
              { id: 'issued', label: t('accounting.issuedCheques') },
              { id: 'alerts', label: `هشدار سررسید (${stats.dueAlertsCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="جستجوی شناسه صیاد، سریال، بانک، صاحب چک..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-9 pe-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <span className="text-[11px] font-medium text-neutral-400 me-2 shrink-0">وضعیت:</span>
          {[
            { id: 'all', label: 'همه وضعیت‌ها' },
            { id: 'registered', label: t('accounting.statusRegistered') },
            { id: 'in_bank', label: t('accounting.statusInBank') },
            { id: 'cleared', label: t('accounting.statusCleared') },
            { id: 'bounced', label: t('accounting.statusBounced') },
            { id: 'transferred', label: t('accounting.statusTransferred') },
            { id: 'cancelled', label: t('accounting.statusCancelled') },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cheques List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-xs text-neutral-500">
          <RefreshCw className="w-5 h-5 animate-spin mb-3 text-neutral-400" />
          <span>در حال بارگذاری اطلاعات چک‌های صیادی...</span>
        </div>
      ) : filteredCheques.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800">
          <CheckSquare className="w-8 h-8 mx-auto text-neutral-400 mb-3" />
          <p className="text-xs text-neutral-500">{t('accounting.noCheques')}</p>
          <button
            onClick={() => handleOpenNewCheque('received')}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('accounting.newCheque')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCheques.map((chk) => {
            const isReceived = chk.type === 'received';
            const daysLeft = chk.days_until_due ?? 0;
            const isDuePassed = chk.is_overdue;
            const isDueSoon = !isDuePassed && daysLeft <= (chk.alert_days_before || 3) && chk.status !== 'cleared' && chk.status !== 'cancelled';

            return (
              <div
                key={chk.id}
                className={`p-5 rounded-2xl border bg-white dark:bg-neutral-900 flex flex-col justify-between transition-all shadow-xs relative overflow-hidden ${
                  isDuePassed
                    ? 'border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10'
                    : isDueSoon
                    ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-neutral-200/80 dark:border-neutral-800'
                }`}
              >
                <div>
                  {/* Card Header: Type Badge & Status */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isReceived
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {isReceived ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        {isReceived ? 'چک دریافتی' : 'چک پرداختی'}
                      </span>
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        {chk.bank_name} {chk.branch_name ? `(${chk.branch_name})` : ''}
                      </span>
                    </div>

                    <div>{getStatusBadge(chk.status)}</div>
                  </div>

                  {/* Sayad ID & Serial */}
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-2 mb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-500 font-medium">شناسه صیادی:</span>
                      <div className="flex items-center gap-2 font-mono font-bold text-neutral-900 dark:text-white tracking-widest text-xs">
                        <span>{formatSayadId(chk.sayad_id)}</span>
                        <button
                          onClick={() => handleCopy(chk.sayad_id, `sayad-${chk.id}`)}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                        >
                          {copiedField === `sayad-${chk.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>شماره سریال چک:</span>
                      <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">{chk.cheque_number}</span>
                    </div>
                  </div>

                  {/* Drawer & Beneficiary Details */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">صاحب حساب / صادرکننده:</span>
                      <span className="font-semibold text-neutral-900 dark:text-white">{chk.drawer_name}</span>
                    </div>

                    {(chk.customer_name || chk.supplier_name) && (
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">طرف‌حساب (مشتری/تامین‌کننده):</span>
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                          {chk.customer_name || chk.supplier_name}
                        </span>
                      </div>
                    )}

                    {/* Dates & Due Status */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-neutral-500">سررسید:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold font-mono text-neutral-900 dark:text-white">
                          {formatPersianDate(chk.due_date)}
                        </span>
                        {chk.status !== 'cleared' && chk.status !== 'cancelled' && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isDuePassed
                                ? 'bg-red-600 text-white'
                                : daysLeft === 0
                                ? 'bg-amber-500 text-white'
                                : isDueSoon
                                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            {isDuePassed
                              ? `${Math.abs(daysLeft)} ${t('accounting.passedDays')}`
                              : daysLeft === 0
                              ? t('accounting.todayDue')
                              : `${daysLeft} ${t('accounting.daysRemaining')}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cheque Amount */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-baseline justify-between">
                    <span className="text-xs text-neutral-500">مبلغ چک:</span>
                    <div className="text-base font-extrabold text-neutral-900 dark:text-white font-mono">
                      {formatCurrency(chk.amount)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenStatusModal(chk)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تغییر وضعیت / وصول</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditCheque(chk)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCheque(chk.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cheque Registration / Edit Modal */}
      {isChequeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <form onSubmit={handleSaveCheque}>
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {editingCheque ? t('accounting.editCheque') : t('accounting.newCheque')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsChequeModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('accounting.chequeType')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, type: 'received' })}
                      className={`py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        formState.type === 'received'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {t('accounting.receivedCheques')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, type: 'issued' })}
                      className={`py-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        formState.type === 'issued'
                          ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {t('accounting.issuedCheques')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('accounting.sayadId')} (۱۶ رقم) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    placeholder={t('accounting.sayadIdPlaceholder')}
                    value={formState.sayad_id}
                    onChange={(e) => setFormState({ ...formState, sayad_id: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono font-bold tracking-widest text-center"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.chequeNumber')} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="سریال برگه چک..."
                      value={formState.cheque_number}
                      onChange={(e) => setFormState({ ...formState, cheque_number: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.chequeAmount')} ({t('accounting.toman')}) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="0"
                      value={formState.amount}
                      onChange={(e) => setFormState({ ...formState, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-bold font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.bankName')} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثلاً ملت، ملی، صادرات، تجارت..."
                      value={formState.bank_name}
                      onChange={(e) => setFormState({ ...formState, bank_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.branchName')}
                    </label>
                    <input
                      type="text"
                      placeholder="نام یا کد شعبه..."
                      value={formState.branch_name}
                      onChange={(e) => setFormState({ ...formState, branch_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.drawerName')} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="نام صاحب حساب صادرکننده..."
                      value={formState.drawer_name}
                      onChange={(e) => setFormState({ ...formState, drawer_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {formState.type === 'received' ? 'انتخاب مشتری طرف‌حساب' : 'انتخاب تامین‌کننده'}
                    </label>
                    {formState.type === 'received' ? (
                      <select
                        value={formState.customer_id}
                        onChange={(e) => setFormState({ ...formState, customer_id: Number(e.target.value) || '' })}
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                      >
                        <option value="">انتخاب مشتری (اختیاری)...</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={formState.supplier_id}
                        onChange={(e) => setFormState({ ...formState, supplier_id: Number(e.target.value) || '' })}
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                      >
                        <option value="">انتخاب تامین‌کننده (اختیاری)...</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <DateInput
                    label={t('accounting.issueDate')}
                    value={formState.issue_date}
                    onChange={(iso) => setFormState({ ...formState, issue_date: iso })}
                  />

                  <DateInput
                    label={`${t('accounting.dueDate')} *`}
                    required
                    value={formState.due_date}
                    onChange={(iso) => setFormState({ ...formState, due_date: iso })}
                  />

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      روز هشدار سررسید
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={formState.alert_days_before}
                      onChange={(e) => setFormState({ ...formState, alert_days_before: Number(e.target.value) || 3 })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    توضیحات و بابت چک
                  </label>
                  <textarea
                    rows={2}
                    placeholder="بابت تسویه فاکتور، تضمین، بیعانه..."
                    value={formState.notes}
                    onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden resize-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2 bg-neutral-50 dark:bg-neutral-800/40">
                <button
                  type="button"
                  onClick={() => setIsChequeModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors cursor-pointer"
                >
                  {editingCheque ? 'بروزرسانی چک' : 'ثبت برگه چک'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {isStatusModalOpen && statusActionCheque && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <form onSubmit={handleUpdateStatus}>
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('accounting.changeStatusModalTitle')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-100 dark:border-neutral-800 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-neutral-900 dark:text-white">
                    <span>{statusActionCheque.bank_name} - {statusActionCheque.drawer_name}</span>
                    <span>{formatCurrency(statusActionCheque.amount)} تومان</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    صیاد: {statusActionCheque.sayad_id} • سررسید: {formatPersianDate(statusActionCheque.due_date)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    وضعیت جدید چک
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'cleared', label: t('accounting.chequeActionClear'), color: 'emerald' },
                      { id: 'in_bank', label: t('accounting.chequeActionDepositBank'), color: 'blue' },
                      { id: 'bounced', label: t('accounting.chequeActionBounce'), color: 'red' },
                      { id: 'transferred', label: t('accounting.chequeActionTransfer'), color: 'purple' },
                      { id: 'cancelled', label: t('accounting.chequeActionCancel'), color: 'neutral' },
                    ].map((st) => (
                      <button
                        type="button"
                        key={st.id}
                        onClick={() => setNewStatus(st.id as ChequeStatus)}
                        className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                          newStatus === st.id
                            ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {newStatus === 'cleared' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {statusActionCheque.type === 'received'
                        ? t('accounting.targetAccountForClear')
                        : t('accounting.targetAccountForIssue')} *
                    </label>
                    <select
                      required
                      value={targetAccountId}
                      onChange={(e) => setTargetAccountId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                    >
                      <option value="">انتخاب حساب بانکی...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (موجودی فعلی: {formatCurrency(a.current_balance)} تومان)
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      با وصول چک، مبلغ {formatCurrency(statusActionCheque.amount)} تومان به صورت خودکار به مانده این حساب افزوده/کسر می‌گردد.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2 bg-neutral-50 dark:bg-neutral-800/40">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors cursor-pointer"
                >
                  تأیید و اعمال وضعیت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
