import {
  Organization, OrganizationUser, Category, Collection, Season, Color, Brand,
  SizeGroup, Size, Product, ProductVariant, Warehouse, WarehouseLocation,
  InventoryItem, InventoryMovement, Customer, Order, OrderItem,
  Supplier, PurchaseOrder, PurchaseOrderItem, StockTransfer, StockTransferItem,
  SizeGuideTemplate, SizeGuideMeasurement, SizeGuideValue,
  Subscription, SystemModule, OrganizationModule,
  ExpenseCategory, Expense, PersonTransaction, ProfitLossSummary,
  FinancialAccount, TreasuryTransaction, Cheque, ChequeStatus,
  LandedCost, LandedCostAllocation, VatReportSummary
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
  period?: string;
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

  // Organization Users & Roles
  getOrganizationUsers(params?: QueryParams): Promise<OrganizationUser[]>;
  saveOrganizationUser(user: Partial<OrganizationUser>): Promise<OrganizationUser>;
  deleteOrganizationUser(id: number): Promise<boolean>;

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
  deleteOrder?(id: number): Promise<boolean>;

  // Customers
  getCustomers(params?: QueryParams): Promise<Customer[]>;
  saveCustomer(cust: Partial<Customer>): Promise<Customer>;
  deleteCustomer?(id: number): Promise<boolean>;

  // Suppliers & Purchase Orders
  getSuppliers(params?: QueryParams): Promise<Supplier[]>;
  saveSupplier(sup: Partial<Supplier>): Promise<Supplier>;
  deleteSupplier?(id: number): Promise<boolean>;

  getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]>;
  getPurchaseOrderItems(purchaseOrderId?: number): Promise<PurchaseOrderItem[]>;
  savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder>;
  deletePurchaseOrder?(id: number): Promise<boolean>;

  // Stock Transfers
  getStockTransfers(params?: QueryParams): Promise<StockTransfer[]>;
  saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer>;
  deleteStockTransfer?(id: number): Promise<boolean>;

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

  // Subscriptions
  getSubscriptions?(params?: QueryParams): Promise<Subscription[]>;
  getActiveSubscription?(organizationId: number): Promise<Subscription | null>;
  saveSubscription?(sub: Partial<Subscription>): Promise<Subscription>;

  // System & Organization Modules
  getSystemModules?(params?: QueryParams): Promise<SystemModule[]>;
  getOrganizationModules?(params?: QueryParams): Promise<OrganizationModule[]>;
  saveOrganizationModule?(mod: Partial<OrganizationModule>): Promise<OrganizationModule>;
  deleteOrganizationModule?(id: number): Promise<boolean>;

  // Accounting & Financials (Phase 1)
  getExpenseCategories(params?: QueryParams): Promise<ExpenseCategory[]>;
  saveExpenseCategory(cat: Partial<ExpenseCategory>): Promise<ExpenseCategory>;
  deleteExpenseCategory(id: number): Promise<boolean>;

  getExpenses(params?: QueryParams): Promise<Expense[]>;
  saveExpense(exp: Partial<Expense>): Promise<Expense>;
  deleteExpense(id: number): Promise<boolean>;

  getPersonTransactions(params?: QueryParams): Promise<PersonTransaction[]>;
  savePersonTransaction(tx: Partial<PersonTransaction>): Promise<PersonTransaction>;
  deletePersonTransaction?(id: number): Promise<boolean>;

  getProfitLossSummary(params?: QueryParams): Promise<ProfitLossSummary>;

  // Accounting & Treasury (Phase 2)
  getFinancialAccounts(params?: QueryParams): Promise<FinancialAccount[]>;
  getFinancialAccountById?(id: number): Promise<FinancialAccount | null>;
  saveFinancialAccount(account: Partial<FinancialAccount>): Promise<FinancialAccount>;
  deleteFinancialAccount(id: number): Promise<boolean>;

  getTreasuryTransactions(params?: QueryParams): Promise<TreasuryTransaction[]>;
  saveTreasuryTransaction(tx: Partial<TreasuryTransaction>): Promise<TreasuryTransaction>;
  deleteTreasuryTransaction?(id: number): Promise<boolean>;

  getCheques(params?: QueryParams): Promise<Cheque[]>;
  getChequeById?(id: number): Promise<Cheque | null>;
  saveCheque(cheque: Partial<Cheque>): Promise<Cheque>;
  deleteCheque(id: number): Promise<boolean>;
  updateChequeStatus?(id: number, status: ChequeStatus, targetAccountId?: number): Promise<Cheque>;

  // Accounting & Landed Costs & Tax (Phase 3)
  getLandedCosts(params?: QueryParams): Promise<LandedCost[]>;
  getLandedCostById?(id: number): Promise<LandedCost | null>;
  saveLandedCost(cost: Partial<LandedCost>, allocations?: Partial<LandedCostAllocation>[]): Promise<LandedCost>;
  deleteLandedCost(id: number): Promise<boolean>;
  getLandedCostAllocations?(landedCostId?: number, purchaseOrderId?: number): Promise<LandedCostAllocation[]>;
  saveLandedCostAllocation?(allocation: Partial<LandedCostAllocation>): Promise<LandedCostAllocation>;
  applyLandedCostToVariants?(landedCostId: number): Promise<{ updatedVariantsCount: number }>;
  getVatReport?(params?: { organizationId?: number; year?: number; quarter?: 1 | 2 | 3 | 4 }): Promise<VatReportSummary>;
}
