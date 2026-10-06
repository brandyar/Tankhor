import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useModuleAccess } from '../../hooks/useModuleAccess';
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
import { RefreshCw } from 'lucide-react';

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
      <ModuleLockedCard
        moduleSlug="accounting"
        moduleName={t('accounting.title')}
        description={t('accounting.subtitle')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Sub-View (Navigation handled directly by sidebar submenus) */}
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
