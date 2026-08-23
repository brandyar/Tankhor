/**
 * Directus REST API Client
 */

export interface DirectusConfig {
  baseUrl: string;
  token?: string | null;
}

class DirectusClient {
  private baseUrl: string;
  private token: string | null = null;

  private refreshTokenValue: string | null = null;
  private isRefreshing = false;

  constructor(baseUrl?: string) {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    const envUrl = metaEnv?.VITE_DIRECTUS_URL;
    this.baseUrl = baseUrl || envUrl || 'https://api.tankhor.com';
    this.token = localStorage.getItem('tankhor_directus_token');
    this.refreshTokenValue = localStorage.getItem('tankhor_directus_refresh_token');
  }

  public setToken(token: string | null, refreshToken?: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('tankhor_directus_token', token);
    } else {
      localStorage.removeItem('tankhor_directus_token');
    }

    if (refreshToken !== undefined) {
      this.refreshTokenValue = refreshToken;
      if (refreshToken) {
        localStorage.setItem('tankhor_directus_refresh_token', refreshToken);
      } else {
        localStorage.removeItem('tankhor_directus_refresh_token');
      }
    }
  }

  public getRefreshToken(): string | null {
    return this.refreshTokenValue || localStorage.getItem('tankhor_directus_refresh_token');
  }

  public getBaseUrl(): string {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    const envUrl = metaEnv?.VITE_DIRECTUS_URL;
    return envUrl || this.baseUrl || 'https://api.tankhor.com';
  }

  public getEffectiveToken(): string | null {
    if (this.token) return this.token;
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    const envAdminToken = metaEnv?.VITE_DIRECTUS_ADMIN_TOKEN || metaEnv?.VITE_DIRECTUS_STATIC_TOKEN;
    return envAdminToken || null;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const effectiveToken = this.getEffectiveToken();
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
    }
    return headers;
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      if (response.status === 401 && retryCount === 0 && !endpoint.includes('/auth/')) {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          return this.request<T>(endpoint, options, 1);
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.errors?.[0]?.message || errorData.message || 'Directus request failed');
      }

      if (response.status === 204) {
        return {} as T;
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        return {} as T;
      }

      try {
        const json = JSON.parse(text);
        return json.data !== undefined ? json.data : (json as T);
      } catch {
        return {} as T;
      }
    } catch (err: any) {
      console.warn(`[Directus Client] Request failed for ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Auth methods
  public async login(email: string, password: string): Promise<{ access_token: string; refresh_token: string }> {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, mode: 'json' }),
    });
    if (data.access_token) {
      this.setToken(data.access_token, data.refresh_token || null);
    }
    return data;
  }

  public async refreshTokens(): Promise<boolean> {
    const rf = this.getRefreshToken();
    if (!rf || this.isRefreshing) return false;

    try {
      this.isRefreshing = true;
      const res = await fetch(`${this.getBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rf, mode: 'json' }),
      });

      if (!res.ok) {
        this.setToken(null, null);
        return false;
      }

      const text = await res.text();
      if (!text || !text.trim()) {
        this.setToken(null, null);
        return false;
      }
      const json = JSON.parse(text);
      const data = json.data || json;
      if (data.access_token) {
        this.setToken(data.access_token, data.refresh_token || rf);
        return true;
      }
      return false;
    } catch {
      this.setToken(null, null);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  public async logout(): Promise<void> {
    const rf = this.getRefreshToken();
    if (rf) {
      try {
        await fetch(`${this.getBaseUrl()}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rf }),
        }).catch(() => {});
      } catch {
        // ignore logout network errors
      }
    }
    this.setToken(null, null);
  }

  public async getMe(): Promise<any> {
    return this.request('/users/me?fields=*,role.id,role.name,role.description,role.admin_access');
  }

  public async register(data: { email: string; password: string; first_name?: string; last_name?: string }): Promise<any> {
    return await this.request('/users/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Generic collection helpers
  public async getItems<T>(collection: string, query?: Record<string, any>): Promise<T[]> {
    let queryString = '';
    if (query) {
      const params = new URLSearchParams();
      if (query.filter) params.append('filter', JSON.stringify(query.filter));
      if (query.sort) params.append('sort', query.sort);
      if (query.limit) params.append('limit', String(query.limit));
      if (query.page) params.append('page', String(query.page));
      if (query.fields) params.append('fields', Array.isArray(query.fields) ? query.fields.join(',') : query.fields);
      queryString = `?${params.toString()}`;
    }
    return this.request<T[]>(`/items/${collection}${queryString}`);
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
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.errors?.[0]?.message || errorData.message || 'File upload failed');
    }

    const json = await response.json();
    return json.data;
  }

  public getAssetUrl(fileId: string): string {
    if (!fileId) return '';
    if (fileId.startsWith('data:') || fileId.startsWith('http://') || fileId.startsWith('https://')) {
      return fileId;
    }
    return `${this.getBaseUrl()}/assets/${fileId}`;
  }
}

export const directusClient = new DirectusClient();
