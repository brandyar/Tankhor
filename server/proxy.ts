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
]);

// Generic List items with injected Tenant Scope
proxyRouter.get('/items/:collection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { collection } = req.params;
  const { userId, organizationId } = req.user!;

  try {
    if (collection === 'organizations') {
      const { organizations } = await getUserOrganizations(userId, organizationId);
      return res.json({ data: organizations });
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
      if (Object.keys(clientFilter).length > 0) {
        effectiveFilter = {
          _and: [
            { organization_id: { _eq: organizationId } },
            clientFilter,
          ],
        };
      } else {
        effectiveFilter = { organization_id: { _eq: organizationId } };
      }
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

  try {
    const item = await DirectusAdminClient.getItemById(collection, id, req.query.fields as string);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Tenant check
    if (TENANT_SCOPED_COLLECTIONS.has(collection) && item.organization_id !== undefined) {
      const itemOrgId = typeof item.organization_id === 'object' ? item.organization_id?.id : item.organization_id;
      if (itemOrgId && Number(itemOrgId) !== Number(organizationId)) {
        return res.status(403).json({ error: 'Access denied. Record belongs to another organization.' });
      }
    }

    return res.json({ data: item });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || `Failed to fetch ${collection}/${id}` });
  }
});

// Create Item with enforced organization_id
proxyRouter.post('/items/:collection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { collection } = req.params;
  const { organizationId } = req.user!;

  try {
    const payload = { ...req.body };

    // Automatically enforce tenant ID
    if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
      payload.organization_id = organizationId;
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
  const { userId, organizationId } = req.user!;

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
      const updated = await DirectusAdminClient.updateItem('organizations', orgId, payload);
      return res.json({ data: updated });
    }

    // 1. Verify existence and tenant ownership
    if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
      const existing = await DirectusAdminClient.getItemById(collection, id);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }
      const existingOrgId = typeof existing.organization_id === 'object' ? existing.organization_id?.id : existing.organization_id;
      if (existingOrgId && Number(existingOrgId) !== Number(organizationId)) {
        return res.status(403).json({ error: 'Forbidden: Cannot modify record of another organization' });
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
  const { organizationId } = req.user!;

  try {
    if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
      const existing = await DirectusAdminClient.getItemById(collection, id);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }
      const existingOrgId = typeof existing.organization_id === 'object' ? existing.organization_id?.id : existing.organization_id;
      if (existingOrgId && Number(existingOrgId) !== Number(organizationId)) {
        return res.status(403).json({ error: 'Forbidden: Cannot delete record of another organization' });
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
