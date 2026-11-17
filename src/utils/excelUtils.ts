import * as XLSX from 'xlsx';
import {
  Product,
  ProductVariant,
  InventoryItem,
  Order,
  Category,
  Brand,
  Collection,
  Season,
  Color,
  Size,
  Warehouse,
  Customer,
  OrderStatus,
  PaymentStatus,
} from '../types';
import { jalaliToIsoString, isoToJalaliString } from './dateUtils';
import { normalizeId } from './formatters';

export interface ExcelImportResult<T> {
  success: boolean;
  importedCount: number;
  updatedCount: number;
  errors: string[];
  items: T[];
}

/**
 * Trigger browser/WebView download for a binary/text Blob safely with object URL cleanup
 */
export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Trigger browser download for an Excel workbook
 */
export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, fileName);
}

/**
 * Trigger browser download for UTF-8 BOM CSV content (Excel Persian compatible)
 */
export function downloadCsvContent(csvContent: string, fileName: string) {
  const contentWithBom = csvContent.startsWith('\uFEFF') ? csvContent : '\uFEFF' + csvContent;
  const blob = new Blob([contentWithBom], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, fileName);
}

/**
 * Safely escape a single CSV field (protects quotes and newlines)
 */
export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// =============================================================
// INTERNAL NORMALIZATION & PARSING HELPERS
// =============================================================

export function toEnglishDigits(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizeHeaderKey(key: string): string {
  return toEnglishDigits(key)
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[\u200C\u200B\u200D\uFEFF]/g, ' ')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRowKeys(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const normKey = normalizeHeaderKey(k);
    if (normKey && (normalized[normKey] === undefined || normalized[normKey] === '')) {
      normalized[normKey] = v;
    }
  }
  return normalized;
}

function getCell(normRow: Record<string, any>, aliases: string[]): string {
  for (const alias of aliases) {
    const normAlias = normalizeHeaderKey(alias);
    const val = normRow[normAlias];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

function getNumericCell(normRow: Record<string, any>, aliases: string[]): number | undefined {
  for (const alias of aliases) {
    const normAlias = normalizeHeaderKey(alias);
    const val = normRow[normAlias];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      if (typeof val === 'number' && !isNaN(val)) return val;
      const cleaned = toEnglishDigits(val)
        .replace(/[,٬،\s]/g, '')
        .replace(/تومان|ریال|toman|irr/gi, '')
        .trim();
      if (!cleaned) continue;
      const num = Number(cleaned);
      if (!isNaN(num)) return num;
    }
  }
  return undefined;
}

function parseExcelDateToIso(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') {
    return new Date().toISOString();
  }
  // Excel numeric serial date
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    const utcDays = Math.floor(raw - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString();
    }
  }

  const str = toEnglishDigits(raw).trim();
  if (!str) return new Date().toISOString();

  // Check YYYY/MM/DD or YYYY-MM-DD
  const match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    // Jalali year typically in 1300-1500
    if (year >= 1300 && year <= 1550) {
      return `${jalaliToIsoString({ jy: year, jm: month, jd: day })}T12:00:00.000Z`;
    }
    const isoStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`;
    const parsed = new Date(isoStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

function normalizeIranianPhone(raw: unknown): string {
  const cleaned = toEnglishDigits(raw).replace(/[\s\-()]/g, '').trim();
  if (!cleaned) return '';
  // Excel frequently drops the leading zero from Iranian 09... phone numbers
  if (/^9\d{9}$/.test(cleaned)) {
    return `0${cleaned}`;
  }
  return cleaned;
}

/**
 * -------------------------------------------------------------
 * 1. PRODUCTS & VARIANTS EXCEL EXPORT & IMPORT
 * -------------------------------------------------------------
 */

export interface ProductExportRow {
  'کد محصول (کد مدل)': string;
  'عنوان محصول': string;
  'دسته‌بندی': string;
  'برند': string;
  'کالکشن': string;
  'فصل': string;
  'جنسیت': string;
  'جنس/پارچه': string;
  'وضعیت انتشار': string;
  'شناسه کالا (SKU)': string;
  'بارکد تنوع': string;
  'رنگ': string;
  'کد رنگ': string;
  'سایز': string;
  'قیمت فروش (تومان)': number;
  'قیمت خرید/تمام‌شده (تومان)': number;
  'قیمت عمده‌فروشی (تومان)': number;
  'وزن (گرم)': number;
  'موجودی فعلی': number;
  'وضعیت تنوع': string;
}

export interface ParsedProductRow {
  rowNumber: number;
  productCode: string;
  title: string;
  categoryName: string;
  brandName: string;
  collectionName: string;
  seasonName: string;
  gender: string;
  material: string;
  productStatus: 'published' | 'draft';
  sku: string;
  barcode: string;
  colorName: string;
  colorHex: string;
  sizeName: string;
  price: number;
  cost: number;
  wholesalePrice: number;
  weightGrams: number;
  stockQuantity?: number;
  variantStatus: 'published' | 'draft';
}

export function exportProductsToExcel(
  products: Product[],
  variants: ProductVariant[],
  categories: Category[],
  brands: Brand[],
  colors: Color[],
  sizes: Size[],
  fileName: string = `tankhor_products_${new Date().toISOString().slice(0, 10)}.xlsx`,
  extraLookups?: { collections?: Collection[]; seasons?: Season[] }
): number {
  const rows: ProductExportRow[] = [];

  const catMap = new Map(categories.map((c) => [normalizeId(c.id) || Number(c.id), c.name]));
  const brandMap = new Map(brands.map((b) => [normalizeId(b.id) || Number(b.id), b.name]));
  const colMap = new Map((extraLookups?.collections || []).map((c) => [normalizeId(c.id) || Number(c.id), c.name]));
  const seasonMap = new Map((extraLookups?.seasons || []).map((s) => [normalizeId(s.id) || Number(s.id), s.name]));
  const colorMap = new Map(colors.map((c) => [normalizeId(c.id) || Number(c.id), c]));
  const sizeMap = new Map(sizes.map((s) => [normalizeId(s.id) || Number(s.id), s.name]));

  // Group variants by product
  const variantsByProduct = new Map<number, ProductVariant[]>();
  variants.forEach((v) => {
    const pId = normalizeId(v.product_id) || Number(v.product_id);
    if (!pId) return;
    if (!variantsByProduct.has(pId)) {
      variantsByProduct.set(pId, []);
    }
    variantsByProduct.get(pId)!.push(v);
  });

  products.forEach((p) => {
    const pId = normalizeId(p.id) || Number(p.id);
    const pVariants = variantsByProduct.get(pId) || [];
    const catId = normalizeId(p.category_id);
    const brandId = normalizeId(p.brand_id);
    const collectionId = normalizeId(p.collection_id);
    const seasonId = normalizeId(p.season_id);

    const catName = catId ? catMap.get(catId) || '' : '';
    const brandName =
      (brandId ? brandMap.get(brandId) : '') ||
      (typeof p.brand === 'string' ? p.brand : p.brand?.name) ||
      '';
    const collectionName =
      (collectionId ? colMap.get(collectionId) : '') ||
      (typeof (p as any).collection_id === 'object' ? (p as any).collection_id?.name : '') ||
      (p as any).collection_name ||
      '';
    const seasonName =
      (seasonId ? seasonMap.get(seasonId) : '') ||
      (typeof (p as any).season_id === 'object' ? (p as any).season_id?.name : '') ||
      (p as any).season_name ||
      '';

    const statusText = p.status === 'published' || String(p.status) === 'active' ? 'منتشر شده' : 'پیش‌نویس';

    if (pVariants.length === 0) {
      rows.push({
        'کد محصول (کد مدل)': (p as any).code || p.slug || '',
        'عنوان محصول': p.title || '',
        'دسته‌بندی': catName,
        'برند': brandName,
        'کالکشن': collectionName,
        'فصل': seasonName,
        'جنسیت': (p as any).gender || 'unisex',
        'جنس/پارچه': (p as any).material || '',
        'وضعیت انتشار': statusText,
        'شناسه کالا (SKU)': '',
        'بارکد تنوع': '',
        'رنگ': '',
        'کد رنگ': '',
        'سایز': '',
        'قیمت فروش (تومان)': 0,
        'قیمت خرید/تمام‌شده (تومان)': 0,
        'قیمت عمده‌فروشی (تومان)': 0,
        'وزن (گرم)': 0,
        'موجودی فعلی': Number(p.total_stock) || 0,
        'وضعیت تنوع': 'فعال',
      });
    } else {
      pVariants.forEach((v) => {
        const cId = normalizeId(v.color_id) || Number(v.color_id);
        const sId = normalizeId(v.size_id) || Number(v.size_id);
        const colObj = colorMap.get(cId);
        const colorName = v.color_name && v.color_name !== '-' ? v.color_name : colObj?.name || '';
        const colorHex = (colObj as any)?.hex || (colObj as any)?.hex_code || colObj?.code || '';
        const sizeName = v.size_name && v.size_name !== '-' ? v.size_name : sizeMap.get(sId) || '';

        const salePrice = Number(v.price ?? (v as any).sale_price ?? (v as any).regular_price ?? 0) || 0;
        const costPrice = Number((v as any).cost_price ?? v.cost ?? v.buy_price ?? 0) || 0;
        const wholesalePrice = Number((v as any).wholesale_price ?? 0) || 0;
        const weightGrams = Number((v as any).weight_grams ?? (v as any).weight ?? 0) || 0;

        rows.push({
          'کد محصول (کد مدل)': (p as any).code || p.slug || '',
          'عنوان محصول': p.title || '',
          'دسته‌بندی': catName,
          'برند': brandName,
          'کالکشن': collectionName,
          'فصل': seasonName,
          'جنسیت': (p as any).gender || 'unisex',
          'جنس/پارچه': (p as any).material || '',
          'وضعیت انتشار': statusText,
          'شناسه کالا (SKU)': v.sku || '',
          'بارکد تنوع': v.barcode || '',
          'رنگ': colorName,
          'کد رنگ': colorHex,
          'سایز': sizeName,
          'قیمت فروش (تومان)': salePrice,
          'قیمت خرید/تمام‌شده (تومان)': costPrice,
          'قیمت عمده‌فروشی (تومان)': wholesalePrice,
          'وزن (گرم)': weightGrams,
          'موجودی فعلی': Number(v.stock_quantity) || 0,
          'وضعیت تنوع':
            String(v.status) === 'active' || String(v.status) === 'published' ? 'فعال' : 'غیرفعال',
        });
      });
    }
  });

  if (rows.length === 0) return 0;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'محصولات و تنوع‌ها');
  downloadWorkbook(workbook, fileName);
  return rows.length;
}

export function parseProductsFromExcel(fileBuffer: ArrayBuffer): ExcelImportResult<ParsedProductRow> {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      success: false,
      importedCount: 0,
      updatedCount: 0,
      errors: ['فایل اکسل خالی است یا برگه معتبری ندارد.'],
      items: [],
    };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    return {
      success: false,
      importedCount: 0,
      updatedCount: 0,
      errors: ['هیچ ردیفی در فایل اکسل یافت نشد.'],
      items: [],
    };
  }

  const items: ParsedProductRow[] = [];
  const errors: string[] = [];

  rawRows.forEach((rawRow, idx) => {
    const rowNum = idx + 2;
    const row = normalizeRowKeys(rawRow);
    const title = getCell(row, ['عنوان محصول', 'نام محصول', 'نام کالا', 'محصول', 'title', 'product name', 'name']);
    if (!title) {
      errors.push(`سطر ${rowNum}: عنوان محصول خالی است.`);
      return;
    }

    const statusRaw = getCell(row, ['وضعیت انتشار', 'وضعیت محصول', 'status']).toLowerCase();
    const productStatus: 'published' | 'draft' =
      statusRaw === 'پیش‌نویس' || statusRaw === 'پیشنویس' || statusRaw === 'draft' || statusRaw === 'inactive'
        ? 'draft'
        : 'published';

    const varStatusRaw = getCell(row, ['وضعیت تنوع', 'variant status']).toLowerCase();
    const variantStatus: 'published' | 'draft' =
      varStatusRaw === 'غیرفعال' ||
      varStatusRaw === 'inactive' ||
      varStatusRaw === 'disabled' ||
      varStatusRaw === 'draft' ||
      varStatusRaw === 'پیش‌نویس'
        ? 'draft'
        : 'published';

    const price = getNumericCell(row, ['قیمت فروش (تومان)', 'قیمت فروش', 'قیمت', 'price', 'sale price']) ?? 0;
    const cost = getNumericCell(row, ['قیمت خرید/تمام‌شده (تومان)', 'قیمت خرید', 'قیمت تمام شده', 'بهای تمام شده', 'cost', 'cost price', 'buy price']) ?? 0;
    const wholesalePrice = getNumericCell(row, ['قیمت عمده‌فروشی (تومان)', 'قیمت عمده', 'wholesale price']) ?? 0;
    const weightGrams = getNumericCell(row, ['وزن (گرم)', 'وزن', 'weight', 'weight grams']) ?? 0;
    const stockQuantity = getNumericCell(row, ['موجودی فعلی', 'موجودی اولیه', 'موجودی', 'تعداد', 'stock', 'quantity', 'stock quantity']);

    if (price < 0 || cost < 0) {
      errors.push(`سطر ${rowNum} (${title}): قیمت نمی‌تواند منفی باشد.`);
      return;
    }

    items.push({
      rowNumber: rowNum,
      productCode: getCell(row, ['کد محصول (کد مدل)', 'کد محصول', 'کد مدل', 'code', 'slug', 'product code']),
      title,
      categoryName: getCell(row, ['دسته‌بندی', 'دسته بندی', 'دسته', 'category']),
      brandName: getCell(row, ['برند', 'مارک', 'brand']),
      collectionName: getCell(row, ['کالکشن', 'مجموعه', 'collection']),
      seasonName: getCell(row, ['فصل', 'season']),
      gender: getCell(row, ['جنسیت', 'gender']) || 'unisex',
      material: getCell(row, ['جنس/پارچه', 'جنس', 'پارچه', 'material']),
      productStatus,
      sku: getCell(row, ['شناسه کالا (sku)', 'شناسه کالا', 'کد تنوع', 'sku']),
      barcode: toEnglishDigits(getCell(row, ['بارکد تنوع', 'بارکد', 'barcode'])),
      colorName: getCell(row, ['رنگ', 'color']),
      colorHex: getCell(row, ['کد رنگ', 'color hex', 'hex']),
      sizeName: getCell(row, ['سایز', 'اندازه', 'size']),
      price: Math.max(0, price),
      cost: Math.max(0, cost),
      wholesalePrice: Math.max(0, wholesalePrice),
      weightGrams: Math.max(0, weightGrams),
      stockQuantity: stockQuantity !== undefined ? Math.max(0, stockQuantity) : undefined,
      variantStatus,
    });
  });

  return {
    success: items.length > 0,
    importedCount: items.length,
    updatedCount: 0,
    errors,
    items,
  };
}

/**
 * -------------------------------------------------------------
 * 2. INVENTORY & STOCK EXCEL EXPORT & IMPORT
 * -------------------------------------------------------------
 */

export interface InventoryExportRow {
  'شناسه کالا (SKU)': string;
  'بارکد': string;
  'عنوان محصول': string;
  'رنگ': string;
  'سایز': string;
  'نام انبار': string;
  'موقعیت در انبار': string;
  'موجودی فیزیکی': number;
  'موجودی رزرو شده': number;
  'موجودی قابل فروش': number;
  'نقطه سفارش مجدد': number;
  'موجودی اطمینان': number;
  'قیمت واحد (تومان)': number;
  'ارزش کل ریالی': number;
}

export interface ParsedInventoryRow {
  rowNumber: number;
  sku: string;
  barcode: string;
  productTitle: string;
  warehouseName: string;
  locationName: string;
  quantity: number;
  reservedQuantity?: number;
  reorderPoint?: number;
  safetyStock?: number;
}

export function exportInventoryToExcel(
  items: InventoryItem[],
  variants: ProductVariant[],
  warehouses: Warehouse[],
  fileName: string = `tankhor_inventory_${new Date().toISOString().slice(0, 10)}.xlsx`
): number {
  if (!items || items.length === 0) return 0;

  const whMap = new Map(warehouses.map((w) => [normalizeId(w.id) || Number(w.id), w.name]));
  const varMap = new Map(variants.map((v) => [normalizeId(v.id) || Number(v.id), v]));

  const rows: InventoryExportRow[] = items.map((item) => {
    const vId = normalizeId(item.variant_id) || Number(item.variant_id);
    const wId = normalizeId(item.warehouse_id) || Number(item.warehouse_id);
    const v = varMap.get(vId);
    const whName = item.warehouse_name || whMap.get(wId) || 'انبار اصلی';
    const sku = item.sku || v?.sku || '-';
    const barcode = v?.barcode || '-';
    const prodTitle = item.product_title || v?.product_title || '-';
    const colorName =
      item.color_name ||
      v?.color_name ||
      (typeof v?.color_id === 'object' ? (v.color_id as any)?.name : '') ||
      '-';
    const sizeName =
      item.size_name ||
      v?.size_name ||
      (typeof v?.size_id === 'object' ? (v.size_id as any)?.name : '') ||
      '-';

    const qty = Number(item.quantity) || 0;
    const reserved = Number(item.reserved_quantity) || 0;
    const damaged = Number(item.damaged_quantity) || 0;
    const available =
      item.available_quantity !== undefined && item.available_quantity !== null
        ? Number(item.available_quantity)
        : Math.max(0, qty - reserved - damaged);
    const reorderPoint = item.reorder_point !== undefined && item.reorder_point !== null ? Number(item.reorder_point) : 5;
    const safetyStock = item.safety_stock !== undefined && item.safety_stock !== null ? Number(item.safety_stock) : 2;
    const unitPrice = Number(v?.price ?? (v as any)?.sale_price ?? (v as any)?.regular_price ?? 0) || 0;

    return {
      'شناسه کالا (SKU)': sku,
      'بارکد': barcode,
      'عنوان محصول': prodTitle,
      'رنگ': colorName,
      'سایز': sizeName,
      'نام انبار': whName,
      'موقعیت در انبار': item.location_name || '-',
      'موجودی فیزیکی': qty,
      'موجودی رزرو شده': reserved,
      'موجودی قابل فروش': available,
      'نقطه سفارش مجدد': reorderPoint,
      'موجودی اطمینان': safetyStock,
      'قیمت واحد (تومان)': unitPrice,
      'ارزش کل ریالی': qty * unitPrice,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'موجودی انبار');
  downloadWorkbook(workbook, fileName);
  return rows.length;
}

export function parseInventoryFromExcel(fileBuffer: ArrayBuffer): ExcelImportResult<ParsedInventoryRow> {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['فایل اکسل خالی است.'], items: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['هیچ ردیفی در فایل یافت نشد.'], items: [] };
  }

  const items: ParsedInventoryRow[] = [];
  const errors: string[] = [];

  rawRows.forEach((rawRow, idx) => {
    const rowNum = idx + 2;
    const row = normalizeRowKeys(rawRow);
    const skuRaw = getCell(row, ['شناسه کالا (sku)', 'شناسه کالا', 'sku', 'کد کالا']);
    const barcodeRaw = toEnglishDigits(getCell(row, ['بارکد', 'barcode']));
    const sku = skuRaw === '-' ? '' : skuRaw;
    const barcode = barcodeRaw === '-' ? '' : barcodeRaw;

    if (!sku && !barcode) {
      errors.push(`سطر ${rowNum}: شناسه کالا (SKU) یا بارکد الزامی است.`);
      return;
    }

    const quantity = getNumericCell(row, ['موجودی فیزیکی', 'موجودی', 'تعداد', 'quantity', 'qty', 'stock']);
    if (quantity === undefined || quantity < 0) {
      errors.push(`سطر ${rowNum} (${sku || barcode}): مقدار موجودی فیزیکی نامعتبر است.`);
      return;
    }

    const reservedQuantity = getNumericCell(row, ['موجودی رزرو شده', 'رزرو', 'reserved', 'reserved quantity']);
    const reorderPoint = getNumericCell(row, ['نقطه سفارش مجدد', 'نقطه سفارش', 'reorder point']);
    const safetyStock = getNumericCell(row, ['موجودی اطمینان', 'حداقل موجودی', 'safety stock']);

    const whName = getCell(row, ['نام انبار', 'انبار', 'warehouse', 'warehouse name']);
    const locName = getCell(row, ['موقعیت در انبار', 'موقیعت در انبار', 'موقعیت', 'قفسه', 'location']);

    items.push({
      rowNumber: rowNum,
      sku,
      barcode,
      productTitle: getCell(row, ['عنوان محصول', 'نام محصول', 'product title', 'title']),
      warehouseName: whName === '-' ? '' : whName,
      locationName: locName === '-' ? '' : locName,
      quantity: Math.max(0, quantity),
      reservedQuantity: reservedQuantity !== undefined ? Math.max(0, reservedQuantity) : undefined,
      reorderPoint: reorderPoint !== undefined ? Math.max(0, reorderPoint) : undefined,
      safetyStock: safetyStock !== undefined ? Math.max(0, safetyStock) : undefined,
    });
  });

  return {
    success: items.length > 0,
    importedCount: items.length,
    updatedCount: 0,
    errors,
    items,
  };
}

/**
 * -------------------------------------------------------------
 * 3. ORDERS & SALES EXCEL EXPORT & IMPORT
 * -------------------------------------------------------------
 */

export interface OrderExportRow {
  'شماره سفارش': string;
  'تاریخ ثبت': string;
  'نام مشتری': string;
  'شماره تماس': string;
  'انبار تحویل': string;
  'وضعیت سفارش': string;
  'وضعیت پرداخت': string;
  'مبلغ کل اقلام (تومان)': number;
  'تخفیف (تومان)': number;
  'مالیات (تومان)': number;
  'مبلغ نهایی فاکتور (تومان)': number;
  'مبلغ پرداختی (تومان)': number;
  'شرح / یادداشت': string;
}

export interface ParsedOrderRow {
  rowNumber: number;
  orderNumber: string;
  dateCreated: string;
  customerName: string;
  customerPhone: string;
  warehouseName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  notes: string;
}

export function exportOrdersToExcel(
  orders: Order[],
  fileName: string = `tankhor_orders_${new Date().toISOString().slice(0, 10)}.xlsx`,
  lookups?: { customers?: Customer[]; warehouses?: Warehouse[]; isPersian?: boolean }
): number {
  if (!orders || orders.length === 0) return 0;

  const statusLabels: Record<string, string> = {
    completed: 'تکمیل شده',
    confirmed: 'تایید شده / در انتظار',
    processing: 'در حال پردازش',
    draft: 'پیش‌نویس',
    cancelled: 'لغو شده',
  };

  const paymentLabels: Record<string, string> = {
    paid: 'پرداخت کامل',
    pending: 'پرداخت نشده',
    partially_paid: 'پرداخت بیعانه/بخشی',
  };

  const custMap = new Map((lookups?.customers || []).map((c) => [normalizeId(c.id) || Number(c.id), c]));
  const whMap = new Map((lookups?.warehouses || []).map((w) => [normalizeId(w.id) || Number(w.id), w]));

  const rows: OrderExportRow[] = orders.map((o) => {
    const custId = normalizeId(o.customer_id);
    const cust = custId ? custMap.get(custId) : undefined;
    const whId = normalizeId(o.warehouse_id);
    const wh = whId ? whMap.get(whId) : undefined;

    const total = Number(o.total ?? (o as any).final_amount ?? 0) || 0;
    const paidAmount =
      (o as any).paid_amount !== undefined && (o as any).paid_amount !== null
        ? Number((o as any).paid_amount) || 0
        : o.payment_status === 'paid'
        ? total
        : 0;

    const rawDate = o.order_date || o.date_created || '';
    const dateDisplay = rawDate
      ? lookups?.isPersian
        ? isoToJalaliString(rawDate)
        : rawDate.slice(0, 10)
      : '';

    return {
      'شماره سفارش': o.order_number || '',
      'تاریخ ثبت': dateDisplay,
      'نام مشتری': o.customer_name || cust?.name || (cust as any)?.full_name || 'مشتری عمومی',
      'شماره تماس': (o as any).customer_phone || (o as any).customer_mobile || cust?.phone || '-',
      'انبار تحویل': (o as any).warehouse_name || wh?.name || 'انبار اصلی',
      'وضعیت سفارش': statusLabels[o.status] || o.status,
      'وضعیت پرداخت': paymentLabels[o.payment_status] || o.payment_status,
      'مبلغ کل اقلام (تومان)': Number(o.subtotal ?? (o as any).total_amount ?? total) || 0,
      'تخفیف (تومان)': Number(o.discount ?? (o as any).discount_amount ?? 0) || 0,
      'مالیات (تومان)': Number(o.tax ?? (o as any).tax_amount ?? 0) || 0,
      'مبلغ نهایی فاکتور (تومان)': total,
      'مبلغ پرداختی (تومان)': paidAmount,
      'شرح / یادداشت': o.notes || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'لیست سفارشات');
  downloadWorkbook(workbook, fileName);
  return rows.length;
}

export function parseOrdersFromExcel(fileBuffer: ArrayBuffer): ExcelImportResult<ParsedOrderRow> {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['فایل اکسل خالی است.'], items: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['هیچ ردیفی در فایل یافت نشد.'], items: [] };
  }

  const items: ParsedOrderRow[] = [];
  const errors: string[] = [];

  const mapOrderStatus = (raw: string): OrderStatus => {
    const s = normalizeHeaderKey(raw);
    if (!s || s.includes('تکمیل') || s === 'completed') return 'completed';
    if (s.includes('تایید') || s.includes('تأیید') || s.includes('انتظار') || s === 'confirmed') return 'confirmed';
    if (s.includes('پردازش') || s === 'processing') return 'processing';
    if (s.includes('پیش') || s === 'draft') return 'draft';
    if (s.includes('لغو') || s === 'cancelled') return 'cancelled';
    return 'completed';
  };

  const mapPaymentStatus = (raw: string, total: number, paid: number): PaymentStatus => {
    const s = normalizeHeaderKey(raw);
    if (s.includes('کامل') || s === 'paid') return 'paid';
    if (s.includes('نشده') || s.includes('معوق') || s === 'pending' || s === 'unpaid') return 'pending';
    if (s.includes('بیعانه') || s.includes('بخشی') || s.includes('اقساط') || s === 'partially paid') return 'partially_paid';
    if (paid > 0 && total > 0 && paid < total) return 'partially_paid';
    if (paid >= total && total > 0) return 'paid';
    return 'pending';
  };

  rawRows.forEach((rawRow, idx) => {
    const rowNum = idx + 2;
    const row = normalizeRowKeys(rawRow);

    const orderNumber =
      getCell(row, ['شماره سفارش', 'شماره فاکتور', 'کد سفارش', 'order number', 'order no']) ||
      `IMP-${Date.now().toString().slice(-5)}-${idx + 1}`;

    const subtotal = getNumericCell(row, ['مبلغ کل اقلام (تومان)', 'مبلغ کل اقلام', 'مبلغ اقلام', 'subtotal']);
    const discount = getNumericCell(row, ['تخفیف (تومان)', 'تخفیف', 'discount']) ?? 0;
    const tax = getNumericCell(row, ['مالیات (تومان)', 'مالیات', 'tax']) ?? 0;
    const totalCell = getNumericCell(row, ['مبلغ نهایی فاکتور (تومان)', 'مبلغ نهایی فاکتور', 'مبلغ نهایی', 'مبلغ کل', 'total']);
    const paidCell = getNumericCell(row, ['مبلغ پرداختی (تومان)', 'مبلغ پرداختی', 'پرداختی', 'paid amount']);

    const total = totalCell ?? Math.max(0, (subtotal ?? 0) - discount + tax);
    const finalSubtotal = subtotal ?? Math.max(0, total + discount - tax);

    if (total <= 0 && finalSubtotal <= 0) {
      errors.push(`سطر ${rowNum} (${orderNumber}): مبلغ کل فاکتور باید بیشتر از صفر باشد.`);
      return;
    }

    const rawDate = row[normalizeHeaderKey('تاریخ ثبت')] || row[normalizeHeaderKey('تاریخ')] || row['date'] || row['order date'];
    const dateCreated = parseExcelDateToIso(rawDate);
    const status = mapOrderStatus(getCell(row, ['وضعیت سفارش', 'وضعیت', 'status']));
    const rawPayStatus = getCell(row, ['وضعیت پرداخت', 'payment status']);
    const paidAmount = paidCell !== undefined ? Math.max(0, paidCell) : rawPayStatus.includes('نشده') ? 0 : total;
    const paymentStatus = mapPaymentStatus(rawPayStatus, total, paidAmount);

    const customerPhoneRaw = getCell(row, ['شماره تماس', 'موبایل', 'تلفن', 'phone', 'customer phone']);
    const customerPhone = customerPhoneRaw === '-' ? '' : normalizeIranianPhone(customerPhoneRaw);
    const warehouseRaw = getCell(row, ['انبار تحویل', 'انبار', 'warehouse']);

    items.push({
      rowNumber: rowNum,
      orderNumber,
      dateCreated,
      customerName: getCell(row, ['نام مشتری', 'مشتری', 'customer', 'customer name']) || 'مشتری عمومی',
      customerPhone,
      warehouseName: warehouseRaw === '-' ? '' : warehouseRaw,
      status,
      paymentStatus,
      subtotal: Math.max(0, finalSubtotal),
      discount: Math.max(0, discount),
      tax: Math.max(0, tax),
      total: Math.max(0, total),
      paidAmount,
      notes: getCell(row, ['شرح / یادداشت', 'یادداشت', 'شرح', 'توضیحات', 'notes']),
    });
  });

  return {
    success: items.length > 0,
    importedCount: items.length,
    updatedCount: 0,
    errors,
    items,
  };
}

/**
 * -------------------------------------------------------------
 * 4. CUSTOMERS EXCEL EXPORT & IMPORT
 * -------------------------------------------------------------
 */

export interface CustomerExportRow {
  'نام و نام خانوادگی': string;
  'شماره تماس': string;
  'موبایل': string;
  'ایمیل': string;
  'استان': string;
  'شهر': string;
  'کد پستی': string;
  'آدرس': string;
  'یادداشت': string;
  'وضعیت': string;
}

export function exportCustomersToExcel(
  customers: Customer[],
  fileName: string = `tankhor_customers_${new Date().toISOString().slice(0, 10)}.xlsx`
): number {
  if (!customers || customers.length === 0) return 0;

  const rows: CustomerExportRow[] = customers.map((c) => {
    return {
      'نام و نام خانوادگی': c.name || (c as any).full_name || '',
      'شماره تماس': c.phone || '',
      'موبایل': (c as any).mobile || c.phone || '',
      'ایمیل': c.email || '',
      'استان': (c as any).province || '',
      'شهر': (c as any).city || '',
      'کد پستی': (c as any).postal_code || '',
      'آدرس': c.address || '',
      'یادداشت': c.notes || '',
      'وضعیت': c.status === 'inactive' ? 'غیرفعال' : 'فعال',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'مشتریان');
  downloadWorkbook(workbook, fileName);
  return rows.length;
}

export function parseCustomersFromExcel(fileBuffer: ArrayBuffer): ExcelImportResult<Partial<Customer>> {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['فایل اکسل خالی است.'], items: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['سطری در فایل اکسل یافت نشد.'], items: [] };
  }

  const items: Partial<Customer>[] = [];
  const errors: string[] = [];

  rawRows.forEach((rawRow, idx) => {
    const row = normalizeRowKeys(rawRow);
    const rawName = getCell(row, ['نام و نام خانوادگی', 'نام مشتری', 'نام کامل', 'نام', 'name', 'full name']);
    if (!rawName) {
      errors.push(`سطر ${idx + 2}: نام مشتری خالی است.`);
      return;
    }

    const rawPhone = getCell(row, ['شماره تماس', 'تلفن', 'تلفن همراه', 'موبایل', 'phone', 'mobile']);
    const rawMobile = getCell(row, ['موبایل', 'تلفن همراه', 'mobile']) || rawPhone;
    const rawEmail = getCell(row, ['ایمیل', 'پست الکترونیک', 'email']);
    const rawAddress = getCell(row, ['آدرس', 'نشانی', 'address']);
    const rawCity = getCell(row, ['شهر', 'city']);
    const rawProvince = getCell(row, ['استان', 'province']);
    const rawPostalCode = toEnglishDigits(getCell(row, ['کد پستی', 'کدپستی', 'postal code']));
    const rawNotes = getCell(row, ['یادداشت', 'توضیحات', 'notes']);
    const rawStatus = getCell(row, ['وضعیت', 'status']).toLowerCase();
    const status = rawStatus === 'غیرفعال' || rawStatus === 'inactive' ? 'inactive' : 'active';

    const addressParts = [
      rawProvince,
      rawCity,
      rawAddress,
      rawPostalCode ? `کدپستی: ${rawPostalCode}` : '',
    ].filter((part) => Boolean(part && part.trim()));

    items.push({
      name: rawName,
      phone: normalizeIranianPhone(rawMobile || rawPhone),
      email: rawEmail,
      address: addressParts.join(' - ') || rawAddress,
      notes: rawNotes,
      status,
    });
  });

  return {
    success: items.length > 0,
    importedCount: items.length,
    updatedCount: 0,
    errors,
    items,
  };
}


