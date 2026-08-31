import React, { createContext, useContext, useState, useEffect } from 'react';
import { directusClient } from '../api/directus';
import { storageManager } from '../storage';

export interface UserRole {
  id?: string;
  name?: string;
  description?: string;
  admin_access?: boolean;
}

export interface User {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  avatar?: string;
  title?: string;
  description?: string;
  role?: string | UserRole;
  status?: string;
}

export interface RegisterParams {
  firstName?: string;
  lastName?: string;
  email: string;
  pass?: string;
  password?: string;
  orgName?: string;
  orgSlug?: string;
  currency?: string;
  initialCategoryName?: string;
  initialWarehouseName?: string;
}

export type RegisterFunction = {
  (params: RegisterParams): Promise<boolean>;
  (firstName: string, lastName: string, email: string, password: string, orgName?: string): Promise<boolean>;
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isCloudAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  login: (email: string, pass: string) => Promise<boolean>;
  register: RegisterFunction;
  loginOfflineGuest: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CACHED_USER_KEY = 'tankhor_cached_user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isCloudAuthenticated, setIsCloudAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setLoginError(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('tankhor_directus_token');
    const cachedUserRaw = localStorage.getItem(CACHED_USER_KEY);

    if (token) {
      setIsLoading(true);
      directusClient.getMe()
        .then(async (userData) => {
          if (userData && (userData.id || userData.email)) {
            setUser(userData);
            setIsCloudAuthenticated(true);
            storageManager.setMode('cloud_synced');

            const activeOrg = userData.active_organization || userData.activeOrganization;
            localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));

            if (activeOrg && activeOrg.id) {
              localStorage.setItem('tankhor_active_org_id', String(activeOrg.id));
              await storageManager.getLocalAdapter().saveOrganization(activeOrg);
            }
            if (Array.isArray(userData.organizations)) {
              for (const org of userData.organizations) {
                if (org && org.id && org.name) {
                  await storageManager.getLocalAdapter().saveOrganization(org);
                }
              }
            }
          } else {
            // Token was invalid or unauthenticated
            directusClient.setToken(null);
            localStorage.removeItem(CACHED_USER_KEY);
            setUser(null);
            setIsCloudAuthenticated(false);
            storageManager.setMode('local_offline');
          }
        })
        .catch((err) => {
          const errMsg = err?.message || '';
          const isAuthError =
            errMsg.toLowerCase().includes('token expired') ||
            errMsg.toLowerCase().includes('unauthorized') ||
            errMsg.toLowerCase().includes('invalid token') ||
            errMsg.includes('TOKEN_EXPIRED') ||
            errMsg.includes('INVALID_TOKEN') ||
            !directusClient.getToken();

          if (isAuthError) {
            // Expired/Invalid token! Wipe tokens and profile so user lands on Login screen
            directusClient.setToken(null);
            localStorage.removeItem(CACHED_USER_KEY);
            setUser(null);
            setIsCloudAuthenticated(false);
            storageManager.setMode('local_offline');
          } else {
            handleOfflineFallback(cachedUserRaw);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      // No token present -> User must see LoginView
      setUser(null);
      setIsCloudAuthenticated(false);
      storageManager.setMode('local_offline');
      setIsLoading(false);
    }
  }, []);

  const handleOfflineFallback = (cachedUserRaw: string | null) => {
    if (cachedUserRaw) {
      try {
        const parsed = JSON.parse(cachedUserRaw);
        if (parsed && (parsed.id || parsed.email)) {
          setUser(parsed);
          setIsCloudAuthenticated(false);
          storageManager.setMode('local_offline');
          return;
        }
      } catch {
        // invalid JSON
      }
    }
    setUser(null);
    setIsCloudAuthenticated(false);
    storageManager.setMode('local_offline');
  };

  const loginOfflineGuest = () => {
    const offlineUser: User = {
      id: 'local_guest',
      first_name: 'کاربر',
      last_name: 'آفلاین',
      email: 'guest@tankhor.local',
      role: 'مدیر سیستم (آفلاین)',
    };
    setUser(offlineUser);
    setIsCloudAuthenticated(false);
    storageManager.setMode('local_offline');
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(offlineUser));
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoginError(null);
    setIsLoading(true);
    // Always clear old tokens before attempting login
    directusClient.setToken(null);
    try {
      const loginRes = await directusClient.login(email, pass);
      let userData = await directusClient.getMe().catch(() => loginRes.user);
      if (!userData) userData = loginRes.user;

      if (userData && (userData.id || userData.email)) {
        setUser(userData);
        setIsCloudAuthenticated(true);

        const activeOrg = userData.active_organization || userData.activeOrganization || loginRes.activeOrganization;
        if (activeOrg && activeOrg.plan === 'pro') {
          storageManager.setMode('cloud_synced');
        } else {
          storageManager.setMode('local_offline');
        }

        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));

        if (activeOrg && activeOrg.id) {
          localStorage.setItem('tankhor_active_org_id', String(activeOrg.id));
          await storageManager.getLocalAdapter().saveOrganization(activeOrg);
        }
        if (Array.isArray(userData.organizations)) {
          for (const org of userData.organizations) {
            if (org && org.id && org.name) {
              await storageManager.getLocalAdapter().saveOrganization(org);
            }
          }
        }

        setIsLoginModalOpen(false);
        return true;
      }
      throw new Error('دریافت اطلاعات حساب کاربری با خطا مواجه شد.');
    } catch (err: any) {
      const msg = err?.message || 'نام کاربری (ایمیل) یا کلمه عبور نادرست است.';
      setLoginError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register: RegisterFunction = (async (
    paramOrFirst: RegisterParams | string,
    lastNameArg?: string,
    emailArg?: string,
    passArg?: string,
    orgNameArg?: string
  ): Promise<boolean> => {
    setLoginError(null);
    setIsLoading(true);
    // Always clear old tokens before attempting registration
    directusClient.setToken(null);
    try {
      let finalParams: RegisterParams;
      if (typeof paramOrFirst === 'object' && paramOrFirst !== null) {
        finalParams = paramOrFirst;
      } else {
        const firstStr = typeof paramOrFirst === 'string' ? paramOrFirst : '';
        finalParams = {
          firstName: firstStr,
          lastName: lastNameArg || '',
          email: emailArg || '',
          pass: passArg || '',
          orgName: orgNameArg || (firstStr ? `فروشگاه ${firstStr} ${lastNameArg || ''}`.trim() : 'فروشگاه من'),
        };
      }

      const email = (finalParams.email || '').trim();
      const password = (finalParams.pass || finalParams.password || '').trim();
      const firstName = (finalParams.firstName || '').trim();
      const lastName = (finalParams.lastName || '').trim();
      const orgName = (finalParams.orgName || '').trim() || (firstName ? `فروشگاه ${firstName} ${lastName}`.trim() : 'فروشگاه من');

      if (!email || !password) {
        setLoginError('وارد کردن آدرس ایمیل و کلمه عبور الزامی است.');
        return false;
      }

      // 1. Send registration request with user & custom organization data
      const regRes = await directusClient.register({
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
        org_name: orgName,
        org_slug: finalParams.orgSlug,
        currency: finalParams.currency || 'TOMAN',
        initial_category_name: finalParams.initialCategoryName,
        initial_warehouse_name: finalParams.initialWarehouseName,
      });

      // 2. Fetch authenticated profile & organization
      let userData = await directusClient.getMe().catch(() => null);
      if (!userData && regRes.user) {
        userData = regRes.user;
      }

      if (userData && (userData.id || userData.email)) {
        setUser(userData);
        setIsCloudAuthenticated(true);

        const activeOrg = userData.active_organization || userData.activeOrganization || regRes.organization || regRes.activeOrganization;
        if (activeOrg && activeOrg.plan === 'pro') {
          storageManager.setMode('cloud_synced');
        } else {
          storageManager.setMode('local_offline');
        }

        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));

        if (activeOrg && activeOrg.id) {
          localStorage.setItem('tankhor_active_org_id', String(activeOrg.id));
          await storageManager.getLocalAdapter().saveOrganization(activeOrg);
        }
        if (Array.isArray(userData.organizations)) {
          for (const org of userData.organizations) {
            if (org && org.id && org.name) {
              await storageManager.getLocalAdapter().saveOrganization(org);
            }
          }
        }

        setIsLoginModalOpen(false);
        return true;
      }

      setLoginError('حساب و سازمان ایجاد شدند، لطفاً وارد شوید.');
      return false;
    } catch (err: any) {
      console.error('[AuthContext] Cloud Registration Failed:', err);
      const errMsg = err?.message || err?.toString() || '';

      if (
        errMsg.toLowerCase().includes('unique') ||
        errMsg.includes('RECORD_NOT_UNIQUE') ||
        errMsg.toLowerCase().includes('already exists')
      ) {
        setLoginError('این آدرس ایمیل قبلاً در سرور آنلاین ثبت شده است. لطفاً وارد شوید.');
      } else {
        setLoginError(`خطا در ثبت‌نام: ${errMsg}`);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }) as RegisterFunction;

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await directusClient.logout();
    } catch {
      // Ignore network errors
    } finally {
      storageManager.setMode('local_offline');
      localStorage.removeItem(CACHED_USER_KEY);
      localStorage.removeItem('tankhor_active_org_id');
      localStorage.removeItem('tankhor_directus_token');
      localStorage.removeItem('tankhor_directus_refresh_token');
      setUser(null);
      setIsCloudAuthenticated(false);
      storageManager.setMode('local_offline');
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isCloudAuthenticated,
        isLoading,
        loginError,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        login,
        register,
        loginOfflineGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
