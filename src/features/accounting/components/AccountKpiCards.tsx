import React from 'react';
import { useTranslation } from '../../../i18n';
import { formatCurrency } from '../../../utils/formatters';
import { Building2, Landmark, Wallet, CreditCard } from 'lucide-react';

interface AccountKpiCardsProps {
  stats: {
    totalLiquidity: number;
    cashboxBalance: number;
    bankBalance: number;
    posBalance: number;
  };
}

export const AccountKpiCards: React.FC<AccountKpiCardsProps> = ({ stats }) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Liquidity */}
      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 mb-2">
          <span className="text-xs font-medium">{t('accounting.totalLiquidity')}</span>
          <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="text-lg font-bold text-neutral-900 dark:text-white">
          {formatCurrency(stats.totalLiquidity)}{' '}
          <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
        </div>
      </div>

      {/* Bank Balance */}
      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 mb-2">
          <span className="text-xs font-medium">{t('accounting.bankBalance')}</span>
          <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
          {formatCurrency(stats.bankBalance)}{' '}
          <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
        </div>
      </div>

      {/* Cashbox Balance */}
      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 mb-2">
          <span className="text-xs font-medium">{t('accounting.cashboxBalance')}</span>
          <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
          {formatCurrency(stats.cashboxBalance)}{' '}
          <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
        </div>
      </div>

      {/* POS Balance */}
      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 mb-2">
          <span className="text-xs font-medium">{t('accounting.posBalance')}</span>
          <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
          {formatCurrency(stats.posBalance)}{' '}
          <span className="text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
        </div>
      </div>
    </div>
  );
};
