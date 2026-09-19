import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { useTheme } from '../../context/ThemeContext';
import { isTauriEnvironment } from '../../storage';
import {
  Search,
  X,
  LayoutDashboard,
  PackagePlus,
  ShoppingCart,
  Users,
  ClipboardList,
  Barcode,
  ArrowLeftRight,
  Warehouse as WarehouseIcon,
  MapPin,
  ShoppingBag,
  Shirt,
  Ruler,
  Layers,
  Bookmark,
  Award,
  Sun,
  Palette,
  FolderTree,
  Tag,
  Truck,
  Boxes,
  Calculator,
  BarChart3,
  Receipt,
  Wallet,
  CheckSquare,
  Scale,
  FileText,
  FileSpreadsheet,
  Globe,
  Clock,
  Settings,
  Building2,
  HardDrive,
  ArrowUpCircle,
  Moon,
  Monitor,
  RefreshCw,
  Plus,
  CornerDownLeft,
  SlidersHorizontal,
} from 'lucide-react';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
  onSyncNow?: () => void;
  onOpenCreateOrg?: () => void;
}

interface SearchableItem {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  route?: string;
  action?: () => void;
  badge?: string;
  visible?: boolean;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSyncNow,
  onOpenCreateOrg,
}) => {
  const { t, locale } = useTranslation();
  const { permissions, isOwner } = useOrganization();
  const { hasAccess } = useModuleAccess();
  const { setTheme } = useTheme();
  const isDesktop = isTauriEnvironment();
  const isRtl = locale === 'fa';

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hasBarcode = hasAccess('barcode');
  const hasAccounting = hasAccess('accounting');
  const hasWooCommerce = hasAccess('woocommerce');

  // Build the complete searchable catalog
  const allItems: SearchableItem[] = useMemo(() => {
    return [
      // 1. Dashboard
      {
        id: 'nav_dashboard',
        title: t('navigation.dashboard', 'پیشخوان و داشبورد مدیریت'),
        category: t('navigation.dashboard', 'پیشخوان'),
        keywords: ['داشبورد', 'پیشخوان', 'گزارش', 'آمار', 'فروش', 'dashboard', 'home', 'main'],
        icon: LayoutDashboard,
        route: 'dashboard',
        visible: true,
      },

      // 2. Orders & Customers
      {
        id: 'nav_order_create',
        title: t('navigation.createOrder', 'ثبت سفارش جدید'),
        category: t('navigation.ordersGroup', 'فروش و سفارشات'),
        keywords: ['سفارش', 'فروش', 'فاکتور', 'ثبت', 'جدید', 'صندوق', 'order', 'create', 'invoice', 'pos'],
        icon: PackagePlus,
        route: 'orders/create',
        visible: permissions.canCreateOrders,
      },
      {
        id: 'nav_order_all',
        title: t('navigation.allOrders', 'لیست و مدیریت سفارشات'),
        category: t('navigation.ordersGroup', 'فروش و سفارشات'),
        keywords: ['سفارشات', 'فاکتورها', 'فروش', 'لیست', 'orders', 'sales'],
        icon: ShoppingCart,
        route: 'orders/all',
        visible: permissions.canViewOrders,
      },
      {
        id: 'nav_customers',
        title: t('navigation.allCustomers', 'لیست مشتریان و خریداران'),
        category: t('navigation.ordersGroup', 'فروش و سفارشات'),
        keywords: ['مشتری', 'مشتریان', 'خریدار', 'اشخاص', 'customers', 'clients'],
        icon: Users,
        route: 'customers/all',
        visible: permissions.canViewCustomers,
      },

      // 3. Inventory & Warehouses
      {
        id: 'nav_inv_overview',
        title: t('navigation.inventoryOverview', 'موجودی انبارها و تنوع‌ها'),
        category: t('navigation.inventoryGroup', 'انبار و موجودی'),
        keywords: ['انبار', 'موجودی', 'کالا', 'تنوع', 'موجودی انبار', 'inventory', 'stock', 'warehouse'],
        icon: ClipboardList,
        route: 'inventory/overview',
        visible: permissions.canViewInventory,
      },
      {
        id: 'nav_inv_barcodes',
        title: t('navigation.barcodePrint', 'تولید و چاپ بارکد'),
        category: t('navigation.inventoryGroup', 'انبار و موجودی'),
        keywords: ['بارکد', 'پرینت', 'چاپ', 'لیبل', 'اتیکت', 'barcode', 'print'],
        icon: Barcode,
        route: 'inventory/barcodes',
        badge: !hasBarcode ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewInventory,
      },
      {
        id: 'nav_inv_movements',
        title: t('navigation.stockMovements', 'سوابق و لاگ‌های گردش کالا'),
        category: t('navigation.inventoryGroup', 'انبار و موجودی'),
        keywords: ['گردش', 'ورود', 'خروج', 'تراکنش انبار', 'movements', 'logs'],
        icon: ClipboardList,
        route: 'inventory/movements',
        visible: permissions.canViewInventory,
      },
      {
        id: 'nav_inv_transfers',
        title: t('navigation.stockTransfers', 'انتقال کالا بین انبارها'),
        category: t('navigation.inventoryGroup', 'انبار و موجودی'),
        keywords: ['انتقال', 'حواله', 'جابجایی', 'انبار به انبار', 'transfer', 'transfers'],
        icon: ArrowLeftRight,
        route: 'inventory/transfers',
        visible: permissions.canManageInventory,
      },
      {
        id: 'nav_inv_warehouses',
        title: t('navigation.warehouses', 'مدیریت انبارها و شعب'),
        category: t('navigation.inventoryGroup', 'انبار و موجودی'),
        keywords: ['انبارها', 'شعب', 'فروشگاه', 'warehouses', 'stores'],
        icon: WarehouseIcon,
        route: 'inventory/warehouses',
        visible: permissions.canManageInventory,
      },
      {
        id: 'nav_inv_locations',
        title: t('navigation.warehouseLocations', 'قفسه‌بندی و جایگاه‌های انبار'),
        category: t('navigation.inventoryGroup', 'انبار و موجودی'),
        keywords: ['قفسه', 'جایگاه', 'لوکیشن', 'ردیف', 'طبقه', 'locations', 'racks'],
        icon: MapPin,
        route: 'inventory/locations',
        visible: permissions.canManageInventory,
      },

      // 4. Products & Catalog
      {
        id: 'nav_prod_all',
        title: t('navigation.allProducts', 'همه محصولات و مدل‌ها'),
        category: t('navigation.productsGroup', 'محصولات و کاتالوگ'),
        keywords: ['محصولات', 'کالا', 'پوشاک', 'لباس', 'کفش', 'کیف', 'مدل', 'products', 'items'],
        icon: ShoppingBag,
        route: 'products/all',
        visible: permissions.canViewProducts,
      },
      {
        id: 'nav_prod_variants',
        title: t('navigation.variants', 'تنخور و تنوع‌ها (رنگ و سایز)'),
        category: t('navigation.productsGroup', 'محصولات و کاتالوگ'),
        keywords: ['تنوع', 'واریاسیون', 'رنگ', 'سایز', 'بارکد تنوع', 'variants', 'skus'],
        icon: Shirt,
        route: 'products/variants',
        visible: permissions.canViewProducts,
      },
      {
        id: 'nav_prod_sizeguides',
        title: t('navigation.sizeGuides', 'قالب‌های راهنمای سایز و تن‌خور'),
        category: t('navigation.productsGroup', 'محصولات و کاتالوگ'),
        keywords: ['راهنمای سایز', 'سایزبندی', 'جدول سایز', 'اندازه', 'size guide', 'measurements'],
        icon: Ruler,
        route: 'products/size-guides',
        visible: permissions.canViewProducts,
      },
      {
        id: 'nav_cat_categories',
        title: t('navigation.categories', 'دسته‌بندی‌های کاتالوگ'),
        category: t('navigation.catalogAttributes', 'مشخصات کاتالوگ'),
        keywords: ['دسته', 'گروه کالا', 'دسته‌بندی', 'categories'],
        icon: Layers,
        route: 'products/categories',
        visible: permissions.canViewProducts,
      },
      {
        id: 'nav_cat_collections',
        title: t('navigation.collections', 'مجموعه‌ها و کالکشن‌ها'),
        category: t('navigation.catalogAttributes', 'مشخصات کاتالوگ'),
        keywords: ['کالکشن', 'مجموعه', 'سری', 'collections'],
        icon: Bookmark,
        route: 'products/collections',
        visible: permissions.canViewProducts,
      },
      {
        id: 'nav_cat_brands',
        title: t('navigation.brands', 'برندها و مارک‌های تجاری'),
        category: t('navigation.catalogAttributes', 'مشخصات کاتالوگ'),
        keywords: ['برند', 'مارک', 'تولیدکننده', 'brands'],
        icon: Award,
        route: 'products/brands',
        visible: permissions.canViewProducts,
      },
      {
        id: 'nav_cat_seasons',
        title: t('navigation.seasons', 'فصل‌ها (بهاره، تابستانه، پاییزه، زمستانه)'),
        category: t('navigation.catalogAttributes', 'مشخصات کاتالوگ'),
        keywords: ['فصل', 'بهار', 'تابستان', 'پاییز', 'زمستان', 'seasons'],
        icon: Sun,
        route: 'products/seasons',
        visible: permissions.canViewProducts,
      },
      {
        id: 'nav_cat_colors',
        title: t('navigation.colors', 'رنگ‌ها و کدهای رنگی'),
        category: t('navigation.catalogAttributes', 'مشخصات کاتالوگ'),
        keywords: ['رنگ', 'کد رنگ', 'پالت', 'colors'],
        icon: Palette,
        route: 'products/colors',
        visible: permissions.canViewProducts,
      },
      {
        id: 'nav_cat_sizegroups',
        title: t('navigation.sizeGroups', 'گروه‌های سایزبندی'),
        category: t('navigation.catalogAttributes', 'مشخصات کاتالوگ'),
        keywords: ['گروه سایز', 'رده سنی', 'زنانه', 'مردانه', 'بچگانه', 'size groups'],
        icon: FolderTree,
        route: 'products/size-groups',
        visible: permissions.canViewProducts,
      },
      {
        id: 'nav_cat_sizes',
        title: t('navigation.sizes', 'سایزها و اندازه‌ها'),
        category: t('navigation.catalogAttributes', 'مشخصات کاتالوگ'),
        keywords: ['سایز', 'مدیوم', 'لارج', 'اسمال', 'اندازه', 'sizes'],
        icon: Tag,
        route: 'products/sizes',
        visible: permissions.canViewProducts,
      },

      // 5. Purchasing & Suppliers
      {
        id: 'nav_pur_orders',
        title: t('navigation.purchaseOrders', 'سفارشات خرید و فاکتور تامین'),
        category: t('navigation.purchasingGroup', 'تدارکات و خرید'),
        keywords: ['خرید', 'فاکتور خرید', 'سفارش خرید', 'تدارکات', 'purchase', 'procurement'],
        icon: Truck,
        route: 'purchasing/orders',
        visible: permissions.canViewPurchasing,
      },
      {
        id: 'nav_pur_suppliers',
        title: t('navigation.suppliers', 'تامین‌کنندگان و تولیدی‌ها'),
        category: t('navigation.purchasingGroup', 'تدارکات و خرید'),
        keywords: ['تامین‌کننده', 'تولیدی', 'بنکدار', 'کارگاه', 'suppliers', 'vendors'],
        icon: Boxes,
        route: 'purchasing/suppliers',
        visible: permissions.canViewPurchasing,
      },

      // 6. Accounting & Finance Suite
      {
        id: 'nav_acc_dash',
        title: t('navigation.accountingDashboard', 'داشبورد سود و زیان و عملکرد مالی'),
        category: t('navigation.accountingGroup', 'حسابداری و مالی'),
        keywords: ['سود', 'زیان', 'درآمد', 'عملکرد مالی', 'تراز', 'p&l', 'accounting', 'finance'],
        icon: BarChart3,
        route: 'accounting/dashboard',
        badge: !hasAccounting ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewFinancials,
      },
      {
        id: 'nav_acc_expenses',
        title: t('navigation.expenses', 'هزینه‌ها و سرفصل‌های هزینه'),
        category: t('navigation.accountingGroup', 'حسابداری و مالی'),
        keywords: ['هزینه', 'مخارج', 'اجاره', 'قبوض', 'حقوق', 'expenses'],
        icon: Receipt,
        route: 'accounting/expenses',
        badge: !hasAccounting ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewFinancials,
      },
      {
        id: 'nav_acc_persons',
        title: t('navigation.personAccounts', 'طرف‌حساب‌ها و معین بدهکار/بستانکار'),
        category: t('navigation.accountingGroup', 'حسابداری و مالی'),
        keywords: ['معین', 'بدهکار', 'بستانکار', 'مانده حساب', 'طرف حساب', 'ledger', 'balance'],
        icon: Users,
        route: 'accounting/persons',
        badge: !hasAccounting ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewFinancials,
      },
      {
        id: 'nav_acc_accounts',
        title: t('navigation.financialAccounts', 'صندوق‌ها، دستگاه‌های کارتخوان و بانک‌ها'),
        category: t('navigation.accountingGroup', 'حسابداری و مالی'),
        keywords: ['بانک', 'صندوق', 'پوز', 'کارتخوان', 'خزانه‌داری', 'accounts', 'cashbox'],
        icon: Wallet,
        route: 'accounting/accounts',
        badge: !hasAccounting ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewFinancials,
      },
      {
        id: 'nav_acc_cheques',
        title: t('navigation.cheques', 'مدیریت چک‌های صیادی (دریافتی و پرداختی)'),
        category: t('navigation.accountingGroup', 'حسابداری و مالی'),
        keywords: ['چک', 'صیاد', 'وصول', 'برگشت', 'خواباندن چک', 'cheques'],
        icon: CheckSquare,
        route: 'accounting/cheques',
        badge: !hasAccounting ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewFinancials,
      },
      {
        id: 'nav_acc_landed',
        title: t('navigation.landedCosts', 'بهای تمام‌شده و هزینه‌های سربار خرید'),
        category: t('navigation.accountingGroup', 'حسابداری و مالی'),
        keywords: ['سربار', 'حمل', 'بهای تمام شده', 'گمرک', 'landed cost'],
        icon: Scale,
        route: 'accounting/landed-costs',
        badge: !hasAccounting ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewFinancials,
      },
      {
        id: 'nav_acc_tax',
        title: t('navigation.taxReports', 'گزارشات مالیات و ارزش افزوده (فصلی)'),
        category: t('navigation.accountingGroup', 'حسابداری و مالی'),
        keywords: ['مالیات', 'ارزش افزوده', 'ماده ۱۶۹', 'گزارش فصلی', 'tax', 'vat'],
        icon: FileText,
        route: 'accounting/tax',
        badge: !hasAccounting ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewFinancials,
      },
      {
        id: 'nav_acc_export',
        title: t('navigation.accountingExport', 'خروجی اسناد حسابداری (سپیدار، هلو و مودیان)'),
        category: t('navigation.accountingGroup', 'حسابداری و مالی'),
        keywords: ['سپیدار', 'هلو', 'سامانه مودیان', 'خروجی اکسل', 'سند دوبل', 'export', 'csv'],
        icon: FileSpreadsheet,
        route: 'accounting/export',
        badge: !hasAccounting ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewFinancials,
      },

      // 7. Reports
      {
        id: 'nav_reports_apparel',
        title: t('navigation.apparelReports', 'گزارشات و نمودارهای تحلیلی فروش و انبار'),
        category: t('navigation.reportsGroup', 'گزارش‌ها و تحلیل‌ها'),
        keywords: ['گزارش', 'نمودار', 'تحلیل', 'فروش', 'موجودی', 'reports', 'analytics'],
        icon: BarChart3,
        route: 'reports/apparel',
        visible: permissions.canViewOrders || permissions.canViewFinancials,
      },

      // 8. WooCommerce Integration
      {
        id: 'nav_wc_overview',
        title: t('navigation.wcOverview', 'پیشخوان همگام‌سازی ووکامرس'),
        category: t('navigation.woocommerceGroup', 'فروشگاه آنلاین ووکامرس'),
        keywords: ['ووکامرس', 'سایت', 'وردپرس', 'آنلاین', 'اتصال', 'woocommerce', 'sync'],
        icon: Globe,
        route: 'sales/woocommerce',
        badge: !hasWooCommerce ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewOrders,
      },
      {
        id: 'nav_wc_mappings',
        title: t('navigation.wcMappings', 'تطبیق محصولات و تنوع‌ها با سایت'),
        category: t('navigation.woocommerceGroup', 'فروشگاه آنلاین ووکامرس'),
        keywords: ['تطبیق', 'مپینگ', 'محصولات سایت', 'mappings'],
        icon: Layers,
        route: 'sales/woocommerce/mappings',
        badge: !hasWooCommerce ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewOrders,
      },
      {
        id: 'nav_wc_logs',
        title: t('navigation.wcLogs', 'گزارش و لاگ‌های وب‌هوک ووکامرس'),
        category: t('navigation.woocommerceGroup', 'فروشگاه آنلاین ووکامرس'),
        keywords: ['لاگ', 'رویداد', 'وب هوک', 'logs', 'webhooks'],
        icon: Clock,
        route: 'sales/woocommerce/logs',
        badge: !hasWooCommerce ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewOrders,
      },
      {
        id: 'nav_wc_settings',
        title: t('navigation.wcSettings', 'تنظیمات و کلیدهای API ووکامرس'),
        category: t('navigation.woocommerceGroup', 'فروشگاه آنلاین ووکامرس'),
        keywords: ['کلید api', 'اتصال ووکامرس', 'woocommerce settings'],
        icon: Settings,
        route: 'sales/woocommerce/settings',
        badge: !hasWooCommerce ? t('navigation.moduleBadge', 'ماژول') : undefined,
        visible: permissions.canViewOrders,
      },

      // 9. Settings
      {
        id: 'nav_set_org',
        title: t('navigation.settingsGeneral', 'پروفایل و اطلاعات سازمان / فروشگاه'),
        category: t('navigation.settingsGroup', 'تنظیمات'),
        keywords: ['سازمان', 'فروشگاه', 'برند', 'واحد پول', 'تومان', 'لوگو', 'settings', 'org'],
        icon: Building2,
        route: 'settings/org',
        visible: true,
      },
      {
        id: 'nav_set_members',
        title: t('navigation.settingsMembers', 'اعضای تیم، کاربران و سطوح دسترسی'),
        category: t('navigation.settingsGroup', 'تنظیمات'),
        keywords: ['کاربر', 'کارمندان', 'نقش‌ها', 'دسترسی', 'دعوت کاربر', 'members', 'users', 'roles'],
        icon: Users,
        route: 'settings/members',
        visible: permissions.canManageUsers || isOwner,
      },
      {
        id: 'nav_set_modules',
        title: t('navigation.settingsModules', 'مدیریت ماژول‌ها، لایسنس و اشتراک'),
        category: t('navigation.settingsGroup', 'تنظیمات'),
        keywords: ['ماژول', 'افزونه', 'لایسنس', 'پرو', 'خرید ماژول', 'ارتقا', 'modules', 'pro'],
        icon: Boxes,
        route: 'settings/modules',
        visible: true,
      },
      {
        id: 'nav_set_sync',
        title: t('navigation.settingsSync', 'پایگاه‌داده، همگام‌سازی و فایل پشتیبان JSON'),
        category: t('navigation.settingsGroup', 'تنظیمات'),
        keywords: ['دیتابیس', 'بکاپ', 'پشتیبان', 'بازیابی', 'همگام‌سازی', 'sqlite', 'sync', 'backup'],
        icon: HardDrive,
        route: 'settings/sync',
        visible: true,
      },
      {
        id: 'nav_set_appearance',
        title: t('navigation.settingsAppearance', 'ظاهر، پوسته (تیره/روشن) و زبان سامانه'),
        category: t('navigation.settingsGroup', 'تنظیمات'),
        keywords: ['تم', 'پوسته', 'دارک', 'لایت', 'شب', 'روز', 'زبان', 'فارسی', 'انگلیسی', 'appearance', 'theme', 'dark', 'light', 'language'],
        icon: Palette,
        route: 'settings/appearance',
        visible: true,
      },
      ...(isDesktop
        ? [
            {
              id: 'nav_set_updater',
              title: t('navigation.settingsUpdater', 'بررسی بروزرسانی نسخه دسکتاپ'),
              category: t('navigation.settingsGroup', 'تنظیمات'),
              keywords: ['آپدیت', 'بروزرسانی', 'نسخه جدید', 'ورژن', 'update', 'version'],
              icon: ArrowUpCircle,
              route: 'settings/updater',
              visible: true,
            },
          ]
        : []),

      // 10. Quick Actions
      {
        id: 'act_theme_light',
        title: t('settings.themeLight', 'فعال‌سازی تم روشن (Light Mode)'),
        category: t('common.quickSearchQuickActions', 'عملیات سریع'),
        keywords: ['روشن', 'روز', 'سفید', 'light theme'],
        icon: Sun,
        action: () => setTheme('light'),
        visible: true,
      },
      {
        id: 'act_theme_dark',
        title: t('settings.themeDark', 'فعال‌سازی تم تیره (Dark Mode)'),
        category: t('common.quickSearchQuickActions', 'عملیات سریع'),
        keywords: ['تیره', 'شب', 'مشکی', 'dark theme'],
        icon: Moon,
        action: () => setTheme('dark'),
        visible: true,
      },
      {
        id: 'act_theme_system',
        title: t('settings.themeSystem', 'هماهنگ‌سازی تم با سیستم‌عامل (System)'),
        category: t('common.quickSearchQuickActions', 'عملیات سریع'),
        keywords: ['سیستم', 'خودکار', 'system theme'],
        icon: Monitor,
        action: () => setTheme('system'),
        visible: true,
      },
      ...(onSyncNow
        ? [
            {
              id: 'act_sync_now',
              title: t('common.syncNow', 'همگام‌سازی فوری با سرور ابری'),
              category: t('common.quickSearchQuickActions', 'عملیات سریع'),
              keywords: ['همگام', 'سینک', 'ارسال تغییرات', 'sync now'],
              icon: RefreshCw,
              action: onSyncNow,
              visible: true,
            },
          ]
        : []),
      ...(onOpenCreateOrg
        ? [
            {
              id: 'act_create_org',
              title: t('common.createNewOrg', 'ایجاد سازمان یا شعبه جدید'),
              category: t('common.quickSearchQuickActions', 'عملیات سریع'),
              keywords: ['ایجاد سازمان', 'فروشگاه جدید', 'شعبه جدید', 'new org'],
              icon: Plus,
              action: onOpenCreateOrg,
              visible: true,
            },
          ]
        : []),
    ].filter((item) => item.visible !== false);
  }, [t, permissions, isOwner, hasBarcode, hasAccounting, hasWooCommerce, isDesktop, setTheme, onSyncNow, onOpenCreateOrg]);

  // Persian string normalizer for search
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[\u064A\u0649]/g, 'ی')
      .replace(/[\u0643]/g, 'ک')
      .replace(/[\u200C\u200B]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = normalize(query);
    if (!q) {
      // Default: show popular/essential navigation items
      return allItems.slice(0, 10);
    }

    return allItems.filter((item) => {
      const matchTitle = normalize(item.title).includes(q);
      const matchCategory = normalize(item.category).includes(q);
      const matchKeywords = item.keywords.some((kw) => normalize(kw).includes(q));
      return matchTitle || matchCategory || matchKeywords;
    });
  }, [allItems, query]);

  // Focus input and reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // Auto scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = (item: SearchableItem) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.route) {
      onNavigate(item.route);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4 pb-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#14161c] rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 overflow-hidden z-10 animate-scale-up text-neutral-800 dark:text-neutral-200">
        {/* Search Header Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-200/80 dark:border-neutral-800">
          <Search className="w-5 h-5 text-neutral-400 dark:text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t('common.quickSearchPlaceholder', 'عنوان صفحه یا عملیات مورد نظر را جستجو کنید...')}
            className="w-full bg-transparent text-sm sm:text-base font-medium text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[380px] sm:max-h-[440px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 mx-auto flex items-center justify-center mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-neutral-700 dark:text-neutral-300">
                {t('common.quickSearchNoResults', 'هیچ صفحه یا عملیاتی با این عبارت یافت نشد')}
              </p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
                کلماتی مانند «انبار»، «سفارش»، «محصول»، «چاپ بارکد»، «سود و زیان» یا «تنظیمات» را امتحان کنید.
              </p>
            </div>
          ) : (
            <>
              {!query && (
                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  {t('common.quickSearchRecentPages', 'صفحات و بخش‌های پرکاربرد')}
                </div>
              )}
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={item.id}
                    data-index={index}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-start transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 shadow-sm'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-neutral-700 dark:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-white/15 dark:bg-neutral-900/15 text-white dark:text-neutral-900'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-semibold truncate leading-tight">
                            {item.title}
                          </p>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                isSelected
                                  ? 'bg-white/20 dark:bg-neutral-900/20 text-white dark:text-neutral-900'
                                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-[10px] truncate mt-0.5 ${
                            isSelected
                              ? 'text-neutral-300 dark:text-neutral-600'
                              : 'text-neutral-400 dark:text-neutral-500'
                          }`}
                        >
                          {item.category}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ps-2">
                      {isSelected ? (
                        <div className="flex items-center gap-1 text-[11px] font-medium opacity-90">
                          <span className="hidden sm:inline">{t('common.quickSearchNavigateHint', 'ورود')}</span>
                          <CornerDownLeft className="w-3.5 h-3.5" />
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-4 py-2.5 bg-neutral-50 dark:bg-[#101217] border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px]">
                ↑↓
              </kbd>
              <span>پیمایش</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px]">
                ↵ Enter
              </kbd>
              <span>انتخاب</span>
            </span>
          </div>

          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px]">
              Esc
            </kbd>
            <span>بستن</span>
          </span>
        </div>
      </div>
    </div>
  );
};
