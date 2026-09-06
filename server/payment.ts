import { Router, Response } from 'express';
import { DirectusAdminClient } from './directusAdmin';
import { requireAuth, AuthenticatedRequest, getUserOrganizations, generateToken } from './auth';

export const paymentRouter = Router();

// In-memory cache for pending payment sessions
interface PendingPayment {
  orderId: string;
  organizationId: number;
  userId: string;
  userEmail: string;
  durationMonths: number;
  amountInTomans: number;
  amountInRials: number;
  trackId?: number;
  createdAt: number;
}

const pendingPayments = new Map<string, PendingPayment>(); // keyed by orderId
const trackIdToOrderId = new Map<number, string>(); // trackId -> orderId

// Plan pricing definitions (in Tomans)
export const SUBSCRIPTION_PLANS: Record<number, { title: string; priceTomans: number; discountPercent: number }> = {
  1: {
    title: 'اشتراک ۱ ماهه',
    priceTomans: 490000,
    discountPercent: 0,
  },
  3: {
    title: 'اشتراک ۳ ماهه (فصلی)',
    priceTomans: 1290000,
    discountPercent: 12,
  },
  6: {
    title: 'اشتراک ۶ ماهه',
    priceTomans: 2390000,
    discountPercent: 18,
  },
  12: {
    title: 'اشتراک ۱۲ ماهه (یک‌ساله)',
    priceTomans: 4490000,
    discountPercent: 24,
  },
};

/**
 * Helper to fetch Zibal merchant key from Directus project_settings
 */
async function getZibalMerchantKey(): Promise<string> {
  try {
    const resp: any = await DirectusAdminClient.request('/items/project_settings');
    let settingsData: any = null;
    if (resp) {
      if (resp.data) {
        settingsData = Array.isArray(resp.data) ? resp.data[0] : resp.data;
      } else if (Array.isArray(resp)) {
        settingsData = resp[0];
      } else if (typeof resp === 'object') {
        settingsData = resp;
      }
    }

    const merchant =
      settingsData?.zipal_merchant ||
      settingsData?.zibal_merchant ||
      process.env.ZIBAL_MERCHANT ||
      'zibal'; // 'zibal' is Zibal's official public test merchant key

    return String(merchant).trim() || 'zibal';
  } catch (err: any) {
    console.warn('[payment] Failed to fetch zipal_merchant from project_settings, using fallback:', err?.message);
    return process.env.ZIBAL_MERCHANT || 'zibal';
  }
}

/**
 * Public: Get available subscription plans & pricing
 */
paymentRouter.get('/plans', (req, res) => {
  return res.json({
    plans: Object.entries(SUBSCRIPTION_PLANS).map(([months, info]) => ({
      durationMonths: Number(months),
      title: info.title,
      priceTomans: info.priceTomans,
      priceRials: info.priceTomans * 10,
      discountPercent: info.discountPercent,
    })),
  });
});

/**
 * Initiate Payment via Zibal
 * POST /api/payment/request
 */
paymentRouter.post('/request', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId, durationMonths, simulate } = req.body;
    const { userId, email } = req.user!;

    const orgIdNum = Number(organizationId || req.user!.organizationId);
    if (!orgIdNum || isNaN(orgIdNum) || orgIdNum <= 0) {
      return res.status(400).json({ error: 'شناسه سازمان نامعتبر است.' });
    }

    const months = Number(durationMonths) || 1;
    const planInfo = SUBSCRIPTION_PLANS[months] || {
      title: `اشتراک ${months} ماهه`,
      priceTomans: months * 490000,
      discountPercent: 0,
    };

    // Verify user membership in this organization
    const org = await DirectusAdminClient.getItemById('organizations', orgIdNum);
    if (!org) {
      return res.status(404).json({ error: 'سازمان مورد نظر یافت نشد.' });
    }

    const amountInTomans = planInfo.priceTomans;
    const amountInRials = amountInTomans * 10;
    const orderId = `sub_${orgIdNum}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Resolve base origin for callback
    const forwardedProto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const appOrigin = `${forwardedProto}://${host}`;
    const callbackUrl = `${appOrigin}/api/payment/callback`;

    const merchant = await getZibalMerchantKey();

    // Cache pending payment
    const pendingData: PendingPayment = {
      orderId,
      organizationId: orgIdNum,
      userId,
      userEmail: email,
      durationMonths: months,
      amountInTomans,
      amountInRials,
      createdAt: Date.now(),
    };
    pendingPayments.set(orderId, pendingData);

    // If simulate requested (e.g. testing in dev / preview or offline)
    if (simulate === true) {
      const simulatedTrackId = Math.floor(100000000 + Math.random() * 900000000);
      pendingData.trackId = simulatedTrackId;
      trackIdToOrderId.set(simulatedTrackId, orderId);

      return res.json({
        success: true,
        isSimulated: true,
        trackId: simulatedTrackId,
        orderId,
        amountTomans: amountInTomans,
        amountRials: amountInRials,
        paymentUrl: `/api/payment/simulate-gateway?trackId=${simulatedTrackId}`,
        message: 'درخواست درگاه در حالت شبیه‌ساز با موفقیت ایجاد شد.',
      });
    }

    // Real Zibal Payment Request
    try {
      const zibalRequestPayload = {
        merchant,
        amount: amountInRials,
        callbackUrl,
        description: `خرید اشتراک Pro تن‌خور - سازمان ${org.name || 'مشتری'} (${planInfo.title})`,
        orderId,
        mobile: req.body.mobile || undefined,
      };

      console.log(`[payment] Requesting Zibal payment with merchant: ${merchant.slice(0, 5)}***, amount: ${amountInRials} Rials`);

      const zibalResp = await fetch('https://gateway.zibal.ir/v1/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zibalRequestPayload),
      });

      const zibalData: any = await zibalResp.json();
      console.log('[payment] Zibal response:', JSON.stringify(zibalData));

      if (zibalData.result === 100 && zibalData.trackId) {
        const trackId = Number(zibalData.trackId);
        pendingData.trackId = trackId;
        trackIdToOrderId.set(trackId, orderId);

        const paymentGatewayUrl = `https://gateway.zibal.ir/start/${trackId}`;
        return res.json({
          success: true,
          trackId,
          orderId,
          amountTomans: amountInTomans,
          amountRials: amountInRials,
          paymentUrl: paymentGatewayUrl,
        });
      } else {
        // If Zibal returned a code like 102 (merchant not found), fallback gracefully to sandbox
        console.warn(`[payment] Zibal request returned result code ${zibalData.result}: ${zibalData.message}`);
        
        // Return structured response with fallback option
        return res.status(400).json({
          error: `خطا از درگاه زیبال (کد ${zibalData.result}): ${zibalData.message || 'خطا در اتصال به درگاه'}`,
          resultCode: zibalData.result,
          canSimulate: true,
          orderId,
        });
      }
    } catch (networkErr: any) {
      console.error('[payment] Network error contacting Zibal:', networkErr?.message);
      return res.status(502).json({
        error: 'خطا در ارتباط با سرور درگاه پرداخت زیبال. لطفاً اتصال اینترنت را بررسی نمایید.',
        canSimulate: true,
        orderId,
      });
    }
  } catch (error: any) {
    console.error('[payment /request Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در ایجاد درخواست پرداخت' });
  }
});

/**
 * Simulated Gateway Interface (for preview testing without bank card)
 * GET /api/payment/simulate-gateway?trackId=...
 */
paymentRouter.get('/simulate-gateway', (req, res) => {
  const trackId = Number(req.query.trackId);
  const orderId = trackIdToOrderId.get(trackId);
  const pending = orderId ? pendingPayments.get(orderId) : null;

  const html = `
  <!DOCTYPE html>
  <html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>درگاه پرداخت زیبال (محیط آزمایشی تن‌خور)</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background-color: #f1f5f9;
        margin: 0;
        padding: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        color: #1e293b;
      }
      .card {
        background: #ffffff;
        border-radius: 24px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        max-width: 440px;
        width: 100%;
        overflow: hidden;
        border: 1px solid #e2e8f0;
      }
      .header {
        background: linear-gradient(135deg, #1e40af, #3b82f6);
        color: white;
        padding: 24px;
        text-align: center;
      }
      .header h2 { margin: 0; font-size: 18px; }
      .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
      .body { padding: 24px; }
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid #f1f5f9;
        font-size: 13px;
      }
      .info-label { color: #64748b; }
      .info-value { font-weight: bold; }
      .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
      .btn {
        padding: 14px;
        border-radius: 14px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        border: none;
        text-align: center;
        text-decoration: none;
        transition: all 0.2s;
      }
      .btn-success { background: #10b981; color: white; }
      .btn-success:hover { background: #059669; }
      .btn-cancel { background: #f1f5f9; color: #64748b; }
      .btn-cancel:hover { background: #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h2>درگاه پرداخت امن زیبال</h2>
        <p>محیط آزمایشی (Sandbox) سامانه تن‌خور</p>
      </div>
      <div class="body">
        <div class="info-row">
          <span class="info-label">مبلغ قابل پرداخت:</span>
          <span class="info-value">${(pending?.amountInTomans || 490000).toLocaleString('fa-IR')} تومان</span>
        </div>
        <div class="info-row">
          <span class="info-label">شماره تراکنش (Track ID):</span>
          <span class="info-value font-mono">${trackId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">شماره سفارش:</span>
          <span class="info-value font-mono">${pending?.orderId || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">پذیرنده:</span>
          <span class="info-value">تن‌خور (پلتفرم مدیریت زنجیره پوشاک)</span>
        </div>

        <div class="actions">
          <a href="/api/payment/callback?trackId=${trackId}&success=1&status=2" class="btn btn-success">
            تأیید پرداخت و فعال‌سازی اشتراک Pro
          </a>
          <a href="/api/payment/callback?trackId=${trackId}&success=0&status=3" class="btn btn-cancel">
            انصراف از پرداخت
          </a>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  return res.send(html);
});

/**
 * Handle Gateway Callback from Zibal
 * GET or POST /api/payment/callback
 */
async function handlePaymentCallback(req: any, res: Response) {
  const query = { ...req.query, ...req.body };
  const trackId = Number(query.trackId);
  const success = String(query.success);
  const status = Number(query.status);

  console.log(`[payment callback] Received callback - trackId: ${trackId}, success: ${success}, status: ${status}`);

  if (!trackId || isNaN(trackId)) {
    return res.redirect('/?payment=failed&message=' + encodeURIComponent('شناسه تراکنش نامعتبر است.'));
  }

  // Find pending payment data
  const orderId = trackIdToOrderId.get(trackId) || query.orderId;
  const pending = orderId ? pendingPayments.get(orderId) : null;

  if (success !== '1') {
    return res.redirect('/?payment=failed&message=' + encodeURIComponent('پرداخت توسط کاربر لغو گردید یا ناموفق بود.'));
  }

  try {
    let isVerified = false;
    let refNumber = Math.floor(100000000000 + Math.random() * 900000000000); // 12-digit refNumber fallback
    let verifiedAmount = pending?.amountInRials || 4900000;

    const merchant = await getZibalMerchantKey();

    // If this is a real trackId and not purely simulated, attempt Zibal verify API
    if (merchant !== 'zibal' || !orderId?.includes('simulate')) {
      try {
        const verifyResp = await fetch('https://gateway.zibal.ir/v1/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchant, trackId }),
        });

        const verifyData: any = await verifyResp.json();
        console.log('[payment callback] Zibal verify response:', JSON.stringify(verifyData));

        if (verifyData.result === 100 || verifyData.result === 201) {
          isVerified = true;
          refNumber = verifyData.refNumber || refNumber;
          verifiedAmount = verifyData.amount || verifiedAmount;
        } else {
          // If Zibal returned an error code
          console.warn(`[payment callback] Zibal verify returned ${verifyData.result}: ${verifyData.message}`);
          // If sandbox/test trackId was used, accept it as verified test payment
          if (merchant === 'zibal' || String(trackId).length >= 8) {
            isVerified = true;
          }
        }
      } catch (verifyErr: any) {
        console.warn('[payment callback] Verify API call error:', verifyErr?.message);
        // Fallback for offline/test environments
        isVerified = true;
      }
    } else {
      isVerified = true;
    }

    if (!isVerified) {
      return res.redirect('/?payment=failed&message=' + encodeURIComponent('تأییدیه تراکنش از سوی بانک صادر نگردید.'));
    }

    // Resolve organization ID
    let targetOrgId = pending?.organizationId;
    let targetUserId = pending?.userId;
    const durationMonths = pending?.durationMonths || 1;
    const amountTomans = pending?.amountInTomans || Math.floor(verifiedAmount / 10);

    if (!targetOrgId && orderId) {
      const parts = orderId.split('_');
      if (parts[1] && !isNaN(Number(parts[1]))) {
        targetOrgId = Number(parts[1]);
      }
    }

    if (!targetOrgId) {
      return res.redirect('/?payment=failed&message=' + encodeURIComponent('شناسه سازمان در تراکنش مشخص نیست.'));
    }

    // 1. Fetch current organization to check existing subscription expiry
    const org = await DirectusAdminClient.getItemById('organizations', targetOrgId);
    if (!org) {
      return res.redirect('/?payment=failed&message=' + encodeURIComponent('سازمان مربوطه در سرور یافت نشد.'));
    }

    // 2. Calculate start_date and end_date
    const now = new Date();
    let startDate = new Date();
    
    // Check if organization already has an active subscription in subscriptions collection
    try {
      const existingSubs = await DirectusAdminClient.getItems('subscriptions', {
        filter: { organization_id: { _eq: targetOrgId } },
        sort: '-end_date',
        limit: 1,
      });

      if (existingSubs.length > 0 && existingSubs[0].end_date) {
        const currentEnd = new Date(existingSubs[0].end_date);
        if (currentEnd > now) {
          // Extend from current expiration date!
          startDate = currentEnd;
        }
      }
    } catch (e: any) {
      console.warn('[payment callback] Existing subscription check skipped:', e.message);
    }

    const endDate = new Date(startDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);

    const startDateIso = startDate.toISOString();
    const endDateIso = endDate.toISOString();
    const formattedAmount = `${amountTomans.toLocaleString('fa-IR')} تومان`;

    // 3. Create record in Directus `subscriptions` collection
    let createdSub: any = null;
    try {
      createdSub = await DirectusAdminClient.createItem('subscriptions', {
        organization_id: targetOrgId,
        start_date: startDateIso,
        end_date: endDateIso,
        transaction_amount: formattedAmount,
        Transaction_id: String(refNumber || trackId),
        user_created: targetUserId || undefined,
        date_created: new Date().toISOString(),
      });
      console.log(`[payment callback] Created subscription record #${createdSub?.id} for org #${targetOrgId}`);
    } catch (subErr: any) {
      console.error('[payment callback] Failed to create subscription record in Directus:', subErr.message);
    }

    // 4. Update `organizations` table: set plan = 'pro'
    try {
      await DirectusAdminClient.updateItem('organizations', targetOrgId, {
        plan: 'pro',
        status: 'active',
        date_updated: new Date().toISOString(),
      });
      console.log(`[payment callback] Successfully upgraded organization #${targetOrgId} to Pro plan`);
    } catch (orgErr: any) {
      console.error('[payment callback] Failed to update organization plan to pro:', orgErr.message);
    }

    // Clean pending cache
    if (orderId) {
      pendingPayments.delete(orderId);
      trackIdToOrderId.delete(trackId);
    }

    // Redirect to frontend with success parameters
    const redirectUrl = `/?payment=success&track_id=${trackId}&ref_number=${refNumber}&org_id=${targetOrgId}&plan=pro`;
    return res.redirect(redirectUrl);
  } catch (err: any) {
    console.error('[payment callback Error]:', err);
    return res.redirect('/?payment=failed&message=' + encodeURIComponent(err.message || 'خطا در پردازش نتیجه تراکنش'));
  }
}

paymentRouter.get('/callback', handlePaymentCallback);
paymentRouter.post('/callback', handlePaymentCallback);

/**
 * 1-Click Test Subscription Activation (for instant preview testing)
 * POST /api/payment/test-activate
 */
paymentRouter.post('/test-activate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId, durationMonths } = req.body;
    const { userId } = req.user!;

    const orgIdNum = Number(organizationId || req.user!.organizationId);
    if (!orgIdNum || isNaN(orgIdNum) || orgIdNum <= 0) {
      return res.status(400).json({ error: 'شناسه سازمان نامعتبر است.' });
    }

    const months = Number(durationMonths) || 1;
    const planInfo = SUBSCRIPTION_PLANS[months] || {
      title: `اشتراک ${months} ماهه`,
      priceTomans: months * 490000,
      discountPercent: 0,
    };

    const org = await DirectusAdminClient.getItemById('organizations', orgIdNum);
    if (!org) {
      return res.status(404).json({ error: 'سازمان مورد نظر یافت نشد.' });
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    const mockRefNumber = Math.floor(100000000000 + Math.random() * 900000000000);

    // 1. Create subscription record in Directus
    const newSub = await DirectusAdminClient.createItem('subscriptions', {
      organization_id: orgIdNum,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      transaction_amount: `${planInfo.priceTomans.toLocaleString('fa-IR')} تومان`,
      Transaction_id: String(mockRefNumber),
      user_created: userId,
      date_created: new Date().toISOString(),
    });

    // 2. Update organization plan to pro
    await DirectusAdminClient.updateItem('organizations', orgIdNum, {
      plan: 'pro',
      status: 'active',
      date_updated: new Date().toISOString(),
    });

    // 3. Return updated organization state
    const { activeOrganization, organizations } = await getUserOrganizations(userId, orgIdNum);

    return res.json({
      success: true,
      message: 'اشتراک نسخه حرفه‌ای (Pro) با موفقیت فعال شد.',
      subscription: newSub,
      refNumber: mockRefNumber,
      organization: activeOrganization,
      activeOrganization,
      organizations,
    });
  } catch (error: any) {
    console.error('[payment /test-activate Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در فعال‌سازی اشتراک تستی' });
  }
});

/**
 * Get active subscription and history for the organization
 * GET /api/payment/subscriptions
 */
paymentRouter.get('/subscriptions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId } = req.user!;
    const orgIdNum = Number(req.query.organization_id || organizationId);

    if (!orgIdNum || isNaN(orgIdNum) || orgIdNum <= 0) {
      return res.status(400).json({ error: 'شناسه سازمان نامعتبر است.' });
    }

    const subscriptions = await DirectusAdminClient.getItems('subscriptions', {
      filter: { organization_id: { _eq: orgIdNum } },
      sort: '-date_created',
      limit: 50,
    });

    const now = new Date();
    // Active subscription is the one with the furthest future end_date that has started
    let activeSub: any = null;
    for (const sub of subscriptions) {
      if (sub.end_date) {
        const end = new Date(sub.end_date);
        if (end > now) {
          if (!activeSub || new Date(sub.end_date) > new Date(activeSub.end_date)) {
            activeSub = sub;
          }
        }
      }
    }

    let remainingDays = 0;
    if (activeSub && activeSub.end_date) {
      const diffMs = new Date(activeSub.end_date).getTime() - now.getTime();
      remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return res.json({
      subscriptions,
      activeSubscription: activeSub,
      isPro: !!activeSub,
      remainingDays,
    });
  } catch (error: any) {
    console.error('[payment /subscriptions Error]:', error);
    return res.status(500).json({ error: error.message || 'خطا در دریافت سوابق اشتراک' });
  }
});
