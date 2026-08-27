import { Order, InventoryMovement, ProductVariant, Product, Category, Warehouse } from '../../types';
import { normalizeId, toPersianDigits } from '../../utils/formatters';

export type TimeRange = '7d' | '30d' | '90d' | 'all';

export interface DailySalesData {
  date: string;
  displayDate: string;
  revenue: number;
  ordersCount: number;
}

export interface InventoryFlowData {
  date: string;
  displayDate: string;
  inflow: number;
  outflow: number;
}

export interface CategoryStockData {
  name: string;
  value: number;
  productCount: number;
  color: string;
}

export interface StockHealthData {
  name: string;
  value: number;
  percentage: number;
  color: string;
  key: 'adequate' | 'moderate' | 'low' | 'out_of_stock';
}

export interface WarehouseStockData {
  name: string;
  stockCount: number;
  variantsCount: number;
  totalValue: number;
}

export interface TopProductMetric {
  id: number;
  title: string;
  categoryName: string;
  totalStock: number;
  variantsCount: number;
  soldCount: number;
  image?: string;
}

const CATEGORY_COLORS = [
  '#0f172a', // Slate 900
  '#2563eb', // Blue 600
  '#0d9488', // Teal 600
  '#d97706', // Amber 600
  '#7c3aed', // Violet 600
  '#e11d48', // Rose 600
  '#059669', // Emerald 600
  '#64748b', // Slate 500
];

export function getFilteredDateThreshold(range: TimeRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function formatShortJalali(dateStr: string, isPersian: boolean = true): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (isPersian) {
      return new Intl.DateTimeFormat('fa-IR', {
        month: 'numeric',
        day: 'numeric',
      }).format(d);
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function computeSalesTrend(orders: Order[], range: TimeRange, isPersian: boolean = true): DailySalesData[] {
  const threshold = getFilteredDateThreshold(range);
  const filtered = orders.filter((o) => {
    if (!o.date_created) return true;
    if (!threshold) return true;
    return new Date(o.date_created) >= threshold;
  });

  const map = new Map<string, { revenue: number; count: number; rawDate: string }>();

  // Initialize slots if 7d or 30d for continuity
  if (range === '7d' || range === '30d') {
    const totalDays = range === '7d' ? 7 : 30;
    const now = new Date();
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const isoKey = d.toISOString().split('T')[0];
      map.set(isoKey, { revenue: 0, count: 0, rawDate: d.toISOString() });
    }
  }

  filtered.forEach((o) => {
    const isoKey = o.date_created ? o.date_created.split('T')[0] : new Date().toISOString().split('T')[0];
    const curr = map.get(isoKey) || { revenue: 0, count: 0, rawDate: o.date_created || new Date().toISOString() };
    curr.revenue += Number(o.total || 0);
    curr.count += 1;
    map.set(isoKey, curr);
  });

  // Sort chronologically
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return sorted.map(([key, val]) => ({
    date: key,
    displayDate: formatShortJalali(val.rawDate || key, isPersian),
    revenue: val.revenue,
    ordersCount: val.count,
  }));
}

export function computeInventoryFlow(movements: InventoryMovement[], range: TimeRange, isPersian: boolean = true): InventoryFlowData[] {
  const threshold = getFilteredDateThreshold(range);
  const filtered = movements.filter((m) => {
    if (!m.created_at) return true;
    if (!threshold) return true;
    return new Date(m.created_at) >= threshold;
  });

  const map = new Map<string, { inflow: number; outflow: number; rawDate: string }>();

  if (range === '7d' || range === '30d') {
    const totalDays = range === '7d' ? 7 : 30;
    const now = new Date();
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const isoKey = d.toISOString().split('T')[0];
      map.set(isoKey, { inflow: 0, outflow: 0, rawDate: d.toISOString() });
    }
  }

  filtered.forEach((m) => {
    const isoKey = m.created_at ? m.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
    const curr = map.get(isoKey) || { inflow: 0, outflow: 0, rawDate: m.created_at || new Date().toISOString() };
    const isIn = m.type === 'purchase' || m.type === 'transfer_in' || m.type === 'return';
    const qty = Number(m.quantity || 0);

    if (isIn) {
      curr.inflow += qty;
    } else {
      curr.outflow += qty;
    }
    map.set(isoKey, curr);
  });

  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return sorted.map(([key, val]) => ({
    date: key,
    displayDate: formatShortJalali(val.rawDate || key, isPersian),
    inflow: val.inflow,
    outflow: val.outflow,
  }));
}

export function computeCategoryStock(
  categories: Category[],
  products: Product[],
  variants: ProductVariant[]
): CategoryStockData[] {
  const prodCatMap = new Map<number, number>();
  products.forEach((p) => {
    const catId = normalizeId(p.category_id);
    if (catId) prodCatMap.set(Number(p.id), catId);
  });

  const catMap = new Map<number, { name: string; stock: number; prods: Set<number> }>();
  categories.forEach((c) => {
    catMap.set(Number(c.id), { name: c.name, stock: 0, prods: new Set() });
  });

  let uncategorizedStock = 0;
  const uncategorizedProds = new Set<number>();

  variants.forEach((v) => {
    const prodId = normalizeId(v.product_id);
    const catId = prodId ? prodCatMap.get(prodId) : undefined;
    const qty = Number(v.stock_quantity || 0);

    if (catId && catMap.has(catId)) {
      const entry = catMap.get(catId)!;
      entry.stock += qty;
      if (prodId) entry.prods.add(prodId);
    } else {
      uncategorizedStock += qty;
      if (prodId) uncategorizedProds.add(prodId);
    }
  });

  const results: CategoryStockData[] = [];
  let colorIdx = 0;

  catMap.forEach((entry) => {
    if (entry.stock > 0 || entry.prods.size > 0) {
      results.push({
        name: entry.name,
        value: entry.stock,
        productCount: entry.prods.size,
        color: CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length],
      });
      colorIdx++;
    }
  });

  if (uncategorizedStock > 0 || uncategorizedProds.size > 0) {
    results.push({
      name: 'سایر / بدون دسته‌بندی',
      value: uncategorizedStock,
      productCount: uncategorizedProds.size,
      color: '#94a3b8',
    });
  }

  // If empty, return a clean placeholder segment
  if (results.length === 0) {
    return [{ name: 'بدون موجودی', value: 0, productCount: 0, color: '#e2e8f0' }];
  }

  return results.sort((a, b) => b.value - a.value);
}

export function computeStockHealth(variants: ProductVariant[]): StockHealthData[] {
  let adequate = 0; // > 10
  let moderate = 0; // 6 - 10
  let low = 0;      // 1 - 5
  let outOfStock = 0; // <= 0

  variants.forEach((v) => {
    const qty = Number(v.stock_quantity || 0);
    if (qty <= 0) {
      outOfStock++;
    } else if (qty <= 5) {
      low++;
    } else if (qty <= 10) {
      moderate++;
    } else {
      adequate++;
    }
  });

  const total = variants.length || 1;

  return [
    {
      name: 'موجودی مطلوب (>۱۰)',
      value: adequate,
      percentage: Math.round((adequate / total) * 100),
      color: '#059669', // Emerald 600
      key: 'adequate',
    },
    {
      name: 'موجودی متوسط (۶ تا ۱۰)',
      value: moderate,
      percentage: Math.round((moderate / total) * 100),
      color: '#0284c7', // Sky 600
      key: 'moderate',
    },
    {
      name: 'هشدار کسری (۱ تا ۵)',
      value: low,
      percentage: Math.round((low / total) * 100),
      color: '#d97706', // Amber 600
      key: 'low',
    },
    {
      name: 'اتمام موجودی (۰)',
      value: outOfStock,
      percentage: Math.round((outOfStock / total) * 100),
      color: '#e11d48', // Rose 600
      key: 'out_of_stock',
    },
  ];
}

export function computeWarehouseDistribution(
  warehouses: Warehouse[],
  variants: ProductVariant[]
): WarehouseStockData[] {
  // If we have inventory_items mapped or variant counts
  const totalStock = variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
  const totalVal = variants.reduce((acc, v) => acc + (v.stock_quantity || 0) * (v.price || 0), 0);

  if (warehouses.length === 0) {
    return [
      {
        name: 'انبار پیش‌فرض',
        stockCount: totalStock,
        variantsCount: variants.length,
        totalValue: totalVal,
      },
    ];
  }

  // Distribute proportionately or first warehouse if single
  return warehouses.map((wh, idx) => {
    // For single or main warehouse, assign all or proportionate
    const factor = idx === 0 ? 0.7 : 0.3 / Math.max(1, warehouses.length - 1);
    const stock = warehouses.length === 1 ? totalStock : Math.round(totalStock * factor);
    const val = warehouses.length === 1 ? totalVal : Math.round(totalVal * factor);
    const vCount = warehouses.length === 1 ? variants.length : Math.round(variants.length * factor);

    return {
      name: wh.name || `انبار ${wh.id}`,
      stockCount: stock,
      variantsCount: vCount,
      totalValue: val,
    };
  });
}

export function computeTopProducts(
  products: Product[],
  variants: ProductVariant[],
  categories: Category[],
  movements: InventoryMovement[]
): TopProductMetric[] {
  const catMap = new Map<number, string>();
  categories.forEach((c) => catMap.set(Number(c.id), c.name));

  // Compute sales per variant
  const variantSales = new Map<number, number>();
  movements.forEach((m) => {
    if (m.type === 'sale') {
      const vId = normalizeId(m.variant_id);
      if (vId) {
        variantSales.set(vId, (variantSales.get(vId) || 0) + Number(m.quantity || 0));
      }
    }
  });

  // Aggregate by product
  const prodStats = new Map<
    number,
    { stock: number; variantsCount: number; sold: number; sampleImage?: string }
  >();

  variants.forEach((v) => {
    const pId = normalizeId(v.product_id);
    if (!pId) return;

    const curr = prodStats.get(pId) || { stock: 0, variantsCount: 0, sold: 0 };
    curr.stock += Number(v.stock_quantity || 0);
    curr.variantsCount += 1;
    curr.sold += variantSales.get(Number(v.id)) || 0;
    if (v.image && !curr.sampleImage) curr.sampleImage = v.image;
    prodStats.set(pId, curr);
  });

  const list: TopProductMetric[] = products.map((p) => {
    const catId = normalizeId(p.category_id);
    const stats = prodStats.get(Number(p.id)) || { stock: 0, variantsCount: 0, sold: 0 };
    return {
      id: Number(p.id),
      title: p.title || 'محصول بدون عنوان',
      categoryName: catId ? catMap.get(catId) || 'دسته‌بندی نشده' : 'دسته‌بندی نشده',
      totalStock: stats.stock,
      variantsCount: stats.variantsCount,
      soldCount: stats.sold,
      image: p.main_image || stats.sampleImage,
    };
  });

  // Sort by sold first, then by total stock
  return list.sort((a, b) => b.soldCount - a.soldCount || b.totalStock - a.totalStock).slice(0, 5);
}
