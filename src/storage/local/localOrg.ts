import { QueryParams } from '../types';
import { LocalStorageBase } from './localBase';
import { normalizeId } from '../../utils/formatters';
import {
  Organization,
  OrganizationUser,
  Subscription,
  SystemModule,
  OrganizationModule,
  Feedback
} from '../../types';
import { DEFAULT_SYSTEM_MODULES } from '../../utils/license';
import { directusClient } from '../../api/directus';

export class LocalOrgStorage {
  constructor(private base: LocalStorageBase) {}

  // Organizations
  async getOrganizations(): Promise<Organization[]> {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const cachedUserRaw = localStorage.getItem('tankhor_cached_user_profile');
      if (cachedUserRaw) {
        try {
          const cachedUser = JSON.parse(cachedUserRaw);
          if (Array.isArray(cachedUser.organizations) && cachedUser.organizations.length > 0) {
            return cachedUser.organizations;
          }
          if (cachedUser.activeOrganization || cachedUser.active_organization) {
            return [cachedUser.activeOrganization || cachedUser.active_organization];
          }
        } catch {}
      }
    }
    return this.base.getItem<Organization>('organizations', []);
  }

  async getOrganizationById(id: number): Promise<Organization | null> {
    const list = await this.getOrganizations();
    return list.find((o) => o.id === id) || null;
  }

  async saveOrganization(org: Partial<Organization>): Promise<Organization> {
    let list = await this.getOrganizations();
    if (org.id) {
      const idx = list.findIndex((o) => Number(o.id) === Number(org.id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...org, date_updated: new Date().toISOString() };
        this.base.setItem('organizations', list);
        return list[idx];
      }
    }

    // If saving a real organization and only default placeholder exists, purge placeholder
    if (org.name && org.name !== 'سازمان اصلی' && list.length === 1 && list[0].slug === 'main-org') {
      list = [];
    }

    const newOrg: Organization = {
      id: org.id || this.base.generateUniqueId(list),
      name: org.name || 'سازمان جدید',
      slug: org.slug || 'new-org',
      currency: org.currency || 'TOMAN',
      timezone: org.timezone || 'Asia/Tehran',
      plan: org.plan || 'free',
      status: org.status || 'active',
      date_created: new Date().toISOString(),
      ...org,
    };
    list.push(newOrg);
    this.base.setItem('organizations', list);
    return newOrg;
  }

  // Organization Users & Roles
  async getOrganizationUsers(params?: QueryParams): Promise<OrganizationUser[]> {
    const allUsers = this.base.getItem<OrganizationUser>('organization_users', []);
    const orgId = this.base.getActiveOrgId(params);

    if (!orgId) return [];

    return allUsers.filter((ou) => {
      const oId = typeof ou.organization_id === 'number' ? ou.organization_id : (ou.organization_id as any)?.id;
      return Number(oId) === Number(orgId);
    });
  }

  async saveOrganizationUser(ouData: Partial<OrganizationUser>): Promise<OrganizationUser> {
    const list = this.base.getItem<OrganizationUser>('organization_users', []);
    const activeOrgId = Number(ouData.organization_id || this.base.getActiveOrgId());
    let saved: OrganizationUser;

    if (ouData.id) {
      const idx = list.findIndex((ou) => ou.id === ouData.id);
      if (idx !== -1) {
        const rawWh = ouData.warehouse_id !== undefined ? (ouData.warehouse_id ? Number(ouData.warehouse_id) : null) : list[idx].warehouse_id;
        const rawAcc = ouData.financial_account_id !== undefined ? (ouData.financial_account_id ? Number(ouData.financial_account_id) : null) : list[idx].financial_account_id;
        const rawCanChangeWh = ouData.can_change_warehouse !== undefined ? Boolean(ouData.can_change_warehouse) : (list[idx].can_change_warehouse ?? true);
        saved = {
          ...list[idx],
          ...ouData,
          organization_id: activeOrgId,
          warehouse_id: rawWh,
          financial_account_id: rawAcc,
          can_change_warehouse: rawCanChangeWh,
        };
        list[idx] = saved;
      } else {
        saved = {
          id: ouData.id,
          organization_id: activeOrgId,
          user_id: ouData.user_id || `user_${Date.now()}`,
          role: ouData.role || 'viewer',
          status: ouData.status || 'active',
          date_joined: ouData.date_joined || new Date().toISOString(),
          first_name: ouData.first_name || '',
          last_name: ouData.last_name || '',
          email: ouData.email || '',
          warehouse_id: ouData.warehouse_id ? Number(ouData.warehouse_id) : null,
          financial_account_id: ouData.financial_account_id ? Number(ouData.financial_account_id) : null,
          can_change_warehouse: ouData.can_change_warehouse !== undefined ? Boolean(ouData.can_change_warehouse) : true,
        };
        list.push(saved);
      }
    } else {
      const nextId = list.reduce((max, ou) => Math.max(max, ou.id || 0), 0) + 1;
      saved = {
        id: nextId,
        organization_id: activeOrgId,
        user_id: ouData.user_id || `user_${Date.now()}`,
        role: ouData.role || 'viewer',
        status: ouData.status || 'active',
        date_joined: new Date().toISOString(),
        first_name: ouData.first_name || '',
        last_name: ouData.last_name || '',
        email: ouData.email || '',
        warehouse_id: ouData.warehouse_id ? Number(ouData.warehouse_id) : null,
        financial_account_id: ouData.financial_account_id ? Number(ouData.financial_account_id) : null,
        can_change_warehouse: ouData.can_change_warehouse !== undefined ? Boolean(ouData.can_change_warehouse) : true,
      };
      list.push(saved);
    }

    this.base.setItem('organization_users', list);
    return saved;
  }

  async deleteOrganizationUser(id: number): Promise<boolean> {
    const list = this.base.getItem<OrganizationUser>('organization_users', []);
    const filtered = list.filter((ou) => ou.id !== id);
    if (filtered.length !== list.length) {
      this.base.setItem('organization_users', filtered);
      return true;
    }
    return false;
  }

  // Subscriptions
  async getSubscriptions(params?: QueryParams): Promise<Subscription[]> {
    const list = this.base.getItem<Subscription>('subscriptions', []);
    const orgId = this.base.getActiveOrgId(params);
    let filtered = list;
    if (orgId) {
      filtered = filtered.filter((s) => normalizeId(s.organization_id) === orgId);
    }
    return filtered.sort((a, b) => new Date(b.date_created || b.start_date || 0).getTime() - new Date(a.date_created || a.start_date || 0).getTime());
  }

  async getActiveSubscription(organizationId: number): Promise<Subscription | null> {
    const list = await this.getSubscriptions({ organization_id: organizationId });
    const now = new Date();
    for (const sub of list) {
      if (sub.end_date && new Date(sub.end_date) > now) {
        return sub;
      }
    }
    return null;
  }

  async saveSubscription(sub: Partial<Subscription>): Promise<Subscription> {
    const list = this.base.getItem<Subscription>('subscriptions', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(sub.organization_id) });
    if (sub.id) {
      const idx = list.findIndex((s) => s.id === sub.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...sub, date_updated: new Date().toISOString() };
        this.base.setItem('subscriptions', list);
        return list[idx];
      }
    }
    const newSub: Subscription = {
      id: this.base.generateUniqueId(list),
      organization_id: orgId || 1,
      start_date: sub.start_date || new Date().toISOString(),
      end_date: sub.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      transaction_amount: sub.transaction_amount || '',
      Transaction_id: sub.Transaction_id || String(Date.now()),
      date_created: new Date().toISOString(),
      ...sub,
    };
    list.unshift(newSub);
    this.base.setItem('subscriptions', list);
    return newSub;
  }

  // System & Organization Modules
  async getSystemModules(params?: QueryParams): Promise<SystemModule[]> {
    try {
      if (typeof window !== 'undefined' && window.navigator?.onLine !== false) {
        const liveItems = await directusClient.getSystemModules(params).catch(() => []);
        if (liveItems && liveItems.length > 0) {
          this.base.setItem('system_modules', liveItems);
          let filtered = liveItems;
          if (params?.status) {
            filtered = filtered.filter((m) => m.status === params.status);
          }
          return filtered;
        }
      }
    } catch {
      // offline fallback to localStorage cache
    }

    let list = this.base.getItem<SystemModule>('system_modules', []);
    if (!list || list.length === 0) {
      list = [...DEFAULT_SYSTEM_MODULES];
      this.base.setItem('system_modules', list);
    }
    if (params?.status) {
      list = list.filter((m) => m.status === params.status);
    }
    return list;
  }

  async getOrganizationModules(params?: QueryParams): Promise<OrganizationModule[]> {
    const list = this.base.getItem<OrganizationModule>('organization_modules', []);
    const orgId = this.base.getActiveOrgId(params);
    let filtered = list;
    if (orgId) {
      filtered = filtered.filter((m) => normalizeId(m.organization_id) === orgId);
    }
    if (params?.status) {
      filtered = filtered.filter((m) => m.status === params.status);
    }
    return filtered;
  }

  async saveOrganizationModule(mod: Partial<OrganizationModule>): Promise<OrganizationModule> {
    const list = this.base.getItem<OrganizationModule>('organization_modules', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(mod.organization_id) });

    if (mod.id) {
      const idx = list.findIndex((m) => m.id === mod.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...mod };
        this.base.setItem('organization_modules', list);
        return list[idx];
      }
    }

    // Check if duplicate active license exists for this org and slug
    const existingIdx = list.findIndex(
      (m) => normalizeId(m.organization_id) === (orgId || 1) && m.slug === mod.slug
    );

    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...mod,
        status: mod.status || 'active',
      };
      this.base.setItem('organization_modules', list);
      return list[existingIdx];
    }

    const newMod: OrganizationModule = {
      id: this.base.generateUniqueId(list),
      slug: mod.slug || 'barcode',
      organization_id: orgId || 1,
      module_id: mod.module_id || 1,
      license_type: mod.license_type || 'lifetime',
      status: mod.status || 'active',
      license_token: mod.license_token || null,
      hardware_id: mod.hardware_id || null,
      starts_at: mod.starts_at || new Date().toISOString(),
      expires_at: mod.expires_at || null,
      ...mod,
    };

    list.unshift(newMod);
    this.base.setItem('organization_modules', list);
    return newMod;
  }

  async deleteOrganizationModule(id: number): Promise<boolean> {
    const list = this.base.getItem<OrganizationModule>('organization_modules', []);
    const updated = list.filter((m) => m.id !== id);
    this.base.setItem('organization_modules', updated);
    return true;
  }

  // Feedbacks
  async getFeedbacks(params?: QueryParams): Promise<Feedback[]> {
    return this.base.getItem<Feedback>('feedbacks', []);
  }

  async submitFeedback(feedback: Partial<Feedback>): Promise<Feedback> {
    const list = this.base.getItem<Feedback>('feedbacks', []);
    const newFeedback: Feedback = {
      id: this.base.generateUniqueId(list as Array<{ id: string | number }>),
      subject: feedback.subject || 'بازخورد',
      message: feedback.message || '',
      status: feedback.status || 'unread',
      user_id: feedback.user_id || null,
      date_created: new Date().toISOString(),
      ...feedback,
    };
    list.unshift(newFeedback);
    this.base.setItem('feedbacks', list);

    // Immediately submit to Directus API gateway
    try {
      await directusClient.submitFeedback({
        subject: newFeedback.subject,
        message: newFeedback.message,
        user_id: newFeedback.user_id,
      });
    } catch (e: any) {
      console.warn('[LocalOrg] Directus direct submission notice:', e?.message);
    }

    return newFeedback;
  }
}
