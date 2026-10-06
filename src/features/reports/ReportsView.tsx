import React from 'react';
import { SalesReportPage } from './SalesReportPage';
import { ApparelReportPage } from './ApparelReportPage';
import { InventoryPerformancePage } from './InventoryPerformancePage';

interface ReportsViewProps {
  activeSubRoute?: string;
  onNavigate?: (route: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  activeSubRoute = 'reports/sales',
}) => {
  if (activeSubRoute.includes('apparel') || activeSubRoute.includes('product') || activeSubRoute.includes('catalog')) {
    return <ApparelReportPage />;
  }
  if (activeSubRoute.includes('inventory') || activeSubRoute.includes('dead-stock')) {
    return <InventoryPerformancePage />;
  }
  return <SalesReportPage />;
};
