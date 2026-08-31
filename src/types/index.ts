/**
 * TANKHOR (تن‌خور) - Core Domain Types
 * Derived strictly from directus-schema.json (25 collections)
 */

export type Status = 'active' | 'archived' | 'draft' | 'published' | 'suspended' | 'invited' | 'inactive';

export type PlanType = 'free' | 'pro';

export type UserRole = 'owner' | 'manager' | 'warehouse' | 'sales' | 'viewer';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  currency: string; // e.g. 'TOMAN', 'IRR', 'USD'
  timezone: string;
  plan: PlanType;
  status: Status;
  date_created?: string;
  date_updated?: string;
}

export interface OrganizationUser {
  id: number;
  organization_id: number | Organization;
  user_id: string; // Directus user UUID
  role: UserRole;
  status: Status;
  date_joined?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  password?: string;
}

export interface Category {
  id: number;
  organization_id: number;
  name: string;
  slug: string;
  parent_id?: number | Category | null;
  image?: string;
  description?: string;
  sort?: number;
  status: Status;
  date_created?: string;
  date_updated?: string;
}

export interface Collection {
  id: number;
  organization_id: number;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  sort?: number;
  status: Status;
  date_created?: string;
  date_updated?: string;
}

export interface Season {
  id: number;
  organization_id: number;
  name: string;
  code?: string;
  start_date?: string;
  end_date?: string;
  status: Status;
  date_created?: string;
}

export interface Color {
  id: number;
  organization_id: number;
  name: string;
  code?: string;
  hex?: string;
  status: Status;
  date_created?: string;
}

export interface Brand {
  id: number;
  organization_id: number;
  name: string;
  code?: string;
  logo?: string;
  description?: string;
  status: Status;
  date_created?: string;
  date_updated?: string;
}

export type SizeCategory = 'apparel' | 'shoes' | 'accessories' | 'other';

export interface SizeGroup {
  id: number;
  organization_id: number;
  name: string;
  category: SizeCategory;
  status: Status;
  date_created?: string;
}

export interface Size {
  id: number;
  organization_id: number;
  size_group_id?: number | SizeGroup;
  name: string;
  code?: string;
  sort?: number;
  status: Status;
  date_created?: string;
}

export interface Product {
  id: number;
  organization_id: number;
  title: string;
  slug?: string;
  description?: string;
  category_id?: number | Category;
  collection_id?: number | Collection;
  season_id?: number | Season;
  size_guide_template_id?: number | SizeGuideTemplate;
  main_image?: string;
  brand_id?: number | Brand;
  brand?: string | Brand;
  tags?: string;
  sort?: number;
  status: 'published' | 'draft' | 'archived';
  user_created?: string;
  user_updated?: string;
  date_created?: string;
  date_updated?: string;
  variants_count?: number;
  total_stock?: number;
}

export interface ProductVariant {
  id: number;
  organization_id: number;
  product_id: number | Product;
  color_id?: number | Color;
  size_id?: number | Size;
  sku: string;
  barcode?: string;
  price?: number;
  cost?: number;
  image?: string;
  status: 'published' | 'draft' | 'archived';
  sort?: number;
  user_created?: string;
  user_updated?: string;
  date_created?: string;
  date_updated?: string;
  product_title?: string;
  color_name?: string;
  size_name?: string;
  stock_quantity?: number;
}

export type WarehouseType = 'warehouse' | 'store' | 'other';

export interface Warehouse {
  id: number;
  organization_id: number;
  name: string;
  code?: string;
  type: WarehouseType;
  address?: string;
  phone?: string;
  status: Status;
  date_created?: string;
  date_updated?: string;
}

export type LocationType = 'zone' | 'aisle' | 'rack' | 'shelf' | 'bin' | 'other';

export interface WarehouseLocation {
  id: number;
  warehouse_id: number | Warehouse;
  parent_id?: number | WarehouseLocation;
  name: string;
  code?: string;
  type: LocationType;
  barcode?: string;
  status: Status;
  date_created?: string;
}

export interface InventoryItem {
  id: number;
  organization_id: number;
  variant_id: number | ProductVariant;
  warehouse_id: number | Warehouse;
  location_id?: number | WarehouseLocation;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  damaged_quantity: number;
  reorder_point?: number;
  safety_stock?: number;
  updated_at?: string;
  sku?: string;
  product_title?: string;
  color_name?: string;
  size_name?: string;
  warehouse_name?: string;
  location_name?: string;
}

export type MovementType = 'purchase' | 'sale' | 'return' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'damage';
export type MovementReferenceType = 'order' | 'purchase_order' | 'return' | 'adjustment' | 'transfer' | 'manual';

export interface InventoryMovement {
  id: number;
  organization_id: number;
  variant_id: number | ProductVariant;
  warehouse_id: number | Warehouse;
  location_id?: number | WarehouseLocation;
  type: MovementType;
  quantity: number;
  reference_type?: MovementReferenceType;
  reference_id?: string;
  note?: string;
  user_id?: string;
  created_at?: string;
  sku?: string;
  warehouse_name?: string;
}

export interface Customer {
  id: number;
  organization_id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status: Status;
  date_created?: string;
  date_updated?: string;
}

export type OrderStatus = 'draft' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded';

export interface Order {
  id: number;
  organization_id: number;
  customer_id?: number | Customer;
  warehouse_id: number | Warehouse;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  user_created?: string;
  date_created?: string;
  date_updated?: string;
  customer_name?: string;
  items_count?: number;
}

export interface OrderItem {
  id: number;
  organization_id: number;
  order_id: number | Order;
  variant_id: number | ProductVariant;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  created_at?: string;
  variant_sku?: string;
}

export interface Supplier {
  id: number;
  organization_id: number;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status: Status;
  date_created?: string;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: number;
  organization_id: number;
  supplier_id: number | Supplier;
  warehouse_id: number | Warehouse;
  purchase_number: string;
  status: PurchaseOrderStatus;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  expected_date?: string;
  notes?: string;
  user_created?: string;
  date_created?: string;
  date_updated?: string;
  supplier_name?: string;
}

export interface PurchaseOrderItem {
  id: number;
  organization_id: number;
  purchase_order_id: number | PurchaseOrder;
  variant_id: number | ProductVariant;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total: number;
  created_at?: string;
}

export type TransferStatus = 'draft' | 'in_transit' | 'completed' | 'cancelled';

export interface StockTransfer {
  id: number;
  organization_id: number;
  from_warehouse_id: number | Warehouse;
  to_warehouse_id: number | Warehouse;
  transfer_number: string;
  status: TransferStatus;
  notes?: string;
  user_created?: string;
  date_created?: string;
  date_updated?: string;
  from_warehouse_name?: string;
  to_warehouse_name?: string;
}

export interface StockTransferItem {
  id: number;
  organization_id: number;
  transfer_id: number | StockTransfer;
  variant_id: number | ProductVariant;
  quantity: number;
  from_location_id?: number | WarehouseLocation;
  to_location_id?: number | WarehouseLocation;
  created_at?: string;
}

export type SizeGuideType = 'apparel' | 'footwear' | 'bags' | 'accessories' | 'custom';
export type SizeUnit = 'cm' | 'in' | 'mm';

export interface SizeGuideTemplate {
  id: number;
  organization_id: number;
  name: string;
  type: SizeGuideType;
  unit: SizeUnit;
  description?: string;
  status: Status;
  date_created?: string;
  date_updated?: string;
}

export type MeasurementUnit = 'default' | 'cm' | 'in' | 'mm' | 'g' | 'kg';
export type MeasurementType = 'length' | 'width' | 'height' | 'depth' | 'circumference' | 'weight' | 'diameter' | 'custom';

export interface SizeGuideMeasurement {
  id: number;
  template_id: number | SizeGuideTemplate;
  name: string;
  code?: string;
  unit: MeasurementUnit;
  type: MeasurementType;
  sort?: number;
  status: Status;
}

export interface SizeGuideValue {
  id: number;
  template_id: number | SizeGuideTemplate;
  size_id: number | Size;
  measurement_id: number | SizeGuideMeasurement;
  value?: number;
  min_value?: number;
  max_value?: number;
  sort?: number;
}

export interface ProjectSettings {
  id?: number;
  windows_setup?: string | null;
  macos_setup?: string | null;
  adnroid_setup?: string | null;
  android_setup?: string | null;
  date_updated?: string | null;
}
