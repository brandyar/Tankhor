import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Organization } from '../types';
import { storageManager } from '../storage';
import { useAuth } from './AuthContext';
import { directusClient } from '../api/directus';

interface OrganizationContextType {
  organizations: Organization[];
  activeOrganization: Organization | null;
  isOwner: boolean;
  userRole: string;
  selectOrganization: (id: number) => Promise<void>;
  createOrganization: (orgData: Partial<Organization>) => Promise<Organization>;
  updateActiveOrganization: (orgData: Partial<Organization>) => Promise<Organization>;
  isLoading: boolean;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isCloudAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Compute owner role: in offline mode or when user has owner role in cloud
  const userRole = isCloudAuthenticated
    ? (typeof user?.role === 'object' ? (user.role as any)?.name || 'viewer' : (user?.role || 'owner'))
    : 'owner';

  const isOwner = !isCloudAuthenticated || userRole === 'owner' || userRole === 'Administrator' || userRole === 'Admin';

  const refreshOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const adapter = storageManager.getAdapter();
      const list = await adapter.getOrganizations();
      setOrganizations(list);

      const savedOrgId = localStorage.getItem('tankhor_active_org_id');
      const found = list.find((o) => String(o.id) === savedOrgId) || list[0] || null;
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
  }, [refreshOrganizations, isCloudAuthenticated]);

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

      // Update state and select the newly created organization
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

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrganization,
        isOwner,
        userRole,
        selectOrganization,
        createOrganization,
        updateActiveOrganization,
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

