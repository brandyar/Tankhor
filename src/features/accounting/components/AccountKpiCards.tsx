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
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {/* Total Liquidity */}
      <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium line-clamp-1">{t('accounting.totalLiquidity')}</span>
          <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        </div>
        <div className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
          {formatCurrency(stats.totalLiquidity)}{' '}
          <span className="text-[10px] sm:text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
        </div>
      </div>

      {/* Bank Balance */}
      <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium line-clamp-1">{t('accounting.bankBalance')}</span>
          <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        </div>
        <div className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
          {formatCurrency(stats.bankBalance)}{' '}
          <span className="text-[10px] sm:text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
        </div>
      </div>

      {/* Cashbox Balance */}
      <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium line-clamp-1">{t('accounting.cashboxBalance')}</span>
          <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        </div>
        <div className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">
          {formatCurrency(stats.cashboxBalance)}{' '}
          <span className="text-[10px] sm:text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
        </div>
      </div>

      {/* POS Balance */}
      <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center justify-between text-neutral-500 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium line-clamp-1">{t('accounting.posBalance')}</span>
          <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400 shrink-0" />
        </div>
        <div className="text-base sm:text-lg font-bold text-purple-600 dark:text-purple-400">
          {formatCurrency(stats.posBalance)}{' '}
          <span className="text-[10px] sm:text-xs font-normal text-neutral-500">{t('accounting.toman')}</span>
        </div>
      </div>
    </div>
  );
};
