import {
  Organization, OrganizationUser, Category, Collection, Season, Color, Brand,
  SizeGroup, Size, Product, ProductVariant, Warehouse, WarehouseLocation,
  InventoryItem, InventoryMovement, Customer, Order, OrderItem,
  Supplier, PurchaseOrder, PurchaseOrderItem, StockTransfer, StockTransferItem,
  SizeGuideTemplate, SizeGuideMeasurement, SizeGuideValue
} from '../types';

export type StorageMode = 'local_offline' | 'cloud_synced';

export interface QueryParams {
  organization_id?: number;
  search?: string;
  status?: string;
  category_id?: number;
  warehouse_id?: number;
  variant_id?: number;
  type?: string;
  page?: number;
  limit?: number;
}

export interface SyncQueueItem {
  id: string;
  collection: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: string;
}

export interface IStorageProvider {
  mode: StorageMode;

  // Organizations
  getOrganizations(): Promise<Organization[]>;
  getOrganizationById(id: number): Promise<Organization | null>;
  saveOrganization(org: Partial<Organization>): Promise<Organization>;

  // Products & Variants
  getProducts(params?: QueryParams): Promise<Product[]>;
  getProductById(id: number): Promise<Product | null>;
  saveProduct(product: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<boolean>;

  getVariants(params?: QueryParams): Promise<ProductVariant[]>;
  getVariantsByProductId(productId: number): Promise<ProductVariant[]>;
  saveVariant(variant: Partial<ProductVariant>, warehouseId?: number, locationId?: number): Promise<ProductVariant>;
  deleteVariant(id: number): Promise<boolean>;

  // Catalog Attributes
  getCategories(params?: QueryParams): Promise<Category[]>;
  saveCategory(cat: Partial<Category>): Promise<Category>;
  deleteCategory(id: number): Promise<boolean>;

  getCollections(params?: QueryParams): Promise<Collection[]>;
  saveCollection(col: Partial<Collection>): Promise<Collection>;
  deleteCollection(id: number): Promise<boolean>;

  getBrands(params?: QueryParams): Promise<Brand[]>;
  saveBrand(brand: Partial<Brand>): Promise<Brand>;
  deleteBrand(id: number): Promise<boolean>;

  getSeasons(params?: QueryParams): Promise<Season[]>;
  saveSeason(season: Partial<Season>): Promise<Season>;
  deleteSeason(id: number): Promise<boolean>;

  getColors(params?: QueryParams): Promise<Color[]>;
  saveColor(color: Partial<Color>): Promise<Color>;
  deleteColor(id: number): Promise<boolean>;

  getSizeGroups(params?: QueryParams): Promise<SizeGroup[]>;
  saveSizeGroup(group: Partial<SizeGroup>): Promise<SizeGroup>;
  deleteSizeGroup(id: number): Promise<boolean>;

  getSizes(params?: QueryParams): Promise<Size[]>;
  saveSize(size: Partial<Size>): Promise<Size>;
  deleteSize(id: number): Promise<boolean>;

  // Warehouses & Locations
  getWarehouses(params?: QueryParams): Promise<Warehouse[]>;
  saveWarehouse(wh: Partial<Warehouse>): Promise<Warehouse>;
  deleteWarehouse(id: number): Promise<boolean>;

  getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]>;
  getLocations(params?: QueryParams): Promise<WarehouseLocation[]>;
  getLocationsByWarehouseId(warehouseId: number): Promise<WarehouseLocation[]>;
  saveWarehouseLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation>;
  saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation>;
  deleteWarehouseLocation(id: number): Promise<boolean>;

  // Inventory
  getInventoryItems(params?: QueryParams): Promise<InventoryItem[]>;
  saveInventoryItem(item: Partial<InventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: number): Promise<boolean>;
  getInventoryMovements(params?: QueryParams): Promise<InventoryMovement[]>;
  recordMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement>;

  // Orders
  getOrders(params?: QueryParams): Promise<Order[]>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order>;

  // Customers
  getCustomers(params?: QueryParams): Promise<Customer[]>;
  saveCustomer(cust: Partial<Customer>): Promise<Customer>;

  // Suppliers & Purchase Orders
  getSuppliers(params?: QueryParams): Promise<Supplier[]>;
  saveSupplier(sup: Partial<Supplier>): Promise<Supplier>;

  getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]>;
  savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder>;

  // Stock Transfers
  getStockTransfers(params?: QueryParams): Promise<StockTransfer[]>;
  saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer>;

  // Size Guides
  getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]>;
  saveSizeGuideTemplate(tpl: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate>;
  deleteSizeGuideTemplate(id: number): Promise<boolean>;

  getSizeGuideMeasurements(templateId: number): Promise<SizeGuideMeasurement[]>;
  saveSizeGuideMeasurement(meas: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement>;
  deleteSizeGuideMeasurement(id: number): Promise<boolean>;

  getSizeGuideValues(templateId: number): Promise<SizeGuideValue[]>;
  saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue>;
  deleteSizeGuideValue(id: number): Promise<boolean>;
}
