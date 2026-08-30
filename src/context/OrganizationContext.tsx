import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Organization, OrganizationUser, UserRole } from '../types';
import { storageManager } from '../storage';
import { useAuth } from './AuthContext';
import { directusClient } from '../api/directus';
import { getRolePermissions, RolePermissions } from '../utils/permissions';

interface OrganizationContextType {
  organizations: Organization[];
  activeOrganization: Organization | null;
  organizationUsers: OrganizationUser[];
  userRole: UserRole | string;
  isOwner: boolean;
  permissions: RolePermissions;
  selectOrganization: (id: number) => Promise<void>;
  createOrganization: (orgData: Partial<Organization>) => Promise<Organization>;
  updateActiveOrganization: (orgData: Partial<Organization>) => Promise<Organization>;
  saveOrganizationUser: (ou: Partial<OrganizationUser>) => Promise<OrganizationUser>;
  deleteOrganizationUser: (id: number) => Promise<boolean>;
  refreshMembers: () => Promise<void>;
  isLoading: boolean;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isCloudAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load organization users for active organization
  const refreshMembers = useCallback(async () => {
    if (!activeOrganization) {
      setOrganizationUsers([]);
      return;
    }
    try {
      const adapter = storageManager.getAdapter();
      const users = await adapter.getOrganizationUsers({ organization_id: activeOrganization.id });
      setOrganizationUsers(users);
    } catch (err) {
      console.error('[OrganizationContext] Failed to load organization members:', err);
    }
  }, [activeOrganization]);

  useEffect(() => {
    refreshMembers();
  }, [refreshMembers]);

  // Compute active user role in current organization
  const currentUserRecord = organizationUsers.find((ou) => {
    const ouUserId = typeof ou.user_id === 'object' ? (ou.user_id as any)?.id : ou.user_id;
    const ouEmail = typeof ou.user_id === 'object' ? (ou.user_id as any)?.email : ou.email;
    if (user?.id && ouUserId && String(ouUserId) === String(user.id)) return true;
    if (user?.email && ouEmail && String(ouEmail).toLowerCase() === String(user.email).toLowerCase()) return true;
    if (user?.email && ou.email && String(ou.email).toLowerCase() === String(user.email).toLowerCase()) return true;
    return false;
  });

  const rawRole =
    currentUserRecord?.role ||
    (activeOrganization as any)?.user_role ||
    (user as any)?.user_role ||
    (typeof user?.role === 'string'
      ? user.role
      : (typeof user?.role === 'object' ? (user.role as any)?.name : null));

  const userRole: UserRole | string = rawRole
    ? String(rawRole).toLowerCase()
    : (isCloudAuthenticated ? 'viewer' : 'owner');

  const permissions: RolePermissions = getRolePermissions(userRole);
  const isOwner = userRole === 'owner' || permissions.canManageOrgSettings;

  const refreshOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const adapter = storageManager.getAdapter();
      let list = await adapter.getOrganizations();

      // Filter out placeholder dummy "سازمان اصلی" if real organizations exist
      if (list.length > 1) {
        const nonPlaceholder = list.filter((o) => o.slug !== 'main-org' && o.name !== 'سازمان اصلی');
        if (nonPlaceholder.length > 0) {
          list = nonPlaceholder;
        }
      }

      setOrganizations(list);

      const savedOrgId = localStorage.getItem('tankhor_active_org_id');
      let found: Organization | null = null;
      if (savedOrgId) {
        found = list.find((o) => String(o.id) === String(savedOrgId)) || null;
      }
      if (!found && list.length > 0) {
        found = list[0];
      }

      setActiveOrganization(found);
      if (found && (!savedOrgId || savedOrgId !== String(found.id))) {
        localStorage.setItem('tankhor_active_org_id', String(found.id));
      }
    } catch (err) {
      console.error('[OrganizationContext] Failed to load organizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations, isCloudAuthenticated, user?.id]);

  // Listen for data restore or reset events to reload context immediately
  useEffect(() => {
    const handleDataRestored = () => {
      refreshOrganizations();
      refreshMembers();
    };

    window.addEventListener('tankhor_data_restored', handleDataRestored);
    return () => {
      window.removeEventListener('tankhor_data_restored', handleDataRestored);
    };
  }, [refreshOrganizations, refreshMembers]);

  const selectOrganization = async (id: number) => {
    const found = organizations.find((o) => o.id === id);
    if (!found) return;

    try {
      if (isCloudAuthenticated && directusClient.getToken()) {
        await directusClient.switchOrganization(id);
      }
      setActiveOrganization(found);
      localStorage.setItem('tankhor_active_org_id', String(id));
    } catch (err) {
      console.error('[OrganizationContext] Failed to switch organization:', err);
      // Still update local UI state if switch failed or offline
      setActiveOrganization(found);
      localStorage.setItem('tankhor_active_org_id', String(id));
    }
  };

  const createOrganization = async (orgData: Partial<Organization>): Promise<Organization> => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const created = await adapter.saveOrganization(orgData);

      // Create owner record for current user in organization_users
      if (activeOrganization) {
        await adapter.saveOrganizationUser({
          organization_id: created.id,
          user_id: user?.id || 'owner_user',
          first_name: user?.first_name || 'مدیر',
          last_name: user?.last_name || 'سازمان',
          email: user?.email || 'owner@tankhor.com',
          role: 'owner',
          status: 'active',
        });
      }

      setOrganizations((prev) => {
        const filtered = prev.filter((o) => o.id !== created.id);
        return [...filtered, created];
      });
      setActiveOrganization(created);
      localStorage.setItem('tankhor_active_org_id', String(created.id));

      return created;
    } finally {
      setIsLoading(false);
    }
  };

  const updateActiveOrganization = async (orgData: Partial<Organization>): Promise<Organization> => {
    if (!activeOrganization) {
      throw new Error('سازمان فعالی انتخاب نشده است.');
    }
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const payload: Partial<Organization> = {
        ...activeOrganization,
        ...orgData,
        id: activeOrganization.id,
      };
      const updated = await adapter.saveOrganization(payload);

      setOrganizations((prev) =>
        prev.map((o) => (o.id === updated.id ? updated : o))
      );
      setActiveOrganization(updated);

      return updated;
    } finally {
      setIsLoading(false);
    }
  };

  const saveOrganizationUser = async (ouData: Partial<OrganizationUser>): Promise<OrganizationUser> => {
    if (!activeOrganization) throw new Error('سازمان فعالی انتخاب نشده است.');
    const adapter = storageManager.getAdapter();
    const saved = await adapter.saveOrganizationUser({
      ...ouData,
      organization_id: activeOrganization.id,
    });
    await refreshMembers();
    return saved;
  };

  const deleteOrganizationUser = async (id: number): Promise<boolean> => {
    const adapter = storageManager.getAdapter();
    const res = await adapter.deleteOrganizationUser(id);
    await refreshMembers();
    return res;
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrganization,
        organizationUsers,
        isOwner,
        userRole,
        permissions,
        selectOrganization,
        createOrganization,
        updateActiveOrganization,
        saveOrganizationUser,
        deleteOrganizationUser,
        refreshMembers,
        isLoading,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider');
  return context;
};

