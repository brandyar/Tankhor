import { Router, Response } from 'express';
import multer from 'multer';
import { DirectusAdminClient } from '../directusAdmin';
import { requireAuth, AuthenticatedRequest, verifyToken } from '../auth';
import { DEFAULT_SYSTEM_MODULES } from '../../src/utils/license';

const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } }); // 15MB

export const publicRouter = Router();

// Public / Health Endpoints
publicRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'api-gateway-admin-proxy',
    directusUrl: DirectusAdminClient.getBaseUrl(),
    hasAdminToken: !!DirectusAdminClient.getAdminToken(),
    timestamp: new Date().toISOString(),
  });
});

// Public Project Settings (Desktop & Mobile Download Links from Directus project_settings collection)
publicRouter.get('/project-settings', async (req, res) => {
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
publicRouter.get('/system-modules', async (req, res) => {
  try {
    let items = await DirectusAdminClient.getItems('system_modules', req.query).catch(() => []);
    if (!items || items.length === 0) {
      items = DEFAULT_SYSTEM_MODULES;
    }
    return res.json({ data: items });
  } catch (error: any) {
    return res.json({ data: DEFAULT_SYSTEM_MODULES });
  }
});

// Endpoint for Desktop & Web module license validation & synchronization with Directus
publicRouter.all('/modules/sync-licenses', async (req: any, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let targetOrgId: number | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
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
    const org = await DirectusAdminClient.getItemById('organizations', targetOrgId).catch(
      () => null
    );
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

      const matchedSys = systemModules.find(
        (s: any) => s.slug === m.slug || s.id === m.module_id
      );

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
    return res
      .status(500)
      .json({ error: error.message || 'خطا در استعلام وضعیت لایسنس‌ها از سرور' });
  }
});

// File Upload Proxy
publicRouter.post(
  '/files',
  requireAuth,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
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
  }
);

// Assets Proxy (Directly stream uploaded images from Directus storage)
publicRouter.get('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send('Asset ID is required');
    }

    const queryString =
      Object.keys(req.query).length > 0
        ? `?${new URLSearchParams(req.query as any).toString()}`
        : '';
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

// Feedback Submission Endpoint (ثبت و ارسال بازخورد کاربران)
publicRouter.post('/feedback', async (req, res) => {
  try {
    const { subject, message, user_id } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'موضوع و متن پیام بازخورد الزامی است.' });
    }

    let resolvedUserId: string | null = user_id || null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = verifyToken(token);
      if (user && user.userId) {
        resolvedUserId = user.userId;
      }
    }

    const payload: any = {
      subject: String(subject).trim().slice(0, 255),
      message: String(message).trim(),
      status: 'unread',
    };

    if (resolvedUserId) {
      payload.user_id = resolvedUserId;
    }

    const created = await DirectusAdminClient.createItem('feedbacks', payload);
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    console.error('[proxy] /feedback error:', error?.message);
    return res.status(500).json({ error: error?.message || 'خطا در ثبت بازخورد' });
  }
});

// Public Online Catalog Endpoint (دریافت داده‌های ویترین و محصولات عمومی برند)
publicRouter.get('/public-catalog/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: 'شناسه برند یا نام فروشگاه الزامی است.' });
    }

    // 1. Fetch organization
    let orgs: any[] = [];
    try {
      orgs = await DirectusAdminClient.getItems('organizations', {
        filter: {
          _or: [{ slug: { _eq: slug } }, { id: { _eq: slug } }],
        },
        limit: 1,
      });
    } catch {
      // ignore
    }

    if (!orgs || orgs.length === 0) {
      return res.status(404).json({ error: 'فروشگاه یا برند مورد نظر یافت نشد.' });
    }

    const org = orgs[0];
    const orgId = org.id;

    // 2. Fetch published products & categories
    const [products, categories, templates, measurements, values, sizes] = await Promise.all([
      DirectusAdminClient.getItems('products', {
        filter: {
          organization_id: { _eq: orgId },
          status: { _neq: 'archived' },
        },
        limit: 100,
      }).catch(() => []),
      DirectusAdminClient.getItems('categories', {
        filter: { organization_id: { _eq: orgId } },
        limit: 100,
      }).catch(() => []),
      DirectusAdminClient.getItems('size_guide_templates', {
        filter: { organization_id: { _eq: orgId } },
        limit: 50,
      }).catch(() => []),
      DirectusAdminClient.getItems('size_guide_measurements', {
        filter: { organization_id: { _eq: orgId } },
        limit: 100,
      }).catch(() => []),
      DirectusAdminClient.getItems('size_guide_values', {
        filter: { organization_id: { _eq: orgId } },
        limit: 500,
      }).catch(() => []),
      DirectusAdminClient.getItems('sizes', {
        filter: { organization_id: { _eq: orgId } },
        limit: 100,
      }).catch(() => []),
    ]);

    return res.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        phone: org.phone,
        logo: org.logo,
        settings: org.settings || {},
      },
      products,
      categories,
      sizeGuides: {
        templates,
        measurements,
        values,
        sizes,
      },
    });
  } catch (error: any) {
    console.error('[proxy] /public-catalog error:', error?.message);
    return res.status(500).json({ error: error?.message || 'خطا در بارگذاری کاتالوگ' });
  }
});

// Public Catalog Customer Inquiry Submission
publicRouter.post('/public-catalog/inquiry', async (req, res) => {
  try {
    const { organization_id, product_id, product_title, size_name, customer_name, customer_phone, note } = req.body;
    if (!customer_phone) {
      return res.status(400).json({ error: 'شماره تماس مشتری الزامی است.' });
    }

    // Try creating a feedback or direct customer inquiry entry
    try {
      await DirectusAdminClient.createItem('feedbacks', {
        subject: `استعلام خرید کاتالوگ: ${product_title || 'کالا'} (${size_name || 'سایز نامشخص'})`,
        message: `مشتری: ${customer_name || 'نامشخص'}\nتلفن: ${customer_phone}\nتوضیحات: ${note || '-'}\nکد کالا: ${product_id || '-'}`,
        status: 'unread',
      });
    } catch {
      // non-blocking
    }

    return res.status(201).json({ success: true, message: 'درخواست خرید با موفقیت ثبت شد.' });
  } catch (error: any) {
    console.error('[proxy] /public-catalog/inquiry error:', error?.message);
    return res.status(500).json({ error: error?.message || 'خطا در ثبت درخواست' });
  }
});
