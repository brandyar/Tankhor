import React from 'react';
import { useTranslation } from '../../../i18n';
import { FinancialAccount } from '../../../types/accounting';
import { formatCurrency } from '../../../utils/formatters';
import {
  Wallet,
  Landmark,
  CreditCard,
  Building2,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Edit2,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';

interface AccountCardProps {
  account: FinancialAccount;
  onDeposit: (accountId: number) => void;
  onWithdrawal: (accountId: number) => void;
  onViewHistory: (account: FinancialAccount) => void;
  onEdit: (account: FinancialAccount) => void;
  onDelete: (accountId: number) => void;
  copiedField: string | null;
  onCopy: (text: string, id: string) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onDeposit,
  onWithdrawal,
  onViewHistory,
  onEdit,
  onDelete,
  copiedField,
  onCopy,
}) => {
  const { t } = useTranslation();

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

  const warehouseName =
    account.warehouse_name ||
    (typeof account.warehouse_id === 'object' && account.warehouse_id
      ? (account.warehouse_id as any)?.name
      : account.warehouse_id
      ? `انبار #${account.warehouse_id}`
      : null);

  return (
    <div
      className={`p-5 rounded-xl border bg-white dark:bg-neutral-900 flex flex-col justify-between transition-all shadow-xs relative overflow-hidden ${
        account.is_default
          ? 'border-neutral-400 dark:border-neutral-600'
          : 'border-neutral-200/80 dark:border-neutral-800'
      }`}
    >
      {account.is_default && (
        <div className="absolute top-0 end-0 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-3 py-0.5 text-[10px] font-bold rounded-bl-lg">
          {t('accounting.defaultBadge')}
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
              {getAccountTypeIcon(account.type)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white line-clamp-1">
                {account.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-medium text-neutral-500">
                  {getAccountTypeLabel(account.type)}
                </span>
                {account.bank_name && (
                  <span className="text-[10px] text-neutral-400">
                    • {account.bank_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Account Details Box */}
        <div className="space-y-1.5 py-3 border-y border-neutral-100 dark:border-neutral-800 text-[11px]">
          {/* Linked Warehouse */}
          {warehouseName && (
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>انبار متصل:</span>
              <div className="flex items-center gap-1 font-medium text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                <Building2 className="w-3 h-3 text-neutral-500" />
                <span>{warehouseName}</span>
              </div>
            </div>
          )}

          {account.card_number && (
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>شماره کارت:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span>{account.card_number}</span>
                <button
                  type="button"
                  onClick={() => onCopy(account.card_number!, `card-${account.id}`)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  {copiedField === `card-${account.id}` ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          )}

          {account.account_number && (
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>شماره حساب:</span>
              <span className="font-mono">{account.account_number}</span>
            </div>
          )}

          {account.shaba_number && (
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>شماره شبا:</span>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span>{account.shaba_number}</span>
                <button
                  type="button"
                  onClick={() => onCopy(account.shaba_number!, `shaba-${account.id}`)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  {copiedField === `shaba-${account.id}` ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          )}

          {account.pos_terminal_id && (
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>کد ترمینال پوز:</span>
              <span className="font-mono">{account.pos_terminal_id}</span>
            </div>
          )}
        </div>

        {/* Balance Display */}
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-xs text-neutral-500">موجودی لحظه‌ای:</span>
          <div className="text-base font-extrabold text-neutral-900 dark:text-white font-mono">
            {formatCurrency(account.current_balance)}{' '}
            <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDeposit(account.id)}
            title="واریز مستقیم به حساب"
            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onWithdrawal(account.id)}
            title="برداشت مستقیم از حساب"
            className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewHistory(account)}
            title="مشاهده ریز گردش و تراکنش‌ها"
            className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <History className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(account)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(account.id)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
