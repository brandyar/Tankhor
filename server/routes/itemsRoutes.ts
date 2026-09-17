import { Router, Response } from 'express';
import { DirectusAdminClient } from '../directusAdmin';
import { requireAuth, AuthenticatedRequest, getUserOrganizations } from '../auth';
import {
  TENANT_SCOPED_COLLECTIONS,
  checkRolePermission,
  sanitizePayloadForDirectus,
} from '../permissions';
import { syncAndPersistFinancialAccountBalances } from '../accountingSync';

export const itemsRouter = Router();

// Generic List items with injected Tenant Scope
itemsRouter.get(
  '/items/:collection',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { collection } = req.params;
    const { userId, organizationId } = req.user!;

    try {
      if (collection === 'project_settings') {
        const items = await DirectusAdminClient.getItems('project_settings', req.query).catch(
          () => []
        );
        return res.json({ data: items });
      }

      if (collection === 'system_modules') {
        const items = await DirectusAdminClient.getItems('system_modules', req.query).catch(
          () => []
        );
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
      if (
        !isDesktop &&
        TENANT_SCOPED_COLLECTIONS.has(collection) &&
        collection !== 'subscriptions' &&
        collection !== 'organization_modules'
      ) {
        const { activeOrganization } = await getUserOrganizations(userId, organizationId);
        if (activeOrganization && activeOrganization.plan === 'free') {
          return res.status(403).json({
            error:
              'دسترسی تحت وب برای این سازمان نیازمند پلن Pro است. لطفاً پلن خود را ارتقا دهید یا از نسخه دسکتاپ رایگان تن‌خور استفاده کنید.',
            code: 'WEB_FREE_PLAN_LOCKED',
          });
        }
      }

      let clientFilter: any = {};
      if (req.query.filter) {
        try {
          clientFilter =
            typeof req.query.filter === 'string'
              ? JSON.parse(req.query.filter)
              : req.query.filter;
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
          posShiftStatusFilter =
            typeof clientFilter.status === 'object'
              ? clientFilter.status._eq
              : clientFilter.status;
          delete clientFilter.status;
        }
        if (Array.isArray(clientFilter._and)) {
          clientFilter._and = clientFilter._and.filter((cond: any) => {
            if (cond.status) {
              posShiftStatusFilter =
                typeof cond.status === 'object' ? cond.status._eq : cond.status;
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
        } else if (
          collection === 'size_guide_measurements' ||
          collection === 'size_guide_values'
        ) {
          tenantFilter = { template_id: { organization_id: { _eq: orgIdNum } } };
        } else if (collection === 'landed_cost_allocations') {
          tenantFilter = { purchase_order_item_id: { organization_id: { _eq: orgIdNum } } };
        }

        if (Object.keys(clientFilter).length > 0) {
          effectiveFilter = {
            _and: [tenantFilter, clientFilter],
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
          const rawWhId =
            typeof ou.warehouse_id === 'object' && ou.warehouse_id
              ? ou.warehouse_id.id
              : ou.warehouse_id;
          const rawAccId =
            typeof ou.financial_account_id === 'object' && ou.financial_account_id
              ? ou.financial_account_id.id
              : ou.financial_account_id;
          return {
            ...ou,
            first_name: u.first_name || ou.first_name || '',
            last_name: u.last_name || ou.last_name || '',
            email: u.email || ou.email || '',
            user_id: typeof ou.user_id === 'string' ? ou.user_id : u.id || ou.user_id || '',
            warehouse_id: rawWhId ? Number(rawWhId) : null,
            financial_account_id: rawAccId ? Number(rawAccId) : null,
            can_change_warehouse:
              ou.can_change_warehouse !== undefined && ou.can_change_warehouse !== null
                ? Boolean(ou.can_change_warehouse)
                : true,
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

      if (collection === 'financial_accounts') {
        const syncedAccounts = await syncAndPersistFinancialAccountBalances(orgIdNum);
        return res.json({ data: syncedAccounts });
      }

      if (collection === 'pos_shifts') {
        let mapped = (items || []).map((shift: any) => ({
          ...shift,
          organization_id: orgIdNum,
          status: Array.isArray(shift.status) ? shift.status[0] : shift.status || 'open',
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
  }
);

// Get Single item by ID
itemsRouter.get(
  '/items/:collection/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { collection, id } = req.params;
    const { organizationId } = req.user!;
    const orgIdNum = Number(organizationId);

    try {
      const item = await DirectusAdminClient.getItemById(
        collection,
        id,
        req.query.fields as string
      );
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Tenant check
      if (TENANT_SCOPED_COLLECTIONS.has(collection) && item.organization_id !== undefined) {
        const itemOrgId =
          typeof item.organization_id === 'object'
            ? item.organization_id?.id
            : item.organization_id;
        if (itemOrgId && Number(itemOrgId) !== orgIdNum) {
          return res
            .status(403)
            .json({ error: 'دسترسی غیرمجاز: این داده متعلق به سازمان دیگری است.' });
        }
      }

      if (collection === 'financial_accounts') {
        const syncedAccounts = await syncAndPersistFinancialAccountBalances(orgIdNum);
        const found = syncedAccounts.find((a: any) => String(a.id) === String(id));
        if (found) {
          return res.json({ data: found });
        }
        return res.json({ data: item });
      }

      return res.json({ data: item });
    } catch (error: any) {
      return res
        .status(500)
        .json({ error: error.message || `Failed to fetch ${collection}/${id}` });
    }
  }
);

// Create Item with enforced organization_id
itemsRouter.post(
  '/items/:collection',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { collection } = req.params;
    const { organizationId, role } = req.user!;
    const orgIdNum = Number(organizationId);

    if (!orgIdNum || isNaN(orgIdNum) || orgIdNum <= 0) {
      return res.status(403).json({ error: 'سازمان فعال مشخص نشده است.' });
    }

    const permCheck = checkRolePermission(role, 'create', collection);
    if (!permCheck.allowed) {
      return res
        .status(403)
        .json({ error: permCheck.message || 'شما دسترسی لازم برای این عملیات را ندارید.' });
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
            const userPass =
              (payload.password || '').toString().trim() ||
              `Tk@${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
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

        const whIdVal =
          payload.warehouse_id !== undefined &&
          payload.warehouse_id !== null &&
          payload.warehouse_id !== ''
            ? Number(payload.warehouse_id)
            : null;
        const finAccIdVal =
          payload.financial_account_id !== undefined &&
          payload.financial_account_id !== null &&
          payload.financial_account_id !== ''
            ? Number(payload.financial_account_id)
            : null;
        const canChangeWhVal =
          payload.can_change_warehouse !== undefined && payload.can_change_warehouse !== null
            ? Boolean(payload.can_change_warehouse)
            : true;

        let memberResult: any;
        if (existingMembers && existingMembers.length > 0) {
          memberResult = await DirectusAdminClient.updateItem(
            'organization_users',
            existingMembers[0].id,
            {
              role: payload.role || 'sales',
              status: payload.status || 'active',
              warehouse_id: whIdVal,
              financial_account_id: finAccIdVal,
              can_change_warehouse: canChangeWhVal,
            }
          );
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
            const existingCat = await DirectusAdminClient.getItemById(
              'expense_categories',
              catId
            ).catch(() => null);
            if (!existingCat) {
              // Find any valid category for this org or create a default one
              const orgCats = await DirectusAdminClient.getItems('expense_categories', {
                filter: { organization_id: { _eq: orgIdNum } },
                limit: 1,
              }).catch(() => []);
              if (orgCats && orgCats.length > 0) {
                cleanPayload.category_id = orgCats[0].id;
              } else {
                const newDefaultCat = await DirectusAdminClient.createItem(
                  'expense_categories',
                  {
                    organization_id: orgIdNum,
                    title: 'سایر هزینه‌های عمومی',
                    code: 'EXP-MISC',
                    icon: 'Receipt',
                    status: 'active',
                  }
                ).catch(() => null);
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
            const newDefaultCat = await DirectusAdminClient.createItem(
              'expense_categories',
              {
                organization_id: orgIdNum,
                title: 'سایر هزینه‌های عمومی',
                code: 'EXP-MISC',
                icon: 'Receipt',
                status: 'active',
              }
            ).catch(() => null);
            cleanPayload.category_id = newDefaultCat ? newDefaultCat.id : null;
          }
        }

        if (cleanPayload.account_id) {
          const accId = Number(cleanPayload.account_id);
          if (isNaN(accId) || accId <= 0 || accId >= 1000000000) {
            cleanPayload.account_id = null;
          } else {
            const existingAcc = await DirectusAdminClient.getItemById(
              'financial_accounts',
              accId
            ).catch(() => null);
            if (!existingAcc) {
              cleanPayload.account_id = null;
            }
          }
        }

        if (cleanPayload.receipt_attachment) {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              String(cleanPayload.receipt_attachment)
            );
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
            const updated = await DirectusAdminClient.updateItem(
              'organization_modules',
              existingMods[0].id,
              {
                ...cleanPayload,
                organization_id: orgIdNum,
              }
            );
            return res.status(200).json({ data: updated });
          }
        }
      }

      const created = await DirectusAdminClient.createItem(collection, cleanPayload);

      // If a financial transaction, order, or expense is created, recalculate and persist account balances
      if (
        collection === 'treasury_transactions' ||
        collection === 'financial_accounts' ||
        collection === 'orders' ||
        collection === 'expenses'
      ) {
        syncAndPersistFinancialAccountBalances(orgIdNum).catch((err) =>
          console.warn('[API Proxy] Error syncing balances on create:', err?.message)
        );
      }

      if (collection === 'pos_shifts') {
        return res.status(201).json({
          data: {
            ...created,
            organization_id: orgIdNum,
            status: Array.isArray(created.status)
              ? created.status[0]
              : created.status || 'open',
          },
        });
      }
      return res.status(201).json({ data: created });
    } catch (error: any) {
      if (
        collection === 'organization_modules' &&
        (error.message?.includes('RECORD_NOT_UNIQUE') ||
          error.message?.includes('unique') ||
          error.message?.includes('slug'))
      ) {
        try {
          const targetSlug = payload?.slug || req.body?.slug;
          if (targetSlug) {
            const existing = await DirectusAdminClient.getItems('organization_modules', {
              filter: { slug: { _eq: targetSlug } },
              limit: 1,
            }).catch(() => []);
            if (existing && existing.length > 0) {
              const updated = await DirectusAdminClient.updateItem(
                'organization_modules',
                existing[0].id,
                {
                  ...payload,
                  organization_id: orgIdNum,
                }
              );
              console.log(
                `[API Proxy] Resiliently updated organization_modules #${existing[0].id} for slug ${targetSlug}`
              );
              return res.status(200).json({ data: updated });
            }
          }
        } catch (upsertErr: any) {
          console.error(
            '[API Proxy] Error in fallback upsert for organization_modules:',
            upsertErr?.message
          );
        }
      }
      console.error(`[API Proxy] Error creating in ${collection}:`, error.message);
      return res
        .status(500)
        .json({ error: error.message || `Failed to create item in ${collection}` });
    }
  }
);

// Update Item with tenant boundary validation
itemsRouter.patch(
  '/items/:collection/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { collection, id } = req.params;
    const { userId, organizationId, role } = req.user!;
    const orgIdNum = Number(organizationId);

    const permCheck = checkRolePermission(role, 'update', collection);
    if (!permCheck.allowed) {
      return res
        .status(403)
        .json({ error: permCheck.message || 'شما دسترسی لازم برای ویرایش این بخش را ندارید.' });
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
          return res
            .status(403)
            .json({ error: 'فقط مالک سازمان (Owner) مجاز به ویرایش مشخصات سازمان است.' });
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
        const orgUser = await DirectusAdminClient.getItemById(
          'organization_users',
          id,
          '*,user_id.*'
        );
        if (!orgUser) return res.status(404).json({ error: 'عضو سازمان یافت نشد.' });

        const existingOrgId =
          typeof orgUser.organization_id === 'object'
            ? orgUser.organization_id?.id
            : orgUser.organization_id;
        if (existingOrgId && Number(existingOrgId) !== orgIdNum) {
          return res
            .status(403)
            .json({ error: 'دسترسی غیرمجاز: امکان ویرایش داده‌های سازمان دیگر وجود ندارد.' });
        }

        const directusUserId =
          typeof orgUser.user_id === 'object' ? orgUser.user_id?.id : orgUser.user_id;
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
          updatePayload.warehouse_id = payload.warehouse_id
            ? Number(payload.warehouse_id)
            : null;
        }
        if (payload.financial_account_id !== undefined) {
          updatePayload.financial_account_id = payload.financial_account_id
            ? Number(payload.financial_account_id)
            : null;
        }
        if (payload.can_change_warehouse !== undefined) {
          updatePayload.can_change_warehouse = Boolean(payload.can_change_warehouse);
        }

        const updated = await DirectusAdminClient.updateItem(
          'organization_users',
          id,
          updatePayload
        );
        const rawWhId =
          updatePayload.warehouse_id !== undefined
            ? updatePayload.warehouse_id
            : typeof orgUser.warehouse_id === 'object'
            ? orgUser.warehouse_id?.id
            : orgUser.warehouse_id;
        const rawAccId =
          updatePayload.financial_account_id !== undefined
            ? updatePayload.financial_account_id
            : typeof orgUser.financial_account_id === 'object'
            ? orgUser.financial_account_id?.id
            : orgUser.financial_account_id;
        return res.json({
          data: {
            ...updated,
            first_name:
              payload.first_name ||
              (typeof orgUser.user_id === 'object' ? orgUser.user_id?.first_name : '') ||
              '',
            last_name:
              payload.last_name ||
              (typeof orgUser.user_id === 'object' ? orgUser.user_id?.last_name : '') ||
              '',
            email:
              payload.email ||
              (typeof orgUser.user_id === 'object' ? orgUser.user_id?.email : '') ||
              '',
            warehouse_id: rawWhId ? Number(rawWhId) : null,
            financial_account_id: rawAccId ? Number(rawAccId) : null,
            can_change_warehouse:
              updatePayload.can_change_warehouse !== undefined
                ? updatePayload.can_change_warehouse
                : orgUser.can_change_warehouse !== undefined
                ? Boolean(orgUser.can_change_warehouse)
                : true,
          },
        });
      }

      // 1. Verify existence and tenant ownership
      if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
        const existing = await DirectusAdminClient.getItemById(collection, id);
        if (!existing) {
          return res.status(404).json({ error: 'Item not found' });
        }
        const existingOrgId =
          typeof existing.organization_id === 'object'
            ? existing.organization_id?.id
            : existing.organization_id;
        if (existingOrgId && Number(existingOrgId) !== orgIdNum) {
          return res
            .status(403)
            .json({ error: 'دسترسی غیرمجاز: امکان ویرایش داده‌های سازمان دیگر وجود ندارد.' });
        }
      }

      const payload = { ...req.body };
      // Prevent tenant hijacking
      delete payload.organization_id;

      const cleanPayload = sanitizePayloadForDirectus(collection, payload);
      const updated = await DirectusAdminClient.updateItem(collection, id, cleanPayload);

      // If a financial transaction, order, or expense is updated, recalculate and persist account balances
      if (
        collection === 'treasury_transactions' ||
        collection === 'financial_accounts' ||
        collection === 'orders' ||
        collection === 'expenses'
      ) {
        syncAndPersistFinancialAccountBalances(orgIdNum).catch((err) =>
          console.warn('[API Proxy] Error syncing balances on update:', err?.message)
        );
      }

      if (collection === 'pos_shifts') {
        return res.json({
          data: {
            ...updated,
            organization_id: orgIdNum,
            status: Array.isArray(updated.status)
              ? updated.status[0]
              : updated.status || 'open',
          },
        });
      }
      return res.json({ data: updated });
    } catch (error: any) {
      return res
        .status(500)
        .json({ error: error.message || `Failed to update ${collection}/${id}` });
    }
  }
);

// Delete Item with tenant boundary validation
itemsRouter.delete(
  '/items/:collection/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { collection, id } = req.params;
    const { organizationId, role } = req.user!;
    const orgIdNum = Number(organizationId);

    const permCheck = checkRolePermission(role, 'delete', collection);
    if (!permCheck.allowed) {
      return res
        .status(403)
        .json({ error: permCheck.message || 'شما دسترسی لازم برای حذف این بخش را ندارید.' });
    }

    try {
      if (TENANT_SCOPED_COLLECTIONS.has(collection)) {
        const existing = await DirectusAdminClient.getItemById(collection, id);
        if (!existing) {
          return res.status(404).json({ error: 'Item not found' });
        }
        const existingOrgId =
          typeof existing.organization_id === 'object'
            ? existing.organization_id?.id
            : existing.organization_id;
        if (existingOrgId && Number(existingOrgId) !== orgIdNum) {
          return res
            .status(403)
            .json({ error: 'دسترسی غیرمجاز: امکان حذف داده‌های سازمان دیگر وجود ندارد.' });
        }
      }

      await DirectusAdminClient.deleteItem(collection, id);

      // If a financial transaction, order, or expense is deleted, recalculate and persist account balances
      if (
        collection === 'treasury_transactions' ||
        collection === 'financial_accounts' ||
        collection === 'orders' ||
        collection === 'expenses'
      ) {
        syncAndPersistFinancialAccountBalances(orgIdNum).catch((err) =>
          console.warn('[API Proxy] Error syncing balances on delete:', err?.message)
        );
      }

      return res.json({ success: true });
    } catch (error: any) {
      return res
        .status(500)
        .json({ error: error.message || `Failed to delete ${collection}/${id}` });
    }
  }
);

// Dedicated Recalculate and Audit Balances Endpoint
itemsRouter.post(
  '/accounting/recalculate-balances',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { organizationId } = req.user!;
    const orgIdNum = Number(organizationId);
    try {
      const syncedAccounts = await syncAndPersistFinancialAccountBalances(orgIdNum);
      return res.json({ success: true, data: syncedAccounts });
    } catch (error: any) {
      console.error('[API Proxy] Error recalculating balances:', error.message);
      return res.status(500).json({ error: error.message || 'خطا در محاسبه و ذخیره موجودی حساب‌ها' });
    }
  }
);
