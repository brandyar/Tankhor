import React, { createContext, useContext, useState, useEffect } from 'react';
import { commonFa } from './locales/fa/common';
import { navigationFa } from './locales/fa/navigation';
import { dashboardFa } from './locales/fa/dashboard';

import { commonEn } from './locales/en/common';
import { navigationEn } from './locales/en/navigation';
import { dashboardEn } from './locales/en/dashboard';

export type Locale = 'fa' | 'en';
export type Direction = 'rtl' | 'ltr';

const translations = {
  fa: {
    common: commonFa,
    navigation: navigationFa,
    dashboard: dashboardFa,
  },
  en: {
    common: commonEn,
    navigation: navigationEn,
    dashboard: dashboardEn,
  },
};

interface I18nContextType {
  locale: Locale;
  direction: Direction;
  setLocale: (loc: Locale) => void;
  t: (path: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('tankhor_locale') as Locale) || 'fa';
  });

  const direction: Direction = locale === 'fa' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem('tankhor_locale', locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = (path: string, fallback?: string): string => {
    const parts = path.split('.');
    let current: any = translations[locale];

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return fallback || path;
      }
    }

    return typeof current === 'string' ? current : fallback || path;
  };

  return (
    <I18nContext.Provider value={{ locale, direction, setLocale, t }}>
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
