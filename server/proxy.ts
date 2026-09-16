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
      zipal_merchant: settingsData?.zipal_merchant || settingsData?.zibal_merchant || null,
      enamad: settingsData?.enamad || null,
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
      zipal_merchant: null,
      enamad: null,
      raw: null,
    });
  }
});

// Public System Modules Catalog (for module pricing, metadata, and licensing info)
proxyRouter.get('/system-modules', async (req, res) => {
  try {
    const items = await DirectusAdminClient.getItems('system_modules', req.query).catch(() => []);
    return res.json({ data: items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch system modules' });
  }
});

// Endpoint for Desktop & Web module license validation & synchronization with Directus
proxyRouter.all('/modules/sync-licenses', async (req: any, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let targetOrgId: number | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { verifyToken } = await import('./auth');
        const decoded = verifyToken(token);
        if (decoded) {
          targetOrgId = decoded.organizationId;
        }
      } catch {}
    }

    if (!targetOrgId) {
      targetOrgId = Number(
        req.body?.organizationId ||
        req.query?.organizationId ||
        req.body?.organization_id ||
        req.query?.organization_id
      );
    }

    if (!targetOrgId || isNaN(targetOrgId) || targetOrgId <= 0) {
      return res.status(400).json({ error: 'شناسه سازمان مشخص نیست.' });
    }

    // 1. Fetch organization to verify existence and Pro status
    const org = await DirectusAdminClient.getItemById('organizations', targetOrgId).catch(() => null);
    if (!org) {
      return res.status(404).json({ error: 'سازمان مورد نظر در سرور یافت نشد.' });
    }

    const isPro = org.plan === 'pro';

    // 2. Fetch all system modules from Directus
    const systemModules = await DirectusAdminClient.getItems('system_modules', {
      filter: { status: { _neq: 'deprecated' } },
      limit: 100,
    }).catch(() => []);

    // 3. Fetch organization_modules records from Directus for this organization
    const orgModules = await DirectusAdminClient.getItems('organization_modules', {
      filter: { organization_id: { _eq: targetOrgId } },
      limit: 100,
    }).catch(() => []);

    // 4. Normalize and evaluate status for each module
    const now = Date.now();
    const evaluatedModules = orgModules.map((m: any) => {
      let effectiveStatus = m.status || 'active';
      // If expires_at is set and passed
      if (m.expires_at) {
        const expiry = new Date(m.expires_at).getTime();
        if (now > expiry) {
          effectiveStatus = 'expired';
        }
      }

      const matchedSys = systemModules.find((s: any) => s.slug === m.slug || s.id === m.module_id);

      return {
        id: m.id,
        organization_id: targetOrgId,
        slug: m.slug,
        module_id: m.module_id || matchedSys?.id,
        name: matchedSys?.name || m.name,
        description: matchedSys?.description || m.description,
        license_type: m.license_type || 'lifetime',
        status: effectiveStatus,
        license_token: m.license_token,
        hardware_id: m.hardware_id,
        starts_at: m.starts_at,
        expires_at: m.expires_at,
        included_in_pro: matchedSys?.included_in_pro ?? false,
      };
    });

    return res.json({
      success: true,
      organizationId: targetOrgId,
      isPro,
      plan: org.plan || 'free',
      systemModules,
      modules: evaluatedModules,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[proxy] /modules/sync-licenses Error:', error);
    return res.status(500).json({ error: error.message || 'خطا در استعلام وضعیت لایسنس‌ها از سرور' });
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
  'subscriptions',
  'organization_modules',
  'expense_categories',
  'expenses',
  'person_transactions',
  'financial_accounts',
  'treasury_transactions',
  'cheques',
  'landed_costs',
  'landed_cost_allocations',
  'pos_shifts',
  'woocommerce_settings',
  'woocommerce_logs',
  'woocommerce_mappings',
]);

function sanitizePayloadForDirectus(collection: string, raw: Record<string, any>): Record<string, any> {
  const payload = { ...raw };

  // 1. Extract IDs if relational objects were sent
  const relationalFields = [
    'organization_id',
    'category_id',
    'account_id',
    'financial_account_id',
    'customer_id',
    'supplier_id',
    'product_id',
    'variant_id',
    'order_id',
    'purchase_order_id',
    'warehouse_id',
    'destination_warehouse_id',
    'source_warehouse_id',
    'source_account_id',
    'destination_account_id',
    'target_account_id',
    'brand_id',
    'collection_id',
    'season_id',
    'color_id',
    'size_id',
    'size_group_id',
    'template_id',
  ];

  for (const f of relationalFields) {
    if (payload[f] !== undefined && payload[f] !== null) {
      if (typeof payload[f] === 'object' && payload[f].id !== undefined) {
        payload[f] = Number(payload[f].id);
      } else if (typeof payload[f] === 'string' && !isNaN(Number(payload[f])) && payload[f].trim() !== '') {
        payload[f] = Number(payload[f]);
      }
    }
  }

  // 2. Collection-specific sanitization & mapping
  if (collection === 'expenses') {
    const pm = payload.payment_method;
    if (pm === 'bank_account' || pm === 'card_transfer' || pm === 'bank') {
      payload.payment_method = 'bank';
    } else if (pm === 'pos') {
      payload.payment_method = 'pos';
    } else if (pm === 'cheque') {
      payload.payment_method = 'cheque';
    } else if (pm === 'credit') {
      payload.payment_method = 'credit';
    } else {
      payload.payment_method = 'cash';
    }

    const noteParts: string[] = [];
    if (payload.paid_to) noteParts.push(`دریافت‌کننده: ${payload.paid_to}`);
    if (payload.reference_code) noteParts.push(`کد پیگیری: ${payload.reference_code}`);
    if (payload.description) noteParts.push(payload.description);
    if (payload.notes && payload.notes !== payload.description) noteParts.push(payload.notes);
    if (noteParts.length > 0) {
      payload.notes = noteParts.join(' | ');
    }

    if (payload.amount !== undefined) {
      payload.amount = Number(payload.amount) || 0;
    }

    if (payload.expense_date) {
      const dateStr = String(payload.expense_date);
      payload.expense_date = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    }

    delete payload.paid_to;
    delete payload.reference_code;
    delete payload.description;
    delete payload.category_title;
    delete payload.category_code;
    delete payload.category_icon;
    delete payload.account_name;
    delete payload.created_by_name;
  }

  if (collection === 'expense_categories') {
    if (!payload.icon) payload.icon = 'Receipt';
    if (!payload.status) payload.status = 'active';
    delete payload.expense_count;
    delete payload.total_amount;
  }

  if (collection === 'financial_accounts') {
    if (payload.initial_balance !== undefined) payload.initial_balance = Number(payload.initial_balance) || 0;
    if (payload.current_balance !== undefined) payload.current_balance = Number(payload.current_balance) || 0;
    if (payload.is_default !== undefined) payload.is_default = Boolean(payload.is_default);
    delete payload.status;
  }

  if (collection === 'treasury_transactions') {
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;
    delete payload.source_account_name;
    delete payload.destination_account_name;
  }

  if (collection === 'cheques') {
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;
    if (payload.alert_days_before !== undefined) payload.alert_days_before = Number(payload.alert_days_before) || 3;
    delete payload.notes;
    delete payload.customer_name;
    delete payload.supplier_name;
  }

  if (collection === 'person_transactions') {
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;
    if (payload.balance_after !== undefined) payload.balance_after = Number(payload.balance_after) || 0;
    delete payload.debit_amount;
    delete payload.credit_amount;
    delete payload.running_balance;
    delete payload.status;
    delete payload.customer_name;
    delete payload.supplier_name;
  }

  if (collection === 'pos_shifts') {
    delete payload.organization_id;
    delete payload.notes;
    delete payload.warehouse_name;
    delete payload.account_name;
    delete payload.user_name;
    delete payload.user_email;
    delete payload.total_sales_amount;
    delete payload.total_cash_amount;
    delete payload.total_pos_amount;
    delete payload.total_card_amount;
    delete payload.total_credit_amount;
    delete payload.total_orders_count;
    if (payload.opening_balance !== undefined && payload.opening_balance !== null) {
      payload.opening_balance = String(payload.opening_balance);
    }
    if (payload.closing_balance !== undefined && payload.closing_balance !== null) {
      payload.closing_balance = String(payload.closing_balance);
    }
    if (payload.status !== undefined && payload.status !== null) {
      payload.status = Array.isArray(payload.status) ? payload.status : [payload.status];
    }
  }

  return payload;
}

// Generic List items with injected Tenant Scope
proxyRouter.get('/items/:collection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { collection } = req.params;
  const { userId, organizationId } = req.user!;

  try {
    if (collection === 'project_settings') {
      const items = await DirectusAdminClient.getItems('project_settings', req.query).catch(() => []);
      return res.json({ data: items });
    }

    if (collection === 'system_modules') {
      const items = await DirectusAdminClient.getItems('system_modules', req.query).catch(() => []);
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

    // Check Plan Gate for Web Clients (exempt subscriptions, organization_modules, and project_settings)
    const isDesktop = req.headers['x-tankhor-platform'] === 'desktop';
    if (!isDesktop && TENANT_SCOPED_COLLECTIONS.has(collection) && collection !== 'subscriptions' && collection !== 'organization_modules') {
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

    // Strip root organization_id for collections without organization_id column
    if (
      collection === 'warehouse_locations' ||
      collection === 'pos_shifts' ||
      collection === 'size_guide_measurements' ||
      collection === 'size_guide_values' ||
      collection === 'landed_cost_allocations'
    ) {
      if (clientFilter.organization_id) {
        delete clientFilter.organization_id;
      }
      if (Array.isArray(clientFilter._and)) {
        clientFilter._and = clientFilter._and.filter((cond: any) => !cond.organization_id);
        if (clientFilter._and.length === 0) delete clientFilter._and;
      }
    }

    // Directus JSON field operator limitation: status on pos_shifts cannot use _eq
    let posShiftStatusFilter: string | null = null;
    if (collection === 'pos_shifts') {
      if (clientFilter.status) {
        posShiftStatusFilter = typeof clientFilter.status === 'object' ? clientFilter.status._eq : clientFilter.status;
        delete clientFilter.status;
      }
      if (Array.isArray(clientFilter._and)) {
        clientFilter._and = clientFilter._and.filter((cond: any) => {
          if (cond.status) {
            posShiftStatusFilter = typeof cond.status === 'object' ? cond.status._eq : cond.status;
            return false;
          }
          return true;
        });
        if (clientFilter._and.length === 0) delete clientFilter._and;
      }
    }

    // Inject mandatory organization boundary for tenant-scoped collections
    let effectiveFilter = clientFilter;
    if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
      let tenantFilter: any = { organization_id: { _eq: orgIdNum } };
      
      if (collection === 'warehouse_locations') {
        tenantFilter = { warehouse_id: { organization_id: { _eq: orgIdNum } } };
      } else if (collection === 'pos_shifts') {
        tenantFilter = { warehouse_id: { organization_id: { _eq: orgIdNum } } };
      } else if (collection === 'size_guide_measurements' || collection === 'size_guide_values') {
        tenantFilter = { template_id: { organization_id: { _eq: orgIdNum } } };
      } else if (collection === 'landed_cost_allocations') {
        tenantFilter = { purchase_order_item_id: { organization_id: { _eq: orgIdNum } } };
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
        fields: [
          'id',
          'role',
          'status',
          'date_joined',
          'organization_id',
          'warehouse_id',
          'financial_account_id',
          'can_change_warehouse',
          'user_id.id',
          'user_id.email',
          'user_id.first_name',
          'user_id.last_name',
          'user_id.avatar',
          'user_id.status',
        ],
        sort: req.query.sort || '-id',
      };
      const items = await DirectusAdminClient.getItems('organization_users', orgUsersQuery);
      const mapped = (items || []).map((ou: any) => {
        const u = typeof ou.user_id === 'object' && ou.user_id ? ou.user_id : {};
        const rawWhId = typeof ou.warehouse_id === 'object' && ou.warehouse_id ? ou.warehouse_id.id : ou.warehouse_id;
        const rawAccId = typeof ou.financial_account_id === 'object' && ou.financial_account_id ? ou.financial_account_id.id : ou.financial_account_id;
        return {
          ...ou,
          first_name: u.first_name || ou.first_name || '',
          last_name: u.last_name || ou.last_name || '',
          email: u.email || ou.email || '',
          user_id: typeof ou.user_id === 'string' ? ou.user_id : (u.id || ou.user_id || ''),
          warehouse_id: rawWhId ? Number(rawWhId) : null,
          financial_account_id: rawAccId ? Number(rawAccId) : null,
          can_change_warehouse: ou.can_change_warehouse !== undefined && ou.can_change_warehouse !== null ? Boolean(ou.can_change_warehouse) : true,
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

    if (collection === 'pos_shifts') {
      let mapped = (items || []).map((shift: any) => ({
        ...shift,
        organization_id: orgIdNum,
        status: Array.isArray(shift.status) ? shift.status[0] : (shift.status || 'open'),
      }));
      if (posShiftStatusFilter) {
        mapped = mapped.filter((s: any) => s.status === posShiftStatusFilter);
      }
      return res.json({ data: mapped });
    }

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
    const salesAllowedCollections = ['orders', 'order_items', 'customers', 'pos_shifts'];
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

  const payload = { ...req.body };

  try {

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
          const userRoleId = DirectusAdminClient.getUserRoleId();
          const newUser: any = await DirectusAdminClient.request('/users', {
            method: 'POST',
            body: JSON.stringify({
              email: email,
              first_name: firstName || 'عضو',
              last_name: lastName || 'سازمان',
              password: userPass,
              status: 'active',
              role: userRoleId,
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

      const whIdVal = payload.warehouse_id !== undefined && payload.warehouse_id !== null && payload.warehouse_id !== ''
        ? Number(payload.warehouse_id)
        : null;
      const finAccIdVal = payload.financial_account_id !== undefined && payload.financial_account_id !== null && payload.financial_account_id !== ''
        ? Number(payload.financial_account_id)
        : null;
      const canChangeWhVal = payload.can_change_warehouse !== undefined && payload.can_change_warehouse !== null
        ? Boolean(payload.can_change_warehouse)
        : true;

      let memberResult: any;
      if (existingMembers && existingMembers.length > 0) {
        memberResult = await DirectusAdminClient.updateItem('organization_users', existingMembers[0].id, {
          role: payload.role || 'sales',
          status: payload.status || 'active',
          warehouse_id: whIdVal,
          financial_account_id: finAccIdVal,
          can_change_warehouse: canChangeWhVal,
        });
      } else {
        memberResult = await DirectusAdminClient.createItem('organization_users', {
          organization_id: orgIdNum,
          user_id: targetUserId,
          role: payload.role || 'sales',
          status: payload.status || 'active',
          date_joined: new Date().toISOString(),
          warehouse_id: whIdVal,
          financial_account_id: finAccIdVal,
          can_change_warehouse: canChangeWhVal,
        });
      }

      return res.status(201).json({
        data: {
          ...memberResult,
          first_name: firstName,
          last_name: lastName,
          email: email,
          warehouse_id: whIdVal,
          financial_account_id: finAccIdVal,
          can_change_warehouse: canChangeWhVal,
        },
      });
    }

    // Automatically enforce tenant ID
    if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
      if (
        collection !== 'warehouse_locations' &&
        collection !== 'size_guide_measurements' &&
        collection !== 'size_guide_values' &&
        collection !== 'landed_cost_allocations' &&
        collection !== 'pos_shifts'
      ) {
        payload.organization_id = orgIdNum;
      }
    }

    const cleanPayload = sanitizePayloadForDirectus(collection, payload);
    // Explicitly delete id on create to allow Directus auto-increment primary key
    delete cleanPayload.id;

    // Special validation for expenses foreign keys to prevent PG foreign key violations
    if (collection === 'expenses') {
      if (cleanPayload.category_id) {
        const catId = Number(cleanPayload.category_id);
        if (isNaN(catId) || catId <= 0 || catId >= 1000000000) {
          cleanPayload.category_id = null;
        } else {
          // Check if category exists in Directus for this organization
          const existingCat = await DirectusAdminClient.getItemById('expense_categories', catId).catch(() => null);
          if (!existingCat) {
            // Find any valid category for this org or create a default one
            const orgCats = await DirectusAdminClient.getItems('expense_categories', {
              filter: { organization_id: { _eq: orgIdNum } },
              limit: 1,
            }).catch(() => []);
            if (orgCats && orgCats.length > 0) {
              cleanPayload.category_id = orgCats[0].id;
            } else {
              const newDefaultCat = await DirectusAdminClient.createItem('expense_categories', {
                organization_id: orgIdNum,
                title: 'سایر هزینه‌های عمومی',
                code: 'EXP-MISC',
                icon: 'Receipt',
                status: 'active',
              }).catch(() => null);
              cleanPayload.category_id = newDefaultCat ? newDefaultCat.id : null;
            }
          }
        }
      } else {
        // If no category_id was provided, find or seed default
        const orgCats = await DirectusAdminClient.getItems('expense_categories', {
          filter: { organization_id: { _eq: orgIdNum } },
          limit: 1,
        }).catch(() => []);
        if (orgCats && orgCats.length > 0) {
          cleanPayload.category_id = orgCats[0].id;
        } else {
          const newDefaultCat = await DirectusAdminClient.createItem('expense_categories', {
            organization_id: orgIdNum,
            title: 'سایر هزینه‌های عمومی',
            code: 'EXP-MISC',
            icon: 'Receipt',
            status: 'active',
          }).catch(() => null);
          cleanPayload.category_id = newDefaultCat ? newDefaultCat.id : null;
        }
      }

      if (cleanPayload.account_id) {
        const accId = Number(cleanPayload.account_id);
        if (isNaN(accId) || accId <= 0 || accId >= 1000000000) {
          cleanPayload.account_id = null;
        } else {
          const existingAcc = await DirectusAdminClient.getItemById('financial_accounts', accId).catch(() => null);
          if (!existingAcc) {
            cleanPayload.account_id = null;
          }
        }
      }

      if (cleanPayload.receipt_attachment) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(cleanPayload.receipt_attachment));
        if (!isUuid) {
          delete cleanPayload.receipt_attachment;
        }
      }
    }

    // Special handling for organization_modules: Upsert based on slug to prevent RECORD_NOT_UNIQUE errors
    if (collection === 'organization_modules') {
      const moduleSlug = cleanPayload.slug || payload.slug;
      if (moduleSlug) {
        const existingMods = await DirectusAdminClient.getItems('organization_modules', {
          filter: {
            _or: [
              {
                _and: [
                  { organization_id: { _eq: orgIdNum } },
                  { slug: { _eq: moduleSlug } },
                ],
              },
              { slug: { _eq: moduleSlug } },
            ],
          },
          limit: 1,
        }).catch(() => []);

        if (existingMods && existingMods.length > 0) {
          const updated = await DirectusAdminClient.updateItem('organization_modules', existingMods[0].id, {
            ...cleanPayload,
            organization_id: orgIdNum,
          });
          return res.status(200).json({ data: updated });
        }
      }
    }

    const created = await DirectusAdminClient.createItem(collection, cleanPayload);
    if (collection === 'pos_shifts') {
      return res.status(201).json({
        data: {
          ...created,
          organization_id: orgIdNum,
          status: Array.isArray(created.status) ? created.status[0] : (created.status || 'open'),
        },
      });
    }
    return res.status(201).json({ data: created });
  } catch (error: any) {
    if (collection === 'organization_modules' && (error.message?.includes('RECORD_NOT_UNIQUE') || error.message?.includes('unique') || error.message?.includes('slug'))) {
      try {
        const targetSlug = payload?.slug || req.body?.slug;
        if (targetSlug) {
          const existing = await DirectusAdminClient.getItems('organization_modules', {
            filter: { slug: { _eq: targetSlug } },
            limit: 1,
          }).catch(() => []);
          if (existing && existing.length > 0) {
            const updated = await DirectusAdminClient.updateItem('organization_modules', existing[0].id, {
              ...payload,
              organization_id: orgIdNum,
            });
            console.log(`[API Proxy] Resiliently updated organization_modules #${existing[0].id} for slug ${targetSlug}`);
            return res.status(200).json({ data: updated });
          }
        }
      } catch (upsertErr: any) {
        console.error('[API Proxy] Error in fallback upsert for organization_modules:', upsertErr?.message);
      }
    }
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
      if (payload.warehouse_id !== undefined) {
        updatePayload.warehouse_id = payload.warehouse_id ? Number(payload.warehouse_id) : null;
      }
      if (payload.financial_account_id !== undefined) {
        updatePayload.financial_account_id = payload.financial_account_id ? Number(payload.financial_account_id) : null;
      }
      if (payload.can_change_warehouse !== undefined) {
        updatePayload.can_change_warehouse = Boolean(payload.can_change_warehouse);
      }

      const updated = await DirectusAdminClient.updateItem('organization_users', id, updatePayload);
      const rawWhId = updatePayload.warehouse_id !== undefined ? updatePayload.warehouse_id : (typeof orgUser.warehouse_id === 'object' ? orgUser.warehouse_id?.id : orgUser.warehouse_id);
      const rawAccId = updatePayload.financial_account_id !== undefined ? updatePayload.financial_account_id : (typeof orgUser.financial_account_id === 'object' ? orgUser.financial_account_id?.id : orgUser.financial_account_id);
      return res.json({
        data: {
          ...updated,
          first_name: payload.first_name || (typeof orgUser.user_id === 'object' ? orgUser.user_id?.first_name : '') || '',
          last_name: payload.last_name || (typeof orgUser.user_id === 'object' ? orgUser.user_id?.last_name : '') || '',
          email: payload.email || (typeof orgUser.user_id === 'object' ? orgUser.user_id?.email : '') || '',
          warehouse_id: rawWhId ? Number(rawWhId) : null,
          financial_account_id: rawAccId ? Number(rawAccId) : null,
          can_change_warehouse: updatePayload.can_change_warehouse !== undefined ? updatePayload.can_change_warehouse : (orgUser.can_change_warehouse !== undefined ? Boolean(orgUser.can_change_warehouse) : true),
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

    const cleanPayload = sanitizePayloadForDirectus(collection, payload);
    const updated = await DirectusAdminClient.updateItem(collection, id, cleanPayload);
    if (collection === 'pos_shifts') {
      return res.json({
        data: {
          ...updated,
          organization_id: orgIdNum,
          status: Array.isArray(updated.status) ? updated.status[0] : (updated.status || 'open'),
        },
      });
    }
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

// Assets Proxy (Directly stream uploaded images from Directus storage)
proxyRouter.get('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send('Asset ID is required');
    }

    const queryString = Object.keys(req.query).length > 0 ? `?${new URLSearchParams(req.query as any).toString()}` : '';
    const directusUrl = `${DirectusAdminClient.getBaseUrl()}/assets/${id}${queryString}`;
    const token = DirectusAdminClient.getAdminToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const upstream = await fetch(directusUrl, { headers });
    if (!upstream.ok) {
      return res.status(upstream.status).send(upstream.statusText || 'Asset not found');
    }

    const contentType = upstream.headers.get('content-type') || 'image/webp';
    res.setHeader('Content-Type', contentType);
    const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=86400';
    res.setHeader('Cache-Control', cacheControl);

    const arrayBuf = await upstream.arrayBuffer();
    return res.send(Buffer.from(arrayBuf));
  } catch (error: any) {
    console.error('[proxy] /assets/:id error:', error);
    return res.status(500).send('Failed to proxy asset');
  }
});
