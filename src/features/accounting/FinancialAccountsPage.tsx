import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { useOrganization } from '../../context/OrganizationContext';
import {
  FinancialAccount,
  FinancialAccountType,
  TreasuryTransaction,
  TreasuryTransactionType,
} from '../../types/accounting';
import { formatCurrency, formatPersianDate } from '../../utils/formatters';
import { DateInput } from '../../components/ui/DateInput';
import {
  Wallet,
  Landmark,
  CreditCard,
  Plus,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  History,
  Edit2,
  Trash2,
  Copy,
  Check,
  Building2,
  Coins,
  RefreshCw,
} from 'lucide-react';

export const FinancialAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const storage = storageManager.getAdapter();
  const { activeOrganization } = useOrganization();

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [treasuryTxs, setTreasuryTxs] = useState<TreasuryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<TreasuryTransactionType>('transfer');
  const [sourceAccountId, setSourceAccountId] = useState<number | ''>('');
  const [destinationAccountId, setDestinationAccountId] = useState<number | ''>('');
  const [transferAmount, setTransferAmount] = useState<number | ''>('');
  const [transferTrackingCode, setTransferTrackingCode] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferDescription, setTransferDescription] = useState('');

  // History Drawer state
  const [selectedHistoryAccount, setSelectedHistoryAccount] = useState<FinancialAccount | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State for Account Modal
  const [accForm, setAccForm] = useState<{
    name: string;
    type: FinancialAccountType;
    bank_name: string;
    account_number: string;
    card_number: string;
    shaba_number: string;
    pos_terminal_id: string;
    initial_balance: number | '';
    is_default: boolean;
    status: 'active' | 'archived';
  }>({
    name: '',
    type: 'cashbox',
    bank_name: '',
    account_number: '',
    card_number: '',
    shaba_number: '',
    pos_terminal_id: '',
    initial_balance: '',
    is_default: false,
    status: 'active',
  });

  const loadData = async () => {
    if (!activeOrganization?.id) return;
    setLoading(true);
    try {
      const accList = await storage.getFinancialAccounts({ organization_id: activeOrganization.id });
      setAccounts(accList);
      const txList = await storage.getTreasuryTransactions({ organization_id: activeOrganization.id });
      setTreasuryTxs(txList);
    } catch (err) {
      console.error('Error loading financial accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization?.id]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenNewAccount = () => {
    setEditingAccount(null);
    setAccForm({
      name: '',
      type: 'cashbox',
      bank_name: '',
      account_number: '',
      card_number: '',
      shaba_number: '',
      pos_terminal_id: '',
      initial_balance: '',
      is_default: accounts.length === 0,
      status: 'active',
    });
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: FinancialAccount) => {
    setEditingAccount(acc);
    setAccForm({
      name: acc.name,
      type: acc.type as FinancialAccountType,
      bank_name: acc.bank_name || '',
      account_number: acc.account_number || '',
      card_number: acc.card_number || '',
      shaba_number: acc.shaba_number || '',
      pos_terminal_id: acc.pos_terminal_id || '',
      initial_balance: acc.initial_balance,
      is_default: acc.is_default,
      status: (acc.status as 'active' | 'archived') || 'active',
    });
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization?.id || !accForm.name.trim()) return;

    try {
      const payload: Partial<FinancialAccount> = {
        id: editingAccount?.id,
        organization_id: activeOrganization.id,
        name: accForm.name.trim(),
        type: accForm.type,
        bank_name: accForm.bank_name.trim() || null,
        account_number: accForm.account_number.trim() || null,
        card_number: accForm.card_number.trim() || null,
        shaba_number: accForm.shaba_number.trim() || null,
        pos_terminal_id: accForm.pos_terminal_id.trim() || null,
        initial_balance: Number(accForm.initial_balance) || 0,
        current_balance: editingAccount ? editingAccount.current_balance : (Number(accForm.initial_balance) || 0),
        is_default: accForm.is_default,
        status: accForm.status,
      };

      await storage.saveFinancialAccount(payload);
      setIsAccountModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Error saving account:', err);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (confirm(t('accounting.deleteAccountConfirm'))) {
      try {
        await storage.deleteFinancialAccount(id);
        if (selectedHistoryAccount?.id === id) {
          setSelectedHistoryAccount(null);
        }
        loadData();
      } catch (err) {
        console.error('Error deleting account:', err);
      }
    }
  };

  const handleOpenTransferModal = (type: TreasuryTransactionType, defaultAccId?: number) => {
    setTransferType(type);
    if (type === 'transfer') {
      setSourceAccountId(defaultAccId || (accounts[0]?.id ?? ''));
      setDestinationAccountId(accounts.find((a) => a.id !== (defaultAccId || accounts[0]?.id))?.id ?? '');
    } else if (type === 'deposit') {
      setDestinationAccountId(defaultAccId || (accounts[0]?.id ?? ''));
      setSourceAccountId('');
    } else if (type === 'withdrawal') {
      setSourceAccountId(defaultAccId || (accounts[0]?.id ?? ''));
      setDestinationAccountId('');
    }
    setTransferAmount('');
    setTransferTrackingCode(`TRX-${Math.floor(100000 + Math.random() * 900000)}`);
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferDescription('');
    setIsTransferModalOpen(true);
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization?.id || !transferAmount || Number(transferAmount) <= 0) return;

    try {
      const payload: Partial<TreasuryTransaction> = {
        organization_id: activeOrganization.id,
        type: transferType,
        source_account_id: transferType !== 'deposit' && sourceAccountId ? Number(sourceAccountId) : null,
        destination_account_id: transferType !== 'withdrawal' && destinationAccountId ? Number(destinationAccountId) : null,
        amount: Number(transferAmount),
        tracking_code: transferTrackingCode.trim() || undefined,
        transaction_date: transferDate,
        description: transferDescription.trim() || undefined,
      };

      await storage.saveTreasuryTransaction(payload);
      setIsTransferModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Error recording treasury transfer:', err);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalLiquidity = accounts.reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
    const cashboxBalance = accounts.filter((a) => a.type === 'cashbox' || a.type === 'petty_cash').reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
    const bankBalance = accounts.filter((a) => a.type === 'bank').reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
    const posBalance = accounts.filter((a) => a.type === 'pos').reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);

    return { totalLiquidity, cashboxBalance, bankBalance, posBalance };
  }, [accounts]);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (typeFilter !== 'all' && acc.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          acc.name.toLowerCase().includes(q) ||
          (acc.bank_name && acc.bank_name.toLowerCase().includes(q)) ||
          (acc.account_number && acc.account_number.includes(q)) ||
          (acc.card_number && acc.card_number.includes(q)) ||
          (acc.shaba_number && acc.shaba_number.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [accounts, typeFilter, searchQuery]);

  // Account History
  const accountHistoryTxs = useMemo(() => {
    if (!selectedHistoryAccount) return [];
    return treasuryTxs.filter((tx) => {
      const srcId = typeof tx.source_account_id === 'object' ? (tx.source_account_id as any)?.id : tx.source_account_id;
      const dstId = typeof tx.destination_account_id === 'object' ? (tx.destination_account_id as any)?.id : tx.destination_account_id;
      return Number(srcId) === selectedHistoryAccount.id || Number(dstId) === selectedHistoryAccount.id;
    });
  }, [selectedHistoryAccount, treasuryTxs]);

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return <Landmark className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'pos':
        return <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'petty_cash':
        return <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      default:
        return <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'bank':
        return t('accounting.bank');
      case 'pos':
        return t('accounting.pos');
      case 'petty_cash':
        return t('accounting.pettyCash');
      default:
        return t('accounting.cashbox');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Summary Cards */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">
            {t('accounting.accountsTitle')}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t('accounting.accountsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleOpenTransferModal('transfer')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{t('accounting.treasuryTransfer')}</span>
          </button>

          <button
            onClick={handleOpenNewAccount}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('accounting.newAccount')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('accounting.totalLiquidity')}</span>
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-white">
            {formatCurrency(stats.totalLiquidity)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('accounting.bankBalance')}</span>
            <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(stats.bankBalance)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('accounting.cashboxBalance')}</span>
            <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(stats.cashboxBalance)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('accounting.posBalance')}</span>
            <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(stats.posBalance)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="جستجوی نام حساب، شماره کارت، شبا یا بانک..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-9 pe-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'cashbox', 'bank', 'pos', 'petty_cash'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                typeFilter === type
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-700'
              }`}
            >
              {type === 'all'
                ? 'همه حساب‌ها'
                : type === 'cashbox'
                ? 'صندوق‌ها'
                : type === 'bank'
                ? 'بانک‌ها'
                : type === 'pos'
                ? 'کارتخوان‌ها'
                : 'تنخواه'}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-xs text-neutral-500">
          <RefreshCw className="w-5 h-5 animate-spin mb-3 text-neutral-400" />
          <span>در حال بارگذاری حساب‌ها و موجودی‌ها...</span>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800">
          <Wallet className="w-8 h-8 mx-auto text-neutral-400 mb-3" />
          <p className="text-xs text-neutral-500">{t('accounting.noAccounts')}</p>
          <button
            onClick={handleOpenNewAccount}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('accounting.newAccount')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((acc) => (
            <div
              key={acc.id}
              className={`p-5 rounded-xl border bg-white dark:bg-neutral-900 flex flex-col justify-between transition-all shadow-xs relative overflow-hidden ${
                acc.is_default
                  ? 'border-neutral-400 dark:border-neutral-600'
                  : 'border-neutral-200/80 dark:border-neutral-800'
              }`}
            >
              {acc.is_default && (
                <div className="absolute top-0 end-0 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-3 py-0.5 text-[10px] font-bold rounded-bl-lg">
                  {t('accounting.defaultBadge')}
                </div>
              )}

              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                      {getAccountTypeIcon(acc.type)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white line-clamp-1">
                        {acc.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-medium text-neutral-500">
                          {getAccountTypeLabel(acc.type)}
                        </span>
                        {acc.bank_name && (
                          <span className="text-[10px] text-neutral-400">
                            • {acc.bank_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Details Box */}
                <div className="space-y-1.5 py-3 border-y border-neutral-100 dark:border-neutral-800 text-[11px]">
                  {acc.card_number && (
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span>شماره کارت:</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span>{acc.card_number}</span>
                        <button
                          onClick={() => handleCopy(acc.card_number!, `card-${acc.id}`)}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                        >
                          {copiedField === `card-${acc.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {acc.account_number && (
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span>شماره حساب:</span>
                      <span className="font-mono">{acc.account_number}</span>
                    </div>
                  )}

                  {acc.shaba_number && (
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span>شماره شبا:</span>
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span>{acc.shaba_number}</span>
                        <button
                          onClick={() => handleCopy(acc.shaba_number!, `shaba-${acc.id}`)}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                        >
                          {copiedField === `shaba-${acc.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {acc.pos_terminal_id && (
                    <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                      <span>کد ترمینال پوز:</span>
                      <span className="font-mono">{acc.pos_terminal_id}</span>
                    </div>
                  )}
                </div>

                {/* Balance Display */}
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xs text-neutral-500">موجودی لحظه‌ای:</span>
                  <div className="text-base font-extrabold text-neutral-900 dark:text-white font-mono">
                    {formatCurrency(acc.current_balance)} <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenTransferModal('deposit', acc.id)}
                    title="واریز مستقیم به حساب"
                    className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenTransferModal('withdrawal', acc.id)}
                    title="برداشت مستقیم از حساب"
                    className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedHistoryAccount(acc)}
                    title="مشاهده ریز گردش و تراکنش‌ها"
                    className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditAccount(acc)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account History Modal / Drawer */}
      {selectedHistoryAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  {getAccountTypeIcon(selectedHistoryAccount.type)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    گردش تراکنش‌های {selectedHistoryAccount.name}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    موجودی فعلی: {formatCurrency(selectedHistoryAccount.current_balance)} {t('accounting.toman')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHistoryAccount(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              {accountHistoryTxs.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  {t('accounting.noTreasuryHistory')}
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {accountHistoryTxs.map((tx) => {
                    const srcId = typeof tx.source_account_id === 'object' ? (tx.source_account_id as any)?.id : tx.source_account_id;
                    const isDebit = Number(srcId) === selectedHistoryAccount.id; // Money went out
                    return (
                      <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isDebit
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isDebit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-white">
                              {tx.type === 'transfer'
                                ? isDebit
                                  ? `انتقال به ${tx.destination_account_name || 'حساب دیگر'}`
                                  : `واریز از ${tx.source_account_name || 'حساب دیگر'}`
                                : tx.type === 'deposit'
                                ? 'واریز مستقیم وجه'
                                : 'برداشت نقدی'}
                            </div>
                            <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                              <span>{formatPersianDate(tx.transaction_date)}</span>
                              {tx.tracking_code && <span>• پیگیری: {tx.tracking_code}</span>}
                              {tx.description && <span>• {tx.description}</span>}
                            </div>
                          </div>
                        </div>

                        <div className={`font-bold font-mono ${isDebit ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {isDebit ? '-' : '+'}{formatCurrency(tx.amount)} {t('accounting.toman')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
              <button
                onClick={() => setSelectedHistoryAccount(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Modal (Create / Edit) */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <form onSubmit={handleSaveAccount}>
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {editingAccount ? t('accounting.editAccount') : t('accounting.newAccount')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('accounting.accountName')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثلاً صندوق فروشگاه، جاری ملت، پوز سامان..."
                    value={accForm.name}
                    onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.accountType')}
                    </label>
                    <select
                      value={accForm.type}
                      onChange={(e) => setAccForm({ ...accForm, type: e.target.value as FinancialAccountType })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                    >
                      <option value="cashbox">{t('accounting.cashbox')}</option>
                      <option value="bank">{t('accounting.bank')}</option>
                      <option value="pos">{t('accounting.pos')}</option>
                      <option value="petty_cash">{t('accounting.pettyCash')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.initialBalance')} ({t('accounting.toman')})
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={accForm.initial_balance}
                      onChange={(e) => setAccForm({ ...accForm, initial_balance: e.target.value === '' ? '' : Number(e.target.value) })}
                      disabled={!!editingAccount}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white disabled:opacity-50"
                    />
                  </div>
                </div>

                {(accForm.type === 'bank' || accForm.type === 'pos') && (
                  <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          {t('accounting.bankName')}
                        </label>
                        <input
                          type="text"
                          placeholder="مثلاً ملت، سامان، ملی..."
                          value={accForm.bank_name}
                          onChange={(e) => setAccForm({ ...accForm, bank_name: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          {t('accounting.accountNumber')}
                        </label>
                        <input
                          type="text"
                          placeholder="شماره حساب..."
                          value={accForm.account_number}
                          onChange={(e) => setAccForm({ ...accForm, account_number: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        {t('accounting.cardNumber')}
                      </label>
                      <input
                        type="text"
                        maxLength={19}
                        placeholder="۶۱۰۴-۳۳۷۸-۹۰۱۲-۳۴۵۶"
                        value={accForm.card_number}
                        onChange={(e) => setAccForm({ ...accForm, card_number: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        {t('accounting.shabaNumber')}
                      </label>
                      <input
                        type="text"
                        maxLength={30}
                        placeholder="IR120120000000012345678901"
                        value={accForm.shaba_number}
                        onChange={(e) => setAccForm({ ...accForm, shaba_number: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono text-center"
                      />
                    </div>

                    {accForm.type === 'pos' && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          {t('accounting.posTerminalId')}
                        </label>
                        <input
                          type="text"
                          placeholder="شماره پایانه کارتخوان..."
                          value={accForm.pos_terminal_id}
                          onChange={(e) => setAccForm({ ...accForm, pos_terminal_id: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accForm.is_default}
                      onChange={(e) => setAccForm({ ...accForm, is_default: e.target.checked })}
                      className="rounded-sm border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    <span>{t('accounting.isDefaultAccount')}</span>
                  </label>
                </div>
              </div>

              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2 bg-neutral-50 dark:bg-neutral-800/40">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors cursor-pointer"
                >
                  {editingAccount ? 'بروزرسانی حساب' : 'ذخیره حساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Treasury Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <form onSubmit={handleSaveTransfer}>
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('accounting.treasuryTransfer')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    نوع عملیات
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'transfer', label: t('accounting.transfer') },
                      { id: 'deposit', label: t('accounting.deposit') },
                      { id: 'withdrawal', label: t('accounting.withdrawal') },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setTransferType(item.id as TreasuryTransactionType);
                        }}
                        className={`py-2 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                          transferType === item.id
                            ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {transferType !== 'deposit' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.sourceAccount')} *
                    </label>
                    <select
                      required
                      value={sourceAccountId}
                      onChange={(e) => setSourceAccountId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                    >
                      <option value="">انتخاب حساب مبدأ...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (موجودی: {formatCurrency(a.current_balance)} تومان)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {transferType !== 'withdrawal' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.destinationAccount')} *
                    </label>
                    <select
                      required
                      value={destinationAccountId}
                      onChange={(e) => setDestinationAccountId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                    >
                      <option value="">انتخاب حساب مقصد...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id} disabled={transferType === 'transfer' && Number(a.id) === Number(sourceAccountId)}>
                          {a.name} (موجودی: {formatCurrency(a.current_balance)} تومان)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.transferAmount')} ({t('accounting.toman')}) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="0"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-bold font-mono"
                    />
                  </div>

                  <DateInput
                    label={t('accounting.transferDate')}
                    value={transferDate}
                    onChange={(iso) => setTransferDate(iso)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('accounting.trackingCode')}
                  </label>
                  <input
                    type="text"
                    value={transferTrackingCode}
                    onChange={(e) => setTransferTrackingCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    توضیحات و بابت
                  </label>
                  <textarea
                    rows={2}
                    placeholder="شرح عملیات بانکی یا انتقال وجه..."
                    value={transferDescription}
                    onChange={(e) => setTransferDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden resize-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2 bg-neutral-50 dark:bg-neutral-800/40">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors cursor-pointer"
                >
                  ثبت گردش وجه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
