import { QueryParams } from '../types';

export class LocalStorageBase {
  private lastGeneratedId = 0;

  getItem<T>(key: string, defaultValue: T[]): T[] {
    if (typeof localStorage === 'undefined') return defaultValue;
    const raw = localStorage.getItem(`tankhor_db_${key}`);
    if (!raw) {
      this.setItem(key, defaultValue);
      return defaultValue;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  setItem<T>(key: string, data: T[]) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(`tankhor_db_${key}`, JSON.stringify(data));
  }

  generateUniqueId(items: { id: number | string }[]): number {
    const maxExisting = items.reduce(
      (max, item) => (typeof item.id === 'number' && Number.isFinite(item.id) && item.id > max ? item.id : max),
      0
    );
    const now = Date.now();
    const candidate = Math.max(maxExisting + 1, now, this.lastGeneratedId + 1);
    this.lastGeneratedId = candidate;
    return candidate;
  }

  getActiveOrgId(params?: QueryParams): number | undefined {
    if (params && params.organization_id !== undefined && params.organization_id !== null) {
      const num = Number(params.organization_id);
      if (!isNaN(num) && num > 0) return num;
    }
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tankhor_active_org_id');
      if (saved) {
        const num = Number(saved);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return undefined;
  }

  filterByOrg<T extends { organization_id?: any }>(items: T[], params?: QueryParams): T[] {
    const hasExplicitOrgParam = params && 'organization_id' in params;
    const orgId = this.getActiveOrgId(params);

    if (hasExplicitOrgParam && !orgId) {
      return [];
    }

    if (orgId) {
      return items.filter((item) => {
        const itemOrgId = typeof item.organization_id === 'number'
          ? item.organization_id
          : Number((item.organization_id as any)?.id || item.organization_id);
        return itemOrgId === orgId;
      });
    }

    return items;
  }
}
