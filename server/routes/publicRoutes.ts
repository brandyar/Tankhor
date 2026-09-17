import { Router, Response } from 'express';
import multer from 'multer';
import { DirectusAdminClient } from '../directusAdmin';
import { requireAuth, AuthenticatedRequest, verifyToken } from '../auth';

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
    const items = await DirectusAdminClient.getItems('system_modules', req.query).catch(() => []);
    return res.json({ data: items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch system modules' });
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
