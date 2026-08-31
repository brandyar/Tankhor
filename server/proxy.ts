import { Router, Response } from 'express';
import multer from 'multer';
import { DirectusAdminClient } from './directusAdmin';
import { requireAuth, AuthenticatedRequest, getUserOrganizations } from './auth';

const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } }); // 15MB

export const proxyRouter = Router();

// Public / Health Endpoints
proxyRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'api-gateway-admin-proxy',
    directusUrl: DirectusAdminClient.getBaseUrl(),
    hasAdminToken: !!DirectusAdminClient.getAdminToken(),
    timestamp: new Date().toISOString(),
  });
});

// Public Project Settings (Desktop & Mobile Download Links from Directus project_settings collection)
proxyRouter.get('/project-settings', async (req, res) => {
  try {
    let settingsData: any = null;
    try {
      const resp: any = await DirectusAdminClient.request('/items/project_settings');
      if (resp) {
        if (resp.data) {
          settingsData = Array.isArray(resp.data) ? resp.data[0] : resp.data;
        } else if (Array.isArray(resp)) {
          settingsData = resp[0];
        } else if (typeof resp === 'object' && resp.id) {
          settingsData = resp;
        }
      }
    } catch (e: any) {
      console.warn('[proxy] /items/project_settings fetch fallback:', e?.message);
      try {
        const items = await DirectusAdminClient.getItems('project_settings', { limit: 1 });
        if (items && items.length > 0) {
          settingsData = items[0];
        }
      } catch {
        // empty / fallback
      }
    }

    const resolveUrl = (val?: string | null) => {
      if (!val) return null;
      const str = String(val).trim();
      if (!str) return null;
      if (str.startsWith('http://') || str.startsWith('https://')) return str;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      if (isUuid) {
        return `${DirectusAdminClient.getBaseUrl()}/assets/${str}?download`;
      }
      return str;
    };

    const windowsUrl = resolveUrl(settingsData?.windows_setup);
    const macosUrl = resolveUrl(settingsData?.macos_setup);
    const androidUrl = resolveUrl(settingsData?.adnroid_setup || settingsData?.android_setup);

    return res.json({
      windows_setup: windowsUrl,
      macos_setup: macosUrl,
      adnroid_setup: androidUrl,
      android_setup: androidUrl,
      zarinpal_merchant: settingsData?.zarinpal_merchant || null,
      raw: settingsData || null,
    });
  } catch (err: any) {
    console.error('[proxy] Error in /project-settings:', err);
    return res.json({
      windows_setup: null,
      macos_setup: null,
      adnroid_setup: null,
      android_setup: null,
      zarinpal_merchant: null,
      raw: null,
    });
  }
});

// Profile / Current user endpoints (available at both /api/users/me and /api/auth/me)
const handleMeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, organizationId } = req.user!;
    const user = await DirectusAdminClient.request(`/users/${userId}`).catch(() => null);
    const { activeOrganization, organizations } = await getUserOrganizations(userId, organizationId);

    return res.json({
      id: user?.id || userId,
      email: user?.email || req.user!.email,
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      avatar: user?.avatar || null,
      title: user?.title || null,
      status: user?.status || 'active',
      role: req.user!.role || activeOrganization?.user_role || 'owner',
      active_organization_id: activeOrganization?.id || organizationId,
      active_organization: activeOrganization,
      activeOrganization: activeOrganization,
      organizations: organizations,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch user profile' });
  }
};

proxyRouter.get('/users/me', requireAuth, handleMeRequest);
proxyRouter.get('/auth/me', requireAuth, handleMeRequest);

// Organization Switcher & Access endpoints
proxyRouter.get('/organizations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, organizationId } = req.user!;
    const { organizations } = await getUserOrganizations(userId, organizationId);
    return res.json(organizations);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch organizations' });
  }
});

proxyRouter.get('/organizations/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const orgId = Number(req.params.id);

    // Verify user belongs to this org
    const memberships = await DirectusAdminClient.getItems('organization_users', {
      filter: {
        _and: [
          { user_id: { _eq: userId } },
          { organization_id: { _eq: orgId } },
        ],
      },
      limit: 1,
    });

    if (memberships.length === 0) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    const org = await DirectusAdminClient.getItemById('organizations', orgId);
    return res.json(org);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch organization' });
  }
});

// Collections with strict organization_id tenant boundary
const TENANT_SCOPED_COLLECTIONS = new Set([
  'products',
  'product_variants',
  'categories',
  'collections',
  'seasons',
  'colors',
  'brands',
  'size_groups',
  'sizes',
  'warehouses',
  'warehouse_locations',
  'inventory_items',
  'inventory_movements',
  'orders',
  'order_items',
  'customers',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'stock_transfers',
  'stock_transfer_items',
  'size_guide_templates',
  'size_guide_measurements',
  'size_guide_values',
  'organization_users',
]);

// Generic List items with injected Tenant Scope
proxyRouter.get('/items/:collection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { collection } = req.params;
  const { userId, organizationId } = req.user!;

  try {
    if (collection === 'project_settings') {
      const items = await DirectusAdminClient.getItems('project_settings', req.query).catch(() => []);
      return res.json({ data: items });
    }

    if (collection === 'organizations') {
      const { organizations } = await getUserOrganizations(userId, organizationId);
      return res.json({ data: organizations });
    }

    const orgIdNum = Number(organizationId);
    if (!orgIdNum || isNaN(orgIdNum) || orgIdNum <= 0) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز: سازمان فعال یافت نشد.' });
    }

    // Check Plan Gate for Web Clients
    const isDesktop = req.headers['x-tankhor-platform'] === 'desktop';
    if (!isDesktop && TENANT_SCOPED_COLLECTIONS.has(collection)) {
      const { activeOrganization } = await getUserOrganizations(userId, organizationId);
      if (activeOrganization && activeOrganization.plan === 'free') {
        return res.status(403).json({
          error: 'دسترسی تحت وب برای این سازمان نیازمند پلن Pro است. لطفاً پلن خود را ارتقا دهید یا از نسخه دسکتاپ رایگان تن‌خور استفاده کنید.',
          code: 'WEB_FREE_PLAN_LOCKED'
        });
      }
    }

    let clientFilter: any = {};
    if (req.query.filter) {
      try {
        clientFilter = typeof req.query.filter === 'string' ? JSON.parse(req.query.filter) : req.query.filter;
      } catch {
        clientFilter = {};
      }
    }

    // Inject mandatory organization boundary for tenant-scoped collections
    let effectiveFilter = clientFilter;
    if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
      let tenantFilter: any = { organization_id: { _eq: orgIdNum } };
      
      if (collection === 'warehouse_locations') {
        tenantFilter = { warehouse_id: { organization_id: { _eq: orgIdNum } } };
      } else if (collection === 'size_guide_measurements' || collection === 'size_guide_values') {
        tenantFilter = { template_id: { organization_id: { _eq: orgIdNum } } };
      }

      if (Object.keys(clientFilter).length > 0) {
        effectiveFilter = {
          _and: [
            tenantFilter,
            clientFilter,
          ],
        };
      } else {
        effectiveFilter = tenantFilter;
      }
    }

    if (collection === 'organization_users') {
      const orgUsersQuery: any = {
        filter: effectiveFilter,
        fields: ['id', 'role', 'status', 'date_joined', 'organization_id', 'user_id.id', 'user_id.email', 'user_id.first_name', 'user_id.last_name', 'user_id.avatar', 'user_id.status'],
        sort: req.query.sort || '-id',
      };
      const items = await DirectusAdminClient.getItems('organization_users', orgUsersQuery);
      const mapped = (items || []).map((ou: any) => {
        const u = typeof ou.user_id === 'object' && ou.user_id ? ou.user_id : {};
        return {
          ...ou,
          first_name: u.first_name || ou.first_name || '',
          last_name: u.last_name || ou.last_name || '',
          email: u.email || ou.email || '',
          user_id: typeof ou.user_id === 'string' ? ou.user_id : (u.id || ou.user_id || ''),
        };
      });
      return res.json({ data: mapped });
    }

    const query: any = {
      filter: effectiveFilter,
    };
    if (req.query.sort) query.sort = req.query.sort;
    if (req.query.limit) query.limit = req.query.limit;
    if (req.query.page) query.page = req.query.page;
    if (req.query.fields) query.fields = req.query.fields;

    const items = await DirectusAdminClient.getItems(collection, query);
    return res.json({ data: items });
  } catch (error: any) {
    console.error(`[API Proxy] Error fetching ${collection}:`, error.message);
    return res.status(500).json({ error: error.message || `Failed to fetch ${collection}` });
  }
});

// Get Single item by ID
proxyRouter.get('/items/:collection/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { collection, id } = req.params;
  const { organizationId } = req.user!;
  const orgIdNum = Number(organizationId);

  try {
    const item = await DirectusAdminClient.getItemById(collection, id, req.query.fields as string);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Tenant check
    if (TENANT_SCOPED_COLLECTIONS.has(collection) && item.organization_id !== undefined) {
      const itemOrgId = typeof item.organization_id === 'object' ? item.organization_id?.id : item.organization_id;
      if (itemOrgId && Number(itemOrgId) !== orgIdNum) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز: این داده متعلق به سازمان دیگری است.' });
      }
    }

    return res.json({ data: item });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || `Failed to fetch ${collection}/${id}` });
  }
});

function checkRolePermission(userRole: string, action: 'create' | 'update' | 'delete', collection: string): { allowed: boolean; message?: string } {
  const role = (userRole || 'viewer').toLowerCase();
  if (role === 'owner' || role === 'manager') {
    return { allowed: true };
  }

  if (role === 'viewer') {
    return { allowed: false, message: 'دسترسی فقط مشاهده (Viewer): امکان ثبت، ویرایش یا حذف اطلاعات وجود ندارد.' };
  }

  if (role === 'sales') {
    if (action === 'delete') {
      return { allowed: false, message: 'نقش فروشنده (Sales) اجازه حذف اطلاعات را ندارد.' };
    }
    const salesAllowedCollections = ['orders', 'order_items', 'customers'];
    if (!salesAllowedCollections.includes(collection)) {
      return { allowed: false, message: `نقش فروشنده (Sales) مجاز به انجام عملیات روی «${collection}» نیست.` };
    }
    return { allowed: true };
  }

  if (role === 'warehouse') {
    if (action === 'delete' && (collection === 'products' || collection === 'product_variants' || collection === 'organizations' || collection === 'organization_users')) {
      return { allowed: false, message: 'نقش انباردار (Warehouse) اجازه حذف این بخش را ندارد.' };
    }
    const warehouseRestrictedCollections = ['orders', 'order_items', 'customers', 'organizations', 'organization_users'];
    if (warehouseRestrictedCollections.includes(collection)) {
      return { allowed: false, message: `نقش انباردار (Warehouse) مجاز به تغییرات روی «${collection}» نیست.` };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

// Create Item with enforced organization_id
proxyRouter.post('/items/:collection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { collection } = req.params;
  const { organizationId, role } = req.user!;
  const orgIdNum = Number(organizationId);

  if (!orgIdNum || isNaN(orgIdNum) || orgIdNum <= 0) {
    return res.status(403).json({ error: 'سازمان فعال مشخص نشده است.' });
  }

  const permCheck = checkRolePermission(role, 'create', collection);
  if (!permCheck.allowed) {
    return res.status(403).json({ error: permCheck.message || 'شما دسترسی لازم برای این عملیات را ندارید.' });
  }

  try {
    const payload = { ...req.body };

    // Special handling for organization_users creation / member invite
    if (collection === 'organization_users') {
      const email = (payload.email || '').toString().trim().toLowerCase();
      const firstName = (payload.first_name || '').toString().trim();
      const lastName = (payload.last_name || '').toString().trim();
      let targetUserId = payload.user_id;

      if (email) {
        const existingUsers = await DirectusAdminClient.getItems('directus_users', {
          filter: { email: { _eq: email } },
          limit: 1,
        }).catch(() => []);

        if (existingUsers && existingUsers.length > 0) {
          targetUserId = existingUsers[0].id;
          if (firstName || lastName || payload.password) {
            await DirectusAdminClient.request(`/users/${targetUserId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                ...(firstName ? { first_name: firstName } : {}),
                ...(lastName ? { last_name: lastName } : {}),
                ...(payload.password ? { password: payload.password } : {}),
              }),
            }).catch(() => {});
          }
        } else {
          const userPass = (payload.password || '').toString().trim() || `Tk@${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
          const DIRECTUS_TENANT_ROLE_ID = 'dbc2022f-0dea-4ef4-bb00-00a577e3208d';
          const newUser: any = await DirectusAdminClient.request('/users', {
            method: 'POST',
            body: JSON.stringify({
              email: email,
              first_name: firstName || 'عضو',
              last_name: lastName || 'سازمان',
              password: userPass,
              status: 'active',
              role: DIRECTUS_TENANT_ROLE_ID,
            }),
          });
          targetUserId = newUser.id;
        }
      }

      if (!targetUserId) {
        return res.status(400).json({ error: 'آدرس ایمیل عضو الزامی است.' });
      }

      const existingMembers = await DirectusAdminClient.getItems('organization_users', {
        filter: {
          _and: [
            { organization_id: { _eq: orgIdNum } },
            { user_id: { _eq: targetUserId } },
          ],
        },
        limit: 1,
      }).catch(() => []);

      let memberResult: any;
      if (existingMembers && existingMembers.length > 0) {
        memberResult = await DirectusAdminClient.updateItem('organization_users', existingMembers[0].id, {
          role: payload.role || 'sales',
          status: payload.status || 'active',
        });
      } else {
        memberResult = await DirectusAdminClient.createItem('organization_users', {
          organization_id: orgIdNum,
          user_id: targetUserId,
          role: payload.role || 'sales',
          status: payload.status || 'active',
          date_joined: new Date().toISOString(),
        });
      }

      return res.status(201).json({
        data: {
          ...memberResult,
          first_name: firstName,
          last_name: lastName,
          email: email,
        },
      });
    }

    // Automatically enforce tenant ID
    if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
      if (collection !== 'warehouse_locations' && collection !== 'size_guide_measurements' && collection !== 'size_guide_values') {
        payload.organization_id = orgIdNum;
      }
    }

    const created = await DirectusAdminClient.createItem(collection, payload);
    return res.status(201).json({ data: created });
  } catch (error: any) {
    console.error(`[API Proxy] Error creating in ${collection}:`, error.message);
    return res.status(500).json({ error: error.message || `Failed to create item in ${collection}` });
  }
});

// Update Item with tenant boundary validation
proxyRouter.patch('/items/:collection/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { collection, id } = req.params;
  const { userId, organizationId, role } = req.user!;
  const orgIdNum = Number(organizationId);

  const permCheck = checkRolePermission(role, 'update', collection);
  if (!permCheck.allowed) {
    return res.status(403).json({ error: permCheck.message || 'شما دسترسی لازم برای ویرایش این بخش را ندارید.' });
  }

  try {
    // Special handling for organizations collection
    if (collection === 'organizations') {
      const orgId = Number(id);
      const memberships = await DirectusAdminClient.getItems('organization_users', {
        filter: {
          _and: [
            { user_id: { _eq: userId } },
            { organization_id: { _eq: orgId } },
          ],
        },
        limit: 1,
      });

      if (memberships.length === 0 || memberships[0].role !== 'owner') {
        return res.status(403).json({ error: 'فقط مالک سازمان (Owner) مجاز به ویرایش مشخصات سازمان است.' });
      }

      const payload = { ...req.body };
      delete payload.id;
      delete payload.plan; // Security: Prevent plan mutation via regular proxy PATCH
      const updated = await DirectusAdminClient.updateItem('organizations', orgId, payload);
      return res.json({ data: updated });
    }

    // Special handling for organization_users
    if (collection === 'organization_users') {
      const payload: any = { ...req.body };
      const orgUser = await DirectusAdminClient.getItemById('organization_users', id, '*,user_id.*');
      if (!orgUser) return res.status(404).json({ error: 'عضو سازمان یافت نشد.' });

      const existingOrgId = typeof orgUser.organization_id === 'object' ? orgUser.organization_id?.id : orgUser.organization_id;
      if (existingOrgId && Number(existingOrgId) !== orgIdNum) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز: امکان ویرایش داده‌های سازمان دیگر وجود ندارد.' });
      }

      const directusUserId = typeof orgUser.user_id === 'object' ? orgUser.user_id?.id : orgUser.user_id;
      if (directusUserId && (payload.first_name || payload.last_name || payload.password)) {
        await DirectusAdminClient.request(`/users/${directusUserId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...(payload.first_name ? { first_name: payload.first_name } : {}),
            ...(payload.last_name ? { last_name: payload.last_name } : {}),
            ...(payload.password ? { password: payload.password } : {}),
          }),
        }).catch(() => {});
      }

      const updatePayload: any = {};
      if (payload.role) updatePayload.role = payload.role;
      if (payload.status) updatePayload.status = payload.status;

      const updated = await DirectusAdminClient.updateItem('organization_users', id, updatePayload);
      return res.json({
        data: {
          ...updated,
          first_name: payload.first_name || (typeof orgUser.user_id === 'object' ? orgUser.user_id?.first_name : '') || '',
          last_name: payload.last_name || (typeof orgUser.user_id === 'object' ? orgUser.user_id?.last_name : '') || '',
          email: payload.email || (typeof orgUser.user_id === 'object' ? orgUser.user_id?.email : '') || '',
        },
      });
    }

    // 1. Verify existence and tenant ownership
    if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
      const existing = await DirectusAdminClient.getItemById(collection, id);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }
      const existingOrgId = typeof existing.organization_id === 'object' ? existing.organization_id?.id : existing.organization_id;
      if (existingOrgId && Number(existingOrgId) !== orgIdNum) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز: امکان ویرایش داده‌های سازمان دیگر وجود ندارد.' });
      }
    }

    const payload = { ...req.body };
    // Prevent tenant hijacking
    delete payload.organization_id;

    const updated = await DirectusAdminClient.updateItem(collection, id, payload);
    return res.json({ data: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || `Failed to update ${collection}/${id}` });
  }
});

// Delete Item with tenant boundary validation
proxyRouter.delete('/items/:collection/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { collection, id } = req.params;
  const { organizationId, role } = req.user!;
  const orgIdNum = Number(organizationId);

  const permCheck = checkRolePermission(role, 'delete', collection);
  if (!permCheck.allowed) {
    return res.status(403).json({ error: permCheck.message || 'شما دسترسی لازم برای حذف این بخش را ندارید.' });
  }

  try {
    if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
      const existing = await DirectusAdminClient.getItemById(collection, id);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }
      const existingOrgId = typeof existing.organization_id === 'object' ? existing.organization_id?.id : existing.organization_id;
      if (existingOrgId && Number(existingOrgId) !== orgIdNum) {
        return res.status(403).json({ error: 'دسترسی غیرمجاز: امکان حذف داده‌های سازمان دیگر وجود ندارد.' });
      }
    }

    await DirectusAdminClient.deleteItem(collection, id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || `Failed to delete ${collection}/${id}` });
  }
});

// File Upload Proxy
proxyRouter.post('/files', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);

    const directusUrl = `${DirectusAdminClient.getBaseUrl()}/files`;
    const response = await fetch(directusUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DirectusAdminClient.getAdminToken()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      return res.status(response.status).json(err);
    }

    const result = await response.json();
    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'File upload proxy failed' });
  }
});
