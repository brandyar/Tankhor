import React, { useState } from 'react';
import { I18nProvider } from './i18n';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrganizationProvider, useOrganization } from './context/OrganizationContext';
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
import { isTauriEnvironment } from './storage';
import { WebFreePlanGuardModal } from './components/modals/WebFreePlanGuardModal';
import { ConfirmModalHost } from './components/ui/ConfirmModal';
import { UpdateNotificationModal } from './components/modals/UpdateNotificationModal';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { ShieldAlert, RefreshCw, Shirt, Home } from 'lucide-react';

const AccessDeniedCard: React.FC<{ userRole: string; onReturn: () => void }> = ({ userRole, onReturn }) => (
  <div className="py-12 px-4 max-w-xl mx-auto text-center">
    <Card className="p-8 border-amber-200 bg-amber-50/50">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-300/80 shadow-xs">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-neutral-900">عدم دسترسی به این بخش</h3>
      <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
        شما با نقش <strong className="text-amber-900 font-bold">{userRole}</strong> به این صفحه یا عملیات دسترسی ندارید.
      </p>
      <div className="mt-6 flex justify-center">
        <Button variant="primary" onClick={onReturn} icon={<Home className="w-4 h-4" />}>
          بازگشت به پیشخوان اصلی
        </Button>
      </div>
    </Card>
  </div>
);

const AuthenticatedApp: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');
  const { permissions, userRole, activeOrganization } = useOrganization();
  const isDesktop = isTauriEnvironment();
  const isWebFreeLocked = !isDesktop && !!activeOrganization && activeOrganization.plan === 'free';

  const isRouteAllowed = (route: string): boolean => {
    switch (route) {
      case 'dashboard':
        return true;
      case 'orders/create':
        return permissions.canCreateOrders;
      case 'orders/all':
        return permissions.canViewOrders;
      case 'customers/all':
        return permissions.canViewCustomers;
      case 'inventory/overview':
      case 'inventory/barcodes':
      case 'products/barcodes':
      case 'inventory/movements':
        return permissions.canViewInventory;
      case 'inventory/warehouses':
      case 'inventory/locations':
      case 'inventory/transfers':
        return permissions.canManageInventory;
      case 'products/all':
      case 'products/variants':
      case 'products/categories':
      case 'products/collections':
      case 'products/brands':
      case 'products/seasons':
      case 'products/colors':
      case 'products/size-groups':
      case 'products/sizes':
      case 'products/size-guides':
        return permissions.canViewProducts;
      case 'purchasing/suppliers':
      case 'purchasing/orders':
        return permissions.canViewPurchasing;
      case 'settings':
      case 'settings/org':
      case 'settings/sync':
        return permissions.canManageOrgSettings || permissions.canManageUsers;
      default:
        return true;
    }
  };

  const renderCurrentView = () => {
    if (!isRouteAllowed(currentRoute)) {
      return <AccessDeniedCard userRole={userRole} onReturn={() => setCurrentRoute('dashboard')} />;
    }

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
      case 'settings':
      case 'settings/org':
      case 'settings/sync':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={setCurrentRoute} />;
    }
  };

  // If user is on the Web with a Free plan organization, render the Dedicated Guard View only.
  // No AppShell, sidebar, dashboard, or data components are mounted in the DOM.
  if (isWebFreeLocked) {
    return <WebFreePlanGuardModal />;
  }

  return (
    <AppShell currentRoute={currentRoute} onNavigate={setCurrentRoute}>
      {renderCurrentView()}
    </AppShell>
  );
};

const MainAppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

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

  return (
    <OrganizationProvider>
      <AuthenticatedApp />
    </OrganizationProvider>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <MainAppContent />
        <ConfirmModalHost />
        <UpdateNotificationModal />
      </AuthProvider>
    </I18nProvider>
  );
}
