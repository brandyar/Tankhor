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
    this.baseUrl = baseUrl || '/api';
    this.token = typeof window !== 'undefined' ? localStorage.getItem('tankhor_directus_token') : null;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('tankhor_directus_token', token);
      } else {
        localStorage.removeItem('tankhor_directus_token');
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

  public getBaseUrl(): string {
    return this.baseUrl || '/api';
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.getBaseUrl()}${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
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
        const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
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
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.token) {
      this.setToken(data.token);
    }
    if (data.activeOrganization?.id && typeof window !== 'undefined') {
      localStorage.setItem('tankhor_active_org_id', String(data.activeOrganization.id));
    }

    return {
      access_token: data.token,
      user: data.user,
      activeOrganization: data.activeOrganization,
      organizations: data.organizations || [],
    };
  }

  public async logout(): Promise<void> {
    this.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tankhor_cached_user_profile');
      localStorage.removeItem('tankhor_active_org_id');
    }
  }

  public async getMe(): Promise<any> {
    return this.request('/auth/me');
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
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (res.token) {
      this.setToken(res.token);
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
      this.setToken(res.token);
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
      this.setToken(res.token);
    }
    const orgId = res.activeOrganization?.id || res.organization?.id;
    if (orgId && typeof window !== 'undefined') {
      localStorage.setItem('tankhor_active_org_id', String(orgId));
    }
    return res.organization || res.activeOrganization;
  }

  public async getOrganizations(): Promise<any[]> {
    try {
      const res = await this.request('/organizations');
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.data)) return res.data;
      if (res && Array.isArray(res.organizations)) return res.organizations;
      return [];
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
}

export const directusClient = new DirectusClient();
