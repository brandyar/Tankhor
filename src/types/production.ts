import { Status } from './index';

export type RawMaterialCategory =
  | 'fabric'       // پارچه
  | 'thread'       // نخ
  | 'zipper'       // زیپ
  | 'button'       // دکمه
  | 'lining'       // لایی / آستر
  | 'label'        // مارک و لیبل
  | 'packaging'    // کاور / بسته‌بندی
  | 'other';       // سایر خرج‌کار

export type ContractorSpecialty =
  | 'cutting'      // برش‌کار
  | 'sewing'       // مزد‌دوز / خیاط
  | 'embroidery'   // گلدوز
  | 'printing'     // چاپ‌کار
  | 'washing'      // سنگ‌شور / شست‌وشو
  | 'iron_pack'    // اتو و بسته‌بندی
  | 'general';     // عمومی

export type ProductionOrderStatus =
  | 'draft'        // پیش‌نویس
  | 'cutting'      // در حال برش
  | 'in_progress'  // در حال دوخت / برون‌سپاری
  | 'qc'           // در حال کنترل کیفیت
  | 'completed'    // تکمیل‌شده
  | 'cancelled';   // لغوشده

export type ProductionStageType =
  | 'cutting'      // برش
  | 'printing'     // چاپ
  | 'embroidery'   // گلدوزی
  | 'sewing'       // دوخت
  | 'washing'      // شست‌وشو
  | 'iron_pack'    // اتو و بسته‌بندی
  | 'qc';          // کنترل کیفیت

export type ProductionStageStatus =
  | 'pending'      // در انتظار
  | 'in_progress'  // در حال انجام
  | 'completed';   // تکمیل‌شده

/**
 * انبار متریال و مواد اولیه / خرج‌کار
 */
export interface RawMaterial {
  id: number;
  organization_id: number;
  name: string;
  code: string; // شناسه کد متریال (e.g. MAT-001)
  unit: string; // واحد سنجش (متر، کیلو، طاقه، عدد، جین...)
  category: RawMaterialCategory;
  warehouse_id?: number | null;
  current_stock: number;
  min_stock?: number | null;
  unit_cost: number;
  color_hex?: string | null;
  description?: string | null;
  status: Status;
  date_created?: string;
  date_updated?: string;
}

/**
 * آیتم فرمول ساخت (BOM Item)
 */
export interface BomItem {
  id: number;
  bom_id: number;
  raw_material_id: number;
  quantity_required: number; // مقدار متریال لازم برای ۱ عدد محصول
  unit_cost?: number;
  notes?: string | null;
  // Joined fields
  raw_material?: RawMaterial;
}

/**
 * شناسنامه تولید و فرمول ساخت (Bill of Materials)
 */
export interface BillOfMaterials {
  id: number;
  organization_id: number;
  product_id: number;
  variant_id?: number | null; // در صورت متفاوت بودن فرمول سایز/رنگ
  name: string;
  version?: string; // e.g. "v1.0"
  waste_percentage?: number; // درصد ضایعات استاندارد (e.g. 5%)
  notes?: string | null;
  status: Status;
  date_created?: string;
  date_updated?: string;
  // Joined / nested items
  items?: BomItem[];
  product_name?: string;
  variant_sku?: string;
  estimated_cost?: number;
}

/**
 * پیمانکاران و کارمزدی‌ها (مزد‌دوز، چاپ‌کار، اتوکار...)
 */
export interface Contractor {
  id: number;
  organization_id: number;
  name: string;
  specialty: ContractorSpecialty;
  phone?: string | null;
  address?: string | null;
  current_balance?: number; // مثبت = بستانکار (طلبکار)، منفی = بدهکار
  status: Status;
  date_created?: string;
  date_updated?: string;
}

/**
 * دستور کار و سفارش تولید (Production Order / Cut Order)
 */
export interface ProductionOrder {
  id: number;
  organization_id: number;
  order_number: string; // شماره دستور کار (e.g. CUT-1403-001)
  product_id: number;
  bom_id?: number | null;
  target_warehouse_id?: number | null; // انبار مقصد کالای ساخته‌شده
  total_quantity: number;
  status: ProductionOrderStatus;
  start_date?: string | null;
  due_date?: string | null;
  completed_date?: string | null;
  estimated_unit_cost?: number;
  actual_unit_cost?: number;
  notes?: string | null;
  date_created?: string;
  date_updated?: string;
  // Joined fields
  product_name?: string;
  target_warehouse_name?: string;
  items?: ProductionOrderItem[];
  stages?: ProductionStage[];
}

/**
 * تفکیک تنوع‌ها و سایزهای سفارش تولید
 */
export interface ProductionOrderItem {
  id: number;
  production_order_id: number;
  variant_id: number;
  quantity_planned: number;
  quantity_completed?: number;
  quantity_rejected?: number;
  // Joined fields
  variant_sku?: string;
  variant_label?: string;
  color_name?: string;
  size_name?: string;
}

/**
 * مراحل خط تولید و کارمزدی برون‌سپاری
 */
export interface ProductionStage {
  id: number;
  production_order_id: number;
  contractor_id?: number | null;
  stage_type: ProductionStageType;
  status: ProductionStageStatus;
  unit_fee: number; // اجرت کارمزد به ازای ۱ عدد
  total_fee: number;
  quantity_sent: number;
  quantity_received: number;
  quantity_damaged?: number;
  sent_date?: string | null;
  received_date?: string | null;
  notes?: string | null;
  // Joined fields
  contractor_name?: string;
}
