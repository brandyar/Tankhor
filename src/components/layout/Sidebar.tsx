import React from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import {
  LayoutDashboard, ShoppingBag, Layers, Tag, Bookmark, Sun,
  Palette, Ruler, Warehouse as WarehouseIcon, MapPin, ArrowLeftRight,
  ClipboardList, ShoppingCart, Truck, Users, Settings, Shirt, Award,
  X, ChevronRight, ChevronLeft, PanelLeftClose, PanelLeft, Barcode, Printer, UserCheck
} from 'lucide-react';

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  isMobileOpen = false,
  onMobileClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { t, locale } = useTranslation();
  const { permissions } = useOrganization();
  const isRtl = locale === 'fa';

  const navGroups = [
    {
      title: null,
      items: [
        { route: 'dashboard', label: t('navigation.dashboard'), icon: LayoutDashboard },
      ],
    },
    {
      title: t('navigation.productsGroup'),
      items: [
        { route: 'products/all', label: t('navigation.allProducts'), icon: ShoppingBag, visible: permissions.canViewProducts },
        { route: 'products/variants', label: t('navigation.variants'), icon: Shirt, visible: permissions.canViewProducts },
        { route: 'products/categories', label: t('navigation.categories'), icon: Layers, visible: permissions.canViewProducts },
        { route: 'products/collections', label: t('navigation.collections'), icon: Bookmark, visible: permissions.canViewProducts },
        { route: 'products/brands', label: t('navigation.brands'), icon: Award, visible: permissions.canViewProducts },
        { route: 'products/seasons', label: t('navigation.seasons'), icon: Sun, visible: permissions.canViewProducts },
        { route: 'products/colors', label: t('navigation.colors'), icon: Palette, visible: permissions.canViewProducts },
        { route: 'products/size-groups', label: t('navigation.sizeGroups'), icon: Layers, visible: permissions.canViewProducts },
        { route: 'products/sizes', label: t('navigation.sizes'), icon: Tag, visible: permissions.canViewProducts },
        { route: 'products/size-guides', label: t('navigation.sizeGuides'), icon: Ruler, visible: permissions.canViewProducts },
      ].filter((i) => i.visible !== false),
    },
    {
      title: t('navigation.inventoryGroup'),
      items: [
        { route: 'inventory/overview', label: t('navigation.inventoryOverview'), icon: ClipboardList, visible: permissions.canViewInventory },
        { route: 'inventory/barcodes', label: t('navigation.barcodePrint'), icon: Barcode, visible: permissions.canViewInventory },
        { route: 'inventory/warehouses', label: t('navigation.warehouses'), icon: WarehouseIcon, visible: permissions.canManageInventory },
        { route: 'inventory/locations', label: t('navigation.warehouseLocations'), icon: MapPin, visible: permissions.canManageInventory },
        { route: 'inventory/movements', label: t('navigation.stockMovements'), icon: ClipboardList, visible: permissions.canViewInventory },
        { route: 'inventory/transfers', label: t('navigation.stockTransfers'), icon: ArrowLeftRight, visible: permissions.canManageInventory },
      ].filter((i) => i.visible !== false),
    },
    {
      title: t('navigation.ordersGroup'),
      items: [
        { route: 'orders/all', label: t('navigation.allOrders'), icon: ShoppingCart, visible: permissions.canViewOrders },
        { route: 'orders/create', label: t('navigation.createOrder'), icon: ShoppingCart, visible: permissions.canCreateOrders },
      ].filter((i) => i.visible !== false),
    },
    {
      title: t('navigation.purchasingGroup'),
      items: [
        { route: 'purchasing/suppliers', label: t('navigation.suppliers'), icon: Truck, visible: permissions.canViewPurchasing },
        { route: 'purchasing/orders', label: t('navigation.purchaseOrders'), icon: Truck, visible: permissions.canViewPurchasing },
      ].filter((i) => i.visible !== false),
    },
    {
      title: t('navigation.customersGroup'),
      items: [
        { route: 'customers/all', label: t('navigation.allCustomers'), icon: Users, visible: permissions.canViewCustomers },
      ].filter((i) => i.visible !== false),
    },
    {
      title: t('navigation.settingsGroup'),
      items: [
        { route: 'settings/org', label: t('navigation.orgSettings'), icon: Settings },
        { route: 'settings/sync', label: t('navigation.storageSyncSettings'), icon: Settings },
      ],
    },
  ].filter((group) => group.items.length > 0);

  const handleNavClick = (route: string) => {
    onNavigate(route);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Main Container */}
      <aside
        className={`
          fixed lg:static inset-y-0 start-0 z-50
          bg-[#0a0a0a] text-neutral-300 flex flex-col shrink-0 border-e border-neutral-800/80 select-none
          transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          w-64 min-h-screen
        `}
      >
        {/* Brand Header */}
        <div className={`h-16 border-b border-neutral-800/80 bg-[#000000] flex items-center transition-all ${isCollapsed ? 'px-3 justify-center' : 'px-4 justify-between'}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src="/logo-light.png"
                alt="تن‌خور"
                className="h-8 max-w-[110px] object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="truncate">
                <h2 className="font-extrabold text-white text-xs sm:text-sm tracking-tight leading-none flex items-center gap-1.5 truncate">
                  <span>{t('common.appName')}</span>
                </h2>
                <p className="text-[10px] text-neutral-500 mt-1 font-mono tracking-wide truncate">
                  {t('common.appSubtitle')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <img
                src="/logo-light.png"
                alt="تن‌خور"
                className="h-7 w-auto max-w-[36px] object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {/* Desktop Collapse Toggle */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title={isCollapsed ? 'باز کردن سایدبار' : 'بستن سایدبار'}
                className="hidden lg:flex p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {isCollapsed ? (
                  isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                ) : (
                  isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Mobile Close Button */}
            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="lg:hidden p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-2 sm:px-3 py-4 space-y-5 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {group.title && (
                !isCollapsed ? (
                  <h3 className="px-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-neutral-500 mb-2 truncate">
                    {group.title}
                  </h3>
                ) : (
                  <div className="my-2 border-t border-neutral-800/60 mx-2" />
                )
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentRoute === item.route;

                return (
                  <button
                    key={item.route}
                    onClick={() => handleNavClick(item.route)}
                    title={item.label}
                    className={`w-full flex items-center transition-all cursor-pointer rounded-md text-xs ${
                      isCollapsed
                        ? 'justify-center p-2.5 my-0.5'
                        : 'gap-3 px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-white text-neutral-900 font-bold shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-100 hover:bg-[#1a1a1a] font-medium'
                    }`}
                  >
                    <Icon className={`shrink-0 ${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${isActive ? 'text-neutral-900' : 'text-neutral-500'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Version */}
        <div className={`p-3 border-t border-neutral-800/80 bg-[#000000]/60 text-center transition-all ${isCollapsed ? 'px-1' : 'px-4'}`}>
          {!isCollapsed ? (
            <p className="text-[11px] font-mono text-neutral-500 truncate">TANKHOR Platform · Offline & Cloud</p>
          ) : (
            <p className="text-[9px] font-mono text-neutral-500">v1.0</p>
          )}
        </div>
      </aside>
    </>
  );
};
