import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { ModuleLockedCard } from '../../components/modules/ModuleLockedCard';
import { ProductionOverviewView } from './ProductionOverviewView';
import { RawMaterialsView } from './RawMaterialsView';
import { BomsView } from './BomsView';
import { ProductionOrdersView } from './ProductionOrdersView';
import { ContractorsView } from './ContractorsView';
import { RefreshCw } from 'lucide-react';

interface ProductionViewProps {
  activeSubRoute?: string;
  onNavigate?: (subRoute: string) => void;
}

export const ProductionView: React.FC<ProductionViewProps> = ({
  activeSubRoute = 'production/overview',
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { hasAccess, loading } = useModuleAccess();
  const hasProductionAccess = hasAccess('production') || hasAccess('produce');

  const getSubTab = (route: string) => {
    if (route.includes('materials')) return 'materials';
    if (route.includes('boms')) return 'boms';
    if (route.includes('orders')) return 'orders';
    if (route.includes('contractors')) return 'contractors';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<string>(() => getSubTab(activeSubRoute));

  useEffect(() => {
    setActiveTab(getSubTab(activeSubRoute));
  }, [activeSubRoute]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onNavigate) {
      onNavigate(`production/${tab}`);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-xs text-neutral-500">
        <RefreshCw className="w-5 h-5 animate-spin mb-3 text-neutral-400" />
        <span>در حال بررسی مجوزهای ماژول تولید و برون‌سپاری...</span>
      </div>
    );
  }

  if (!hasProductionAccess) {
    return (
      <ModuleLockedCard
        moduleSlug="production"
        moduleName={t('navigation.productionGroup', 'تولید و برون‌سپاری')}
        description="مدیریت انبار مواد اولیه، فرمول ساخت (BOM)، دستور تولید، برون‌سپاری کارمزدی و محاسبه بهای تمام‌شده"
      />
    );
  }



  return (
    <div className="space-y-6 pb-12">
      {/* Active Sub-View */}
      {activeTab === 'overview' && <ProductionOverviewView onNavigateSubRoute={(sr) => handleTabChange(sr.replace('production/', ''))} />}
      {activeTab === 'materials' && <RawMaterialsView />}
      {activeTab === 'boms' && <BomsView />}
      {activeTab === 'orders' && <ProductionOrdersView />}
      {activeTab === 'contractors' && <ContractorsView />}
    </div>
  );
};
