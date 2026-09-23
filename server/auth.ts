import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DirectusAdminClient } from './directusAdmin';

const JWT_SECRET = process.env.JWT_SECRET || 'tankhor_jwt_secret_dev_key_2026';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  organizationId: number;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing or invalid Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  req.user = payload;
  next();
}

/**
 * Securely resolve all full Organization objects that a user belongs to.
 * Strictly checks organization_users memberships and prevents tenant leakage.
 */
// In-memory fallback cache for user organizations to survive transient Directus under-pressure spikes
const userOrgsCache = new Map<string, { activeOrganization: any; organizations: any[]; timestamp: number }>();

export async function getUserOrganizations(userId: string, targetActiveOrgId?: number, userEmail?: string): Promise<{ activeOrganization: any; organizations: any[] }> {
  try {
    // 1. Fetch memberships from organization_users strictly for this userId / email
    let memberships: any[] = [];
    try {
      const filters: any[] = [
        { user_id: { _eq: userId } },
        { user_id: { id: { _eq: userId } } },
      ];
      if (userEmail) {
        filters.push({ user_id: { email: { _eq: userEmail.toLowerCase().trim() } } });
      }

      memberships = await DirectusAdminClient.getItems('organization_users', {
        filter: {
          _or: filters,
        },
        fields: ['id', 'role', 'status', 'organization_id.*', 'organization_id', 'warehouse_id', 'financial_account_id', 'can_change_warehouse', 'user_id.id', 'user_id.email'],
      });
    } catch (err: any) {
      console.warn('[getUserOrganizations] First membership fetch attempt failed:', err.message);
      try {
        memberships = await DirectusAdminClient.getItems('organization_users', {
          filter: { user_id: { _eq: userId } },
          fields: ['id', 'role', 'status', 'organization_id.*', 'organization_id', 'warehouse_id', 'financial_account_id', 'can_change_warehouse'],
        });
      } catch (err2: any) {
        console.warn('[getUserOrganizations] Second membership fetch attempt failed:', err2.message);
        memberships = [];
      }
    }

    const orgList: any[] = [];
    const orgIdsToFetch = new Set<number>();

    for (const m of memberships) {
      const rawWh = typeof m.warehouse_id === 'object' && m.warehouse_id ? m.warehouse_id.id : m.warehouse_id;
      const rawAcc = typeof m.financial_account_id === 'object' && m.financial_account_id ? m.financial_account_id.id : m.financial_account_id;
      if (typeof m.organization_id === 'object' && m.organization_id && m.organization_id.id && m.organization_id.name) {
        orgList.push({
          ...m.organization_id,
          user_role: m.role || 'viewer',
          user_warehouse_id: rawWh ? Number(rawWh) : null,
          user_financial_account_id: rawAcc ? Number(rawAcc) : null,
          user_can_change_warehouse: m.can_change_warehouse !== undefined && m.can_change_warehouse !== null ? Boolean(m.can_change_warehouse) : true,
        });
      } else if (m.organization_id) {
        const idNum = Number(typeof m.organization_id === 'object' ? m.organization_id.id : m.organization_id);
        if (idNum && !isNaN(idNum) && idNum > 0) {
          orgIdsToFetch.add(idNum);
        }
      }
    }

    // 2. Fetch full organization objects ONLY for verified memberships
    for (const orgId of Array.from(orgIdsToFetch)) {
      if (!orgList.some((o) => Number(o.id) === Number(orgId))) {
        try {
          const org = await DirectusAdminClient.getItemById('organizations', orgId);
          if (org && org.id && org.name) {
            const matchingMembership = memberships.find(
              (m: any) => Number(typeof m.organization_id === 'object' ? m.organization_id?.id : m.organization_id) === Number(orgId)
            );
            const rawWh = matchingMembership && typeof matchingMembership.warehouse_id === 'object' && matchingMembership.warehouse_id ? matchingMembership.warehouse_id.id : matchingMembership?.warehouse_id;
            const rawAcc = matchingMembership && typeof matchingMembership.financial_account_id === 'object' && matchingMembership.financial_account_id ? matchingMembership.financial_account_id.id : matchingMembership?.financial_account_id;
            orgList.push({
              ...org,
              user_role: matchingMembership?.role || 'viewer',
              user_warehouse_id: rawWh ? Number(rawWh) : null,
              user_financial_account_id: rawAcc ? Number(rawAcc) : null,
              user_can_change_warehouse: matchingMembership?.can_change_warehouse !== undefined && matchingMembership?.can_change_warehouse !== null ? Boolean(matchingMembership.can_change_warehouse) : true,
            });
          }
        } catch (fetchErr: any) {
          console.warn(`[getUserOrganizations] Could not load organization #${orgId}:`, fetchErr.message);
        }
      }
    }

    // 3. Deduplicate organizations by ID
    const uniqueOrgs: any[] = [];
    const seenIds = new Set<number>();
    for (const org of orgList) {
      const idNum = Number(org.id);
      if (idNum && !seenIds.has(idNum)) {
        seenIds.add(idNum);
        uniqueOrgs.push(org);
      }
    }

    // 4. Return list of verified user organizations (no silent auto-provisioning on query)
    let activeOrg: any = null;
    if (targetActiveOrgId) {
      activeOrg = uniqueOrgs.find((o) => Number(o.id) === Number(targetActiveOrgId)) || null;
    }
    if (!activeOrg && uniqueOrgs.length > 0) {
      activeOrg = uniqueOrgs[0];
    }

    if (uniqueOrgs.length > 0) {
      const result = { activeOrganization: activeOrg, organizations: uniqueOrgs };
      userOrgsCache.set(userId, { ...result, timestamp: Date.now() });
      return result;
    }

    // If Directus returned empty due to momentary pressure or network glitch, check cache
    const cached = userOrgsCache.get(userId);
    if (cached && cached.organizations.length > 0) {
      console.warn(`[getUserOrganizations] Directus returned no organizations for user ${userId}, serving from cache.`);
      let fallbackActive = cached.activeOrganization;
      if (targetActiveOrgId) {
        fallbackActive = cached.organizations.find((o) => Number(o.id) === Number(targetActiveOrgId)) || fallbackActive;
      }
      return { activeOrganization: fallbackActive, organizations: cached.organizations };
    }

    return {
      activeOrganization: activeOrg,
      organizations: uniqueOrgs,
    };
  } catch (error: any) {
    console.error('[getUserOrganizations Error]:', error);
    const cached = userOrgsCache.get(userId);
    if (cached && cached.organizations.length > 0) {
      console.warn(`[getUserOrganizations] Directus error for user ${userId}, serving from cache.`);
      return { activeOrganization: cached.activeOrganization, organizations: cached.organizations };
    }
    return { activeOrganization: null, organizations: [] };
  }
}

export const authRouter = Router();

// Register new user + provision custom Organization + initial warehouse/category
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    let body: any = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body || {};

    const email = (body.email || body.username || body.userEmail || body.Email || '').toString().trim();
    const password = (body.password || body.pass || body.Password || '').toString();
    const first_name = (body.first_name || body.firstName || '').toString().trim();
    const last_name = (body.last_name || body.lastName || '').toString().trim();
    const user_phone = (body.user_phone || body.userPhone || body.phone || '').toString().trim();
    const org_name = (body.org_name || body.orgName || '').toString().trim();
    const org_slug = (body.org_slug || body.orgSlug || '').toString().trim();
    const currency = (body.currency || 'TOMAN').toString().trim();
    const initial_category_name = (body.initial_category_name || body.initialCategoryName || '').toString().trim();
    const initial_warehouse_name = (body.initial_warehouse_name || body.initialWarehouseName || '').toString().trim();

    if (!email || !password) {
      console.warn('[Auth Register Warning] Missing email or password:', { hasEmail: !!email, hasPassword: !!password, bodyKeys: Object.keys(body) });
      return res.status(400).json({ error: 'وارد کردن آدرس ایمیل و کلمه عبور الزامی است.' });
    }

    // 1. Check if user already exists in Directus
    const existingUsers = await DirectusAdminClient.getItems('directus_users', {
      filter: { email: { _eq: email.toLowerCase().trim() } },
      limit: 1,
    }).catch(() => []);

    let userId: string;
    let userEmail = email.toLowerCase().trim();
    let userFirstName = first_name || '';
    let userLastName = last_name || '';

    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      const orgsData = await getUserOrganizations(existingUser.id, undefined, userEmail);
      if (orgsData.organizations.length > 0) {
        return res.status(400).json({ error: 'این ایمیل قبلاً در سیستم ثبت شده و دارای فروشگاه است. لطفاً وارد شوید.' });
      }
      userId = existingUser.id;
      userFirstName = existingUser.first_name || userFirstName;
      userLastName = existingUser.last_name || userLastName;
      // Update password & phone if provided
      const userUpdatePayload: any = {};
      if (password) userUpdatePayload.password = password;
      if (user_phone) userUpdatePayload.user_phone = user_phone;
      if (Object.keys(userUpdatePayload).length > 0) {
        await DirectusAdminClient.request(`/users/${userId}`, {
          method: 'PATCH',
          body: JSON.stringify(userUpdatePayload),
        }).catch(() => {});
      }
    } else {
      // 2. Create User in Directus via Admin Client with tenant role
      const userRoleId = DirectusAdminClient.getUserRoleId();
      const userPayload: any = {
        email: userEmail,
        password: password,
        first_name: userFirstName,
        last_name: userLastName,
        user_phone: user_phone,
        status: 'active',
        role: userRoleId,
      };

      let newUser: any;
      try {
        newUser = await DirectusAdminClient.request('/users', {
          method: 'POST',
          body: JSON.stringify(userPayload),
        });
      } catch (err: any) {
        console.error('[Auth Service] User creation error:', err.message);
        const errMsg = err?.message || '';

        if (
          errMsg.includes('RECORD_NOT_UNIQUE') ||
          errMsg.toLowerCase().includes('unique') ||
          errMsg.toLowerCase().includes('already exists')
        ) {
          return res.status(400).json({ error: 'این ایمیل قبلاً در دایرکتوس ثبت شده است. لطفاً وارد شوید.' });
        }

        if (errMsg.includes('INVALID_CREDENTIALS') || errMsg.includes('Invalid user credentials')) {
          return res.status(500).json({
            error: 'خطای احراز هویت توکن ادمین دایرکتوس (Directus Admin Token). لطفاً متغیر DIRECTUS_ADMIN_TOKEN را در تنظیمات Secrets بررسی نمایید.',
          });
        }

        return res.status(500).json({ error: `خطا در ایجاد حساب کاربری در سرور: ${errMsg}` });
      }

      userId = newUser.id;
    }

    // 3. Create the Organization specified by the user
    const generatedSlug = (org_slug && org_slug.trim())
      ? org_slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-')
      : `org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

    const finalOrgName = (org_name && org_name.trim())
      ? org_name.trim()
      : (first_name ? `فروشگاه ${first_name} ${last_name || ''}`.trim() : 'فروشگاه من');

    const newOrg = await DirectusAdminClient.createItem('organizations', {
      name: finalOrgName,
      slug: generatedSlug,
      currency: currency || 'TOMAN',
      timezone: 'Asia/Tehran',
      plan: 'free',
      status: 'active',
    });

    // 4. Create membership in organization_users (role: owner)
    await DirectusAdminClient.createItem('organization_users', {
      organization_id: newOrg.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
      date_joined: new Date().toISOString(),
    });

    // 5. Create initial starter items for the new organization
    try {
      // 5a. Initial Category
      const categoryTitle = (initial_category_name && initial_category_name.trim())
        ? initial_category_name.trim()
        : 'پوشاک عمومی';
      await DirectusAdminClient.createItem('categories', {
        organization_id: newOrg.id,
        name: categoryTitle,
        slug: `cat-${Date.now().toString(36)}`,
        status: 'active',
      }).catch((e) => console.warn('Could not seed initial category:', e.message));

      // 5b. Initial Warehouse
      const warehouseTitle = (initial_warehouse_name && initial_warehouse_name.trim())
        ? initial_warehouse_name.trim()
        : 'انبار مرکزی';
      await DirectusAdminClient.createItem('warehouses', {
        organization_id: newOrg.id,
        name: warehouseTitle,
        code: 'WH-MAIN',
        is_default: true,
        status: 'active',
      }).catch((e) => console.warn('Could not seed initial warehouse:', e.message));
    } catch (seedErr: any) {
      console.warn('[Auth Register] Starter seeding warning:', seedErr.message);
    }

    // 6. Generate Auth JWT token
    const token = generateToken({
      userId: userId,
      email: userEmail,
      organizationId: newOrg.id,
      role: 'owner',
    });

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        email: userEmail,
        first_name: userFirstName,
        last_name: userLastName,
        user_phone: user_phone,
        role: 'owner',
      },
      organization: newOrg,
    });
  } catch (error: any) {
    console.error('[Auth Register Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در ثبت نام' });
  }
});

// Login with email & password
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    let body: any = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body || {};

    const email = (body.email || body.username || body.userEmail || '').toString().trim();
    const password = (body.password || body.pass || '').toString();

    if (!email || !password) {
      return res.status(400).json({ error: 'وارد کردن ایمیل و رمز عبور الزامی است.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Authenticate credentials with Directus Auth endpoint
    let directusAuthRes: any;
    try {
      directusAuthRes = await DirectusAdminClient.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          password: password,
          mode: 'json',
        }),
      });
    } catch (err: any) {
      console.warn(`[Auth Login] Directus auth error for ${cleanEmail}:`, err.message);
      return res.status(401).json({ error: err.message || 'نام کاربری (ایمیل) یا کلمه عبور نادرست است.' });
    }

    // 2. Fetch full user info using access_token or Admin Client
    let userRecord: any;
    if (directusAuthRes?.access_token) {
      try {
        userRecord = await DirectusAdminClient.request('/users/me', {
          headers: {
            Authorization: `Bearer ${directusAuthRes.access_token}`,
          },
        });
      } catch {
        // Fallback to query
      }
    }

    if (!userRecord) {
      try {
        const users = await DirectusAdminClient.getItems('directus_users', {
          filter: { email: { _eq: cleanEmail } },
          limit: 1,
        });
        userRecord = users?.[0];
      } catch (err: any) {
        console.warn('[Auth Login] User lookup error:', err.message);
      }
    }

    if (!userRecord) {
      return res.status(404).json({ error: 'اطلاعات کاربری یافت نشد.' });
    }

    const userId = userRecord.id;

    // 3. Fetch user's organizations and active org
    const orgsData = await getUserOrganizations(userId, undefined, cleanEmail);
    let activeOrg = orgsData.activeOrganization;
    let userRole = activeOrg?.user_role || 'viewer';

    if (!activeOrg || orgsData.organizations.length === 0) {
      return res.status(403).json({
        error: 'برای این حساب کاربری هیچ فروشگاه یا سازمانی ثبت نشده است. لطفاً ابتدا از بخش ثبت‌نام، فروشگاه خود را ایجاد کنید.',
      });
    }

    // 4. Generate user JWT
    const token = generateToken({
      userId: userId,
      email: cleanEmail,
      organizationId: activeOrg.id,
      role: userRole,
    });

    const userProfile = {
      id: userId,
      email: userRecord.email,
      first_name: userRecord.first_name,
      last_name: userRecord.last_name,
      avatar: userRecord.avatar,
      title: userRecord.title,
      status: userRecord.status,
      role: userRole,
    };

    return res.json({
      success: true,
      token,
      user: userProfile,
      activeOrganization: activeOrg,
      organizations: orgsData.organizations,
    });
  } catch (error: any) {
    console.error('[Auth Login Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در ورود به سیستم' });
  }
});

// Current User Profile & Organization info
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, organizationId } = req.user!;

    // Fetch user details
    const user = await DirectusAdminClient.request(`/users/${userId}`).catch(() => null);
    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد.' });
    }

    // Fetch full organization details and all memberships
    const { activeOrganization, organizations } = await getUserOrganizations(userId, organizationId, user.email);
    const userRole = activeOrganization?.user_role || req.user?.role || 'viewer';

    return res.json({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar: user.avatar,
      title: user.title,
      status: user.status,
      role: userRole,
      user_role: userRole,
      active_organization_id: activeOrganization?.id || organizationId,
      active_organization: activeOrganization,
      activeOrganization: activeOrganization,
      organizations: organizations,
    });
  } catch (error: any) {
    console.error('[Auth /me Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در دریافت مشخصات کاربر' });
  }
});

// Update Current User Profile & Password directly in Directus
authRouter.patch('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.user!;
    const { first_name, last_name, title, avatar, password, current_password } = req.body;

    // 1. Fetch current user from Directus
    const currentUser = await DirectusAdminClient.request(`/users/${userId}`).catch(() => null);
    if (!currentUser) {
      return res.status(404).json({ error: 'کاربر در دایرکتوس یافت نشد.' });
    }

    const updatePayload: Record<string, any> = {};
    if (first_name !== undefined) updatePayload.first_name = String(first_name).trim();
    if (last_name !== undefined) updatePayload.last_name = String(last_name).trim();
    if (title !== undefined) updatePayload.title = String(title).trim();
    if (avatar !== undefined) updatePayload.avatar = avatar;

    // 2. If password change is requested
    if (password && typeof password === 'string' && password.trim().length > 0) {
      const cleanPass = password.trim();
      if (cleanPass.length < 6) {
        return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
      }

      // If current password provided, verify against Directus login
      if (current_password) {
        try {
          const directusBaseUrl = DirectusAdminClient.getBaseUrl();
          const verifyRes = await fetch(`${directusBaseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: currentUser.email,
              password: current_password,
              mode: 'json',
            }),
          });
          if (!verifyRes.ok) {
            return res.status(400).json({ error: 'رمز عبور فعلی وارد شده نادرست است.' });
          }
        } catch (authErr: any) {
          console.warn('[Auth PATCH /me] Password check warning:', authErr?.message);
        }
      }

      updatePayload.password = cleanPass;
    }

    // 3. Save updates into Directus
    const updatedUser = await DirectusAdminClient.request(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updatePayload),
    });

    const finalUser = updatedUser?.data || updatedUser || currentUser;

    return res.json({
      success: true,
      message: 'مشخصات کاربر با موفقیت در دایرکتوس بروزرسانی شد.',
      user: {
        id: finalUser.id || userId,
        email: finalUser.email || currentUser.email,
        first_name: finalUser.first_name ?? updatePayload.first_name ?? currentUser.first_name,
        last_name: finalUser.last_name ?? updatePayload.last_name ?? currentUser.last_name,
        avatar: finalUser.avatar ?? updatePayload.avatar ?? currentUser.avatar,
        title: finalUser.title ?? updatePayload.title ?? currentUser.title,
      },
    });
  } catch (error: any) {
    console.error('[Auth PATCH /me Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در بروزرسانی مشخصات کاربر' });
  }
});

// Switch active organization
authRouter.post('/switch-org', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetOrganizationId } = req.body;
    const { userId, email } = req.user!;

    if (!targetOrganizationId) {
      return res.status(400).json({ error: 'targetOrganizationId is required' });
    }

    const { activeOrganization, organizations } = await getUserOrganizations(userId, Number(targetOrganizationId), email);

    if (!activeOrganization || Number(activeOrganization.id) !== Number(targetOrganizationId)) {
      return res.status(403).json({ error: 'شما به این سازمان دسترسی ندارید.' });
    }

    const role = activeOrganization.user_role || 'viewer';

    const newToken = generateToken({
      userId,
      email,
      organizationId: Number(activeOrganization.id),
      role,
    });

    return res.json({
      success: true,
      token: newToken,
      activeOrganization,
      organizations,
      role,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'خطا در تغییر سازمان' });
  }
});

// Check live organization plan status directly from Directus with trial support & auto-downgrade
authRouter.get('/check-plan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, organizationId, email } = req.user!;
    const orgIdNum = Number(req.query.organization_id || organizationId);
    if (!orgIdNum || isNaN(orgIdNum) || orgIdNum <= 0) {
      return res.status(400).json({ error: 'سازمان فعالی مشخص نشده است.' });
    }

    // Always fetch fresh organization directly from Directus Admin
    const org: any = await DirectusAdminClient.getItemById('organizations', orgIdNum);
    if (!org) {
      return res.status(404).json({ error: 'سازمان یافت نشد.' });
    }

    const now = new Date();
    let currentPlan = org.plan || 'free';
    let isTrial = false;
    let trialDaysRemaining = 0;
    let trialExpired = false;

    // 1. Check if organization has any active paid subscription
    const existingSubs: any[] = await DirectusAdminClient.getItems('subscriptions', {
      filter: { organization_id: { _eq: orgIdNum } },
      sort: '-end_date',
      limit: 10,
    }).catch(() => []);

    const activePaidSub = existingSubs.find((s: any) => {
      if (!s.end_date) return false;
      const notTrial = !String(s.Transaction_id || '').startsWith('TRIAL-');
      return notTrial && new Date(s.end_date) > now;
    });

    // 2. Check trial status
    if (org.trial_ends_at) {
      const trialEnd = new Date(org.trial_ends_at);
      if (trialEnd > now) {
        isTrial = true;
        trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      } else {
        trialExpired = true;
      }
    }

    // 3. Auto-downgrade logic:
    // If organization plan is 'pro' but has NO active paid subscription and trial is expired (or has used trial and not active)
    if (currentPlan === 'pro' && !activePaidSub) {
      if (trialExpired || (org.has_used_trial && !isTrial)) {
        console.log(`[check-plan] Organization #${orgIdNum} trial has expired. Reverting plan to 'free'`);
        await DirectusAdminClient.updateItem('organizations', orgIdNum, {
          plan: 'free',
          date_updated: now.toISOString(),
        }).catch((err) => console.error('[check-plan] Failed to update org plan to free:', err));
        currentPlan = 'free';
        org.plan = 'free';
      }
    }

    const isPro = currentPlan === 'pro';
    const { activeOrganization, organizations } = await getUserOrganizations(userId, orgIdNum, email);

    return res.json({
      success: true,
      organizationId: orgIdNum,
      plan: currentPlan,
      isPro,
      isTrial: isPro && isTrial,
      trialDaysRemaining,
      trialEndsAt: org.trial_ends_at || null,
      hasUsedTrial: Boolean(org.has_used_trial),
      trialExpired,
      organization: org,
      activeOrganization: activeOrganization || org,
      organizations,
    });
  } catch (error: any) {
    console.error('[Auth /check-plan Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در بررسی وضعیت اشتراک از سرور' });
  }
});

// Activate 14-day free trial for Pro plan
authRouter.post('/start-trial', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, organizationId, email } = req.user!;
    const orgIdNum = Number(req.body?.organization_id || req.body?.organizationId || organizationId);

    if (!orgIdNum || isNaN(orgIdNum) || orgIdNum <= 0) {
      return res.status(400).json({ error: 'شناسه سازمان مشخص نشده است.' });
    }

    // Verify user membership in organization
    const orgMembers = await DirectusAdminClient.getItems('organization_users', {
      filter: {
        organization_id: { _eq: orgIdNum },
        user_id: { _eq: userId },
        status: { _eq: 'active' },
      },
    });

    if (!orgMembers || orgMembers.length === 0) {
      return res.status(403).json({ error: 'شما به این سازمان دسترسی ندارید.' });
    }

    // Fetch fresh organization
    const org: any = await DirectusAdminClient.getItemById('organizations', orgIdNum);
    if (!org) {
      return res.status(404).json({ error: 'سازمان یافت نشد.' });
    }

    // Check if organization has already used its trial
    if (org.has_used_trial) {
      return res.status(400).json({
        error: 'این سازمان قبلاً از مهلت ۱۴ روزه تست رایگان استفاده کرده است.',
        has_used_trial: true,
      });
    }

    const now = new Date();
    const trialDays = 14;
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    // 1. Update organization in Directus
    await DirectusAdminClient.updateItem('organizations', orgIdNum, {
      plan: 'pro',
      has_used_trial: true,
      trial_ends_at: trialEndsAt.toISOString(),
      date_updated: now.toISOString(),
    });

    // 2. Create entry in subscriptions collection
    let createdSub: any = null;
    try {
      createdSub = await DirectusAdminClient.createItem('subscriptions', {
        organization_id: orgIdNum,
        start_date: now.toISOString(),
        end_date: trialEndsAt.toISOString(),
        transaction_amount: '0 تومان (تست ۱۴ روزه رایگان)',
        Transaction_id: `TRIAL-14D-${orgIdNum}-${Date.now().toString(36).toUpperCase()}`,
        user_created: userId || undefined,
        date_created: now.toISOString(),
      });
    } catch (subErr: any) {
      console.warn('[start-trial] Could not insert subscriptions record:', subErr?.message);
    }

    const updatedOrg: any = await DirectusAdminClient.getItemById('organizations', orgIdNum);
    const { activeOrganization, organizations } = await getUserOrganizations(userId, orgIdNum, email);

    console.log(`[start-trial] 14-day free trial activated for org #${orgIdNum} (${updatedOrg?.name}) by user ${email || userId}`);

    return res.json({
      success: true,
      message: 'مهلت تست ۱۴ روزه رایگان پلن حرفه‌ای (Pro) با موفقیت فعال شد!',
      plan: 'pro',
      isPro: true,
      isTrial: true,
      trialDaysRemaining: 14,
      trialEndsAt: trialEndsAt.toISOString(),
      organization: updatedOrg,
      activeOrganization: activeOrganization || updatedOrg,
      organizations,
      subscription: createdSub,
    });
  } catch (error: any) {
    console.error('[Auth /start-trial Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در فعال‌سازی تست رایگان' });
  }
});

// Create new organization and assign current user as owner
authRouter.post('/create-org', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, slug, currency, timezone, plan } = req.body;
    const { userId, email } = req.user!;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'وارد کردن نام سازمان الزامی است.' });
    }

    const orgName = String(name).trim();
    const orgSlug = slug && String(slug).trim()
      ? String(slug).trim().toLowerCase().replace(/\s+/g, '-')
      : `org-${Date.now().toString(36)}`;
    const orgCurrency = currency || 'TOMAN';
    const orgTimezone = timezone || 'Asia/Tehran';
    const orgPlan = plan || 'free';

    // 1. Create Organization in Directus
    const newOrg = await DirectusAdminClient.createItem('organizations', {
      name: orgName,
      slug: orgSlug,
      currency: orgCurrency,
      timezone: orgTimezone,
      plan: orgPlan,
      status: 'active',
    });

    // 2. Create organization_users membership as owner
    await DirectusAdminClient.createItem('organization_users', {
      organization_id: newOrg.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
    });

    // 3. Create default warehouse for this organization
    try {
      await DirectusAdminClient.createItem('warehouses', {
        organization_id: newOrg.id,
        name: 'انبار مرکزی',
        code: 'WH-CENTRAL',
        status: 'active',
        is_default: true,
      });
    } catch (e: any) {
      console.warn('[Create Org] Default warehouse auto-creation skipped:', e.message);
    }

    // 4. Generate new JWT token scoped to this new organization with owner role
    const newToken = generateToken({
      userId,
      email,
      organizationId: newOrg.id,
      role: 'owner',
    });

    const { organizations } = await getUserOrganizations(userId, newOrg.id);

    return res.status(201).json({
      success: true,
      token: newToken,
      organization: newOrg,
      activeOrganization: newOrg,
      organizations: organizations.length > 0 ? organizations : [newOrg],
      role: 'owner',
    });
  } catch (error: any) {
    console.error('[Auth /create-org Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در ایجاد سازمان جدید' });
  }
});
