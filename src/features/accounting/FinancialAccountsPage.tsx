import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { useOrganization } from '../../context/OrganizationContext';
import {
  FinancialAccount,
  TreasuryTransaction,
  TreasuryTransactionType,
} from '../../types/accounting';
import { Warehouse } from '../../types';
import {
  Plus,
  ArrowRightLeft,
  Search,
  RefreshCw,
  Wallet,
} from 'lucide-react';

// Subcomponents
import { AccountKpiCards } from './components/AccountKpiCards';
import { AccountCard } from './components/AccountCard';
import { AccountHistoryDrawer } from './components/AccountHistoryDrawer';
import { AccountFormModal } from './components/AccountFormModal';
import { TreasuryTransferModal } from './components/TreasuryTransferModal';

export const FinancialAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const storage = storageManager.getAdapter();
  const { activeOrganization } = useOrganization();

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [treasuryTxs, setTreasuryTxs] = useState<TreasuryTransaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<TreasuryTransactionType>('transfer');
  const [transferDefaultAccId, setTransferDefaultAccId] = useState<number | undefined>(undefined);

  // History Drawer state
  const [selectedHistoryAccount, setSelectedHistoryAccount] = useState<FinancialAccount | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadData = async () => {
    if (!activeOrganization?.id) return;
    setLoading(true);
    try {
      if (storage.reconcileOrdersWithTreasury) {
        try {
          await storage.reconcileOrdersWithTreasury(activeOrganization.id);
        } catch {
          // ignore
        }
      }
      const [accList, txList, whList] = await Promise.all([
        storage.getFinancialAccounts({ organization_id: activeOrganization.id }),
        storage.getTreasuryTransactions({ organization_id: activeOrganization.id }),
        storage.getWarehouses({ organization_id: activeOrganization.id }),
      ]);
      setAccounts(accList);
      setTreasuryTxs(txList);
      setWarehouses(whList);
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
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: FinancialAccount) => {
    setEditingAccount(acc);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (payload: Partial<FinancialAccount>) => {
    if (!activeOrganization?.id) return;
    await storage.saveFinancialAccount({
      ...payload,
      organization_id: activeOrganization.id,
    });
    loadData();
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
    setTransferDefaultAccId(defaultAccId);
    setIsTransferModalOpen(true);
  };

  const handleSaveTransfer = async (payload: Partial<TreasuryTransaction>) => {
    if (!activeOrganization?.id) return;
    await storage.saveTreasuryTransaction({
      ...payload,
      organization_id: activeOrganization.id,
    });
    loadData();
  };

  // Compute dynamic real-time balances from treasury transactions
  const accountsWithComputedBalances = useMemo(() => {
    return accounts.map((acc) => {
      const accId = Number(acc.id);
      let balance = Number(acc.initial_balance) || 0;

      treasuryTxs.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        const srcId =
          typeof tx.source_account_id === 'object'
            ? (tx.source_account_id as any)?.id
            : tx.source_account_id;
        const dstId =
          typeof tx.destination_account_id === 'object'
            ? (tx.destination_account_id as any)?.id
            : tx.destination_account_id;

        if (tx.type === 'deposit' && Number(dstId) === accId) {
          balance += amt;
        } else if (tx.type === 'withdrawal' && Number(srcId) === accId) {
          balance -= amt;
        } else if (tx.type === 'transfer') {
          if (Number(dstId) === accId) balance += amt;
          if (Number(srcId) === accId) balance -= amt;
        }
      });

      const finalBalance =
        treasuryTxs.length > 0
          ? balance
          : acc.current_balance !== undefined
          ? Number(acc.current_balance)
          : balance;

      return {
        ...acc,
        current_balance: finalBalance,
      };
    });
  }, [accounts, treasuryTxs]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalLiquidity = accountsWithComputedBalances.reduce(
      (sum, a) => sum + (Number(a.current_balance) || 0),
      0
    );
    const cashboxBalance = accountsWithComputedBalances
      .filter((a) => a.type === 'cashbox' || a.type === 'petty_cash')
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
    const bankBalance = accountsWithComputedBalances
      .filter((a) => a.type === 'bank')
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
    const posBalance = accountsWithComputedBalances
      .filter((a) => a.type === 'pos')
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);

    return { totalLiquidity, cashboxBalance, bankBalance, posBalance };
  }, [accountsWithComputedBalances]);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accountsWithComputedBalances.filter((acc) => {
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
  }, [accountsWithComputedBalances, typeFilter, searchQuery]);

  // Account History
  const accountHistoryTxs = useMemo(() => {
    if (!selectedHistoryAccount) return [];
    return treasuryTxs.filter((tx) => {
      const srcId =
        typeof tx.source_account_id === 'object'
          ? (tx.source_account_id as any)?.id
          : tx.source_account_id;
      const dstId =
        typeof tx.destination_account_id === 'object'
          ? (tx.destination_account_id as any)?.id
          : tx.destination_account_id;
      return (
        Number(srcId) === selectedHistoryAccount.id || Number(dstId) === selectedHistoryAccount.id
      );
    });
  }, [selectedHistoryAccount, treasuryTxs]);

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
            onClick={loadData}
            disabled={loading}
            title={t('common.refresh') || 'بروزرسانی و همگام‌سازی'}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('common.refresh') || 'بروزرسانی'}</span>
          </button>

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
      <AccountKpiCards stats={stats} />

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
            <AccountCard
              key={acc.id}
              account={acc}
              onDeposit={(accId) => handleOpenTransferModal('deposit', accId)}
              onWithdrawal={(accId) => handleOpenTransferModal('withdrawal', accId)}
              onViewHistory={(a) => setSelectedHistoryAccount(a)}
              onEdit={(a) => handleOpenEditAccount(a)}
              onDelete={(accId) => handleDeleteAccount(accId)}
              copiedField={copiedField}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}

      {/* Account History Modal / Drawer */}
      <AccountHistoryDrawer
        account={selectedHistoryAccount}
        historyTransactions={accountHistoryTxs}
        onClose={() => setSelectedHistoryAccount(null)}
      />

      {/* Account Modal (Create / Edit) */}
      <AccountFormModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        editingAccount={editingAccount}
        warehouses={warehouses}
        defaultWarehouseId={warehouses[0]?.id || ''}
        isFirstAccount={accounts.length === 0}
        onSave={handleSaveAccount}
      />

      {/* Treasury Transfer Modal */}
      <TreasuryTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        initialType={transferType}
        defaultAccountId={transferDefaultAccId}
        accounts={accounts}
        onSave={handleSaveTransfer}
      />
    </div>
  );
};
