import { CloudStorageBase } from './cloudBase';
import { QueryParams } from '../types';
import {
  Organization,
  OrganizationUser,
  Subscription,
  SystemModule,
  OrganizationModule,
} from '../../types';

export class CloudOrgStorage {
  constructor(private base: CloudStorageBase) {}

  // Organizations
  async getOrganizations(): Promise<Organization[]> {
    try {
      const orgs = await this.base.client.getOrganizations();
      const validOrgs: Organization[] = (Array.isArray(orgs) ? orgs : [])
        .filter((o: any) => o && typeof o === 'object' && o.id && o.name);

      if (validOrgs.length > 0) {
        // Cache to local adapter for offline resilience
        for (const org of validOrgs) {
          await this.base.localAdapter.saveOrganization(org);
        }
        return validOrgs;
      }
      return await this.base.localAdapter.getOrganizations();
    } catch (err: any) {
      console.warn('[CloudOrgStorage] getOrganizations fallback:', err?.message || err);
      return await this.base.localAdapter.getOrganizations();
    }
  }

  async getOrganizationById(id: number): Promise<Organization | null> {
    try {
      const org = await this.base.client.getItemById<Organization>('organizations', id);
      if (org && org.id && org.name) {
        await this.base.localAdapter.saveOrganization(org);
        return org;
      }
      return await this.base.localAdapter.getOrganizationById(id);
    } catch {
      return await this.base.localAdapter.getOrganizationById(id);
    }
  }

  async saveOrganization(org: Partial<Organization>): Promise<Organization> {
    try {
      if (org.id) {
        return await this.base.client.updateItem<Organization>('organizations', org.id, org);
      }
      return await this.base.client.createOrganization({
        name: org.name || 'سازمان جدید',
        slug: org.slug,
        currency: org.currency,
        timezone: org.timezone,
        plan: org.plan,
      });
    } catch (err: any) {
      console.warn('[CloudOrgStorage] Cloud saveOrganization failed, falling back to local adapter:', err?.message || err);
      const saved = await this.base.localAdapter.saveOrganization(org);
      this.base.syncManager.enqueue({ action: org.id ? 'UPDATE' : 'CREATE', collection: 'organizations', payload: saved });
      return saved;
    }
  }

  // Organization Users & Roles
  async getOrganizationUsers(params?: QueryParams): Promise<OrganizationUser[]> {
    const orgId = params?.organization_id || (typeof window !== 'undefined' ? localStorage.getItem('tankhor_active_org_id') : null);
    if (!orgId) return [];

    const numOrgId = Number(orgId);
    if (isNaN(numOrgId) || numOrgId <= 0) return [];

    const query: any = {
      sort: '-id',
      filter: { organization_id: { _eq: numOrgId } },
      fields: [
        'id',
        'organization_id',
        'role',
        'status',
        'warehouse_id',
        'financial_account_id',
        'can_change_warehouse',
        'date_joined',
        'user_id.*',
        'user_id.id',
        'user_id.email',
        'user_id.first_name',
        'user_id.last_name',
        'user_id.avatar',
      ],
    };
    try {
      const items = await this.base.client.getItems<any>('organization_users', query);
      if (Array.isArray(items) && items.length > 0) {
        return items.map((ou: any) => {
          const u = typeof ou.user_id === 'object' && ou.user_id ? ou.user_id : {};
          const rawWh = typeof ou.warehouse_id === 'object' && ou.warehouse_id ? ou.warehouse_id.id : ou.warehouse_id;
          const rawAcc = typeof ou.financial_account_id === 'object' && ou.financial_account_id ? ou.financial_account_id.id : ou.financial_account_id;
          return {
            ...ou,
            organization_id: numOrgId,
            user_id: u.id || ou.user_id,
            first_name: ou.first_name || u.first_name || '',
            last_name: ou.last_name || u.last_name || '',
            email: ou.email || u.email || '',
            avatar: ou.avatar || u.avatar || null,
            warehouse_id: rawWh ? Number(rawWh) : null,
            financial_account_id: rawAcc ? Number(rawAcc) : null,
            can_change_warehouse: ou.can_change_warehouse !== undefined && ou.can_change_warehouse !== null ? Boolean(ou.can_change_warehouse) : true,
          };
        });
      }
      return [];
    } catch (err: any) {
      console.warn('[CloudOrgStorage] getOrganizationUsers failed, using local adapter:', err?.message || err);
      return this.base.localAdapter.getOrganizationUsers({ organization_id: numOrgId });
    }
  }

  async saveOrganizationUser(user: Partial<OrganizationUser>): Promise<OrganizationUser> {
    try {
      if (user.id) {
        const updated = await this.base.client.updateItem<OrganizationUser>('organization_users', user.id, user);
        const result = { ...user, ...updated };
        await this.base.localAdapter.saveOrganizationUser(result);
        return result;
      } else {
        const created = await this.base.client.createItem<OrganizationUser>('organization_users', user);
        const result = { ...user, ...created };
        await this.base.localAdapter.saveOrganizationUser(result);
        return result;
      }
    } catch (err: any) {
      console.warn('[CloudOrgStorage] saveOrganizationUser failed, falling back to local:', err?.message || err);
      const saved = await this.base.localAdapter.saveOrganizationUser(user);
      this.base.syncManager.enqueue({ action: user.id ? 'UPDATE' : 'CREATE', collection: 'organization_users', payload: saved });
      return saved;
    }
  }

  async deleteOrganizationUser(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('organization_users', id);
      await this.base.localAdapter.deleteOrganizationUser(id);
      return true;
    } catch (err: any) {
      console.warn('[CloudOrgStorage] deleteOrganizationUser failed, using local:', err?.message || err);
      const res = await this.base.localAdapter.deleteOrganizationUser(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'organization_users', payload: { id } });
      return res;
    }
  }

  // Subscriptions
  async getSubscriptions(params?: QueryParams): Promise<Subscription[]> {
    try {
      const filter: any = {};
      if (params?.organization_id) {
        filter.organization_id = { _eq: params.organization_id };
      }
      return await this.base.client.getItems<Subscription>('subscriptions', {
        filter,
        sort: '-date_created',
      });
    } catch {
      return this.base.localAdapter.getSubscriptions(params);
    }
  }

  async getActiveSubscription(organizationId: number): Promise<Subscription | null> {
    try {
      const resp = await this.base.client.getSubscriptions(organizationId);
      return resp.activeSubscription || null;
    } catch {
      return this.base.localAdapter.getActiveSubscription(organizationId);
    }
  }

  async saveSubscription(sub: Partial<Subscription>): Promise<Subscription> {
    try {
      if (sub.id) {
        return await this.base.client.updateItem<Subscription>('subscriptions', sub.id, sub);
      }
      return await this.base.client.createItem<Subscription>('subscriptions', sub);
    } catch {
      const saved = await this.base.localAdapter.saveSubscription(sub);
      this.base.syncManager.enqueue({ action: sub.id ? 'UPDATE' : 'CREATE', collection: 'subscriptions', payload: saved });
      return saved;
    }
  }

  // System & Organization Modules
  async getSystemModules(params?: QueryParams): Promise<SystemModule[]> {
    try {
      const items = await this.base.client.getSystemModules(params);
      if (items && items.length > 0) {
        this.base.localAdapter.setItem('system_modules', items);
        let filtered = items;
        if (params?.status) {
          filtered = filtered.filter((m) => m.status === params.status);
        }
        return filtered;
      }
      return await this.base.localAdapter.getSystemModules(params);
    } catch {
      return await this.base.localAdapter.getSystemModules(params);
    }
  }

  async getOrganizationModules(params?: QueryParams): Promise<OrganizationModule[]> {
    try {
      const filter: any = {};
      if (params?.organization_id) {
        filter.organization_id = { _eq: params.organization_id };
      }
      if (params?.status) {
        filter.status = { _eq: params.status };
      }
      const items = await this.base.client.getItems<OrganizationModule>('organization_modules', {
        filter,
        sort: '-id',
      });
      return items;
    } catch {
      return await this.base.localAdapter.getOrganizationModules(params);
    }
  }

  async saveOrganizationModule(mod: Partial<OrganizationModule>): Promise<OrganizationModule> {
    try {
      if (mod.id) {
        return await this.base.client.updateItem<OrganizationModule>('organization_modules', mod.id, mod);
      }
      if (mod.slug) {
        const existing = await this.base.client.getItems<OrganizationModule>('organization_modules', {
          filter: { slug: { _eq: mod.slug } },
          limit: 1,
        }).catch(() => []);
        if (existing && existing.length > 0) {
          return await this.base.client.updateItem<OrganizationModule>('organization_modules', existing[0].id, mod);
        }
      }
      return await this.base.client.createItem<OrganizationModule>('organization_modules', mod);
    } catch {
      const saved = await this.base.localAdapter.saveOrganizationModule(mod);
      this.base.syncManager.enqueue({ action: mod.id ? 'UPDATE' : 'CREATE', collection: 'organization_modules', payload: saved });
      return saved;
    }
  }

  async deleteOrganizationModule(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('organization_modules', id);
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deleteOrganizationModule(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'organization_modules', payload: { id } });
      return deleted;
    }
  }
}
