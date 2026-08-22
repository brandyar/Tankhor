import React, { createContext, useContext, useState, useEffect } from 'react';
import { Organization } from '../types';
import { storageManager } from '../storage';

interface OrganizationContextType {
  organizations: Organization[];
  activeOrganization: Organization | null;
  selectOrganization: (id: number) => void;
  isLoading: boolean;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshOrganizations = async () => {
    try {
      setIsLoading(true);
      const adapter = storageManager.getAdapter();
      const list = await adapter.getOrganizations();
      setOrganizations(list);

      const savedOrgId = localStorage.getItem('tankhor_active_org_id');
      const found = list.find((o) => String(o.id) === savedOrgId) || list[0] || null;
      setActiveOrganization(found);
    } catch (err) {
      console.error('[OrganizationContext] Failed to load organizations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshOrganizations();
  }, []);

  const selectOrganization = (id: number) => {
    const found = organizations.find((o) => o.id === id);
    if (found) {
      setActiveOrganization(found);
      localStorage.setItem('tankhor_active_org_id', String(id));
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrganization,
        selectOrganization,
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
