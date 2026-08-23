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

interface RegisterParams {
  firstName: string;
  lastName: string;
  email: string;
  pass: string;
  orgName: string;
  orgSlug?: string;
  currency?: string;
  initialCategoryName?: string;
  initialWarehouseName?: string;
}

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
  register: (params: RegisterParams) => Promise<boolean>;
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
        .then((userData) => {
          if (userData && userData.id) {
            setUser(userData);
            setIsCloudAuthenticated(true);
            localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));
          } else {
            handleOfflineFallback(cachedUserRaw);
          }
        })
        .catch(() => {
          // Server offline or token expired -> use cached user session for offline work
          handleOfflineFallback(cachedUserRaw);
        })
        .finally(() => setIsLoading(false));
    } else {
      handleOfflineFallback(cachedUserRaw);
      setIsLoading(false);
    }
  }, []);

  const handleOfflineFallback = (cachedUserRaw: string | null) => {
    if (cachedUserRaw) {
      try {
        const parsed = JSON.parse(cachedUserRaw);
        if (parsed && parsed.id) {
          setUser(parsed);
          setIsCloudAuthenticated(false);
          return;
        }
      } catch {
        // invalid JSON
      }
    }
    setUser(null);
    setIsCloudAuthenticated(false);
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoginError(null);
    setIsLoading(true);
    try {
      await directusClient.login(email, pass);
      const userData = await directusClient.getMe();

      if (userData && userData.id) {
        setUser(userData);
        setIsCloudAuthenticated(true);
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));
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

  const register = async (params: RegisterParams): Promise<boolean> => {
    setLoginError(null);
    setIsLoading(true);
    try {
      // 1. Send registration request with user & custom organization data
      await directusClient.register({
        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
        password: params.pass,
        org_name: params.orgName,
        org_slug: params.orgSlug,
        currency: params.currency || 'TOMAN',
        initial_category_name: params.initialCategoryName,
        initial_warehouse_name: params.initialWarehouseName,
      });

      // 2. Fetch authenticated profile & organization
      const userData = await directusClient.getMe();
      if (userData && userData.id) {
        setUser(userData);
        setIsCloudAuthenticated(true);
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));
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
        setLoginError('این آدرس ایمیل قبلاً در سرور ابری ثبت شده است. لطفاً وارد شوید.');
      } else {
        setLoginError(`خطا در ثبت‌نام: ${errMsg}`);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await directusClient.logout();
    } catch {
      // Ignore network errors
    } finally {
      localStorage.removeItem(CACHED_USER_KEY);
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
