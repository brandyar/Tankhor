import React from 'react';
import { useTranslation } from '../../../i18n';
import { FinancialAccount, TreasuryTransaction } from '../../../types/accounting';
import { formatCurrency, formatPersianDate } from '../../../utils/formatters';
import {
  Wallet,
  Landmark,
  CreditCard,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  X,
} from 'lucide-react';

interface AccountHistoryDrawerProps {
  account: FinancialAccount | null;
  historyTransactions: TreasuryTransaction[];
  onClose: () => void;
}

export const AccountHistoryDrawer: React.FC<AccountHistoryDrawerProps> = ({
  account,
  historyTransactions,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!account) return null;

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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-neutral-800">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              {getAccountTypeIcon(account.type)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                گردش تراکنش‌های {account.name}
              </h3>
              <p className="text-[11px] text-neutral-500">
                موجودی فعلی: {formatCurrency(account.current_balance)} {t('accounting.toman')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
          {historyTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              {t('accounting.noTreasuryHistory')}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {historyTransactions.map((tx) => {
                const srcId =
                  typeof tx.source_account_id === 'object'
                    ? (tx.source_account_id as any)?.id
                    : tx.source_account_id;
                const isDebit = Number(srcId) === account.id; // Money went out

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
                        {isDebit ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        )}
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

                    <div
                      className={`font-bold font-mono ${
                        isDebit
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isDebit ? '-' : '+'}
                      {formatCurrency(tx.amount)} {t('accounting.toman')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 cursor-pointer transition-colors"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
