import { QueryParams } from '../types';
import { SqliteStorageBase } from './sqliteBase';
import { normalizeId } from '../../utils/formatters';
import {
  Organization,
  OrganizationUser,
  Subscription,
  SystemModule,
  OrganizationModule,
  Feedback,
} from '../../types';
import { DEFAULT_SYSTEM_MODULES } from '../../utils/license';
import { directusClient } from '../../api/directus';

export class SqliteOrgStorage {
  constructor(private base: SqliteStorageBase) {}

  // ==========================================
  // Organizations
  // ==========================================
  async getOrganizations(): Promise<Organization[]> {
    if (typeof window !== 'undefined') {
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
    return this.base.getItems<Organization>('organizations');
  }

  async getOrganizationById(id: number): Promise<Organization | null> {
    const list = await this.getOrganizations();
    return list.find((o) => o.id === id) || null;
  }

  async saveOrganization(org: Partial<Organization>): Promise<Organization> {
    const list = await this.getOrganizations();
    if (org.id) {
      const found = list.find((o) => Number(o.id) === Number(org.id));
      if (found) {
        const updated: Organization = { ...found, ...org, date_updated: new Date().toISOString() };
        await this.base.saveItem('organizations', updated);
        return updated;
      }
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
    await this.base.saveItem('organizations', newOrg);
    return newOrg;
  }

  // ==========================================
  // Organization Users
  // ==========================================
  async getOrganizationUsers(params?: QueryParams): Promise<OrganizationUser[]> {
    const orgId = this.base.getActiveOrgId(params);
    if (!orgId) {
      return [];
    }
    const list = await this.base.getItems<OrganizationUser>('organization_users', orgId);
    return list;
  }

  async saveOrganizationUser(ouData: Partial<OrganizationUser>): Promise<OrganizationUser> {
    const list = await this.base.getItems<OrganizationUser>('organization_users');
    const activeOrgId = Number(ouData.organization_id || this.base.getActiveOrgId());
    let saved: OrganizationUser;

    if (ouData.id) {
      const existing = list.find((ou) => ou.id === ouData.id);
      if (existing) {
        const rawWh = ouData.warehouse_id !== undefined ? (ouData.warehouse_id ? Number(ouData.warehouse_id) : null) : existing.warehouse_id;
        const rawAcc = ouData.financial_account_id !== undefined ? (ouData.financial_account_id ? Number(ouData.financial_account_id) : null) : existing.financial_account_id;
        const rawCanChangeWh = ouData.can_change_warehouse !== undefined ? Boolean(ouData.can_change_warehouse) : (existing.can_change_warehouse ?? true);
        saved = {
          ...existing,
          ...ouData,
          organization_id: activeOrgId,
          warehouse_id: rawWh,
          financial_account_id: rawAcc,
          can_change_warehouse: rawCanChangeWh,
        };
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
    }

    await this.base.saveItem('organization_users', saved);
    return saved;
  }

  async deleteOrganizationUser(id: number): Promise<boolean> {
    return this.base.deleteItem('organization_users', id);
  }

  // ==========================================
  // Subscriptions
  // ==========================================
  async getSubscriptions(params?: QueryParams): Promise<Subscription[]> {
    const orgId = this.base.getActiveOrgId(params);
    const list = await this.base.getItems<Subscription>('subscriptions', orgId);
    return list.sort((a, b) => new Date(b.date_created || b.start_date || 0).getTime() - new Date(a.date_created || a.start_date || 0).getTime());
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
    const list = await this.base.getItems<Subscription>('subscriptions');
    const validId = typeof sub.id === 'number' && sub.id > 0 ? sub.id : this.base.generateUniqueId(list);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(sub.organization_id) });
    const saved: Subscription = {
      organization_id: orgId || 1,
      start_date: sub.start_date || new Date().toISOString(),
      end_date: sub.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      transaction_amount: sub.transaction_amount || '',
      Transaction_id: sub.Transaction_id || String(Date.now()),
      date_created: sub.date_created || new Date().toISOString(),
      ...sub,
      id: validId,
    };
    await this.base.saveItem('subscriptions', saved);
    return saved;
  }

  // ==========================================
  // System & Organization Modules
  // ==========================================
  async getSystemModules(params?: QueryParams): Promise<SystemModule[]> {
    try {
      if (typeof window !== 'undefined' && window.navigator?.onLine !== false) {
        const liveItems = await directusClient.getSystemModules(params).catch(() => []);
        if (liveItems && liveItems.length > 0) {
          for (const m of liveItems) {
            await this.base.saveItem('system_modules', m);
          }
          let filtered = liveItems;
          if (params?.status) {
            filtered = filtered.filter((m) => m.status === params.status);
          }
          return filtered;
        }
      }
    } catch {
      // offline fallback
    }

    let list = await this.base.getItems<SystemModule>('system_modules');
    if (!list || list.length === 0) {
      list = [...DEFAULT_SYSTEM_MODULES];
      for (const m of list) {
        await this.base.saveItem('system_modules', m);
      }
    }
    if (params?.status) {
      list = list.filter((m) => m.status === params.status);
    }
    return list;
  }

  async getOrganizationModules(params?: QueryParams): Promise<OrganizationModule[]> {
    const orgId = this.base.getActiveOrgId(params);
    let list = await this.base.getItems<OrganizationModule>('organization_modules', orgId);
    if (params?.status) {
      list = list.filter((m) => m.status === params.status);
    }
    return list;
  }

  async saveOrganizationModule(mod: Partial<OrganizationModule>): Promise<OrganizationModule> {
    const list = await this.base.getItems<OrganizationModule>('organization_modules');
    const validId = typeof mod.id === 'number' && mod.id > 0 ? mod.id : this.base.generateUniqueId(list);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(mod.organization_id) });

    const existing = list.find(
      (m) => normalizeId(m.organization_id) === (orgId || 1) && m.slug === mod.slug
    );

    const saved: OrganizationModule = {
      organization_id: orgId || 1,
      slug: mod.slug || 'barcode',
      module_id: mod.module_id || 1,
      license_type: mod.license_type || 'lifetime',
      status: mod.status || 'active',
      license_token: mod.license_token || null,
      hardware_id: mod.hardware_id || null,
      starts_at: mod.starts_at || new Date().toISOString(),
      expires_at: mod.expires_at || null,
      ...existing,
      ...mod,
      id: existing ? existing.id : validId,
    };

    await this.base.saveItem('organization_modules', saved);
    return saved;
  }

  async deleteOrganizationModule(id: number): Promise<boolean> {
    return this.base.deleteItem('organization_modules', id);
  }

  // Feedbacks
  async getFeedbacks(params?: QueryParams): Promise<Feedback[]> {
    return this.base.getItems<Feedback>('feedbacks');
  }

  async submitFeedback(feedback: Partial<Feedback>): Promise<Feedback> {
    const list = await this.base.getItems<Feedback>('feedbacks');
    const newFeedback: Feedback = {
      id: this.base.generateUniqueId(list),
      subject: feedback.subject || 'بازخورد',
      message: feedback.message || '',
      status: feedback.status || 'unread',
      user_id: feedback.user_id || null,
      date_created: new Date().toISOString(),
      ...feedback,
    };
    await this.base.saveItem('feedbacks', newFeedback);

    // Immediately submit to Directus API gateway
    try {
      await directusClient.submitFeedback({
        subject: newFeedback.subject,
        message: newFeedback.message,
        user_id: newFeedback.user_id,
      });
    } catch (e: any) {
      console.warn('[SqliteOrg] Directus direct submission notice:', e?.message);
    }

    return newFeedback;
  }
}
