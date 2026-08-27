import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import {
  LayoutDashboard,
  ShoppingBag,
  Layers,
  Tag,
  Bookmark,
  Sun,
  Palette,
  Ruler,
  Warehouse as WarehouseIcon,
  MapPin,
  ArrowLeftRight,
  ClipboardList,
  ShoppingCart,
  Truck,
  Users,
  Settings,
  Shirt,
  Award,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Barcode,
  FolderTree,
  PackagePlus,
  Boxes,
  SlidersHorizontal,
} from 'lucide-react';

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  route: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible?: boolean;
}

interface NavSubmenu {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  visible?: boolean;
}

type NavEntry = ({ type: 'item' } & NavItem) | ({ type: 'submenu' } & NavSubmenu);

interface NavGroup {
  title: string | null;
  entries: NavEntry[];
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

  // State to track open submenus
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    catalogAttributes: false,
    warehouseManagement: false,
    stockOperations: false,
  });

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Build the reordered navigation tree:
  // 1. Dashboard
  // 2. Orders & Sales (Create Order, All Orders, Customers)
  // 3. Inventory & Warehouses (Overview, Barcodes, Stock Logs & Transfers submenu, Warehouses & Locations submenu)
  // 4. Products & Catalog (All Products, Variants, Size Guides, Catalog Attributes submenu)
  // 5. Purchasing & Procurement (Purchase Orders, Suppliers)
  // 6. Settings (Org Settings, Storage Sync)
  const navGroups: NavGroup[] = [
    {
      title: null,
      entries: [
        { type: 'item', route: 'dashboard', label: t('navigation.dashboard'), icon: LayoutDashboard },
      ],
    },
    {
      title: t('navigation.ordersGroup'),
      entries: [
        { type: 'item', route: 'orders/create', label: t('navigation.createOrder'), icon: PackagePlus, visible: permissions.canCreateOrders },
        { type: 'item', route: 'orders/all', label: t('navigation.allOrders'), icon: ShoppingCart, visible: permissions.canViewOrders },
        { type: 'item', route: 'customers/all', label: t('navigation.allCustomers'), icon: Users, visible: permissions.canViewCustomers },
      ],
    },
    {
      title: t('navigation.inventoryGroup'),
      entries: [
        { type: 'item', route: 'inventory/overview', label: t('navigation.inventoryOverview'), icon: ClipboardList, visible: permissions.canViewInventory },
        { type: 'item', route: 'inventory/barcodes', label: t('navigation.barcodePrint'), icon: Barcode, visible: permissions.canViewInventory },
        {
          type: 'submenu',
          key: 'stockOperations',
          label: t('navigation.stockOperations', 'گردش و انتقال کالا'),
          icon: ArrowLeftRight,
          visible: permissions.canViewInventory,
          items: [
            { route: 'inventory/movements', label: t('navigation.stockMovements'), icon: ClipboardList, visible: permissions.canViewInventory },
            { route: 'inventory/transfers', label: t('navigation.stockTransfers'), icon: ArrowLeftRight, visible: permissions.canManageInventory },
          ].filter((i) => i.visible !== false),
        },
        {
          type: 'submenu',
          key: 'warehouseManagement',
          label: t('navigation.warehouseManagement', 'انبارها و قفسه‌بندی'),
          icon: WarehouseIcon,
          visible: permissions.canManageInventory,
          items: [
            { route: 'inventory/warehouses', label: t('navigation.warehouses'), icon: WarehouseIcon, visible: permissions.canManageInventory },
            { route: 'inventory/locations', label: t('navigation.warehouseLocations'), icon: MapPin, visible: permissions.canManageInventory },
          ].filter((i) => i.visible !== false),
        },
      ],
    },
    {
      title: t('navigation.productsGroup'),
      entries: [
        { type: 'item', route: 'products/all', label: t('navigation.allProducts'), icon: ShoppingBag, visible: permissions.canViewProducts },
        { type: 'item', route: 'products/variants', label: t('navigation.variants'), icon: Shirt, visible: permissions.canViewProducts },
        { type: 'item', route: 'products/size-guides', label: t('navigation.sizeGuides'), icon: Ruler, visible: permissions.canViewProducts },
        {
          type: 'submenu',
          key: 'catalogAttributes',
          label: t('navigation.catalogAttributes', 'مشخصات و ویژگی‌ها'),
          icon: SlidersHorizontal,
          visible: permissions.canViewProducts,
          items: [
            { route: 'products/categories', label: t('navigation.categories'), icon: Layers, visible: permissions.canViewProducts },
            { route: 'products/collections', label: t('navigation.collections'), icon: Bookmark, visible: permissions.canViewProducts },
            { route: 'products/brands', label: t('navigation.brands'), icon: Award, visible: permissions.canViewProducts },
            { route: 'products/seasons', label: t('navigation.seasons'), icon: Sun, visible: permissions.canViewProducts },
            { route: 'products/colors', label: t('navigation.colors'), icon: Palette, visible: permissions.canViewProducts },
            { route: 'products/size-groups', label: t('navigation.sizeGroups'), icon: FolderTree, visible: permissions.canViewProducts },
            { route: 'products/sizes', label: t('navigation.sizes'), icon: Tag, visible: permissions.canViewProducts },
          ].filter((i) => i.visible !== false),
        },
      ],
    },
    {
      title: t('navigation.purchasingGroup'),
      entries: [
        { type: 'item', route: 'purchasing/orders', label: t('navigation.purchaseOrders'), icon: Truck, visible: permissions.canViewPurchasing },
        { type: 'item', route: 'purchasing/suppliers', label: t('navigation.suppliers'), icon: Boxes, visible: permissions.canViewPurchasing },
      ],
    },
    {
      title: t('navigation.settingsGroup'),
      entries: [
        {
          type: 'item',
          route: 'settings/org',
          label: t('navigation.orgSettings'),
          icon: Settings,
          visible: permissions.canManageOrgSettings || permissions.canManageUsers,
        },
        {
          type: 'item',
          route: 'settings/sync',
          label: t('navigation.storageSyncSettings'),
          icon: SlidersHorizontal,
          visible: permissions.canManageSync,
        },
      ],
    },
  ];

  const isEntryVisible = (entry: NavEntry): boolean => {
    if (entry.visible === false) return false;
    if (entry.type === 'submenu') {
      return entry.items.some((item) => item.visible !== false);
    }
    return true;
  };

  // Auto-expand any submenu containing active route
  useEffect(() => {
    navGroups.forEach((group) => {
      group.entries.forEach((entry) => {
        if (entry.type === 'submenu' && isEntryVisible(entry)) {
          const hasActive = entry.items.some((i) => i.visible !== false && i.route === currentRoute);
          if (hasActive) {
            setOpenSubmenus((prev) => ({ ...prev, [entry.key]: true }));
          }
        }
      });
    });
  }, [currentRoute, permissions]);

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
        <nav className="flex-1 px-2 sm:px-3 py-4 space-y-4 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, gIdx) => {
            const visibleEntries = group.entries.filter(isEntryVisible);
            if (visibleEntries.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                {group.title && (
                  !isCollapsed ? (
                    <h3 className="px-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-neutral-500 mb-1.5 truncate">
                      {group.title}
                    </h3>
                  ) : (
                    <div className="my-2 border-t border-neutral-800/60 mx-2" />
                  )
                )}

                {visibleEntries.map((entry, eIdx) => {
                  if (entry.type === 'item') {
                    const Icon = entry.icon;
                    const isActive = currentRoute === entry.route;

                    return (
                      <button
                        key={entry.route}
                        onClick={() => handleNavClick(entry.route)}
                        title={entry.label}
                        className={`w-full flex items-center transition-all cursor-pointer rounded-lg text-xs ${
                          isCollapsed
                            ? 'justify-center p-2.5 my-0.5'
                            : 'gap-3 px-3 py-2'
                        } ${
                          isActive
                            ? 'bg-white text-neutral-900 font-bold shadow-sm'
                            : 'text-neutral-400 hover:text-neutral-100 hover:bg-[#1a1a1a] font-medium'
                        }`}
                      >
                        <Icon className={`shrink-0 ${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                        {!isCollapsed && <span className="truncate">{entry.label}</span>}
                      </button>
                    );
                  }

                  // Submenu Entry
                  if (entry.type === 'submenu') {
                    const Icon = entry.icon;
                    const isOpen = !!openSubmenus[entry.key];
                    const visibleSubItems = entry.items.filter((i) => i.visible !== false);
                    if (visibleSubItems.length === 0) return null;
                    const hasActiveChild = visibleSubItems.some((i) => i.route === currentRoute);

                    if (isCollapsed) {
                      // In collapsed mode, render primary icon or trigger
                      return (
                        <div key={entry.key} className="relative group my-0.5">
                          <button
                            onClick={() => {
                              if (visibleSubItems.length > 0) {
                                handleNavClick(visibleSubItems[0].route);
                              }
                            }}
                            title={entry.label}
                            className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-all cursor-pointer ${
                              hasActiveChild
                                ? 'bg-neutral-800 text-white font-bold'
                                : 'text-neutral-400 hover:text-neutral-100 hover:bg-[#1a1a1a]'
                            }`}
                          >
                            <Icon className="w-5 h-5 shrink-0" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div key={entry.key} className="space-y-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSubmenu(entry.key)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                            hasActiveChild
                              ? 'text-white font-bold bg-[#171717]'
                              : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#141414] font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate">
                            <Icon className={`w-4 h-4 shrink-0 ${hasActiveChild ? 'text-white' : 'text-neutral-400'}`} />
                            <span className="truncate">{entry.label}</span>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 shrink-0 text-neutral-500 transition-transform duration-200 ${
                              isOpen ? 'rotate-180 text-neutral-300' : ''
                            }`}
                          />
                        </button>

                        {/* Collapsible Submenu Items */}
                        {isOpen && (
                          <div className="ms-4 ps-2 border-s border-neutral-800 space-y-1 py-1">
                            {visibleSubItems.map((subItem) => {
                              const SubIcon = subItem.icon;
                              const isSubActive = currentRoute === subItem.route;

                              return (
                                <button
                                  key={subItem.route}
                                  onClick={() => handleNavClick(subItem.route)}
                                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] transition-all cursor-pointer ${
                                    isSubActive
                                      ? 'bg-neutral-100 text-neutral-900 font-bold shadow-xs'
                                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1c1c1c]'
                                  }`}
                                >
                                  <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-neutral-900' : 'text-neutral-500'}`} />
                                  <span className="truncate">{subItem.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer Version */}
        <div className={`p-3 border-t border-neutral-800/80 bg-[#000000]/60 text-center transition-all ${isCollapsed ? 'px-1' : 'px-4'}`}>
          {!isCollapsed ? (
            <p className="text-[11px] font-mono text-neutral-500 truncate">TANKHOR Platform · v1.0</p>
          ) : (
            <p className="text-[9px] font-mono text-neutral-500">v1.0</p>
          )}
        </div>
      </aside>
    </>
  );
};
