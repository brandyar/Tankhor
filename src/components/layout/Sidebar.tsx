import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { isTauriEnvironment } from '../../storage';
import { APP_VERSION } from '../../utils/version';
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
  BarChart3,
  HardDrive,
  Building2,
  ArrowUpCircle,
  Lock,
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
  badge?: string;
  isLocked?: boolean;
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
  const { permissions, isOwner } = useOrganization();
  const { hasAccess } = useModuleAccess();
  const isRtl = locale === 'fa';
  const hasBarcodeAccess = hasAccess('barcode');
  const isDesktop = isTauriEnvironment();

  // State to track open submenus
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    catalogAttributes: false,
    warehouseManagement: false,
    stockOperations: false,
    settingsManagement: false,
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
  // 3. Inventory & Warehouses (Overview, Barcodes (if unlocked), Stock Logs & Transfers submenu, Warehouses & Locations submenu)
  // 4. Products & Catalog (All Products, Variants, Size Guides, Catalog Attributes submenu)
  // 5. Purchasing & Procurement (Purchase Orders, Suppliers)
  // 6. Reports & Analytics
  // 7. Settings (General/Org Profile, Members & Permissions, Modules & Licenses, Database & Sync, Appearance, Updater)
  // 8. Locked Modules (if any module is locked/unpurchased, it sits at the bottom of the sidebar)
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
        // If Barcode module is ACTIVE/PURCHASED, it is placed right here in its natural place under Inventory
        ...(hasBarcodeAccess
          ? [
              {
                type: 'item' as const,
                route: 'inventory/barcodes',
                label: t('navigation.barcodePrint'),
                icon: Barcode,
                visible: permissions.canViewInventory,
              },
            ]
          : []),
        {
          type: 'submenu',
          key: 'stockOperations',
          label: t('navigation.stockOperations'),
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
          label: t('navigation.warehouseManagement'),
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
          label: t('navigation.catalogAttributes'),
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
      title: t('navigation.reportsGroup'),
      entries: [
        { type: 'item', route: 'reports/apparel', label: t('navigation.apparelReports'), icon: BarChart3, visible: permissions.canViewOrders || permissions.canViewFinancials },
      ],
    },
    {
      title: t('navigation.settingsGroup'),
      entries: [
        {
          type: 'submenu',
          key: 'settingsManagement',
          label: t('navigation.settingsGroup'),
          icon: Settings,
          visible: permissions.canManageOrgSettings || permissions.canManageUsers,
          items: [
            {
              route: 'settings/org',
              label: t('navigation.settingsGeneral', 'پروفایل و اطلاعات سازمان'),
              icon: Building2,
              visible: true,
            },
            {
              route: 'settings/members',
              label: t('navigation.settingsMembers', 'اعضا و سطوح دسترسی'),
              icon: Users,
              visible: permissions.canManageUsers || isOwner,
            },
            {
              route: 'settings/modules',
              label: t('navigation.settingsModules', 'مدیریت ماژول‌ها و لایسنس‌ها'),
              icon: Boxes,
              visible: true,
            },
            {
              route: 'settings/sync',
              label: t('navigation.settingsSync', 'پایگاه‌داده و پشتیبان‌گیری'),
              icon: HardDrive,
              visible: true,
            },
            {
              route: 'settings/appearance',
              label: t('navigation.settingsAppearance', 'ظاهر و تم سامانه'),
              icon: Palette,
              visible: true,
            },
            ...(isDesktop
              ? [
                  {
                    route: 'settings/updater',
                    label: t('navigation.settingsUpdater', 'بروزرسانی نرم‌افزار'),
                    icon: ArrowUpCircle,
                    visible: true,
                  },
                ]
              : []),
          ].filter((i) => i.visible !== false),
        },
      ],
    },
  ];

  // If any module is LOCKED (unpurchased), append it at the bottom of the sidebar in a dedicated group
  const lockedEntries: NavEntry[] = [];
  if (!hasBarcodeAccess && permissions.canViewInventory) {
    lockedEntries.push({
      type: 'item',
      route: 'inventory/barcodes',
      label: t('navigation.barcodePrint'),
      icon: Barcode,
      badge: t('navigation.lockedBadge', 'قفل / خرید'),
      isLocked: true,
      visible: true,
    });
  }

  if (lockedEntries.length > 0) {
    navGroups.push({
      title: t('navigation.lockedModulesGroup', 'ماژول‌ها و افزونه‌ها'),
      entries: lockedEntries,
    });
  }

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
          const hasActive = entry.items.some((i) => i.visible !== false && (i.route === currentRoute || (entry.key === 'settingsManagement' && currentRoute.startsWith('settings'))));
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
                alt={t('common.appName')}
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
                alt={t('common.appName')}
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
                title={isCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
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

                {visibleEntries.map((entry) => {
                  if (entry.type === 'item') {
                    const Icon = entry.icon;
                    const isActive = currentRoute === entry.route;

                    return (
                      <button
                        key={entry.route}
                        onClick={() => handleNavClick(entry.route)}
                        title={entry.label}
                        className={`w-full flex items-center transition-all cursor-pointer rounded-lg text-xs relative ${
                          isCollapsed
                            ? 'justify-center p-2.5 my-0.5'
                            : 'gap-3 px-3 py-2'
                        } ${
                          isActive
                            ? 'bg-white text-neutral-900 font-bold shadow-sm'
                            : entry.isLocked
                            ? 'text-amber-400/90 hover:text-amber-200 hover:bg-amber-950/20 font-medium border border-amber-500/20'
                            : 'text-neutral-400 hover:text-neutral-100 hover:bg-[#1a1a1a] font-medium'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Icon className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${isActive ? 'text-neutral-900' : entry.isLocked ? 'text-amber-400' : 'text-neutral-400'}`} />
                          {entry.isLocked && (
                            <span className="absolute -top-1 -right-1 flex items-center justify-center">
                              <Lock className="w-2.5 h-2.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                        {!isCollapsed && (
                          <div className="flex-1 flex items-center justify-between overflow-hidden gap-1">
                            <span className="truncate">{entry.label}</span>
                            {entry.badge && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium shrink-0 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>{entry.badge}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  }

                  // Submenu Entry
                  if (entry.type === 'submenu') {
                    const Icon = entry.icon;
                    const isOpen = !!openSubmenus[entry.key];
                    const visibleSubItems = entry.items.filter((i) => i.visible !== false);
                    if (visibleSubItems.length === 0) return null;
                    const hasActiveChild = visibleSubItems.some((i) => i.route === currentRoute || (entry.key === 'settingsManagement' && currentRoute.startsWith('settings')));

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
                              const isSubActive = currentRoute === subItem.route || (subItem.route === 'settings/org' && currentRoute === 'settings');

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
            <p className="text-[11px] font-mono text-neutral-500 truncate">TANKHOR Platform · v{APP_VERSION}</p>
          ) : (
            <p className="text-[9px] font-mono text-neutral-500">v{APP_VERSION}</p>
          )}
        </div>
      </aside>
    </>
  );
};
