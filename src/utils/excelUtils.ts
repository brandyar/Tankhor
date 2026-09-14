import * as XLSX from 'xlsx';
import { Product, ProductVariant, InventoryItem, Order, OrderItem, Category, Brand, Color, Size, Warehouse, Customer } from '../types';

export interface ExcelImportResult<T> {
  success: boolean;
  importedCount: number;
  updatedCount: number;
  errors: string[];
  items: T[];
}

/**
 * Trigger browser download for a workbook
 */
export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', type: 'binary' });
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
  'وضعیت تنوع': string;
}

export function exportProductsToExcel(
  products: Product[],
  variants: ProductVariant[],
  categories: Category[],
  brands: Brand[],
  colors: Color[],
  sizes: Size[],
  fileName: string = `tankhor_products_${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const rows: ProductExportRow[] = [];

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const brandMap = new Map(brands.map((b) => [b.id, b.name]));
  const colorMap = new Map(colors.map((c) => [c.id, c]));
  const sizeMap = new Map(sizes.map((s) => [s.id, s.name]));

  // Group variants by product
  const variantsByProduct = new Map<number, ProductVariant[]>();
  variants.forEach((v) => {
    const pId = typeof v.product_id === 'object' ? (v.product_id as any)?.id : Number(v.product_id);
    if (!variantsByProduct.has(pId)) {
      variantsByProduct.set(pId, []);
    }
    variantsByProduct.get(pId)!.push(v);
  });

  products.forEach((p) => {
    const pVariants = variantsByProduct.get(p.id) || [];
    const catName = p.category_id ? catMap.get(typeof p.category_id === 'object' ? (p.category_id as any).id : p.category_id) || '' : '';
    const brandName = p.brand_id ? brandMap.get(typeof p.brand_id === 'object' ? (p.brand_id as any).id : p.brand_id) || (typeof p.brand === 'string' ? p.brand : '') : (typeof p.brand === 'string' ? p.brand : '');

    if (pVariants.length === 0) {
      // Product with no variants yet
      rows.push({
        'کد محصول (کد مدل)': (p as any).code || '',
        'عنوان محصول': p.title || '',
        'دسته‌بندی': catName,
        'برند': brandName,
        'کالکشن': (p as any).collection_name || '',
        'فصل': (p as any).season_name || '',
        'جنسیت': (p as any).gender || 'unisex',
        'جنس/پارچه': (p as any).material || '',
        'وضعیت انتشار': p.status === 'published' ? 'منتشر شده' : 'پیش‌نویس',
        'شناسه کالا (SKU)': '',
        'بارکد تنوع': '',
        'رنگ': '',
        'کد رنگ': '',
        'سایز': '',
        'قیمت فروش (تومان)': 0,
        'قیمت خرید/تمام‌شده (تومان)': 0,
        'قیمت عمده‌فروشی (تومان)': 0,
        'وزن (گرم)': 0,
        'وضعیت تنوع': 'فعال',
      });
    } else {
      pVariants.forEach((v) => {
        const cId = typeof v.color_id === 'object' ? (v.color_id as any)?.id : Number(v.color_id);
        const sId = typeof v.size_id === 'object' ? (v.size_id as any)?.id : Number(v.size_id);
        const colObj = colorMap.get(cId);
        const colorName = v.color_name || colObj?.name || '';
        const colorHex = (colObj as any)?.hex || (colObj as any)?.hex_code || colObj?.code || '';
        const sizeName = v.size_name || sizeMap.get(sId) || '';

        rows.push({
          'کد محصول (کد مدل)': (p as any).code || '',
          'عنوان محصول': p.title || '',
          'دسته‌بندی': catName,
          'برند': brandName,
          'کالکشن': (p as any).collection_name || '',
          'فصل': (p as any).season_name || '',
          'جنسیت': (p as any).gender || 'unisex',
          'جنس/پارچه': (p as any).material || '',
          'وضعیت انتشار': p.status === 'published' ? 'منتشر شده' : 'پیش‌نویس',
          'شناسه کالا (SKU)': v.sku || '',
          'بارکد تنوع': v.barcode || '',
          'رنگ': colorName,
          'کد رنگ': colorHex,
          'سایز': sizeName,
          'قیمت فروش (تومان)': Number(v.price) || 0,
          'قیمت خرید/تمام‌شده (تومان)': Number((v as any).cost_price || v.cost) || 0,
          'قیمت عمده‌فروشی (تومان)': Number((v as any).wholesale_price || v.price) || 0,
          'وزن (گرم)': Number((v as any).weight_grams || (v as any).weight) || 0,
          'وضعیت تنوع': String(v.status) === 'active' || String(v.status) === 'published' ? 'فعال' : 'غیرفعال',
        });
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'محصولات و تنوع‌ها');
  downloadWorkbook(workbook, fileName);
}

export function parseProductsFromExcel(fileBuffer: ArrayBuffer): ExcelImportResult<Partial<ProductExportRow>> {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['فایل اکسل خالی است یا برگه معتبری ندارد.'], items: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

  if (!rows || rows.length === 0) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['هیچ ردیفی در فایل یافت نشد.'], items: [] };
  }

  return {
    success: true,
    importedCount: rows.length,
    updatedCount: 0,
    errors: [],
    items: rows,
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
  'موقیعت در انبار': string;
  'موجودی فیزیکی': number;
  'موجودی رزرو شده': number;
  'موجودی قابل فروش': number;
  'نقطه سفارش مجدد': number;
  'موجودی اطمینان': number;
  'قیمت واحد (تومان)': number;
  'ارزش کل ریالی': number;
}

export function exportInventoryToExcel(
  items: InventoryItem[],
  variants: ProductVariant[],
  warehouses: Warehouse[],
  fileName: string = `tankhor_inventory_${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const whMap = new Map(warehouses.map((w) => [w.id, w.name]));
  const varMap = new Map(variants.map((v) => [v.id, v]));

  const rows: InventoryExportRow[] = items.map((item) => {
    const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : Number(item.variant_id);
    const wId = typeof item.warehouse_id === 'object' ? (item.warehouse_id as any)?.id : Number(item.warehouse_id);
    const v = varMap.get(vId);
    const whName = item.warehouse_name || whMap.get(wId) || 'انبار اصلی';
    const sku = item.sku || v?.sku || '-';
    const barcode = v?.barcode || '-';
    const prodTitle = item.product_title || v?.product_title || '-';
    const colorName = v?.color_name || (typeof v?.color_id === 'object' ? (v.color_id as any)?.name : '') || '-';
    const sizeName = v?.size_name || (typeof v?.size_id === 'object' ? (v.size_id as any)?.name : '') || '-';

    const qty = Number(item.quantity) || 0;
    const reserved = Number(item.reserved_quantity) || 0;
    const available = Number(item.available_quantity) || (qty - reserved);
    const unitPrice = Number(v?.price) || 0;

    return {
      'شناسه کالا (SKU)': sku,
      'بارکد': barcode,
      'عنوان محصول': prodTitle,
      'رنگ': colorName,
      'سایز': sizeName,
      'نام انبار': whName,
      'موقیعت در انبار': item.location_name || '-',
      'موجودی فیزیکی': qty,
      'موجودی رزرو شده': reserved,
      'موجودی قابل فروش': available,
      'نقطه سفارش مجدد': item.reorder_point || 5,
      'موجودی اطمینان': item.safety_stock || 2,
      'قیمت واحد (تومان)': unitPrice,
      'ارزش کل ریالی': qty * unitPrice,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'موجودی انبار');
  downloadWorkbook(workbook, fileName);
}

export function parseInventoryFromExcel(fileBuffer: ArrayBuffer): ExcelImportResult<any> {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['فایل اکسل خالی است.'], items: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

  return {
    success: true,
    importedCount: rows?.length || 0,
    updatedCount: 0,
    errors: [],
    items: rows || [],
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

export function exportOrdersToExcel(
  orders: Order[],
  fileName: string = `tankhor_orders_${new Date().toISOString().slice(0, 10)}.xlsx`
) {
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

  const rows: OrderExportRow[] = orders.map((o) => {
    return {
      'شماره سفارش': o.order_number || '',
      'تاریخ ثبت': o.date_created?.slice(0, 10) || '',
      'نام مشتری': o.customer_name || 'مشتری عمومی',
      'شماره تماس': (o as any).customer_phone || (o as any).customer_mobile || '-',
      'انبار تحویل': (o as any).warehouse_name || 'انبار اصلی',
      'وضعیت سفارش': statusLabels[o.status] || o.status,
      'وضعیت پرداخت': paymentLabels[o.payment_status] || o.payment_status,
      'مبلغ کل اقلام (تومان)': Number(o.subtotal) || 0,
      'تخفیف (تومان)': Number(o.discount) || 0,
      'مالیات (تومان)': Number(o.tax) || 0,
      'مبلغ نهایی فاکتور (تومان)': Number(o.total) || 0,
      'مبلغ پرداختی (تومان)': Number((o as any).paid_amount || o.total) || 0,
      'شرح / یادداشت': o.notes || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'لیست سفارشات');
  downloadWorkbook(workbook, fileName);
}

export function parseOrdersFromExcel(fileBuffer: ArrayBuffer): ExcelImportResult<any> {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['فایل اکسل خالی است.'], items: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

  return {
    success: true,
    importedCount: rows?.length || 0,
    updatedCount: 0,
    errors: [],
    items: rows || [],
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
) {
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
}

export function parseCustomersFromExcel(fileBuffer: ArrayBuffer): ExcelImportResult<Partial<Customer>> {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['فایل اکسل خالی است.'], items: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

  if (!rows || rows.length === 0) {
    return { success: false, importedCount: 0, updatedCount: 0, errors: ['سطری در فایل اکسل یافت نشد.'], items: [] };
  }

  const items: Partial<Customer>[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const rawName = row['نام و نام خانوادگی'] || row['نام مشتری'] || row['نام'] || row['name'] || row['full_name'];
    if (!rawName || !String(rawName).trim()) {
      errors.push(`سطر ${idx + 2}: نام مشتری خالی است.`);
      return;
    }

    const rawPhone = row['شماره تماس'] || row['تلفن'] || row['تلفن همراه'] || row['موبایل'] || row['phone'] || row['mobile'] || '';
    const rawMobile = row['موبایل'] || row['تلفن همراه'] || row['mobile'] || rawPhone || '';
    const rawEmail = row['ایمیل'] || row['پست الکترونیک'] || row['email'] || '';
    const rawAddress = row['آدرس'] || row['نشانی'] || row['address'] || '';
    const rawCity = row['شهر'] || row['city'] || '';
    const rawProvince = row['استان'] || row['province'] || '';
    const rawPostalCode = row['کد پستی'] || row['کدپستی'] || row['postal_code'] || '';
    const rawNotes = row['یادداشت'] || row['توضیحات'] || row['notes'] || '';
    const rawStatus = row['وضعیت'] || row['status'];
    const status = (rawStatus === 'غیرفعال' || rawStatus === 'inactive') ? 'inactive' : 'active';

    items.push({
      name: String(rawName).trim(),
      phone: String(rawMobile || rawPhone).trim(),
      email: String(rawEmail).trim(),
      address: [rawProvince, rawCity, rawAddress, rawPostalCode ? `کدپستی: ${rawPostalCode}` : ''].filter(Boolean).join(' - ').trim() || String(rawAddress).trim(),
      notes: String(rawNotes).trim(),
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

