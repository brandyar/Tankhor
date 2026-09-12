import React, { createContext, useContext, useState, useEffect } from 'react';
import { commonFa } from './locales/fa/common';
import { navigationFa } from './locales/fa/navigation';
import { dashboardFa } from './locales/fa/dashboard';
import { productsFa } from './locales/fa/products';
import { ordersFa } from './locales/fa/orders';
import { inventoryFa } from './locales/fa/inventory';
import { purchasingFa } from './locales/fa/purchasing';
import { customersFa } from './locales/fa/customers';
import { sizeguidesFa } from './locales/fa/sizeguides';
import { settingsFa } from './locales/fa/settings';
import { authFa } from './locales/fa/auth';
import { reportsFa } from './locales/fa/reports';
import { modulesFa } from './locales/fa/modules';
import { accountingFa } from './locales/fa/accounting';

import { commonEn } from './locales/en/common';
import { navigationEn } from './locales/en/navigation';
import { dashboardEn } from './locales/en/dashboard';
import { productsEn } from './locales/en/products';
import { ordersEn } from './locales/en/orders';
import { inventoryEn } from './locales/en/inventory';
import { purchasingEn } from './locales/en/purchasing';
import { customersEn } from './locales/en/customers';
import { sizeguidesEn } from './locales/en/sizeguides';
import { settingsEn } from './locales/en/settings';
import { authEn } from './locales/en/auth';
import { reportsEn } from './locales/en/reports';
import { modulesEn } from './locales/en/modules';
import { accountingEn } from './locales/en/accounting';

export type Locale = 'fa' | 'en';
export type Direction = 'rtl' | 'ltr';

const translations = {
  fa: {
    common: commonFa,
    navigation: navigationFa,
    dashboard: dashboardFa,
    products: productsFa,
    orders: ordersFa,
    inventory: inventoryFa,
    purchasing: purchasingFa,
    customers: customersFa,
    sizeguides: sizeguidesFa,
    settings: settingsFa,
    auth: authFa,
    reports: reportsFa,
    modules: modulesFa,
    accounting: accountingFa,
  },
  en: {
    common: commonEn,
    navigation: navigationEn,
    dashboard: dashboardEn,
    products: productsEn,
    orders: ordersEn,
    inventory: inventoryEn,
    purchasing: purchasingEn,
    customers: customersEn,
    sizeguides: sizeguidesEn,
    settings: settingsEn,
    auth: authEn,
    reports: reportsEn,
    modules: modulesEn,
    accounting: accountingEn,
  },
};

interface I18nContextType {
  locale: Locale;
  direction: Direction;
  isRtl: boolean;
  isPersian: boolean;
  setLocale: (loc: Locale) => void;
  t: (path: string, paramsOrFallback?: Record<string, any> | string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('tankhor_locale') as Locale) || 'fa';
  });

  const direction: Direction = locale === 'fa' ? 'rtl' : 'ltr';
  const isRtl = direction === 'rtl';
  const isPersian = locale === 'fa';

  useEffect(() => {
    localStorage.setItem('tankhor_locale', locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    if (direction === 'ltr') {
      document.body.classList.add('font-sans-en');
      document.body.classList.remove('font-vazir');
    } else {
      document.body.classList.add('font-vazir');
      document.body.classList.remove('font-sans-en');
    }
  }, [locale, direction]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = (
    path: string,
    paramsOrFallback?: Record<string, any> | string,
    explicitFallback?: string
  ): string => {
    const parts = path.split('.');
    let current: any = translations[locale];
    let resolvedString: string | null = null;
    const fallbackStr = typeof paramsOrFallback === 'string' ? paramsOrFallback : explicitFallback;
    const params = typeof paramsOrFallback === 'object' && paramsOrFallback !== null ? paramsOrFallback : undefined;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        // Try fallback to Persian
        let fallbackCurrent: any = translations['fa'];
        for (const fPart of parts) {
          if (fallbackCurrent && typeof fallbackCurrent === 'object' && fPart in fallbackCurrent) {
            fallbackCurrent = fallbackCurrent[fPart];
          } else {
            fallbackCurrent = null;
            break;
          }
        }
        if (typeof fallbackCurrent === 'string') {
          resolvedString = fallbackCurrent;
        } else {
          resolvedString = fallbackStr || path;
        }
        break;
      }
    }

    if (resolvedString === null) {
      resolvedString = typeof current === 'string' ? current : fallbackStr || path;
    }

    // Apply interpolation params if provided (e.g. {count}, {name}, {title})
    if (params && typeof resolvedString === 'string') {
      for (const [key, val] of Object.entries(params)) {
        resolvedString = resolvedString.replace(new RegExp(`{${key}}`, 'g'), String(val));
      }
    }

    return resolvedString;
  };

  return (
    <I18nContext.Provider value={{ locale, direction, isRtl, isPersian, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
