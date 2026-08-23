import React, { useState } from 'react';
import { I18nProvider } from './i18n';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { AppShell } from './components/layout/AppShell';
import { LoginView } from './features/auth/LoginView';
import { DashboardView } from './features/dashboard/DashboardView';
import { ProductsView } from './features/products/ProductsView';
import { VariantsView } from './features/products/VariantsView';
import { CategoriesView } from './features/products/CategoriesView';
import { CollectionsView } from './features/products/CollectionsView';
import { BrandsView } from './features/products/BrandsView';
import { SeasonsView } from './features/products/SeasonsView';
import { ColorsView } from './features/products/ColorsView';
import { SizeGroupsView } from './features/products/SizeGroupsView';
import { SizesView } from './features/products/SizesView';
import { SizeGuidesView } from './features/products/SizeGuidesView';
import { InventoryView } from './features/inventory/InventoryView';
import { BarcodePrintView } from './features/inventory/BarcodePrintView';
import { WarehousesView } from './features/inventory/WarehousesView';
import { LocationsView } from './features/inventory/LocationsView';
import { MovementsView } from './features/inventory/MovementsView';
import { TransfersView } from './features/inventory/TransfersView';
import { OrdersView } from './features/orders/OrdersView';
import { CreateOrderView } from './features/orders/CreateOrderView';
import { CustomersView } from './features/customers/CustomersView';
import { SuppliersView } from './features/purchasing/SuppliersView';
import { PurchaseOrdersView } from './features/purchasing/PurchaseOrdersView';
import { SettingsView } from './features/settings/SettingsView';
import { RefreshCw, Shirt } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4 shadow-md animate-bounce">
          <Shirt className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm font-bold text-neutral-800">سامانه تن‌خور</p>
        <p className="text-xs text-neutral-500 font-mono mt-1 flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-400" />
          <span>در حال بررسی نشست کاربری...</span>
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const renderCurrentView = () => {
    switch (currentRoute) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentRoute} />;
      case 'products/all':
        return <ProductsView />;
      case 'products/variants':
        return <VariantsView />;
      case 'products/categories':
        return <CategoriesView />;
      case 'products/collections':
        return <CollectionsView />;
      case 'products/brands':
        return <BrandsView />;
      case 'products/seasons':
        return <SeasonsView />;
      case 'products/colors':
        return <ColorsView />;
      case 'products/size-groups':
        return <SizeGroupsView />;
      case 'products/sizes':
        return <SizesView />;
      case 'products/size-guides':
        return <SizeGuidesView />;
      case 'inventory/overview':
        return <InventoryView />;
      case 'inventory/barcodes':
      case 'products/barcodes':
        return <BarcodePrintView />;
      case 'inventory/warehouses':
        return <WarehousesView />;
      case 'inventory/locations':
        return <LocationsView />;
      case 'inventory/movements':
        return <MovementsView />;
      case 'inventory/transfers':
        return <TransfersView />;
      case 'orders/all':
        return <OrdersView onNavigateToCreate={() => setCurrentRoute('orders/create')} />;
      case 'orders/create':
        return <CreateOrderView onOrderCreated={() => setCurrentRoute('orders/all')} />;
      case 'customers/all':
        return <CustomersView />;
      case 'purchasing/suppliers':
        return <SuppliersView />;
      case 'purchasing/orders':
        return <PurchaseOrdersView />;
      case 'settings/org':
      case 'settings/sync':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={setCurrentRoute} />;
    }
  };

  return (
    <OrganizationProvider>
      <AppShell currentRoute={currentRoute} onNavigate={setCurrentRoute}>
        {renderCurrentView()}
      </AppShell>
    </OrganizationProvider>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </I18nProvider>
  );
}
