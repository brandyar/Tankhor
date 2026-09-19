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

  // Internal concurrency limiter to prevent overwhelming Directus Fastify under-pressure detector
  private static activeRequests = 0;
  private static requestQueue: Array<() => void> = [];
  private static readonly MAX_CONCURRENCY = 3;

  private static async acquireSlot(): Promise<void> {
    if (this.activeRequests < this.MAX_CONCURRENCY) {
      this.activeRequests++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.requestQueue.push(resolve);
    });
    this.activeRequests++;
  }

  private static releaseSlot(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    const next = this.requestQueue.shift();
    if (next) {
      next();
    }
  }

  // Semi-static cache for endpoints like /items/system_modules and /items/project_settings
  private static requestCache = new Map<string, { data: any; expiresAt: number }>();

  public static async request<T = any>(endpoint: string, options: RequestInit = {}, maxRetries = 3): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.getBaseUrl()}${cleanEndpoint}`;

    // Check cache for GET requests on semi-static collections
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const isCacheable = isGet && (cleanEndpoint.includes('/items/system_modules') || cleanEndpoint.includes('/items/project_settings'));
    if (isCacheable) {
      const cached = this.requestCache.get(cleanEndpoint);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data as T;
      }
    }

    // For public auth endpoints like /auth/login, do not attach admin token
    const isPublicAuth = cleanEndpoint.startsWith('/auth/login') || cleanEndpoint.startsWith('/auth/refresh');
    const baseHeaders = isPublicAuth ? { 'Content-Type': 'application/json' } : this.getHeaders();

    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      await this.acquireSlot();

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

        // Check for transient server pressure / rate limit errors
        const isPressureOrRateLimit =
          response.status === 503 ||
          response.status === 429 ||
          response.status === 502 ||
          response.status === 504 ||
          (data.errors && data.errors.some((e: any) =>
            e.message?.toLowerCase().includes('under pressure') ||
            e.extensions?.reason?.toLowerCase().includes('under pressure') ||
            e.extensions?.code === 'SERVICE_UNAVAILABLE'
          ));

        if (isPressureOrRateLimit && attempt <= maxRetries) {
          const delayMs = attempt * 350 + Math.floor(Math.random() * 200);
          console.warn(
            `[DirectusAdminClient] Directus 503/Pressure on ${cleanEndpoint}, retry attempt ${attempt}/${maxRetries} in ${delayMs}ms...`
          );
          await new Promise((res) => setTimeout(res, delayMs));
          continue; // Retry
        }

        if (!response.ok) {
          const errorMsg = data.errors?.[0]?.message || data.message || `Directus request failed with status ${response.status}`;
          // Only log error if not retrying
          if (attempt > maxRetries) {
            console.error(`[DirectusAdminClient] Directus error on ${endpoint} (${response.status}):`, JSON.stringify(data));
          }
          throw new Error(errorMsg);
        }

        const result = (data.data !== undefined ? data.data : data) as T;

        if (isCacheable) {
          this.requestCache.set(cleanEndpoint, {
            data: result,
            expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
          });
        }

        return result;
      } catch (error: any) {
        const isNetworkOrTimeout =
          error.message?.includes('fetch failed') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.toLowerCase().includes('under pressure');

        if (isNetworkOrTimeout && attempt <= maxRetries) {
          const delayMs = attempt * 400 + Math.floor(Math.random() * 200);
          console.warn(`[DirectusAdminClient] Network glitch on ${cleanEndpoint}: ${error.message}. Retrying in ${delayMs}ms...`);
          await new Promise((res) => setTimeout(res, delayMs));
          continue;
        }

        if (attempt > maxRetries) {
          console.error(`[DirectusAdminClient] Error on ${endpoint} after ${maxRetries} retries:`, error.message);
          throw error;
        }
      } finally {
        this.releaseSlot();
      }
    }

    throw new Error(`[DirectusAdminClient] Request to ${endpoint} failed after ${maxRetries} retries.`);
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
      // For items collections, using filter query avoids Directus 403/404 errors when ID doesn't exist
      if (!collection.startsWith('directus_') && collection !== 'users' && collection !== 'roles' && collection !== 'settings') {
        const items = await this.getItems<T>(collection, {
          filter: { id: { _eq: id } },
          limit: 1,
          fields: fields || '*',
        });
        return items && items.length > 0 ? items[0] : null;
      }

      const queryString = fields ? `?fields=${fields}` : '';
      const endpoint = `${this.getCollectionEndpoint(collection, String(id))}${queryString}`;
      return await this.request<T>(endpoint);
    } catch (err: any) {
      if (
        err.message?.includes('404') ||
        err.message?.includes('403') ||
        err.message?.toLowerCase().includes('not found') ||
        err.message?.toLowerCase().includes("don't have permission")
      ) {
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
