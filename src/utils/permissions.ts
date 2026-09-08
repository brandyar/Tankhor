import { UserRole } from '../types';

export interface RolePermissions {
  canManageOrgSettings: boolean;
  canManageUsers: boolean;
  canViewProducts: boolean;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canViewInventory: boolean;
  canManageInventory: boolean;
  canViewOrders: boolean;
  canCreateOrders: boolean;
  canEditOrders: boolean;
  canViewPurchasing: boolean;
  canManagePurchasing: boolean;
  canViewCustomers: boolean;
  canManageCustomers: boolean;
  canViewFinancials: boolean;
}

export interface RoleDefinition {
  key: UserRole;
  labelFa: string;
  labelEn: string;
  descriptionFa: string;
  descriptionEn: string;
  badgeVariant: 'primary' | 'secondary' | 'info' | 'warning' | 'neutral';
  permissions: RolePermissions;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  owner: {
    key: 'owner',
    labelFa: 'مالک سازمان',
    labelEn: 'Organization Owner',
    descriptionFa: 'دسترسی کامل به تمام امکانات سیستم، مدیریت مالی، اعضا و تنظیمات سازمان',
    descriptionEn: 'Full access to all system features, financial management, team members, and organization settings.',
    badgeVariant: 'primary',
    permissions: {
      canManageOrgSettings: true,
      canManageUsers: true,
      canViewProducts: true,
      canEditProducts: true,
      canDeleteProducts: true,
      canViewInventory: true,
      canManageInventory: true,
      canViewOrders: true,
      canCreateOrders: true,
      canEditOrders: true,
      canViewPurchasing: true,
      canManagePurchasing: true,
      canViewCustomers: true,
      canManageCustomers: true,
      canViewFinancials: true,
    },
  },
  manager: {
    key: 'manager',
    labelFa: 'مدیر فروشگاه',
    labelEn: 'Store Manager',
    descriptionFa: 'مدیر کل فروشگاه و انبار، ثبت و ویرایش محصولات، سفارشات و خریدها (بدون دسترسی به تنظیمات اصلی سازمان و حذف اعضا)',
    descriptionEn: 'Store and warehouse management, products, orders, and purchasing (excluding organization settings and member deletion).',
    badgeVariant: 'info',
    permissions: {
      canManageOrgSettings: false,
      canManageUsers: true,
      canViewProducts: true,
      canEditProducts: true,
      canDeleteProducts: true,
      canViewInventory: true,
      canManageInventory: true,
      canViewOrders: true,
      canCreateOrders: true,
      canEditOrders: true,
      canViewPurchasing: true,
      canManagePurchasing: true,
      canViewCustomers: true,
      canManageCustomers: true,
      canViewFinancials: true,
    },
  },
  warehouse: {
    key: 'warehouse',
    labelFa: 'انباردار',
    labelEn: 'Warehouse Manager',
    descriptionFa: 'دسترسی کامل به مدیریت موجودی انبار، انبارها، جایگاه‌ها، انتقال کالا، چاپ بارکد و رسید سفارشات خرید',
    descriptionEn: 'Full inventory control, warehouses, bins/locations, stock transfers, barcode printing, and purchase receipts.',
    badgeVariant: 'secondary',
    permissions: {
      canManageOrgSettings: false,
      canManageUsers: false,
      canViewProducts: true,
      canEditProducts: false,
      canDeleteProducts: false,
      canViewInventory: true,
      canManageInventory: true,
      canViewOrders: true,
      canCreateOrders: false,
      canEditOrders: false,
      canViewPurchasing: true,
      canManagePurchasing: true,
      canViewCustomers: false,
      canManageCustomers: false,
      canViewFinancials: false,
    },
  },
  sales: {
    key: 'sales',
    labelFa: 'فروشنده / صندوق‌دار',
    labelEn: 'Sales Representative',
    descriptionFa: 'دسترسی به مشاهده محصولات، مشتریان و ثبت سفارشات فروش جدید (بدون دسترسی به تنظیمات انبار و خرید)',
    descriptionEn: 'Access to catalog products, customers, and creating sales orders (without inventory/purchasing administration).',
    badgeVariant: 'warning',
    permissions: {
      canManageOrgSettings: false,
      canManageUsers: false,
      canViewProducts: true,
      canEditProducts: false,
      canDeleteProducts: false,
      canViewInventory: true,
      canManageInventory: false,
      canViewOrders: true,
      canCreateOrders: true,
      canEditOrders: true,
      canViewPurchasing: false,
      canManagePurchasing: false,
      canViewCustomers: true,
      canManageCustomers: true,
      canViewFinancials: false,
    },
  },
  viewer: {
    key: 'viewer',
    labelFa: 'مشاهده‌گر',
    labelEn: 'Viewer',
    descriptionFa: 'فقط مشاهده کاتالوگ محصولات، موجودی‌ها و راهنمای سایز (بدون قابلیت تغییر داده‌ها)',
    descriptionEn: 'Read-only access to catalog products, inventory levels, and size guides (no write permissions).',
    badgeVariant: 'neutral',
    permissions: {
      canManageOrgSettings: false,
      canManageUsers: false,
      canViewProducts: true,
      canEditProducts: false,
      canDeleteProducts: false,
      canViewInventory: true,
      canManageInventory: false,
      canViewOrders: true,
      canCreateOrders: false,
      canEditOrders: false,
      canViewPurchasing: false,
      canManagePurchasing: false,
      canViewCustomers: true,
      canManageCustomers: false,
      canViewFinancials: false,
    },
  },
};

export function getRolePermissions(role?: string | null): RolePermissions {
  if (!role) return ROLE_DEFINITIONS.owner.permissions;
  const normalizedRole = role.toLowerCase();
  if (ROLE_DEFINITIONS[normalizedRole as UserRole]) {
    return ROLE_DEFINITIONS[normalizedRole as UserRole].permissions;
  }
  // Admin or Administrator mapping
  if (normalizedRole === 'admin' || normalizedRole === 'administrator') {
    return ROLE_DEFINITIONS.owner.permissions;
  }
  return ROLE_DEFINITIONS.viewer.permissions;
}

export function getRoleDefinition(role?: string | null): RoleDefinition {
  if (!role) return ROLE_DEFINITIONS.owner;
  const normalizedRole = role.toLowerCase();
  if (ROLE_DEFINITIONS[normalizedRole as UserRole]) {
    return ROLE_DEFINITIONS[normalizedRole as UserRole];
  }
  if (normalizedRole === 'admin' || normalizedRole === 'administrator') {
    return ROLE_DEFINITIONS.owner;
  }
  return ROLE_DEFINITIONS.viewer;
}

export function getRoleLabel(role?: string | null, isPersian = true): string {
  const def = getRoleDefinition(role);
  return isPersian ? def.labelFa : def.labelEn;
}

export function getRoleDescription(role?: string | null, isPersian = true): string {
  const def = getRoleDefinition(role);
  return isPersian ? def.descriptionFa : def.descriptionEn;
}
