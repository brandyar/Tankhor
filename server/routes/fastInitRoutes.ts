import { Router, Response } from 'express';
import { DirectusAdminClient } from '../directusAdmin';
import { requireAuth, AuthenticatedRequest } from '../auth';
import { registerCacheInvalidator } from '../serverCache';

export const fastInitRouter = Router();

// In-memory caches with 30-second TTL (invalidated immediately on mutations)
const posInitCache = new Map<number, { data: any; expiresAt: number }>();
const barcodeInitCache = new Map<number, { data: any; expiresAt: number }>();

registerCacheInvalidator((orgId) => {
  posInitCache.delete(orgId);
  barcodeInitCache.delete(orgId);
});

// Global lookup caches for static reference tables (5-minute TTL)
let cachedColors: { data: any[]; expiresAt: number } | null = null;
let cachedSizes: { data: any[]; expiresAt: number } | null = null;

async function getCachedColors(): Promise<any[]> {
  if (cachedColors && cachedColors.expiresAt > Date.now()) {
    return cachedColors.data;
  }
  const data = await DirectusAdminClient.getItems<any>('colors', {
    fields: ['id', 'name', 'hex'],
    limit: 250,
  }).catch(() => []);
  cachedColors = { data, expiresAt: Date.now() + 5 * 60 * 1000 };
  return data;
}

async function getCachedSizes(): Promise<any[]> {
  if (cachedSizes && cachedSizes.expiresAt > Date.now()) {
    return cachedSizes.data;
  }
  const data = await DirectusAdminClient.getItems<any>('sizes', {
    fields: ['id', 'name'],
    limit: 250,
  }).catch(() => []);
  cachedSizes = { data, expiresAt: Date.now() + 5 * 60 * 1000 };
  return data;
}

/**
 * High-Speed Composite Init Endpoint for POS / Create Order
 * Replaces 12-14 fragmented client-side queries with 1 parallel optimized roundtrip
 */
fastInitRouter.get(
  '/orders/pos-init',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { organizationId } = req.user!;
    const targetOrgId = Number(req.query.organization_id || organizationId);
    if (!targetOrgId || isNaN(targetOrgId) || targetOrgId <= 0) {
      return res.status(400).json({ error: 'سازمان فعال مشخص نشده است.' });
    }

    const cached = posInitCache.get(targetOrgId);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ data: cached.data });
    }

    try {
      const orgFilter = { organization_id: { _eq: targetOrgId } };

      const [
        customers,
        warehouses,
        categories,
        products,
        variants,
        colors,
        sizes,
        inventoryItems,
        accounts,
      ] = await Promise.all([
        DirectusAdminClient.getItems<any>('customers', {
          filter: orgFilter,
          fields: ['id', 'name', 'phone', 'email', 'address', 'status', 'notes', 'balance', 'credit_limit'],
          limit: -1,
        }).catch(() => []),

        DirectusAdminClient.getItems<any>('warehouses', {
          filter: orgFilter,
          fields: ['id', 'name', 'code', 'type', 'status'],
          limit: 50,
        }).catch(() => []),

        DirectusAdminClient.getItems<any>('categories', {
          filter: orgFilter,
          fields: ['id', 'name', 'slug', 'status'],
          limit: 100,
        }).catch(() => []),

        DirectusAdminClient.getItems<any>('products', {
          filter: orgFilter,
          fields: ['id', 'title', 'category_id', 'brand_id', 'status', 'main_image'],
          limit: -1,
        }).catch(() => []),

        DirectusAdminClient.getItems<any>('product_variants', {
          filter: orgFilter,
          fields: ['id', 'product_id', 'sku', 'barcode', 'price', 'color_id', 'size_id', 'status', 'image'],
          limit: -1,
        }).catch(() => []),

        getCachedColors(),

        getCachedSizes(),

        DirectusAdminClient.getItems<any>('inventory_items', {
          filter: orgFilter,
          fields: [
            'id',
            'variant_id',
            'warehouse_id',
            'quantity',
            'available_quantity',
            'reserved_quantity',
            'damaged_quantity',
          ],
          limit: -1,
        }).catch(() => []),

        DirectusAdminClient.getItems<any>('financial_accounts', {
          filter: orgFilter,
          fields: [
            'id',
            'name',
            'type',
            'bank_name',
            'pos_terminal_id',
            'is_default',
            'warehouse_id',
            'current_balance',
          ],
          limit: 50,
        }).catch(() => []),
      ]);

      const productsMap = new Map<number, any>(products.map((p: any) => [Number(p.id), p]));
      const colorsMap = new Map<number, any>(colors.map((c: any) => [Number(c.id), c]));
      const sizesMap = new Map<number, any>(sizes.map((s: any) => [Number(s.id), s]));

      const enrichedVariants = variants.map((v: any) => {
        const prod = productsMap.get(Number(v.product_id));
        const color = colorsMap.get(Number(v.color_id));
        const size = sizesMap.get(Number(v.size_id));
        return {
          ...v,
          product_title: prod?.title || v.product_title || 'محصول',
          color_name: color?.name || v.color_name || '-',
          color_hex: color?.hex || v.color_hex,
          size_name: size?.name || v.size_name || '-',
        };
      });

      const responseData = {
        customers,
        warehouses,
        categories,
        products,
        variants: enrichedVariants,
        inventoryItems,
        financialAccounts: accounts,
      };

      posInitCache.set(targetOrgId, { data: responseData, expiresAt: Date.now() + 15000 });
      return res.json({ data: responseData });
    } catch (err: any) {
      console.error('[POS Init Route Error]:', err);
      return res.status(500).json({ error: err.message || 'خطا در واکشی داده‌های ثبت سفارش' });
    }
  }
);

/**
 * High-Speed Composite Init Endpoint for Barcode Printing
 * Replaces 10-12 fragmented client-side queries with 1 parallel optimized roundtrip
 */
fastInitRouter.get(
  '/inventory/barcode-init',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { organizationId } = req.user!;
    const targetOrgId = Number(req.query.organization_id || organizationId);
    if (!targetOrgId || isNaN(targetOrgId) || targetOrgId <= 0) {
      return res.status(400).json({ error: 'سازمان فعال مشخص نشده است.' });
    }

    const cached = barcodeInitCache.get(targetOrgId);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ data: cached.data });
    }

    try {
      const orgFilter = { organization_id: { _eq: targetOrgId } };

      const [
        variants,
        products,
        brands,
        categories,
        colors,
        sizes,
        inventoryItems,
      ] = await Promise.all([
        DirectusAdminClient.getItems<any>('product_variants', {
          filter: orgFilter,
          fields: ['id', 'product_id', 'sku', 'barcode', 'price', 'color_id', 'size_id', 'status', 'image'],
          limit: -1,
        }).catch(() => []),

        DirectusAdminClient.getItems<any>('products', {
          filter: orgFilter,
          fields: ['id', 'title', 'brand_id', 'category_id', 'status'],
          limit: -1,
        }).catch(() => []),

        DirectusAdminClient.getItems<any>('brands', {
          filter: orgFilter,
          fields: ['id', 'name'],
          limit: 100,
        }).catch(() => []),

        DirectusAdminClient.getItems<any>('categories', {
          filter: orgFilter,
          fields: ['id', 'name', 'slug'],
          limit: 100,
        }).catch(() => []),

        getCachedColors(),
        getCachedSizes(),

        DirectusAdminClient.getItems<any>('inventory_items', {
          filter: orgFilter,
          fields: ['id', 'variant_id', 'warehouse_id', 'quantity'],
          limit: -1,
        }).catch(() => []),
      ]);

      const productsMap = new Map<number, any>(products.map((p: any) => [Number(p.id), p]));
      const colorsMap = new Map<number, any>(colors.map((c: any) => [Number(c.id), c]));
      const sizesMap = new Map<number, any>(sizes.map((s: any) => [Number(s.id), s]));

      // Calculate total stock per variant
      const stockByVariant = new Map<number, number>();
      for (const item of inventoryItems) {
        const vId = Number(item.variant_id);
        const qty = Number(item.quantity) || 0;
        stockByVariant.set(vId, (stockByVariant.get(vId) || 0) + qty);
      }

      const enrichedVariants = variants.map((v: any) => {
        const prod = productsMap.get(Number(v.product_id));
        const color = colorsMap.get(Number(v.color_id));
        const size = sizesMap.get(Number(v.size_id));
        const stock = stockByVariant.get(Number(v.id)) || 0;

        return {
          ...v,
          product_title: prod?.title || v.product_title || 'محصول',
          color_name: color?.name || v.color_name || '-',
          color_hex: color?.hex || v.color_hex,
          size_name: size?.name || v.size_name || '-',
          stock_quantity: stock,
        };
      });

      const responseData = {
        variants: enrichedVariants,
        products,
        brands,
        categories,
        colors,
        sizes,
      };

      barcodeInitCache.set(targetOrgId, { data: responseData, expiresAt: Date.now() + 15000 });
      return res.json({ data: responseData });
    } catch (err: any) {
      console.error('[Barcode Init Route Error]:', err);
      return res.status(500).json({ error: err.message || 'خطا در واکشی داده‌های ساخت بارکد' });
    }
  }
);
