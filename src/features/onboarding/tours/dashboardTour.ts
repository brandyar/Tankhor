import { DriveStep } from 'driver.js';
import { TourDefinition } from '../types';

export const dashboardTour: TourDefinition = {
  name: 'dashboard',
  getSteps: (t: (key: string, paramsOrFallback?: any, fallback?: string) => string, isRtl: boolean): DriveStep[] => {
    return [
      // Step 1: Welcome & Dashboard KPI Ribbon
      {
        element: '#tour-dashboard-ribbon',
        popover: {
          title: t('onboarding.dashboard.welcome.title', 'به نرم‌افزار تن‌خور (TANKHOR) خوش آمدید!'),
          description: t(
            'onboarding.dashboard.welcome.description',
            'سامانه یکپارچه مدیریت تخصصی مد، پوشاک و زنجیره تامین. در این بخش، آمار لحظه‌ای موجودی کل انبار، ارزش ریالی کالاها، تنوع اقلام و میزان فروش دوره‌ای را در یک نگاه مشاهده می‌کنید.'
          ),
          side: 'bottom',
          align: 'center',
        },
      },
      // Step 2: Quick Operational Actions
      {
        element: '#tour-quick-actions',
        popover: {
          title: t('onboarding.dashboard.quickActions.title', 'عملیات و دسترسی‌های سریع'),
          description: t(
            'onboarding.dashboard.quickActions.description',
            'دسترسی سریع به ثبت فوری سفارش فروش، تعریف محصول جدید، صدور فاکتور خرید و مشاهده لیست سفارشات با یک کلیک برای تسریع کارهای روزمره فروشگاه.'
          ),
          side: 'bottom',
          align: 'center',
        },
      },
      // Step 3: Products & Catalog
      {
        element: '#tour-nav-products',
        popover: {
          title: t('onboarding.dashboard.products.title', 'محصولات و کاتالوگ تخصصی پوشاک'),
          description: t(
            'onboarding.dashboard.products.description',
            'مدیریت ماتریس تنوع رنگ و سایز، راهنمای سایز تعاملی، ویژگی‌ها، دسته‌بندی‌ها، فصل‌ها و برندها با معماری مختص صنعت مد و لباس.'
          ),
          side: isRtl ? 'left' : 'right',
          align: 'start',
        },
      },
      // Step 4: Inventory & Multi-Warehouse
      {
        element: '#tour-nav-inventory',
        popover: {
          title: t('onboarding.dashboard.inventory.title', 'انبارداری، موجودی و چاپ بارکد'),
          description: t(
            'onboarding.dashboard.inventory.description',
            'کنترل موجودی انبارها، انتقال بین انبارها، رهگیری اسناد ورود و خروج، هشدارهای کسری موجودی و طراحی و چاپ بارکد و لیبل استاندارد.'
          ),
          side: isRtl ? 'left' : 'right',
          align: 'start',
        },
      },
      // Step 5: Orders & Sales
      {
        element: '#tour-nav-orders',
        popover: {
          title: t('onboarding.dashboard.orders.title', 'فروش، فاکتور و مشتریان'),
          description: t(
            'onboarding.dashboard.orders.description',
            'ثبت و صدور فاکتور فروش، کسر آنی موجودی، تسویه حساب‌های نقدی/پوز، ثبت در دفتر معین مشتری و مدیریت ارتباط با خریداران.'
          ),
          side: isRtl ? 'left' : 'right',
          align: 'start',
        },
      },
      // Step 6: Analytics & Intelligence Charts
      {
        element: '#tour-analytics-charts',
        popover: {
          title: t('onboarding.dashboard.analytics.title', 'نمودارها و تحلیل هوشمند کسب‌وکار'),
          description: t(
            'onboarding.dashboard.analytics.description',
            'نمودارهای روند فروش، جریان ورود و خروج کالا، سهم دسته‌بندی‌ها و شاخص سلامت موجودی برای تصمیم‌گیری‌های دقیق‌تر و هوشمندانه.'
          ),
          side: 'top',
          align: 'center',
        },
      },
      // Step 7: Organization & Cloud Sync
      {
        element: '#tour-header-org',
        popover: {
          title: t('onboarding.dashboard.settings.title', 'سازمان، کاربران و همگام‌سازی ابری'),
          description: t(
            'onboarding.dashboard.settings.description',
            'مدیریت اطلاعات فروشگاه، کنترل دسترسی کاربران و تیم فروش، پشتیبان‌گیری آفلاین با یک کلیک و همگام‌سازی لحظه‌ای با سرور ابری.'
          ),
          side: 'bottom',
          align: isRtl ? 'start' : 'end',
        },
      },
    ];
  },
};
