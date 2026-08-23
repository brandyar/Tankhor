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

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: 'این ایمیل قبلاً در سیستم ثبت شده است. لطفاً وارد شوید.' });
    }

    // 2. Create User in Directus via Admin Client
    const userPayload: any = {
      email: email.toLowerCase().trim(),
      password: password,
      first_name: first_name || '',
      last_name: last_name || '',
      status: 'active',
    };

    let newUser: any;
    try {
      newUser = await DirectusAdminClient.request('/users', {
        method: 'POST',
        body: JSON.stringify(userPayload),
      });
    } catch (err: any) {
      console.error('[Auth Service] User creation error:', err);
      return res.status(500).json({ error: `خطا در ایجاد حساب کاربری: ${err.message}` });
    }

    const userId = newUser.id;

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
      email: userPayload.email,
      organizationId: newOrg.id,
      role: 'owner',
    });

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        email: userPayload.email,
        first_name: userPayload.first_name,
        last_name: userPayload.last_name,
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
      return res.status(401).json({ error: 'نام کاربری (ایمیل) یا کلمه عبور نادرست است.' });
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

    // 3. Fetch user's organizations from organization_users
    let orgMemberships = await DirectusAdminClient.getItems('organization_users', {
      filter: { user_id: { _eq: userId } },
      fields: ['id', 'role', 'status', 'organization_id.*'],
    }).catch(() => []);

    let activeOrg: any = null;
    let userRole = 'owner';

    if (orgMemberships.length === 0) {
      // Auto-create a default organization if none exists
      const orgName = userRecord.first_name ? `فروشگاه ${userRecord.first_name}` : 'فروشگاه من';
      const createdOrg = await DirectusAdminClient.createItem('organizations', {
        name: orgName,
        slug: `org-${Date.now().toString(36)}`,
        currency: 'TOMAN',
        timezone: 'Asia/Tehran',
        plan: 'free',
        status: 'active',
      });

      await DirectusAdminClient.createItem('organization_users', {
        organization_id: createdOrg.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
      });

      activeOrg = createdOrg;
      userRole = 'owner';
    } else {
      // Extract populated organization
      const firstMembership = orgMemberships[0];
      userRole = firstMembership.role || 'owner';
      activeOrg = typeof firstMembership.organization_id === 'object'
        ? firstMembership.organization_id
        : await DirectusAdminClient.getItemById('organizations', firstMembership.organization_id);
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
      organizations: orgMemberships.map((m: any) => m.organization_id).filter(Boolean),
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

    // Fetch organization details
    const activeOrg = await DirectusAdminClient.getItemById('organizations', organizationId).catch(() => null);

    // Fetch all user organizations
    const memberships = await DirectusAdminClient.getItems('organization_users', {
      filter: { user_id: { _eq: userId } },
      fields: ['id', 'role', 'status', 'organization_id.*'],
    }).catch(() => []);

    const organizations = memberships.map((m: any) => m.organization_id).filter(Boolean);

    return res.json({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar: user.avatar,
      title: user.title,
      status: user.status,
      role: req.user!.role,
      active_organization_id: organizationId,
      active_organization: activeOrg,
      organizations: organizations,
    });
  } catch (error: any) {
    console.error('[Auth /me Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در دریافت مشخصات کاربر' });
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

    // Verify user belongs to targetOrganizationId
    const memberships = await DirectusAdminClient.getItems('organization_users', {
      filter: {
        _and: [
          { user_id: { _eq: userId } },
          { organization_id: { _eq: targetOrganizationId } },
        ],
      },
      limit: 1,
    });

    if (memberships.length === 0) {
      return res.status(403).json({ error: 'شما به این سازمان دسترسی ندارید.' });
    }

    const membership = memberships[0];
    const role = membership.role || 'viewer';

    const newToken = generateToken({
      userId,
      email,
      organizationId: Number(targetOrganizationId),
      role,
    });

    const activeOrg = await DirectusAdminClient.getItemById('organizations', targetOrganizationId);

    return res.json({
      success: true,
      token: newToken,
      activeOrganization: activeOrg,
      role,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'خطا در تغییر سازمان' });
  }
});
