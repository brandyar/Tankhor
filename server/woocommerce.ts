import express, { Request, Response, Router } from 'express';
import { DirectusAdminClient } from './directusAdmin';

export const woocommerceRouter: Router = express.Router();

interface WcCredentials {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

function sanitizeUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

function getAuthHeader(consumerKey: string, consumerSecret: string): string {
  const credentials = `${consumerKey.trim()}:${consumerSecret.trim()}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/**
 * 1. Test Connection Endpoint
 * POST /api/woocommerce/test-connection
 */
woocommerceRouter.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { site_url, consumer_key, consumer_secret } = req.body;

    if (!site_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({
        success: false,
        error: 'آدرس فروشگاه (site_url)، کلید مصرف‌کننده (consumer_key) و رمز (consumer_secret) الزامی هستند.',
      });
    }

    const cleanUrl = sanitizeUrl(site_url);
    const authHeader = getAuthHeader(consumer_key, consumer_secret);

    // Call WooCommerce REST API: try /wp-json/wc/v3/system_status or fallback to /wp-json/wc/v3/products
    let response = await fetch(`${cleanUrl}/wp-json/wc/v3/system_status`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'User-Agent': 'Tankhor-BFF-Proxy/1.0',
      },
    }).catch(() => null);

    if (response && response.ok) {
      const data: any = await response.json();
      const environment = data.environment || {};
      const settings = data.settings || {};

      return res.json({
        success: true,
        store_name: environment.site_title || environment.home_url || 'فروشگاه ووکامرس',
        wc_version: environment.version || 'v3+',
        currency: settings.currency || 'IRR/IRT',
        url: cleanUrl,
      });
    }

    // Fallback attempt: test with products endpoint
    const fallbackResponse = await fetch(`${cleanUrl}/wp-json/wc/v3/products?per_page=1`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'User-Agent': 'Tankhor-BFF-Proxy/1.0',
      },
    });

    if (!fallbackResponse.ok) {
      const errText = await fallbackResponse.text().catch(() => '');
      let errorMsg = `خطای دسترسی ووکامرس (کد ${fallbackResponse.status})`;
      try {
        const json = JSON.parse(errText);
        if (json.message) errorMsg = json.message;
      } catch {}
      return res.status(fallbackResponse.status).json({
        success: false,
        error: errorMsg,
      });
    }

    return res.json({
      success: true,
      store_name: 'فروشگاه ووکامرس متصل شد',
      wc_version: 'v3 (تأییدشده)',
      currency: 'شناسایی شد',
      url: cleanUrl,
    });
  } catch (error: any) {
    console.error('[WooCommerce] test-connection error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'خطا در برقراری ارتباط با هاست وردپرس یا اینترنت.',
    });
  }
});

/**
 * 2. Sync Stock to WooCommerce
 * POST /api/woocommerce/sync-stock
 */
woocommerceRouter.post('/sync-stock', async (req: Request, res: Response) => {
  try {
    const { organization_id, warehouse_id, site_url, consumer_key, consumer_secret } = req.body;

    if (!organization_id || !site_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({
        success: false,
        error: 'اطلاعات سازمان و اعتبارنامه ووکامرس الزامی است.',
      });
    }

    const orgIdNum = Number(organization_id);
    const cleanUrl = sanitizeUrl(site_url);
    const authHeader = getAuthHeader(consumer_key, consumer_secret);

    // Fetch Tankhor variants
    const variants = await DirectusAdminClient.getItems('product_variants', {
      filter: { organization_id: { _eq: orgIdNum } },
      fields: ['id', 'product_id', 'sku', 'barcode', 'title', 'price'],
      limit: -1,
    }).catch(() => []);

    // Fetch Inventory items for this warehouse (or all warehouses if none selected)
    const inventoryFilter: any = { organization_id: { _eq: orgIdNum } };
    if (warehouse_id) {
      inventoryFilter.warehouse_id = { _eq: Number(warehouse_id) };
    }

    const inventoryItems = await DirectusAdminClient.getItems('inventory_items', {
      filter: inventoryFilter,
      fields: ['id', 'variant_id', 'quantity'],
      limit: -1,
    }).catch(() => []);

    // Map variant stock
    const variantStockMap = new Map<number, number>();
    for (const item of inventoryItems) {
      const vId = typeof item.variant_id === 'object' ? item.variant_id?.id : item.variant_id;
      if (vId) {
        const curr = variantStockMap.get(Number(vId)) || 0;
        variantStockMap.set(Number(vId), curr + (Number(item.quantity) || 0));
      }
    }

    // Map SKU -> stock
    const skuStockMap = new Map<string, { stock: number; price: number; title: string; variantId: number }>();
    let missingSkuCount = 0;

    for (const v of variants) {
      const sku = (v.sku || v.barcode || '').trim();
      const stock = variantStockMap.get(v.id) || 0;
      const price = Number(v.price) || 0;
      if (sku) {
        skuStockMap.set(sku, { stock, price, title: v.title || '', variantId: v.id });
      } else {
        missingSkuCount++;
      }
    }

    // Fetch products from WooCommerce to match by SKU
    // WooCommerce allows querying by sku or paging products
    const wcProductsUrl = `${cleanUrl}/wp-json/wc/v3/products?per_page=100`;
    const wcRes = await fetch(wcProductsUrl, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });

    if (!wcRes.ok) {
      return res.status(wcRes.status).json({
        success: false,
        error: 'خطا در دریافت لیست محصولات از ووکامرس.',
      });
    }

    const wcProducts: any[] = await wcRes.json();
    let updatedCount = 0;
    const errors: string[] = [];
    const updates: any[] = [];

    for (const product of wcProducts) {
      // 1. Simple product match
      if (product.type === 'simple' && product.sku) {
        const matched = skuStockMap.get(product.sku.trim());
        if (matched !== undefined) {
          updates.push({
            id: product.id,
            manage_stock: true,
            stock_quantity: matched.stock,
          });
          updatedCount++;
        }
      } else if (product.type === 'variable') {
        // Fetch variations for variable product
        try {
          const varUrl = `${cleanUrl}/wp-json/wc/v3/products/${product.id}/variations?per_page=100`;
          const varRes = await fetch(varUrl, {
            headers: { Authorization: authHeader, Accept: 'application/json' },
          });
          if (varRes.ok) {
            const variations: any[] = await varRes.json();
            const varBatch: any[] = [];
            for (const variation of variations) {
              if (variation.sku) {
                const matched = skuStockMap.get(variation.sku.trim());
                if (matched !== undefined) {
                  varBatch.push({
                    id: variation.id,
                    manage_stock: true,
                    stock_quantity: matched.stock,
                  });
                  updatedCount++;
                }
              }
            }

            if (varBatch.length > 0) {
              await fetch(`${cleanUrl}/wp-json/wc/v3/products/${product.id}/variations/batch`, {
                method: 'POST',
                headers: {
                  Authorization: authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ update: varBatch }),
              });
            }
          }
        } catch (vErr: any) {
          errors.push(`خطا در متغیرهای کالای ${product.name}: ${vErr.message}`);
        }
      }
    }

    // Apply simple products batch update if any
    if (updates.length > 0) {
      const batchRes = await fetch(`${cleanUrl}/wp-json/wc/v3/products/batch`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ update: updates }),
      });
      if (!batchRes.ok) {
        errors.push('خطا در ارسال پکیج کالاهای ساده به ووکامرس.');
      }
    }

    // Record log in Directus woocommerce_logs if collection exists
    await DirectusAdminClient.createItem('woocommerce_logs', {
      organization_id: orgIdNum,
      action: 'sync_stock',
      direction: 'outbound',
      status: errors.length === 0 ? 'success' : 'info',
      message: `همگام‌سازی موجودی به پایان رسید. تعداد ${updatedCount} قلم کالا/متغیر در ووکامرس بروزرسانی شد.`,
      details: {
        totalVariants: variants.length,
        updatedCount,
        missingSkuCount,
        errors,
      },
    }).catch(() => null);

    return res.json({
      success: true,
      totalVariants: variants.length,
      matchedCount: updatedCount,
      updatedCount,
      missingSkuCount,
      errors,
    });
  } catch (error: any) {
    console.error('[WooCommerce] sync-stock error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'خطا در ارسال موجودی به ووکامرس.',
    });
  }
});

/**
 * 3. Sync Prices to WooCommerce
 * POST /api/woocommerce/sync-prices
 */
woocommerceRouter.post('/sync-prices', async (req: Request, res: Response) => {
  try {
    const { organization_id, site_url, consumer_key, consumer_secret } = req.body;

    if (!organization_id || !site_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({
        success: false,
        error: 'اطلاعات سازمان و اعتبارنامه ووکامرس الزامی است.',
      });
    }

    const orgIdNum = Number(organization_id);
    const cleanUrl = sanitizeUrl(site_url);
    const authHeader = getAuthHeader(consumer_key, consumer_secret);

    // Fetch Tankhor variants
    const variants = await DirectusAdminClient.getItems('product_variants', {
      filter: { organization_id: { _eq: orgIdNum } },
      fields: ['id', 'sku', 'barcode', 'price'],
      limit: -1,
    }).catch(() => []);

    const skuPriceMap = new Map<string, number>();
    for (const v of variants) {
      const sku = (v.sku || v.barcode || '').trim();
      const price = Number(v.price) || 0;
      if (sku && price > 0) {
        skuPriceMap.set(sku, price);
      }
    }

    const wcProductsUrl = `${cleanUrl}/wp-json/wc/v3/products?per_page=100`;
    const wcRes = await fetch(wcProductsUrl, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });

    if (!wcRes.ok) {
      return res.status(wcRes.status).json({
        success: false,
        error: 'خطا در دریافت لیست محصولات از ووکامرس.',
      });
    }

    const wcProducts: any[] = await wcRes.json();
    let updatedCount = 0;
    const updates: any[] = [];

    for (const product of wcProducts) {
      if (product.type === 'simple' && product.sku) {
        const price = skuPriceMap.get(product.sku.trim());
        if (price !== undefined) {
          updates.push({
            id: product.id,
            regular_price: String(price),
          });
          updatedCount++;
        }
      } else if (product.type === 'variable') {
        try {
          const varUrl = `${cleanUrl}/wp-json/wc/v3/products/${product.id}/variations?per_page=100`;
          const varRes = await fetch(varUrl, {
            headers: { Authorization: authHeader, Accept: 'application/json' },
          });
          if (varRes.ok) {
            const variations: any[] = await varRes.json();
            const varBatch: any[] = [];
            for (const variation of variations) {
              if (variation.sku) {
                const price = skuPriceMap.get(variation.sku.trim());
                if (price !== undefined) {
                  varBatch.push({
                    id: variation.id,
                    regular_price: String(price),
                  });
                  updatedCount++;
                }
              }
            }

            if (varBatch.length > 0) {
              await fetch(`${cleanUrl}/wp-json/wc/v3/products/${product.id}/variations/batch`, {
                method: 'POST',
                headers: {
                  Authorization: authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ update: varBatch }),
              });
            }
          }
        } catch {}
      }
    }

    if (updates.length > 0) {
      await fetch(`${cleanUrl}/wp-json/wc/v3/products/batch`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ update: updates }),
      });
    }

    await DirectusAdminClient.createItem('woocommerce_logs', {
      organization_id: orgIdNum,
      action: 'sync_prices',
      direction: 'outbound',
      status: 'success',
      message: `همگام‌سازی قیمت‌ها با موفقیت انجام شد. تعداد ${updatedCount} قیمت در سایت بروزرسانی گردید.`,
      details: { updatedCount },
    }).catch(() => null);

    return res.json({
      success: true,
      updatedCount,
    });
  } catch (error: any) {
    console.error('[WooCommerce] sync-prices error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'خطا در ارسال قیمت‌ها به ووکامرس.',
    });
  }
});

/**
 * 4. Import Orders from WooCommerce
 * POST /api/woocommerce/import-orders
 */
woocommerceRouter.post('/import-orders', async (req: Request, res: Response) => {
  try {
    const { organization_id, warehouse_id, financial_account_id, site_url, consumer_key, consumer_secret } = req.body;

    if (!organization_id || !site_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({
        success: false,
        error: 'اطلاعات سازمان و اعتبارنامه ووکامرس الزامی است.',
      });
    }

    const orgIdNum = Number(organization_id);
    const cleanUrl = sanitizeUrl(site_url);
    const authHeader = getAuthHeader(consumer_key, consumer_secret);

    // Fetch orders from WooCommerce: processing, on-hold, pending
    const ordersUrl = `${cleanUrl}/wp-json/wc/v3/orders?status=processing,pending,on-hold&per_page=50`;
    const wcRes = await fetch(ordersUrl, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });

    if (!wcRes.ok) {
      return res.status(wcRes.status).json({
        success: false,
        error: 'خطا در دریافت سفارش‌ها از ووکامرس.',
      });
    }

    const wcOrders: any[] = await wcRes.json();
    if (!Array.isArray(wcOrders) || wcOrders.length === 0) {
      return res.json({
        success: true,
        fetchedOrdersCount: 0,
        importedOrdersCount: 0,
        skippedCount: 0,
        importedOrderIds: [],
        errors: [],
      });
    }

    // Check existing orders in Tankhor for this organization
    const existingOrders = await DirectusAdminClient.getItems('orders', {
      filter: { organization_id: { _eq: orgIdNum } },
      fields: ['id', 'order_number', 'notes'],
      limit: -1,
    }).catch(() => []);

    const existingWcIds = new Set<string>();
    for (const ord of existingOrders) {
      if (ord.order_number && String(ord.order_number).startsWith('WC-')) {
        existingWcIds.add(String(ord.order_number));
      }
      if (ord.notes && ord.notes.includes('WC#')) {
        const match = ord.notes.match(/WC#(\d+)/);
        if (match) existingWcIds.add(`WC-${match[1]}`);
      }
    }

    // Fetch Tankhor variants to match SKUs
    const variants = await DirectusAdminClient.getItems('product_variants', {
      filter: { organization_id: { _eq: orgIdNum } },
      fields: ['id', 'product_id', 'sku', 'barcode', 'title', 'price'],
      limit: -1,
    }).catch(() => []);

    const skuToVariantMap = new Map<string, any>();
    for (const v of variants) {
      const sku = (v.sku || v.barcode || '').trim();
      if (sku) skuToVariantMap.set(sku, v);
    }

    // Fetch existing customers to match by phone
    const customers = await DirectusAdminClient.getItems('customers', {
      filter: { organization_id: { _eq: orgIdNum } },
      fields: ['id', 'phone', 'first_name', 'last_name', 'email'],
      limit: -1,
    }).catch(() => []);

    const phoneToCustomerMap = new Map<string, any>();
    for (const c of customers) {
      if (c.phone) {
        phoneToCustomerMap.set(c.phone.replace(/[^0-9]/g, ''), c);
      }
    }

    let importedOrdersCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const importedOrderIds: number[] = [];

    for (const wcOrder of wcOrders) {
      const wcOrderCode = `WC-${wcOrder.id}`;
      if (existingWcIds.has(wcOrderCode)) {
        skippedCount++;
        continue;
      }

      try {
        // Customer matching or creation
        const billing = wcOrder.billing || {};
        const rawPhone = (billing.phone || '').replace(/[^0-9]/g, '');
        let customerId: number | null = null;

        if (rawPhone && phoneToCustomerMap.has(rawPhone)) {
          customerId = phoneToCustomerMap.get(rawPhone).id;
        } else {
          // Create new customer
          const newCustomer = await DirectusAdminClient.createItem('customers', {
            organization_id: orgIdNum,
            first_name: billing.first_name || 'خریدار',
            last_name: billing.last_name || `سایت ${wcOrder.id}`,
            phone: billing.phone || null,
            email: billing.email || null,
            address: `${billing.city || ''} ${billing.address_1 || ''}`.trim() || null,
          }).catch(() => null);

          if (newCustomer) {
            customerId = newCustomer.id;
            if (rawPhone) phoneToCustomerMap.set(rawPhone, newCustomer);
          }
        }

        // Create Order in Tankhor
        const totalAmount = Number(wcOrder.total) || 0;
        const isPaid = wcOrder.status === 'processing' || wcOrder.status === 'completed';
        const newOrder = await DirectusAdminClient.createItem('orders', {
          organization_id: orgIdNum,
          warehouse_id: warehouse_id ? Number(warehouse_id) : null,
          order_number: wcOrderCode,
          customer_id: customerId,
          type: 'sale',
          channel: 'online',
          status: isPaid ? 'confirmed' : 'pending',
          payment_status: isPaid ? 'paid' : 'pending',
          subtotal: totalAmount,
          total: totalAmount,
          total_amount: String(totalAmount),
          discount_amount: String(wcOrder.discount_total || 0),
          notes: `سفارش آنلاین ووکامرس WC#${wcOrder.id} - وضعیت سایت: ${wcOrder.status} - نام: ${billing.first_name || ''} ${billing.last_name || ''}`,
          date_created: wcOrder.date_created || new Date().toISOString(),
        });

        if (newOrder && newOrder.id) {
          importedOrderIds.push(newOrder.id);
          existingWcIds.add(wcOrderCode);

          // Create order items
          const lineItems = wcOrder.line_items || [];
          for (const item of lineItems) {
            const itemSku = (item.sku || '').trim();
            const matchedVariant = itemSku ? skuToVariantMap.get(itemSku) : null;
            const itemQty = Number(item.quantity) || 1;

            await DirectusAdminClient.createItem('order_items', {
              organization_id: orgIdNum,
              order_id: newOrder.id,
              variant_id: matchedVariant ? matchedVariant.id : null,
              product_id: matchedVariant ? (typeof matchedVariant.product_id === 'object' ? matchedVariant.product_id?.id : matchedVariant.product_id) : null,
              quantity: itemQty,
              unit_price: String(item.price || 0),
              total_price: String(item.total || 0),
              title: item.name || 'آیتم ووکامرس',
            }).catch(() => null);

            // If warehouse specified and variant matched, record stock movement and update inventory items
            if (warehouse_id && matchedVariant) {
              const whNum = Number(warehouse_id);

              await DirectusAdminClient.createItem('inventory_movements', {
                organization_id: orgIdNum,
                warehouse_id: whNum,
                variant_id: matchedVariant.id,
                quantity: itemQty,
                type: 'sale',
                reference_type: 'order',
                reference_id: String(newOrder.id),
                note: `کسر خودکار بابت سفارش آنلاین ووکامرس WC#${wcOrder.id}`,
                date_created: new Date().toISOString(),
              }).catch(() => null);

              // Decrement stock in inventory_items
              try {
                const invItems = await DirectusAdminClient.getItems('inventory_items', {
                  filter: {
                    organization_id: { _eq: orgIdNum },
                    warehouse_id: { _eq: whNum },
                    variant_id: { _eq: matchedVariant.id },
                  },
                  limit: 1,
                }).catch(() => []);

                if (invItems && invItems.length > 0) {
                  const currentQty = Number(invItems[0].quantity) || 0;
                  const newQty = Math.max(0, currentQty - itemQty);
                  await DirectusAdminClient.updateItem('inventory_items', invItems[0].id, {
                    quantity: newQty,
                    available: newQty,
                  });
                }
              } catch (invErr) {
                console.warn('[WooCommerce] Inventory balance update note:', invErr);
              }
            }
          }

          // If financial account configured and order was paid, record in Treasury and Person Ledger
          if (financial_account_id && totalAmount > 0) {
            const finAccId = Number(financial_account_id);

            // 1. Treasury deposit to bank/cash account
            try {
              await DirectusAdminClient.createItem('treasury_transactions', {
                organization_id: orgIdNum,
                destination_account_id: finAccId,
                type: 'deposit',
                amount: totalAmount,
                tracking_code: `WC-${wcOrder.id}`,
                description: `دریافت وجه فاکتور آنلاین ووکامرس WC#${wcOrder.id} (${billing.first_name || ''} ${billing.last_name || ''})`,
                transaction_date: new Date().toISOString(),
              });
            } catch (trErr) {
              console.warn('[WooCommerce] Treasury transaction error:', trErr);
            }

            // 2. Customer Ledger audit (sale invoice + receipt)
            if (customerId) {
              try {
                await DirectusAdminClient.createItem('person_transactions', {
                  organization_id: orgIdNum,
                  customer_id: customerId,
                  financial_account_id: finAccId,
                  party_type: 'customer',
                  party_name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'مشتری ووکامرس',
                  type: 'debtor',
                  transaction_type: 'sale_invoice',
                  amount: totalAmount,
                  debit_amount: totalAmount,
                  status: 'completed',
                  reference_number: wcOrderCode,
                  order_id: newOrder.id,
                  description: `فاکتور فروش آنلاین ووکامرس WC#${wcOrder.id}`,
                  transaction_date: new Date().toISOString(),
                });

                await DirectusAdminClient.createItem('person_transactions', {
                  organization_id: orgIdNum,
                  customer_id: customerId,
                  financial_account_id: finAccId,
                  party_type: 'customer',
                  party_name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'مشتری ووکامرس',
                  type: 'creditor',
                  transaction_type: 'receipt',
                  amount: totalAmount,
                  credit_amount: totalAmount,
                  status: 'completed',
                  reference_number: `REC-${wcOrderCode}`,
                  order_id: newOrder.id,
                  description: `تسویه اینترنتی فاکتور ووکامرس WC#${wcOrder.id}`,
                  transaction_date: new Date().toISOString(),
                });
              } catch (ptErr) {
                console.warn('[WooCommerce] Person ledger transaction error:', ptErr);
              }
            }
          }

          importedOrdersCount++;
        }
      } catch (orderErr: any) {
        errors.push(`خطا در ثبت سفارش #${wcOrder.id}: ${orderErr.message}`);
      }
    }

    await DirectusAdminClient.createItem('woocommerce_logs', {
      organization_id: orgIdNum,
      action: 'import_orders',
      direction: 'inbound',
      status: errors.length === 0 ? 'success' : 'info',
      message: `دریافت سفارشات اینترنتی: تعداد ${importedOrdersCount} سفارش جدید وارد تن‌خور شد (${skippedCount} قبلاً ثبت شده بودند).`,
      details: {
        fetchedCount: wcOrders.length,
        importedOrdersCount,
        skippedCount,
        errors,
      },
    }).catch(() => null);

    return res.json({
      success: true,
      fetchedOrdersCount: wcOrders.length,
      importedOrdersCount,
      skippedCount,
      importedOrderIds,
      errors,
    });
  } catch (error: any) {
    console.error('[WooCommerce] import-orders error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'خطا در دریافت سفارشات از ووکامرس.',
    });
  }
});

/**
 * 5. Incoming Webhook Receiver for WooCommerce
 * POST /api/woocommerce/webhook
 */
woocommerceRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const topic = req.headers['x-wc-webhook-topic'] as string;
    const body = req.body;
    const orgId = req.query.org_id ? Number(req.query.org_id) : 1;

    console.log(`[WooCommerce Webhook] Received topic: ${topic}, orgId: ${orgId}`);

    // If order.created or order.updated
    if (topic === 'order.created' || (!topic && body?.id && body?.line_items)) {
      const wcOrder = body;
      const billing = wcOrder.billing || {};

      // Check duplicate
      const wcOrderCode = `WC-${wcOrder.id}`;
      const existing = await DirectusAdminClient.getItems('orders', {
        filter: { order_number: { _eq: wcOrderCode } },
        limit: 1,
      }).catch(() => []);

      if (existing && existing.length > 0) {
        return res.json({ status: 'ignored', message: 'Order already imported' });
      }

      // Customer matching/creation
      const rawPhone = (billing.phone || '').replace(/[^0-9]/g, '');
      let customerId: number | null = null;

      if (rawPhone) {
        const custs = await DirectusAdminClient.getItems('customers', {
          filter: { phone: { _eq: rawPhone } },
          limit: 1,
        }).catch(() => []);
        if (custs && custs.length > 0) {
          customerId = custs[0].id;
        }
      }

      if (!customerId) {
        const newCust = await DirectusAdminClient.createItem('customers', {
          organization_id: orgId,
          first_name: billing.first_name || 'خریدار',
          last_name: billing.last_name || `سایت ${wcOrder.id}`,
          phone: billing.phone || null,
          email: billing.email || null,
          address: `${billing.city || ''} ${billing.address_1 || ''}`.trim() || null,
        }).catch(() => null);
        if (newCust) customerId = newCust.id;
      }

      // Create Order
      const totalAmount = Number(wcOrder.total) || 0;
      const order = await DirectusAdminClient.createItem('orders', {
        organization_id: orgId,
        order_number: wcOrderCode,
        customer_id: customerId,
        type: 'sale',
        channel: 'online',
        status: 'pending',
        total_amount: String(totalAmount),
        notes: `وب‌هوک ووکامرس WC#${wcOrder.id} - ${billing.first_name || ''} ${billing.last_name || ''}`,
        date_created: new Date().toISOString(),
      });

      if (order && order.id) {
        const lineItems = wcOrder.line_items || [];
        for (const item of lineItems) {
          await DirectusAdminClient.createItem('order_items', {
            organization_id: orgId,
            order_id: order.id,
            quantity: Number(item.quantity) || 1,
            unit_price: String(item.price || 0),
            total_price: String(item.total || 0),
            title: item.name || 'آیتم وب‌هوک',
          }).catch(() => null);
        }

        await DirectusAdminClient.createItem('woocommerce_logs', {
          organization_id: orgId,
          action: 'webhook_order',
          direction: 'inbound',
          status: 'success',
          message: `سفارش آنلاین WC#${wcOrder.id} بلافاصله از طریق وب‌هوک ووکامرس در تن‌خور ثبت شد.`,
          details: { wcOrderId: wcOrder.id, orderId: order.id },
        }).catch(() => null);
      }

      return res.status(200).json({ status: 'ok', imported: true, orderId: order?.id });
    }

    return res.status(200).json({ status: 'ok', received: true });
  } catch (error: any) {
    console.error('[WooCommerce Webhook] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});
