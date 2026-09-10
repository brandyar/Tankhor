import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { PageHeader } from '../../components/ui/PageHeader';
import { ModuleLockedCard } from '../../components/modules/ModuleLockedCard';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { AccountingDashboardPage } from './AccountingDashboardPage';
import { ExpensesPage } from './ExpensesPage';
import { PersonLedgersPage } from './PersonLedgersPage';
import { FinancialAccountsPage } from './FinancialAccountsPage';
import { ChequesPage } from './ChequesPage';
import { LandedCostsPage } from './LandedCostsPage';
import { TaxReportsPage } from './TaxReportsPage';
import { AccountingExportPage } from './AccountingExportPage';
import {
  BarChart3,
  Receipt,
  Users,
  Wallet,
  CheckSquare,
  Scale,
  FileText,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';

interface AccountingViewProps {
  activeSubRoute?: string;
  onNavigate?: (subRoute: string) => void;
}

export const AccountingView: React.FC<AccountingViewProps> = ({
  activeSubRoute = 'accounting/dashboard',
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { hasAccess, loading } = useModuleAccess();
  const hasAccountingAccess = hasAccess('accounting');

  // Internal tab state if onNavigate is not passed
  const [internalTab, setInternalTab] = useState<string>(activeSubRoute);

  const activeTab = onNavigate ? activeSubRoute : internalTab;
  const handleTabChange = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    } else {
      setInternalTab(tab);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-xs text-neutral-500">
        <RefreshCw className="w-5 h-5 animate-spin mb-3 text-neutral-400" />
        <span>در حال بررسی مجوزهای ماژول حسابداری...</span>
      </div>
    );
  }

  // If module is locked, show ModuleLockedCard
  if (!hasAccountingAccess) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('accounting.title')}
          subtitle={t('accounting.subtitle')}
        />
        <ModuleLockedCard
          moduleSlug="accounting"
          moduleName={t('accounting.title')}
          description={t('accounting.subtitle')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Navigation Tabs */}
      <div className="space-y-4">
        <PageHeader
          title={t('accounting.title')}
          subtitle={t('accounting.subtitle')}
        />

        <div className="flex border-b border-neutral-200/80 dark:border-neutral-800 gap-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => handleTabChange('accounting/dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'accounting/dashboard' || activeTab === 'accounting'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{t('accounting.dashboard')}</span>
          </button>

          <button
            onClick={() => handleTabChange('accounting/expenses')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'accounting/expenses'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>{t('accounting.expensesTitle')}</span>
          </button>

          <button
            onClick={() => handleTabChange('accounting/persons')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'accounting/persons'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t('accounting.personsTitle')}</span>
          </button>

          <button
            onClick={() => handleTabChange('accounting/accounts')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'accounting/accounts'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>{t('accounting.accountsTitle')}</span>
          </button>

          <button
            onClick={() => handleTabChange('accounting/cheques')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'accounting/cheques'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>{t('accounting.chequesTitle')}</span>
          </button>

          <button
            onClick={() => handleTabChange('accounting/landed-costs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'accounting/landed-costs'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>{t('navigation.landedCosts')}</span>
          </button>

          <button
            onClick={() => handleTabChange('accounting/tax')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'accounting/tax'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('navigation.taxReports')}</span>
          </button>

          <button
            onClick={() => handleTabChange('accounting/export')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'accounting/export'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t('navigation.accountingExport')}</span>
          </button>
        </div>
      </div>

      {/* Active Sub-View */}
      <ErrorBoundary key={activeTab} onReset={() => handleTabChange('accounting/dashboard')}>
        {activeTab === 'accounting/expenses' ? (
          <ExpensesPage />
        ) : activeTab === 'accounting/persons' ? (
          <PersonLedgersPage />
        ) : activeTab === 'accounting/accounts' ? (
          <FinancialAccountsPage />
        ) : activeTab === 'accounting/cheques' ? (
          <ChequesPage />
        ) : activeTab === 'accounting/landed-costs' ? (
          <LandedCostsPage />
        ) : activeTab === 'accounting/tax' ? (
          <TaxReportsPage />
        ) : activeTab === 'accounting/export' ? (
          <AccountingExportPage />
        ) : (
          <AccountingDashboardPage
            onNavigateSubRoute={handleTabChange}
            onOpenNewExpense={() => handleTabChange('accounting/expenses')}
            onOpenNewTransaction={() => handleTabChange('accounting/persons')}
          />
        )}
      </ErrorBoundary>
    </div>
  );
};
