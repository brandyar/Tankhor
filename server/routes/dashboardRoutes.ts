import { Router, Response } from 'express';
import { DirectusAdminClient } from '../directusAdmin';
import { requireAuth, AuthenticatedRequest } from '../auth';

export const dashboardRouter = Router();

// In-memory cache for dashboard summary (TTL: 15 seconds) to make subsequent loads instant (0-5ms)
const dashboardSummaryCache = new Map<number, { data: any; expiresAt: number }>();
const inventorySummaryCache = new Map<string, { data: any; expiresAt: number }>();

/**
 * High-Speed Aggregated Dashboard Summary Route
 * Replaces 10+ waterfall queries with 1 single parallel aggregated API call
 */
dashboardRouter.get(
  '/dashboard/summary',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { organizationId } = req.user!;
    const targetOrgId = Number(req.query.organization_id || organizationId);

    if (!targetOrgId || isNaN(targetOrgId) || targetOrgId <= 0) {
      return res.status(400).json({ error: 'سازمان فعال مشخص نشده است.' });
    }

    // Check fast memory cache
    const cached = dashboardSummaryCache.get(targetOrgId);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ data: cached.data });
    }

    try {
      const orgFilter = { organization_id: { _eq: targetOrgId } };

      // Execute optimized parallel Directus queries
      const [
        prodAgg,
        varAgg,
        invAgg,
        lowStockAgg,
        outOfStockAgg,
        ordersAgg,
        recentOrders,
        recentMovements,
        categories,
        warehouses,
      ] = await Promise.all([
        // 1. Total Products Count
        DirectusAdminClient.request<any>(
          `/items/products?aggregate[count]=*&filter[organization_id][_eq]=${targetOrgId}`
        ).catch(() => [{ count: 0 }]),

        // 2. Total Variants Count
        DirectusAdminClient.request<any>(
          `/items/product_variants?aggregate[count]=*&filter[organization_id][_eq]=${targetOrgId}`
        ).catch(() => [{ count: 0 }]),

        // 3. Total Physical Inventory Sums & Count
        DirectusAdminClient.request<any>(
          `/items/inventory_items?aggregate[count]=*&aggregate[sum]=quantity,available_quantity,reserved_quantity,damaged_quantity&filter[organization_id][_eq]=${targetOrgId}`
        ).catch(() => [{ count: 0, sum: {} }]),

        // 4. Low Stock Count (quantity > 0 and quantity <= 5)
        DirectusAdminClient.request<any>(
          `/items/inventory_items?aggregate[count]=*&filter[organization_id][_eq]=${targetOrgId}&filter[quantity][_gt]=0&filter[quantity][_lte]=5`
        ).catch(() => [{ count: 0 }]),

        // 5. Out of Stock Count (quantity <= 0)
        DirectusAdminClient.request<any>(
          `/items/inventory_items?aggregate[count]=*&filter[organization_id][_eq]=${targetOrgId}&filter[quantity][_lte]=0`
        ).catch(() => [{ count: 0 }]),

        // 6. Total Orders Count & Revenue
        DirectusAdminClient.request<any>(
          `/items/orders?aggregate[count]=*&aggregate[sum]=total&filter[organization_id][_eq]=${targetOrgId}`
        ).catch(() => [{ count: 0, sum: {} }]),

        // 7. Recent 10 Orders (with customer_id relation)
        DirectusAdminClient.getItems<any>('orders', {
          filter: orgFilter,
          sort: '-date_created',
          limit: 10,
          fields: [
            'id',
            'order_number',
            'status',
            'payment_status',
            'total',
            'currency',
            'date_created',
            'customer_id.id',
            'customer_id.name',
          ],
        }).catch(() => []),

        // 8. Recent 10 Inventory Movements
        DirectusAdminClient.getItems<any>('inventory_movements', {
          filter: orgFilter,
          sort: '-created_at',
          limit: 10,
          fields: [
            'id',
            'variant_id',
            'warehouse_id',
            'type',
            'quantity',
            'reference_type',
            'reference_id',
            'note',
            'created_at',
          ],
        }).catch(() => []),

        // 9. Categories lookup (lightweight)
        DirectusAdminClient.getItems<any>('categories', {
          filter: orgFilter,
          fields: ['id', 'name', 'slug'],
          limit: 100,
        }).catch(() => []),

        // 10. Warehouses lookup (lightweight)
        DirectusAdminClient.getItems<any>('warehouses', {
          filter: orgFilter,
          fields: ['id', 'name', 'code'],
          limit: 50,
        }).catch(() => []),
      ]);

      const totalProducts = Number(prodAgg?.[0]?.count) || 0;
      const totalVariants = Number(varAgg?.[0]?.count) || 0;

      const invRow = invAgg?.[0] || {};
      const invSum = invRow.sum || {};
      const totalStockCount = Number(invSum.quantity) || 0;
      const totalAvailableStock = Number(invSum.available_quantity) || totalStockCount;
      const totalReservedStock = Number(invSum.reserved_quantity) || 0;
      const totalDamagedStock = Number(invSum.damaged_quantity) || 0;

      const lowStockCount = Number(lowStockAgg?.[0]?.count) || 0;
      const outOfStockCount = Number(outOfStockAgg?.[0]?.count) || 0;

      const ordRow = ordersAgg?.[0] || {};
      const totalOrdersCount = Number(ordRow.count) || 0;
      const totalSalesRevenue = Number(ordRow.sum?.total) || 0;
      const averageOrderValue = totalOrdersCount > 0 ? Math.round(totalSalesRevenue / totalOrdersCount) : 0;

      // Map recent orders customer names
      const mappedOrders = (recentOrders || []).map((o: any) => ({
        ...o,
        customer_name: typeof o.customer_id === 'object' ? o.customer_id?.name : undefined,
      }));

      const summaryData = {
        totalProducts,
        totalVariants,
        totalStockCount,
        totalAvailableStock,
        totalReservedStock,
        totalDamagedStock,
        lowStockCount,
        outOfStockCount,
        totalOrdersCount,
        totalSalesRevenue,
        averageOrderValue,
        recentOrders: mappedOrders,
        recentMovements: recentMovements || [],
        categories: categories || [],
        warehouses: warehouses || [],
      };

      // Cache for 15 seconds
      dashboardSummaryCache.set(targetOrgId, {
        data: summaryData,
        expiresAt: Date.now() + 15000,
      });

      return res.json({ data: summaryData });
    } catch (err: any) {
      console.error('[Dashboard Summary Route Error]:', err);
      return res.status(500).json({ error: err.message || 'خطا در واکشی خلاصه داشبورد' });
    }
  }
);

/**
 * Fast Aggregated Inventory Summary Route
 * Computes exact warehouse stock sums without downloading all items
 */
dashboardRouter.get(
  '/inventory/summary',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const { organizationId } = req.user!;
    const targetOrgId = Number(req.query.organization_id || organizationId);
    const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined;

    if (!targetOrgId || isNaN(targetOrgId) || targetOrgId <= 0) {
      return res.status(400).json({ error: 'سازمان فعال مشخص نشده است.' });
    }

    const cacheKey = `${targetOrgId}_${warehouseId || 'all'}`;
    const cached = inventorySummaryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ data: cached.data });
    }

    try {
      const whFilter = (warehouseId && !isNaN(warehouseId) && warehouseId > 0)
        ? `&filter[warehouse_id][_eq]=${warehouseId}`
        : '';

      const [invAgg, lowStockAgg] = await Promise.all([
        DirectusAdminClient.request<any>(
          `/items/inventory_items?aggregate[count]=*&aggregate[sum]=quantity,available_quantity,reserved_quantity,damaged_quantity&filter[organization_id][_eq]=${targetOrgId}${whFilter}`
        ).catch(() => [{ count: 0, sum: {} }]),

        DirectusAdminClient.request<any>(
          `/items/inventory_items?aggregate[count]=*&filter[organization_id][_eq]=${targetOrgId}${whFilter}&filter[quantity][_gt]=0&filter[quantity][_lte]=5`
        ).catch(() => [{ count: 0 }]),
      ]);

      const invRow = invAgg?.[0] || {};
      const invSum = invRow.sum || {};
      const totalItems = Number(invRow.count) || 0;
      const totalQuantity = Number(invSum.quantity) || 0;
      const totalAvailable = Number(invSum.available_quantity) || totalQuantity;
      const totalReserved = Number(invSum.reserved_quantity) || 0;
      const totalDamaged = Number(invSum.damaged_quantity) || 0;
      const lowStockCount = Number(lowStockAgg?.[0]?.count) || 0;

      const summary = {
        totalItems,
        totalQuantity,
        totalAvailable,
        totalReserved,
        totalDamaged,
        lowStockCount,
      };

      inventorySummaryCache.set(cacheKey, {
        data: summary,
        expiresAt: Date.now() + 15000,
      });

      return res.json({ data: summary });
    } catch (err: any) {
      console.error('[Inventory Summary Route Error]:', err);
      return res.status(500).json({ error: err.message || 'خطا در واکشی خلاصه انبار' });
    }
  }
);
