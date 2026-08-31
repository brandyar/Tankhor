/**
 * Tankhor Backend API Gateway Client (BFF Proxy)
 * Connects securely to the Node.js API Gateway which handles Directus Admin and Tenant Isolation.
 */

export interface DirectusConfig {
  baseUrl: string;
  token?: string | null;
}

class DirectusClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/+$/, '');
    } else if (typeof window !== 'undefined') {
      const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
      const customApiUrl = metaEnv?.VITE_API_URL || metaEnv?.VITE_GATEWAY_URL;
      const isTauri =
        window.location.protocol.includes('tauri') ||
        Boolean((window as any).__TAURI__) ||
        window.location.hostname === 'tauri.localhost';

      if (customApiUrl) {
        this.baseUrl = customApiUrl.replace(/\/+$/, '');
      } else if (isTauri) {
        const rawServer = metaEnv?.VITE_DIRECTUS_URL || metaEnv?.VITE_API_URL || 'https://api.tankhor.com';
        this.baseUrl = rawServer.replace(/\/+$/, '');
      } else {
        // In browser / web preview / production Cloud Run, all requests go through the same-origin Express BFF proxy at /api
        this.baseUrl = '/api';
      }
    } else {
      this.baseUrl = '/api';
    }
    this.token = typeof window !== 'undefined' ? localStorage.getItem('tankhor_directus_token') : null;
  }

  public setToken(token: string | null, refreshToken?: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('tankhor_directus_token', token);
      } else {
        localStorage.removeItem('tankhor_directus_token');
      }
      if (refreshToken) {
        localStorage.setItem('tankhor_directus_refresh_token', refreshToken);
      } else if (refreshToken === null) {
        localStorage.removeItem('tankhor_directus_refresh_token');
      }
    }
  }

  public getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tankhor_directus_token');
    }
    return null;
  }

  public getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tankhor_directus_refresh_token');
    }
    return null;
  }

  private isRefreshing = false;

  private async refreshAccessToken(): Promise<string | null> {
    const rToken = this.getRefreshToken();
    if (!rToken) return null;

    try {
      this.isRefreshing = true;
      const url = `${this.getBaseUrl()}/auth/refresh`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rToken, mode: 'json' }),
      });

      if (!response.ok) {
        this.setToken(null, null);
        return null;
      }

      const json = await response.json();
      const resData = json.data || json;
      const newToken = resData.access_token || resData.token;
      const newRefreshToken = resData.refresh_token || rToken;

      if (newToken) {
        this.setToken(newToken, newRefreshToken);
        return newToken;
      } else {
        this.setToken(null, null);
        return null;
      }
    } catch {
      this.setToken(null, null);
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl || 'https://api.tankhor.com';
  }

  private isAuthPublicEndpoint(endpoint: string): boolean {
    const clean = endpoint.toLowerCase().trim();
    return (
      clean.startsWith('/auth/login') ||
      clean.startsWith('/auth/register') ||
      clean.startsWith('/auth/refresh') ||
      clean === '/users' ||
      clean === '/users/'
    );
  }

  private getHeaders(options?: RequestInit & { skipAuth?: boolean }, endpoint?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const skip = options?.skipAuth || (endpoint && this.isAuthPublicEndpoint(endpoint));
    if (!skip) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  public async request<T = any>(endpoint: string, options: RequestInit & { skipAuth?: boolean } = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.getBaseUrl()}${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(options, cleanEndpoint),
          ...(options.headers || {}),
        },
      });

      if (response.status === 204) {
        return {} as T;
      }

      const text = await response.text();
      let data: any = {};
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      if (!response.ok) {
        const errorMsg = data.errors?.[0]?.message || data.error || data.message || `Request failed with status ${response.status}`;
        
        const isExpiredOrUnauthorized =
          response.status === 401 ||
          errorMsg.toLowerCase().includes('token expired') ||
          errorMsg.toLowerCase().includes('invalid token') ||
          errorMsg.includes('TOKEN_EXPIRED') ||
          errorMsg.includes('INVALID_TOKEN');

        if (isExpiredOrUnauthorized && !this.isRefreshing && !this.isAuthPublicEndpoint(cleanEndpoint)) {
          const newToken = await this.refreshAccessToken();
          if (newToken) {
            return this.request<T>(endpoint, options);
          } else {
            this.setToken(null, null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('tankhor_cached_user_profile');
            }
          }
        } else if (isExpiredOrUnauthorized) {
          this.setToken(null, null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('tankhor_cached_user_profile');
          }
        }

        throw new Error(errorMsg);
      }

      return data.data !== undefined ? data.data : (data as T);
    } catch (err: any) {
      console.warn(`[API Client] Request failed for ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Auth methods
  public async login(email: string, password: string): Promise<{ access_token: string; user: any; activeOrganization: any; organizations: any[] }> {
    const cleanEmail = email.toLowerCase().trim();
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, password, mode: 'json' }),
    });

    const token = res.token || res.access_token;
    const refreshToken = res.refresh_token;
    if (token) {
      this.setToken(token, refreshToken);
    }

    let user = res.user;
    let activeOrg = res.activeOrganization || res.active_organization;
    let orgs = res.organizations;

    if (!user || !activeOrg || !Array.isArray(orgs) || orgs.length === 0) {
      const meData = await this.getMe().catch(() => null);
      if (meData) {
        user = user || meData;
        activeOrg = activeOrg || meData.activeOrganization || meData.active_organization;
        orgs = orgs || meData.organizations;
      }
    }

    if (activeOrg?.id && typeof window !== 'undefined') {
      localStorage.setItem('tankhor_active_org_id', String(activeOrg.id));
    }

    const finalOrgs = Array.isArray(orgs) && orgs.length > 0 ? orgs : (activeOrg ? [activeOrg] : []);
    const finalActiveOrg = activeOrg || (finalOrgs.length > 0 ? finalOrgs[0] : null);

    return {
      access_token: token,
      user: user || { email: cleanEmail, role: 'owner', plan: 'free' },
      activeOrganization: finalActiveOrg,
      organizations: finalOrgs,
    };
  }

  public async logout(): Promise<void> {
    this.setToken(null, null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tankhor_cached_user_profile');
      localStorage.removeItem('tankhor_active_org_id');
      localStorage.removeItem('tankhor_storage_mode');
    }
  }

  public async getMe(): Promise<any> {
    try {
      return await this.request('/auth/me');
    } catch {
      return await this.request('/users/me');
    }
  }

  public async register(data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    org_name?: string;
    org_slug?: string;
    currency?: string;
    initial_category_name?: string;
    initial_warehouse_name?: string;
  }): Promise<any> {
    const cleanEmail = data.email.toLowerCase().trim();
    let res: any;

    try {
      res = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...data, email: cleanEmail }),
      });
    } catch (err: any) {
      try {
        const DIRECTUS_TENANT_ROLE_ID = 'dbc2022f-0dea-4ef4-bb00-00a577e3208d';
        const newUser = await this.request('/users', {
          method: 'POST',
          body: JSON.stringify({
            email: cleanEmail,
            password: data.password,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            status: 'active',
            role: DIRECTUS_TENANT_ROLE_ID,
          }),
        });

        const loginRes = await this.login(cleanEmail, data.password);
        return {
          success: true,
          user: newUser || loginRes.user,
          token: loginRes.access_token,
          activeOrganization: loginRes.activeOrganization,
          organization: loginRes.activeOrganization,
        };
      } catch (directusErr: any) {
        throw new Error(directusErr.message || err.message || 'خطا در ثبت نام در سرور آنلاین');
      }
    }

    const token = res.token || res.access_token;
    const refreshToken = res.refresh_token;
    if (token) {
      this.setToken(token, refreshToken);
    }
    const orgId = res.activeOrganization?.id || res.organization?.id;
    if (orgId && typeof window !== 'undefined') {
      localStorage.setItem('tankhor_active_org_id', String(orgId));
    }
    return res;
  }

  public async switchOrganization(targetOrganizationId: number): Promise<any> {
    const res = await this.request('/auth/switch-org', {
      method: 'POST',
      body: JSON.stringify({ targetOrganizationId }),
    });
    if (res.token) {
      this.setToken(res.token, res.refresh_token);
    }
    const orgId = res.activeOrganization?.id || targetOrganizationId;
    if (orgId && typeof window !== 'undefined') {
      localStorage.setItem('tankhor_active_org_id', String(orgId));
    }
    return res;
  }

  public async createOrganization(data: {
    name: string;
    slug?: string;
    currency?: string;
    timezone?: string;
    plan?: string;
  }): Promise<any> {
    const res = await this.request('/auth/create-org', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      this.setToken(res.token, res.refresh_token);
    }
    const orgId = res.activeOrganization?.id || res.organization?.id;
    if (orgId && typeof window !== 'undefined') {
      localStorage.setItem('tankhor_active_org_id', String(orgId));
    }
    return res.organization || res.activeOrganization;
  }

  public async checkOrganizationPlan(): Promise<{
    success: boolean;
    organizationId: number;
    plan: 'free' | 'pro';
    isPro: boolean;
    organization: any;
    activeOrganization: any;
    organizations: any[];
  }> {
    const res = await this.request<any>('/auth/check-plan');
    if (res && res.activeOrganization) {
      // Update cached user profile in localStorage
      if (typeof window !== 'undefined') {
        const cachedRaw = localStorage.getItem('tankhor_cached_user_profile');
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            cached.activeOrganization = res.activeOrganization;
            cached.active_organization = res.activeOrganization;
            if (Array.isArray(res.organizations) && res.organizations.length > 0) {
              cached.organizations = res.organizations;
            }
            localStorage.setItem('tankhor_cached_user_profile', JSON.stringify(cached));
          } catch {}
        }
      }
    }
    return res;
  }

  public async getOrganizations(): Promise<any[]> {
    try {
      const me = await this.getMe().catch(() => null);
      if (me && Array.isArray(me.organizations) && me.organizations.length > 0) {
        return me.organizations;
      }
      if (me && (me.activeOrganization || me.active_organization)) {
        return [me.activeOrganization || me.active_organization];
      }

      // If connecting directly to Directus, query organization_users for current user
      if (me && me.id) {
        try {
          const memberships = await this.getItems<any>('organization_users', {
            filter: { user_id: { _eq: me.id } },
            fields: ['id', 'role', 'status', 'organization_id.*'],
          });
          if (Array.isArray(memberships) && memberships.length > 0) {
            const orgs = memberships
              .map((m: any) => {
                if (m.organization_id && typeof m.organization_id === 'object' && m.organization_id.id) {
                  return { ...m.organization_id, user_role: m.role || 'viewer' };
                }
                return null;
              })
              .filter(Boolean);
            if (orgs.length > 0) return orgs;
          }
        } catch {}
      }

      const res = await this.getItems('organizations');
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  // Generic collection helpers
  public async getItems<T>(collection: string, query?: Record<string, any>): Promise<T[]> {
    let queryString = '';
    if (query) {
      const params = new URLSearchParams();
      if (query.filter) params.append('filter', typeof query.filter === 'string' ? query.filter : JSON.stringify(query.filter));
      if (query.sort) params.append('sort', query.sort);
      if (query.limit) params.append('limit', String(query.limit));
      if (query.page) params.append('page', String(query.page));
      if (query.fields) params.append('fields', Array.isArray(query.fields) ? query.fields.join(',') : query.fields);
      queryString = `?${params.toString()}`;
    }
    const result = await this.request<T[]>(`/items/${collection}${queryString}`);
    return Array.isArray(result) ? result : [];
  }

  public async getItemById<T>(collection: string, id: number | string): Promise<T> {
    return this.request<T>(`/items/${collection}/${id}`);
  }

  public async createItem<T>(collection: string, item: Partial<T>): Promise<T> {
    return this.request<T>(`/items/${collection}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  public async updateItem<T>(collection: string, id: number | string, item: Partial<T>): Promise<T> {
    return this.request<T>(`/items/${collection}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(item),
    });
  }

  public async deleteItem(collection: string, id: number | string): Promise<boolean> {
    await this.request(`/items/${collection}/${id}`, {
      method: 'DELETE',
    });
    return true;
  }

  public async uploadFile(file: File): Promise<{ id: string; title: string; filename_download: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.getBaseUrl()}/files`;
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.error || errorData.message || 'File upload failed');
    }

    const json = await response.json();
    return json.data || json;
  }

  public getAssetUrl(fileId: string): string {
    if (!fileId) return '';
    if (fileId.startsWith('data:') || fileId.startsWith('http://') || fileId.startsWith('https://')) {
      return fileId;
    }
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    const directusUrl = metaEnv?.VITE_DIRECTUS_URL || 'https://api.tankhor.com';
    return `${directusUrl.replace(/\/+$/, '')}/assets/${fileId}`;
  }

  public async getProjectSettings(): Promise<{
    windows_setup?: string | null;
    macos_setup?: string | null;
    adnroid_setup?: string | null;
    android_setup?: string | null;
  }> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/project-settings`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch project settings:', e);
    }
    return {
      windows_setup: null,
      macos_setup: null,
      adnroid_setup: null,
      android_setup: null,
    };
  }
}

export const directusClient = new DirectusClient();
