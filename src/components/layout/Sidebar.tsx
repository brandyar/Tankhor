import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { useAuth } from '../../context/AuthContext';
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
  BarChart3,
  HardDrive,
  Building2,
  ArrowUpCircle,
  Lock,
  Calculator,
  Receipt,
  Wallet,
  CheckSquare,
  Scale,
  FileText,
  FileSpreadsheet,
  Globe,
  Clock,
  LogOut,
  RefreshCw,
  User as UserIcon,
  MessageSquare,
  Store,
  Sparkles,
} from 'lucide-react';
import { UserProfileModal } from '../modals/UserProfileModal';
import { FeedbackModal } from '../modals/FeedbackModal';

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

interface NavSection {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route?: string;
  isSingle?: boolean;
  visible?: boolean;
  items?: NavItem[];
  isLocked?: boolean;
  badge?: string;
}

interface ActiveFlyout {
  key: string;
  title: string;
  items?: NavItem[];
  rect: DOMRect;
  isSingle?: boolean;
  route?: string;
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
  const { user, isCloudAuthenticated, logout } = useAuth();
  const isRtl = locale === 'fa';
  const hasBarcodeAccess = hasAccess('barcode');
  const hasAccountingAccess = hasAccess('accounting');
  const hasWooCommerceAccess = hasAccess('woocommerce');
  const hasOnlineCatalogAccess = hasAccess('online_catalog');
  const isDesktop = isTauriEnvironment();

  // State to track open expandable sections in expanded mode
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    orders: false,
    inventory: false,
    products: false,
    purchasing: false,
    accounting: false,
    online_catalog: false,
    woocommerce: false,
    settings: false,
  });

  // State for outward flyout popover in collapsed mode
  const [activeFlyout, setActiveFlyout] = useState<ActiveFlyout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Lock body scroll when mobile drawer is open to prevent background scrolling
  useEffect(() => {
    if (isMobileOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isMobileOpen]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isRouteActive = (route: string) => {
    if (route === 'action:feedback') return false;
    if (currentRoute === route) return true;
    if (route === 'settings/org' && currentRoute === 'settings') return true;
    if (route === 'sales/woocommerce' && (currentRoute === 'woocommerce' || currentRoute === 'orders/woocommerce')) return true;
    if (route.startsWith('sales/woocommerce') && currentRoute.startsWith(route)) return true;
    if (route === 'sales/catalog' && (currentRoute === 'catalog' || currentRoute === 'online_catalog')) return true;
    if (route.startsWith('sales/catalog') && currentRoute === route) return true;
    if (route.startsWith('accounting') && currentRoute === route) return true;
    return false;
  };

  // Build modular navigation sections
  const sections: NavSection[] = [
    {
      key: 'dashboard',
      label: t('navigation.dashboard', 'پیشخوان'),
      icon: LayoutDashboard,
      route: 'dashboard',
      isSingle: true,
      visible: true,
    },
    {
      key: 'orders',
      label: t('navigation.ordersGroup', 'فروش و سفارشات'),
      icon: ShoppingCart,
      visible: permissions.canViewOrders || permissions.canCreateOrders || permissions.canViewCustomers,
      items: [
        { route: 'orders/create', label: t('navigation.createOrder', 'ثبت سفارش جدید'), icon: PackagePlus, visible: permissions.canCreateOrders },
        { route: 'orders/all', label: t('navigation.allOrders', 'همه سفارشات'), icon: ShoppingCart, visible: permissions.canViewOrders },
        { route: 'customers/all', label: t('navigation.allCustomers', 'مشتریان'), icon: Users, visible: permissions.canViewCustomers },
      ].filter((i) => i.visible !== false),
    },
    {
      key: 'inventory',
      label: t('navigation.inventoryGroup', 'انبار و موجودی'),
      icon: WarehouseIcon,
      visible: permissions.canViewInventory || permissions.canManageInventory,
      items: [
        { route: 'inventory/overview', label: t('navigation.inventoryOverview', 'نمای کلی موجودی'), icon: ClipboardList, visible: permissions.canViewInventory },
        ...(hasBarcodeAccess
          ? [
              {
                route: 'inventory/barcodes',
                label: t('navigation.barcodePrint', 'چاپ بارکد'),
                icon: Barcode,
                visible: permissions.canViewInventory,
              },
            ]
          : []),
        { route: 'inventory/movements', label: t('navigation.stockMovements', 'گردش کالا و اسناد'), icon: ClipboardList, visible: permissions.canViewInventory },
        { route: 'inventory/transfers', label: t('navigation.stockTransfers', 'حواله و انتقال بین انبارها'), icon: ArrowLeftRight, visible: permissions.canManageInventory },
        { route: 'inventory/warehouses', label: t('navigation.warehouses', 'انبارها'), icon: WarehouseIcon, visible: permissions.canManageInventory },
        { route: 'inventory/locations', label: t('navigation.warehouseLocations', 'موقعیت‌های انبار'), icon: MapPin, visible: permissions.canManageInventory },
      ].filter((i) => i.visible !== false),
    },
    {
      key: 'products',
      label: t('navigation.productsGroup', 'محصولات و کاتالوگ'),
      icon: Shirt,
      visible: permissions.canViewProducts,
      items: [
        { route: 'products/all', label: t('navigation.allProducts', 'همه محصولات'), icon: ShoppingBag, visible: permissions.canViewProducts },
        { route: 'products/variants', label: t('navigation.variants', 'تنوع‌ها و ویژگی‌ها'), icon: Shirt, visible: permissions.canViewProducts },
        { route: 'products/size-guides', label: t('navigation.sizeGuides', 'راهنمای سایز'), icon: Ruler, visible: permissions.canViewProducts },
        { route: 'products/categories', label: t('navigation.categories', 'دسته‌بندی‌ها'), icon: Layers, visible: permissions.canViewProducts },
        { route: 'products/collections', label: t('navigation.collections', 'مجموعه‌ها'), icon: Bookmark, visible: permissions.canViewProducts },
        { route: 'products/brands', label: t('navigation.brands', 'برندها'), icon: Award, visible: permissions.canViewProducts },
        { route: 'products/seasons', label: t('navigation.seasons', 'فصل‌ها'), icon: Sun, visible: permissions.canViewProducts },
        { route: 'products/colors', label: t('navigation.colors', 'رنگ‌ها'), icon: Palette, visible: permissions.canViewProducts },
        { route: 'products/size-groups', label: t('navigation.sizeGroups', 'گروه‌های سایز'), icon: FolderTree, visible: permissions.canViewProducts },
        { route: 'products/sizes', label: t('navigation.sizes', 'سایزها'), icon: Tag, visible: permissions.canViewProducts },
      ].filter((i) => i.visible !== false),
    },
    {
      key: 'purchasing',
      label: t('navigation.purchasingGroup', 'تدارکات و خرید'),
      icon: Truck,
      visible: permissions.canViewPurchasing,
      items: [
        { route: 'purchasing/orders', label: t('navigation.purchaseOrders', 'سفارش‌های خرید'), icon: Truck, visible: permissions.canViewPurchasing },
        { route: 'purchasing/suppliers', label: t('navigation.suppliers', 'تامین‌کنندگان'), icon: Boxes, visible: permissions.canViewPurchasing },
      ].filter((i) => i.visible !== false),
    },
    ...(hasAccountingAccess
      ? [
          {
            key: 'accounting',
            label: t('navigation.accountingGroup', 'حسابداری و مالی'),
            icon: Calculator,
            visible: permissions.canViewFinancials,
            items: [
              { route: 'accounting/dashboard', label: t('navigation.accountingDashboard', 'سود و زیان و عملکرد'), icon: BarChart3, visible: permissions.canViewFinancials },
              { route: 'accounting/expenses', label: t('navigation.expenses', 'هزینه‌ها و سرفصل‌ها'), icon: Receipt, visible: permissions.canViewFinancials },
              { route: 'accounting/persons', label: t('navigation.personAccounts', 'معین اشخاص و طرف‌حساب‌ها'), icon: Users, visible: permissions.canViewFinancials },
              { route: 'accounting/accounts', label: t('navigation.financialAccounts', 'صندوق‌ها و بانک‌ها'), icon: Wallet, visible: permissions.canViewFinancials },
              { route: 'accounting/cheques', label: t('navigation.cheques', 'مدیریت چک‌های صیادی'), icon: CheckSquare, visible: permissions.canViewFinancials },
              { route: 'accounting/landed-costs', label: t('navigation.landedCosts', 'بهای تمام‌شده و سربار'), icon: Scale, visible: permissions.canViewFinancials },
              { route: 'accounting/tax', label: t('navigation.taxReports', 'مالیات و ارزش افزوده'), icon: FileText, visible: permissions.canViewFinancials },
              { route: 'accounting/export', label: t('navigation.accountingExport', 'خروجی اسناد و مؤدیان'), icon: FileSpreadsheet, visible: permissions.canViewFinancials },
            ].filter((i) => i.visible !== false),
          },
        ]
      : []),
    {
      key: 'reports',
      label: t('navigation.reportsGroup', 'گزارشات'),
      icon: BarChart3,
      route: 'reports/apparel',
      isSingle: true,
      visible: permissions.canViewOrders || permissions.canViewFinancials,
    },
    ...(hasOnlineCatalogAccess
      ? [
          {
            key: 'online_catalog',
            label: t('navigation.onlineCatalog', 'کاتالوگ دیجیتال'),
            icon: Store,
            visible: permissions.canViewProducts || permissions.canViewOrders,
            items: [
              { route: 'sales/catalog', label: t('navigation.catalogOverview', 'تنظیمات کاتالوگ'), icon: Store, visible: permissions.canViewProducts },
              { route: 'sales/catalog/products', label: t('navigation.catalogProducts', 'کالاهای ویترین'), icon: Layers, visible: permissions.canViewProducts },
              { route: 'sales/catalog/size-engine', label: t('navigation.catalogSizeEngine', 'شبیه‌ساز راهنمای سایز'), icon: Sparkles, visible: permissions.canViewProducts },
            ].filter((i) => i.visible !== false),
          },
        ]
      : []),
    ...(hasWooCommerceAccess
      ? [
          {
            key: 'woocommerce',
            label: t('navigation.woocommerce', 'فروشگاه آنلاین ووکامرس'),
            icon: Globe,
            visible: permissions.canViewOrders,
            items: [
              { route: 'sales/woocommerce', label: t('navigation.wcOverview', 'پیشخوان همگام‌سازی'), icon: Boxes, visible: permissions.canViewOrders },
              { route: 'sales/woocommerce/mappings', label: t('navigation.wcMappings', 'تطبیق کالاها و تنوع‌ها'), icon: Layers, visible: permissions.canViewOrders },
              { route: 'sales/woocommerce/logs', label: t('navigation.wcLogs', 'گزارش و لاگ‌های رویداد'), icon: Clock, visible: permissions.canViewOrders },
              { route: 'sales/woocommerce/settings', label: t('navigation.wcSettings', 'تنظیمات اتصال'), icon: Settings, visible: permissions.canViewOrders },
            ].filter((i) => i.visible !== false),
          },
        ]
      : []),
    {
      key: 'settings',
      label: t('navigation.settingsGroup', 'تنظیمات'),
      icon: Settings,
      visible: true,
      items: [
        { route: 'settings/org', label: t('navigation.settingsGeneral', 'پروفایل و اطلاعات سازمان'), icon: Building2, visible: permissions.canManageOrgSettings || isOwner },
        { route: 'settings/members', label: t('navigation.settingsMembers', 'اعضا و سطوح دسترسی'), icon: Users, visible: permissions.canManageUsers || isOwner },
        { route: 'settings/modules', label: t('navigation.settingsModules', 'مدیریت ماژول‌ها و لایسنس‌ها'), icon: Boxes, visible: permissions.canManageOrgSettings || isOwner },
        { route: 'settings/sync', label: t('navigation.settingsSync', 'پایگاه‌داده و پشتیبان‌گیری'), icon: HardDrive, visible: permissions.canManageOrgSettings || isOwner },
        { route: 'settings/appearance', label: t('navigation.settingsAppearance', 'ظاهر و تم سامانه'), icon: Palette, visible: true },
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
        {
          route: 'action:feedback',
          label: t('common.feedback', 'ارسال بازخورد'),
          icon: MessageSquare,
          visible: true,
        },
      ].filter((i) => i.visible !== false),
    },
  ];

  // Locked/unpurchased modules placed at the bottom
  const lockedSections: NavSection[] = [];
  if (!hasBarcodeAccess && permissions.canViewInventory) {
    lockedSections.push({
      key: 'locked-barcode',
      label: t('navigation.barcodePrint', 'چاپ بارکد'),
      icon: Barcode,
      route: 'inventory/barcodes',
      badge: t('navigation.moduleBadge', 'ماژول'),
      isLocked: true,
      isSingle: true,
      visible: true,
    });
  }
  if (!hasAccountingAccess && permissions.canViewFinancials) {
    lockedSections.push({
      key: 'locked-accounting',
      label: t('navigation.accountingGroup', 'حسابداری و مالی'),
      icon: Calculator,
      route: 'accounting/dashboard',
      badge: t('navigation.moduleBadge', 'ماژول'),
      isLocked: true,
      isSingle: true,
      visible: true,
    });
  }
  if (!hasWooCommerceAccess && permissions.canViewOrders) {
    lockedSections.push({
      key: 'locked-woocommerce',
      label: t('navigation.woocommerce', 'همگام‌سازی ووکامرس'),
      icon: Globe,
      route: 'sales/woocommerce',
      badge: t('navigation.moduleBadge', 'ماژول'),
      isLocked: true,
      isSingle: true,
      visible: true,
    });
  }
  if (!hasOnlineCatalogAccess && (permissions.canViewProducts || permissions.canViewOrders)) {
    lockedSections.push({
      key: 'locked-online_catalog',
      label: t('navigation.onlineCatalog', 'کاتالوگ دیجیتال'),
      icon: Store,
      route: 'sales/catalog',
      badge: t('navigation.moduleBadge', 'ماژول'),
      isLocked: true,
      isSingle: true,
      visible: true,
    });
  }

  // Auto-expand section containing currentRoute in expanded mode
  useEffect(() => {
    sections.forEach((sec) => {
      if (sec.items && sec.items.some((item) => isRouteActive(item.route))) {
        setOpenSections((prev) => ({ ...prev, [sec.key]: true }));
      }
    });
  }, [currentRoute]);

  // Close flyout on scroll or window resize
  useEffect(() => {
    const handleClose = () => {
      if (activeFlyout) {
        setActiveFlyout(null);
      }
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [activeFlyout]);

  const handleNavClick = (route: string) => {
    if (route === 'action:feedback') {
      setIsFeedbackModalOpen(true);
      setActiveFlyout(null);
      if (onMobileClose) {
        onMobileClose();
      }
      return;
    }
    onNavigate(route);
    setActiveFlyout(null);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setIsLogoutModalOpen(false);
      if (onMobileClose) {
        onMobileClose();
      }
    } catch (err) {
      console.error('[Sidebar] Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = handleLogoutClick;

  // Outward flyout handlers for collapsed mode
  const handleMouseEnter = (
    key: string,
    title: string,
    e: React.MouseEvent<HTMLElement>,
    items?: NavItem[],
    isSingle?: boolean,
    route?: string
  ) => {
    if (!isCollapsed) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveFlyout({ key, title, items, rect, isSingle, route });
  };

  const handleMouseLeave = () => {
    if (!isCollapsed) return;
    closeTimeoutRef.current = setTimeout(() => {
      setActiveFlyout(null);
    }, 150);
  };

  const handleFlyoutMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleFlyoutMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveFlyout(null);
    }, 150);
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

      {/* Outward Flyout Popover in Collapsed Mode */}
      {isCollapsed && activeFlyout && (
        <div
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
          style={{
            position: 'fixed',
            top: Math.max(12, Math.min(window.innerHeight - 380, activeFlyout.rect.top)),
            ...(isRtl
              ? { right: `${window.innerWidth - activeFlyout.rect.left + 10}px` }
              : { left: `${activeFlyout.rect.right + 10}px` }),
          }}
          className={`z-[9999] bg-[#11141c] border border-neutral-700/80 rounded-2xl shadow-2xl p-2.5 min-w-[210px] max-w-[270px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-none ${
            isRtl
              ? "before:absolute before:inset-y-0 before:-end-3 before:w-4 before:content-['']"
              : "before:absolute before:inset-y-0 before:-start-3 before:w-4 before:content-['']"
          }`}
        >
          {/* Flyout Header */}
          <div className="px-2.5 py-1.5 mb-1.5 border-b border-neutral-800 flex items-center justify-between">
            <span className="text-xs font-bold text-white tracking-wide truncate">{activeFlyout.title}</span>
            {activeFlyout.items && (
              <span className="text-[10px] font-mono text-neutral-400 bg-white/5 px-1.5 py-0.5 rounded-md">
                {activeFlyout.items.length}
              </span>
            )}
          </div>

          {/* Flyout Items List */}
          {activeFlyout.items && activeFlyout.items.length > 0 ? (
            <div className="space-y-1 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {activeFlyout.items.map((subItem) => {
                const SubIcon = subItem.icon;
                const isSubActive = isRouteActive(subItem.route);
                return (
                  <button
                    key={subItem.route}
                    onClick={() => handleNavClick(subItem.route)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-start ${
                      isSubActive
                        ? 'bg-white text-neutral-900 font-bold shadow-xs'
                        : 'text-neutral-300 hover:text-white hover:bg-white/10 font-medium'
                    }`}
                  >
                    <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                    <span className="truncate">{subItem.label}</span>
                    {subItem.badge && (
                      <span className="ms-auto text-[9px] px-1 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                        {subItem.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <button
              onClick={() => {
                if (activeFlyout.route) {
                  handleNavClick(activeFlyout.route);
                }
              }}
              className="w-full text-start text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              {t('common.clickToOpen', 'مشاهده صفحه')}
            </button>
          )}
        </div>
      )}

      {/* Main Sidebar Panel */}
      <aside
        className={`
          fixed lg:static top-0 bottom-0 ${isRtl ? 'right-0' : 'left-0'} z-50 lg:z-30
          bg-[#0f121a] text-neutral-300 flex flex-col shrink-0 select-none
          border-e border-neutral-800/80
          transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')}
          ${isCollapsed ? 'w-[72px]' : 'w-64 lg:w-[260px]'}
          h-full max-h-screen
        `}
      >
        {/* Header with App Logo and Collapse Toggle */}
        <div
          className={`h-16 border-b border-neutral-800/80 flex items-center transition-all ${
            isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
          }`}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src="/logo-light.png"
                alt={t('common.appName')}
                className="w-8 h-8 rounded-lg object-contain shrink-0"
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
            <button
              onClick={onToggleCollapse}
              title={t('common.expandSidebar', 'باز کردن سایدبار')}
              className="flex items-center justify-center p-1 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
            >
              <img
                src="/logo-light.png"
                alt={t('common.appName')}
                className="w-8 h-8 rounded-lg object-contain shrink-0 transition-transform group-hover:scale-105"
              />
            </button>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {/* Desktop Collapse Toggle Button (Screenshot Style) */}
            {onToggleCollapse && !isCollapsed && (
              <button
                onClick={onToggleCollapse}
                title={t('common.collapseSidebar', 'بستن سایدبار')}
                className="hidden lg:flex w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white items-center justify-center border border-white/10 transition-colors shadow-2xs cursor-pointer"
              >
                {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
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

        {/* Collapsed Mode Quick Expand Trigger */}
        {isCollapsed && onToggleCollapse && (
          <div className="hidden lg:flex justify-center pt-2 pb-1">
            <button
              onClick={onToggleCollapse}
              title={t('common.expandSidebar', 'باز کردن سایدبار')}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center border border-white/5 transition-colors cursor-pointer"
            >
              {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Navigation List */}
        <nav className={`flex-1 overflow-y-auto custom-scrollbar ${isCollapsed ? 'px-2 py-2 space-y-2' : 'px-3 py-3 space-y-1.5'}`}>
          {sections.map((section) => {
            if (section.visible === false) return null;
            const Icon = section.icon;

            // 1. Single Item (e.g. Dashboard, Reports)
            if (section.isSingle && section.route) {
              const isActive = isRouteActive(section.route);

              if (isCollapsed) {
                return (
                  <button
                    key={section.key}
                    onClick={() => handleNavClick(section.route!)}
                    onMouseEnter={(e) => handleMouseEnter(section.key, section.label, e, undefined, true, section.route)}
                    onMouseLeave={handleMouseLeave}
                    title={section.label}
                    className={`w-11 h-11 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-neutral-900 shadow-md'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                  </button>
                );
              }

              return (
                <button
                  key={section.key}
                  onClick={() => handleNavClick(section.route!)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-neutral-900 font-bold shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                  <span className="truncate">{section.label}</span>
                </button>
              );
            }

            // 2. Expandable Section with Sub-Items (e.g. Orders, Inventory, Products, Accounting, Settings)
            const visibleItems = (section.items || []).filter((i) => i.visible !== false);
            if (visibleItems.length === 0) return null;

            const isSectionActive = visibleItems.some((i) => isRouteActive(i.route));
            const isOpen = !!openSections[section.key];

            // Collapsed Mode Rendering (Flyout Outward on Hover/Click)
            if (isCollapsed) {
              return (
                <button
                  key={section.key}
                  onClick={() => {
                    if (visibleItems.length > 0) {
                      handleNavClick(visibleItems[0].route);
                    }
                  }}
                  onMouseEnter={(e) => handleMouseEnter(section.key, section.label, e, visibleItems, false)}
                  onMouseLeave={handleMouseLeave}
                  title={section.label}
                  className={`w-11 h-11 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    isSectionActive
                      ? 'bg-white text-neutral-900 shadow-md'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSectionActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                </button>
              );
            }

            // Expanded Mode Rendering (Vercel-Inspired Screenshot Style)
            return (
              <div key={section.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    isSectionActive
                      ? 'bg-white text-neutral-900 font-bold shadow-sm'
                      : isOpen
                      ? 'bg-[#171a23] text-white font-semibold'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isSectionActive ? 'text-neutral-900' : isOpen ? 'text-white' : 'text-neutral-400'}`} />
                    <span className="truncate">{section.label}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                      isSectionActive ? 'text-neutral-900' : isOpen ? 'rotate-180 text-white' : 'text-neutral-500'
                    }`}
                  />
                </button>

                {/* Submenu Children Items */}
                {isOpen && (
                  <div className="ms-3 ps-3 border-s border-neutral-800/80 space-y-1 py-1">
                    {visibleItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = isRouteActive(subItem.route);

                      return (
                        <button
                          key={subItem.route}
                          onClick={() => handleNavClick(subItem.route)}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-start ${
                            isSubActive
                              ? 'bg-white/10 text-white font-bold'
                              : 'text-neutral-400 hover:text-white hover:bg-white/5 font-medium'
                          }`}
                        >
                          <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-neutral-500'}`} />
                          <span className="truncate">{subItem.label}</span>
                          {subItem.badge && (
                            <span className="ms-auto text-[9px] px-1 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                              {subItem.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Locked Modules Section */}
          {lockedSections.length > 0 && (
            <div className="pt-3">
              {!isCollapsed ? (
                <h4 className="px-3.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 truncate">
                  {t('navigation.lockedModulesGroup', 'ماژول‌ها و افزونه‌ها')}
                </h4>
              ) : (
                <div className="my-2 border-t border-neutral-800 mx-2" />
              )}

              {lockedSections.map((lockedSec) => {
                const Icon = lockedSec.icon;
                const isActive = lockedSec.route ? isRouteActive(lockedSec.route) : false;

                if (isCollapsed) {
                  return (
                    <button
                      key={lockedSec.key}
                      onClick={() => lockedSec.route && handleNavClick(lockedSec.route)}
                      onMouseEnter={(e) => handleMouseEnter(lockedSec.key, lockedSec.label, e, undefined, true, lockedSec.route)}
                      onMouseLeave={handleMouseLeave}
                      title={lockedSec.label}
                      className="w-11 h-11 mx-auto rounded-xl flex items-center justify-center text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-all cursor-pointer relative"
                    >
                      <Icon className="w-5 h-5 text-neutral-500" />
                      <span className="absolute -top-1 -right-1 flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-neutral-500" />
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={lockedSec.key}
                    onClick={() => lockedSec.route && handleNavClick(lockedSec.route)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-neutral-800 text-white font-bold'
                        : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon className="w-4 h-4 shrink-0 text-neutral-500" />
                      <span className="truncate">{lockedSec.label}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-800/80 text-neutral-400 border border-neutral-700/50 font-medium shrink-0 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                      <span>{lockedSec.badge}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer Area with User Profile & Sign Out & Version */}
        <div
          className={`p-2 border-t border-neutral-800/80 bg-[#080a0f] flex flex-col gap-1.5 transition-all ${
            isCollapsed ? 'items-center' : ''
          }`}
        >
          {!isCollapsed ? (
            <>
              {/* User Profile Info Card */}
              {user && (
                <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] transition-colors">
                  <div
                    onClick={() => setIsProfileModalOpen(true)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
                    title={t('auth.editProfile', 'مشاهده و ویرایش مشخصات کاربر')}
                  >
                    <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden group-hover:border-blue-500 transition-colors">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        user?.first_name ? user.first_name[0] : 'T'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-neutral-200 truncate leading-tight group-hover:text-blue-400 transition-colors">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="text-[10px] text-neutral-500 font-mono truncate">
                        {user?.email || (isCloudAuthenticated ? t('common.cloudSynced') : t('common.localOffline'))}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    title={t('auth.logout', 'خروج از حساب')}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}

              {!user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer w-full"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>{t('auth.logout', 'خروج از حساب')}</span>
                </button>
              )}

              <div className="flex items-center justify-between px-2 text-[10px] font-mono text-neutral-500">
                <span>{isCloudAuthenticated ? t('common.cloudSynced') : t('common.localOffline')}</span>
                <span>v{APP_VERSION}</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-0.5">
              {user && (
                <div
                  onClick={() => setIsProfileModalOpen(true)}
                  className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 text-white font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer hover:border-blue-500 transition-colors overflow-hidden"
                  title={`${user?.first_name || ''} ${user?.last_name || ''} - ${t('auth.editProfile', 'ویرایش مشخصات')}`}
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.first_name ? user.first_name[0] : 'T'
                  )}
                </div>
              )}
              <button
                onClick={handleLogout}
                onMouseEnter={(e) => handleMouseEnter('signout', t('auth.logout', 'خروج از حساب'), e, undefined, true)}
                onMouseLeave={handleMouseLeave}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title={t('auth.logout', 'خروج از حساب')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* User Profile & Password Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isLoggingOut && setIsLogoutModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#181a20] p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-150 text-start"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                <LogOut className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {t('auth.logout', 'خروج از حساب کاربری')}
                </h3>
                <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {t('auth.logoutConfirm', 'آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟')}
                </p>
                <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                  {t('auth.logoutNote', 'برای ورود مجدد به ایمیل و کلمه عبور خود نیاز خواهید داشت.')}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                disabled={isLoggingOut}
                className="rounded-xl border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('common.cancel', 'انصراف')}
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                <span>{isLoggingOut ? t('auth.loggingOut', 'در حال خروج...') : t('auth.logout', 'خروج از حساب')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

