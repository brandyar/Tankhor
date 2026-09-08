import dotenv from 'dotenv';
dotenv.config();

function sanitizeDirectusUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return 'https://api.tankhor.com';
  }
  let trimmed = rawUrl.trim().replace(/^["']|["']$/g, '').trim();
  if (!trimmed) {
    return 'https://api.tankhor.com';
  }
  // If it is just a token (e.g. 32-char alphanumeric with no dots/slashes), it's not a URL
  if (!trimmed.includes('.') && !trimmed.includes('/') && !trimmed.includes(':') && !trimmed.startsWith('localhost')) {
    return 'https://api.tankhor.com';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }
  if (trimmed.startsWith('localhost') || trimmed.startsWith('127.0.0.1')) {
    return `http://${trimmed}`.replace(/\/+$/, '');
  }
  return `https://${trimmed}`.replace(/\/+$/, '');
}

export class DirectusAdminClient {
  public static getBaseUrl(): string {
    const candidate =
      process.env.DIRECTUS_URL ||
      process.env.VITE_DIRECTUS_URL ||
      process.env.DIRECTUS_API_URL ||
      process.env.API_URL;
    return sanitizeDirectusUrl(candidate);
  }

  public static getAdminToken(): string {
    const rawCandidates = [
      process.env.DIRECTUS_ADMIN_TOKEN,
      process.env.DIRECTUS_TOKEN,
      process.env.ADMIN_TOKEN,
      process.env.VITE_DIRECTUS_ADMIN_TOKEN,
      process.env.VITE_DIRECTUS_TOKEN,
    ];

    for (const raw of rawCandidates) {
      if (raw && typeof raw === 'string') {
        const cleaned = raw.trim().replace(/^["']|["']$/g, '').trim();
        if (cleaned) {
          return cleaned;
        }
      }
    }

    // Check if DIRECTUS_URL was mistakenly set to a raw token (alphanumeric string >= 20 chars without dots or slashes)
    const directusUrlEnv = (process.env.DIRECTUS_URL || '').trim().replace(/^["']|["']$/g, '').trim();
    if (
      directusUrlEnv &&
      !directusUrlEnv.startsWith('http://') &&
      !directusUrlEnv.startsWith('https://') &&
      !directusUrlEnv.includes('.') &&
      !directusUrlEnv.includes('/') &&
      !directusUrlEnv.includes(':') &&
      directusUrlEnv.length >= 20
    ) {
      return directusUrlEnv;
    }

    return '';
  }

  public static getUserRoleId(): string {
    const rawCandidates = [
      process.env.DIRECTUS_USER_ROLE_ID,
      process.env.DIRECTUS_TENANT_ROLE_ID,
      process.env.VITE_DIRECTUS_USER_ROLE_ID,
      process.env.VITE_DIRECTUS_TENANT_ROLE_ID,
    ];

    for (const raw of rawCandidates) {
      if (raw && typeof raw === 'string') {
        const cleaned = raw.trim().replace(/^["']|["']$/g, '').trim();
        if (cleaned) {
          return cleaned;
        }
      }
    }

    return '5cd02fe5-1738-4029-b95b-babf6d7fb7be';
  }

  public static getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getAdminToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.getBaseUrl()}${cleanEndpoint}`;

    // For public auth endpoints like /auth/login, do not attach admin token
    const isPublicAuth = cleanEndpoint.startsWith('/auth/login') || cleanEndpoint.startsWith('/auth/refresh');
    const baseHeaders = isPublicAuth ? { 'Content-Type': 'application/json' } : this.getHeaders();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...baseHeaders,
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
        const errorMsg = data.errors?.[0]?.message || data.message || `Directus request failed with status ${response.status}`;
        console.error(`[DirectusAdminClient] Directus error on ${endpoint} (${response.status}):`, JSON.stringify(data));
        throw new Error(errorMsg);
      }

      return data.data !== undefined ? data.data : data;
    } catch (error: any) {
      console.error(`[DirectusAdminClient] Error on ${endpoint}:`, error.message);
      throw error;
    }
  }

  public static getCollectionEndpoint(collection: string, suffix = ''): string {
    const s = suffix ? (suffix.startsWith('/') ? suffix : `/${suffix}`) : '';
    switch (collection) {
      case 'directus_users':
      case 'users':
        return `/users${s}`;
      case 'directus_roles':
      case 'roles':
        return `/roles${s}`;
      case 'directus_files':
      case 'files':
        return `/files${s}`;
      case 'directus_activity':
      case 'activity':
        return `/activity${s}`;
      case 'directus_settings':
      case 'settings':
        return `/settings${s}`;
      default:
        return `/items/${collection}${s}`;
    }
  }

  // Raw Directus Items CRUD using Admin Token
  public static async getItems<T = any>(collection: string, query?: Record<string, any>): Promise<T[]> {
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
    const endpoint = `${this.getCollectionEndpoint(collection)}${queryString}`;
    return this.request<T[]>(endpoint);
  }

  public static async getItemById<T = any>(collection: string, id: string | number, fields?: string): Promise<T | null> {
    try {
      const queryString = fields ? `?fields=${fields}` : '';
      const endpoint = `${this.getCollectionEndpoint(collection, String(id))}${queryString}`;
      return await this.request<T>(endpoint);
    } catch (err: any) {
      if (err.message?.includes('404') || err.message?.toLowerCase().includes('not found')) {
        return null;
      }
      throw err;
    }
  }

  public static async createItem<T = any>(collection: string, item: any): Promise<T> {
    return this.request<T>(this.getCollectionEndpoint(collection), {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  public static async updateItem<T = any>(collection: string, id: string | number, item: any): Promise<T> {
    return this.request<T>(this.getCollectionEndpoint(collection, String(id)), {
      method: 'PATCH',
      body: JSON.stringify(item),
    });
  }

  public static async deleteItem(collection: string, id: string | number): Promise<boolean> {
    await this.request(this.getCollectionEndpoint(collection, String(id)), {
      method: 'DELETE',
    });
    return true;
  }
}
