import { IStorageProvider, QueryParams, StorageMode } from './types';
import { SqliteStorageBase, isTauriEnvironment } from './sqlite/sqliteBase';
import { SqliteOrgStorage } from './sqlite/sqliteOrg';
import { SqliteCatalogStorage } from './sqlite/sqliteCatalog';
import { SqliteInventoryStorage } from './sqlite/sqliteInventory';
import { SqliteSalesStorage } from './sqlite/sqliteSales';
import { SqliteProcurementStorage } from './sqlite/sqliteProcurement';
import { SqliteAccountingStorage } from './sqlite/sqliteAccounting';
import { SqliteWooCommerceStorage } from './sqlite/sqliteWooCommerce';

export { isTauriEnvironment };

import {
  Organization,
  Category,
  Collection,
  Season,
  Color,
  SizeGroup,
  Size,
  Brand,
  Product,
  ProductVariant,
  Warehouse,
  WarehouseLocation,
  InventoryItem,
  InventoryMovement,
  Supplier,
  Customer,
  Order,
  OrderItem,
  PurchaseOrder,
  PurchaseOrderItem,
  StockTransfer,
  StockTransferItem,
  Subscription,
  SystemModule,
  OrganizationModule,
  OrganizationUser,
  SizeGuideTemplate,
  SizeGuideMeasurement,
  SizeGuideValue,
  ExpenseCategory,
  Expense,
  PersonTransaction,
  FinancialAccount,
  TreasuryTransaction,
  Cheque,
  ChequeStatus,
  LandedCost,
  LandedCostAllocation,
  PosShift,
  PosShiftStatus,
  ProfitLossSummary,
  VatReportSummary,
  WooCommerceSettings,
  WooCommerceLog,
  IntegrationMapping,
} from '../types';

export class SqliteStorageAdapter implements IStorageProvider {
  public mode: StorageMode = 'local_offline';

  private base: SqliteStorageBase;
  private orgStorage: SqliteOrgStorage;
  private catalogStorage: SqliteCatalogStorage;
  private inventoryStorage: SqliteInventoryStorage;
  private salesStorage: SqliteSalesStorage;
  private procurementStorage: SqliteProcurementStorage;
  private accountingStorage: SqliteAccountingStorage;
  private wooCommerceStorage: SqliteWooCommerceStorage;

  constructor() {
    this.base = new SqliteStorageBase();
    this.orgStorage = new SqliteOrgStorage(this.base);
    this.catalogStorage = new SqliteCatalogStorage(this.base);
    this.inventoryStorage = new SqliteInventoryStorage(this.base);
    this.salesStorage = new SqliteSalesStorage(this.base);
    this.procurementStorage = new SqliteProcurementStorage(this.base);
    this.accountingStorage = new SqliteAccountingStorage(this.base);
    this.wooCommerceStorage = new SqliteWooCommerceStorage(this.base);
  }

  // ==========================================
  // Lifecycle & Low-Level Bridge Methods
  // ==========================================
  async init(): Promise<void> {
    return this.base.init();
  }

  isInitialized(): boolean {
    return this.base.isInitialized();
  }

  getItems<T>(collection: string, orgId?: number): Promise<T[]> {
    return this.base.getItems<T>(collection, orgId);
  }

  getItemById<T extends { id?: number | string }>(collection: string, id: number | string): Promise<T | null> {
    return this.base.getItemById<T>(collection, id);
  }

  saveItem<T extends { id?: number | string }>(collection: string, item: T): Promise<T> {
    return this.base.saveItem<T>(collection, item);
  }

  deleteItem(collection: string, id: number | string): Promise<boolean> {
    return this.base.deleteItem(collection, id);
  }

  generateUniqueId(items: { id?: number | string }[]): number {
    return this.base.generateUniqueId(items);
  }

  getActiveOrgId(params?: QueryParams): number | undefined {
    return this.base.getActiveOrgId(params);
  }

  // ==========================================
  // Organizations & Users
  // ==========================================
  getOrganizations(): Promise<Organization[]> {
    return this.orgStorage.getOrganizations();
  }

  getOrganizationById(id: number): Promise<Organization | null> {
    return this.orgStorage.getOrganizationById(id);
  }

  saveOrganization(org: Partial<Organization>): Promise<Organization> {
    return this.orgStorage.saveOrganization(org);
  }

  getOrganizationUsers(params?: QueryParams): Promise<OrganizationUser[]> {
    return this.orgStorage.getOrganizationUsers(params);
  }

  saveOrganizationUser(ouData: Partial<OrganizationUser>): Promise<OrganizationUser> {
    return this.orgStorage.saveOrganizationUser(ouData);
  }

  deleteOrganizationUser(id: number): Promise<boolean> {
    return this.orgStorage.deleteOrganizationUser(id);
  }

  // ==========================================
  // Subscriptions & System Modules
  // ==========================================
  getSubscriptions(params?: QueryParams): Promise<Subscription[]> {
    return this.orgStorage.getSubscriptions(params);
  }

  getActiveSubscription(organizationId: number): Promise<Subscription | null> {
    return this.orgStorage.getActiveSubscription(organizationId);
  }

  saveSubscription(sub: Partial<Subscription>): Promise<Subscription> {
    return this.orgStorage.saveSubscription(sub);
  }

  getSystemModules(params?: QueryParams): Promise<SystemModule[]> {
    return this.orgStorage.getSystemModules(params);
  }

  getOrganizationModules(params?: QueryParams): Promise<OrganizationModule[]> {
    return this.orgStorage.getOrganizationModules(params);
  }

  saveOrganizationModule(mod: Partial<OrganizationModule>): Promise<OrganizationModule> {
    return this.orgStorage.saveOrganizationModule(mod);
  }

  deleteOrganizationModule(id: number): Promise<boolean> {
    return this.orgStorage.deleteOrganizationModule(id);
  }

  // ==========================================
  // Catalog & Products
  // ==========================================
  getProducts(params?: QueryParams): Promise<Product[]> {
    return this.catalogStorage.getProducts(params);
  }

  getProductById(id: number): Promise<Product | null> {
    return this.catalogStorage.getProductById(id);
  }

  saveProduct(product: Partial<Product>): Promise<Product> {
    return this.catalogStorage.saveProduct(product);
  }

  deleteProduct(id: number): Promise<boolean> {
    return this.catalogStorage.deleteProduct(id);
  }

  getVariants(params?: QueryParams): Promise<ProductVariant[]> {
    return this.catalogStorage.getVariants(params);
  }

  getVariantsByProductId(productId: number): Promise<ProductVariant[]> {
    return this.catalogStorage.getVariantsByProductId(productId);
  }

  saveVariant(variant: Partial<ProductVariant>, warehouseId?: number, locationId?: number): Promise<ProductVariant> {
    return this.catalogStorage.saveVariant(variant, warehouseId, locationId);
  }

  deleteVariant(id: number): Promise<boolean> {
    return this.catalogStorage.deleteVariant(id);
  }

  getCategories(params?: QueryParams): Promise<Category[]> {
    return this.catalogStorage.getCategories(params);
  }

  saveCategory(category: Partial<Category>): Promise<Category> {
    return this.catalogStorage.saveCategory(category);
  }

  deleteCategory(id: number): Promise<boolean> {
    return this.catalogStorage.deleteCategory(id);
  }

  getCollections(params?: QueryParams): Promise<Collection[]> {
    return this.catalogStorage.getCollections(params);
  }

  saveCollection(collection: Partial<Collection>): Promise<Collection> {
    return this.catalogStorage.saveCollection(collection);
  }

  deleteCollection(id: number): Promise<boolean> {
    return this.catalogStorage.deleteCollection(id);
  }

  getBrands(params?: QueryParams): Promise<Brand[]> {
    return this.catalogStorage.getBrands(params);
  }

  saveBrand(brand: Partial<Brand>): Promise<Brand> {
    return this.catalogStorage.saveBrand(brand);
  }

  deleteBrand(id: number): Promise<boolean> {
    return this.catalogStorage.deleteBrand(id);
  }

  getSeasons(params?: QueryParams): Promise<Season[]> {
    return this.catalogStorage.getSeasons(params);
  }

  saveSeason(season: Partial<Season>): Promise<Season> {
    return this.catalogStorage.saveSeason(season);
  }

  deleteSeason(id: number): Promise<boolean> {
    return this.catalogStorage.deleteSeason(id);
  }

  getColors(params?: QueryParams): Promise<Color[]> {
    return this.catalogStorage.getColors(params);
  }

  saveColor(color: Partial<Color>): Promise<Color> {
    return this.catalogStorage.saveColor(color);
  }

  deleteColor(id: number): Promise<boolean> {
    return this.catalogStorage.deleteColor(id);
  }

  getSizeGroups(params?: QueryParams): Promise<SizeGroup[]> {
    return this.catalogStorage.getSizeGroups(params);
  }

  saveSizeGroup(group: Partial<SizeGroup>): Promise<SizeGroup> {
    return this.catalogStorage.saveSizeGroup(group);
  }

  deleteSizeGroup(id: number): Promise<boolean> {
    return this.catalogStorage.deleteSizeGroup(id);
  }

  getSizes(params?: QueryParams): Promise<Size[]> {
    return this.catalogStorage.getSizes(params);
  }

  saveSize(size: Partial<Size>): Promise<Size> {
    return this.catalogStorage.saveSize(size);
  }

  deleteSize(id: number): Promise<boolean> {
    return this.catalogStorage.deleteSize(id);
  }

  // ==========================================
  // Size Guides
  // ==========================================
  getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    return this.catalogStorage.getSizeGuideTemplates(params);
  }

  getSizeGuideTemplateById(id: number): Promise<SizeGuideTemplate | null> {
    return this.catalogStorage.getSizeGuideTemplateById(id);
  }

  saveSizeGuideTemplate(template: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    return this.catalogStorage.saveSizeGuideTemplate(template);
  }

  deleteSizeGuideTemplate(id: number): Promise<boolean> {
    return this.catalogStorage.deleteSizeGuideTemplate(id);
  }

  getSizeGuideMeasurements(templateId?: number): Promise<SizeGuideMeasurement[]> {
    return this.catalogStorage.getSizeGuideMeasurements(templateId);
  }

  saveSizeGuideMeasurement(measurement: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement> {
    return this.catalogStorage.saveSizeGuideMeasurement(measurement);
  }

  deleteSizeGuideMeasurement(id: number): Promise<boolean> {
    return this.catalogStorage.deleteSizeGuideMeasurement(id);
  }

  getSizeGuideValues(templateId?: number): Promise<SizeGuideValue[]> {
    return this.catalogStorage.getSizeGuideValues(templateId);
  }

  saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue> {
    return this.catalogStorage.saveSizeGuideValue(val);
  }

  deleteSizeGuideValue(id: number): Promise<boolean> {
    return this.catalogStorage.deleteSizeGuideValue(id);
  }

  // ==========================================
  // Inventory & Warehouses
  // ==========================================
  getWarehouses(params?: QueryParams): Promise<Warehouse[]> {
    return this.inventoryStorage.getWarehouses(params);
  }

  getWarehouseById(id: number): Promise<Warehouse | null> {
    return this.inventoryStorage.getWarehouseById(id);
  }

  saveWarehouse(warehouse: Partial<Warehouse>): Promise<Warehouse> {
    return this.inventoryStorage.saveWarehouse(warehouse);
  }

  deleteWarehouse(id: number): Promise<boolean> {
    return this.inventoryStorage.deleteWarehouse(id);
  }

  getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.inventoryStorage.getWarehouseLocations(params);
  }

  getLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.inventoryStorage.getLocations(params);
  }

  getLocationsByWarehouseId(warehouseId: number): Promise<WarehouseLocation[]> {
    return this.inventoryStorage.getLocationsByWarehouseId(warehouseId);
  }

  saveWarehouseLocation(location: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.inventoryStorage.saveWarehouseLocation(location);
  }

  saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.inventoryStorage.saveLocation(loc);
  }

  deleteWarehouseLocation(id: number): Promise<boolean> {
    return this.inventoryStorage.deleteWarehouseLocation(id);
  }

  deleteLocation(id: number): Promise<boolean> {
    return this.inventoryStorage.deleteLocation(id);
  }

  getInventoryItems(params?: QueryParams): Promise<InventoryItem[]> {
    return this.inventoryStorage.getInventoryItems(params);
  }

  getInventoryItem(variantId: number, warehouseId: number): Promise<InventoryItem | null> {
    return this.inventoryStorage.getInventoryItem(variantId, warehouseId);
  }

  saveInventoryItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    return this.inventoryStorage.saveInventoryItem(item);
  }

  deleteInventoryItem(id: number): Promise<boolean> {
    return this.inventoryStorage.deleteInventoryItem(id);
  }

  getInventoryMovements(params?: QueryParams): Promise<InventoryMovement[]> {
    return this.inventoryStorage.getInventoryMovements(params);
  }

  saveInventoryMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    return this.inventoryStorage.saveInventoryMovement(movement);
  }

  recordMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    return this.inventoryStorage.recordMovement(movement);
  }

  getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    return this.inventoryStorage.getStockTransfers(params);
  }

  getStockTransferById(id: number): Promise<StockTransfer | null> {
    return this.inventoryStorage.getStockTransferById(id);
  }

  getStockTransferItems(transferId: number): Promise<StockTransferItem[]> {
    return this.inventoryStorage.getStockTransferItems(transferId);
  }

  saveStockTransfer(transfer: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    return this.inventoryStorage.saveStockTransfer(transfer, items);
  }

  deleteStockTransfer(id: number): Promise<boolean> {
    return this.inventoryStorage.deleteStockTransfer(id);
  }

  // ==========================================
  // Customers & Sales
  // ==========================================
  getCustomers(params?: QueryParams): Promise<Customer[]> {
    return this.salesStorage.getCustomers(params);
  }

  getCustomerById(id: number): Promise<Customer | null> {
    return this.salesStorage.getCustomerById(id);
  }

  saveCustomer(cust: Partial<Customer>): Promise<Customer> {
    return this.salesStorage.saveCustomer(cust);
  }

  deleteCustomer(id: number): Promise<boolean> {
    return this.salesStorage.deleteCustomer(id);
  }

  getOrders(params?: QueryParams): Promise<Order[]> {
    return this.salesStorage.getOrders(params);
  }

  getOrderById(id: number): Promise<Order | null> {
    return this.salesStorage.getOrderById(id);
  }

  getOrderItems(orderId: number): Promise<OrderItem[]> {
    return this.salesStorage.getOrderItems(orderId);
  }

  saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    return this.salesStorage.saveOrder(order, items);
  }

  deleteOrder(id: number): Promise<boolean> {
    return this.salesStorage.deleteOrder(id);
  }

  reconcileOrdersWithTreasury(targetOrgId?: number): Promise<void> {
    return this.salesStorage.reconcileOrdersWithTreasury(targetOrgId);
  }

  // ==========================================
  // Suppliers & Procurement
  // ==========================================
  getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    return this.procurementStorage.getSuppliers(params);
  }

  getSupplierById(id: number): Promise<Supplier | null> {
    return this.procurementStorage.getSupplierById(id);
  }

  saveSupplier(sup: Partial<Supplier>): Promise<Supplier> {
    return this.procurementStorage.saveSupplier(sup);
  }

  deleteSupplier(id: number): Promise<boolean> {
    return this.procurementStorage.deleteSupplier(id);
  }

  getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    return this.procurementStorage.getPurchaseOrders(params);
  }

  getPurchaseOrderById(id: number): Promise<PurchaseOrder | null> {
    return this.procurementStorage.getPurchaseOrderById(id);
  }

  getPurchaseOrderItems(purchaseOrderId?: number): Promise<PurchaseOrderItem[]> {
    return this.procurementStorage.getPurchaseOrderItems(purchaseOrderId);
  }

  savePurchaseOrderItem(item: Partial<PurchaseOrderItem>): Promise<PurchaseOrderItem> {
    return this.procurementStorage.savePurchaseOrderItem(item);
  }

  deletePurchaseOrderItem(id: number): Promise<boolean> {
    return this.procurementStorage.deletePurchaseOrderItem(id);
  }

  savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    return this.procurementStorage.savePurchaseOrder(po, items);
  }

  deletePurchaseOrder(id: number): Promise<boolean> {
    return this.procurementStorage.deletePurchaseOrder(id);
  }

  // ==========================================
  // Accounting & Financials
  // ==========================================
  getDefaultExpenseCategories(orgId: number): ExpenseCategory[] {
    return this.accountingStorage.getDefaultExpenseCategories(orgId);
  }

  getExpenseCategories(params?: QueryParams): Promise<ExpenseCategory[]> {
    return this.accountingStorage.getExpenseCategories(params);
  }

  saveExpenseCategory(cat: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    return this.accountingStorage.saveExpenseCategory(cat);
  }

  deleteExpenseCategory(id: number): Promise<boolean> {
    return this.accountingStorage.deleteExpenseCategory(id);
  }

  getExpenses(params?: QueryParams): Promise<Expense[]> {
    return this.accountingStorage.getExpenses(params);
  }

  getExpenseById(id: number): Promise<Expense | null> {
    return this.accountingStorage.getExpenseById(id);
  }

  saveExpense(exp: Partial<Expense>): Promise<Expense> {
    return this.accountingStorage.saveExpense(exp);
  }

  deleteExpense(id: number): Promise<boolean> {
    return this.accountingStorage.deleteExpense(id);
  }

  getPersonTransactions(params?: QueryParams): Promise<PersonTransaction[]> {
    return this.accountingStorage.getPersonTransactions(params);
  }

  getPersonTransactionById(id: number): Promise<PersonTransaction | null> {
    return this.accountingStorage.getPersonTransactionById(id);
  }

  savePersonTransaction(tx: Partial<PersonTransaction>): Promise<PersonTransaction> {
    return this.accountingStorage.savePersonTransaction(tx);
  }

  deletePersonTransaction(id: number): Promise<boolean> {
    return this.accountingStorage.deletePersonTransaction(id);
  }

  getProfitAndLoss(params?: QueryParams): Promise<ProfitLossSummary> {
    return this.accountingStorage.getProfitAndLoss(params);
  }

  getProfitLossSummary(params?: QueryParams): Promise<ProfitLossSummary> {
    return this.accountingStorage.getProfitAndLoss(params);
  }

  getDefaultFinancialAccounts(orgId: number): FinancialAccount[] {
    return this.accountingStorage.getDefaultFinancialAccounts(orgId);
  }

  getFinancialAccounts(params?: QueryParams): Promise<FinancialAccount[]> {
    return this.accountingStorage.getFinancialAccounts(params);
  }

  getFinancialAccountById(id: number): Promise<FinancialAccount | null> {
    return this.accountingStorage.getFinancialAccountById(id);
  }

  saveFinancialAccount(account: Partial<FinancialAccount>): Promise<FinancialAccount> {
    return this.accountingStorage.saveFinancialAccount(account);
  }

  deleteFinancialAccount(id: number): Promise<boolean> {
    return this.accountingStorage.deleteFinancialAccount(id);
  }

  getTreasuryTransactions(params?: QueryParams): Promise<TreasuryTransaction[]> {
    return this.accountingStorage.getTreasuryTransactions(params);
  }

  saveTreasuryTransaction(tx: Partial<TreasuryTransaction>): Promise<TreasuryTransaction> {
    return this.accountingStorage.saveTreasuryTransaction(tx);
  }

  deleteTreasuryTransaction(id: number): Promise<boolean> {
    return this.accountingStorage.deleteTreasuryTransaction(id);
  }

  getCheques(params?: QueryParams): Promise<Cheque[]> {
    return this.accountingStorage.getCheques(params);
  }

  getChequeById(id: number): Promise<Cheque | null> {
    return this.accountingStorage.getChequeById(id);
  }

  saveCheque(cheque: Partial<Cheque>): Promise<Cheque> {
    return this.accountingStorage.saveCheque(cheque);
  }

  deleteCheque(id: number): Promise<boolean> {
    return this.accountingStorage.deleteCheque(id);
  }

  updateChequeStatus(id: number, status: ChequeStatus, targetAccountId?: number): Promise<Cheque> {
    return this.accountingStorage.updateChequeStatus(id, status, targetAccountId);
  }

  getLandedCosts(params?: QueryParams): Promise<LandedCost[]> {
    return this.accountingStorage.getLandedCosts(params);
  }

  getLandedCostById(id: number): Promise<LandedCost | null> {
    return this.accountingStorage.getLandedCostById(id);
  }

  saveLandedCost(cost: Partial<LandedCost>, allocations?: Partial<LandedCostAllocation>[]): Promise<LandedCost> {
    return this.accountingStorage.saveLandedCost(cost, allocations);
  }

  deleteLandedCost(id: number): Promise<boolean> {
    return this.accountingStorage.deleteLandedCost(id);
  }

  getLandedCostAllocations(landedCostId?: number, purchaseOrderId?: number): Promise<LandedCostAllocation[]> {
    return this.accountingStorage.getLandedCostAllocations(landedCostId, purchaseOrderId);
  }

  saveLandedCostAllocation(allocation: Partial<LandedCostAllocation>): Promise<LandedCostAllocation> {
    return this.accountingStorage.saveLandedCostAllocation(allocation);
  }

  applyLandedCostToVariants(landedCostId: number): Promise<{ updatedVariantsCount: number }> {
    return this.accountingStorage.applyLandedCostToVariants(landedCostId);
  }

  getVatReport(params?: { organizationId?: number; year?: number; quarter?: 1 | 2 | 3 | 4 }): Promise<VatReportSummary> {
    return this.accountingStorage.getVatReport(params);
  }

  getPosShifts(params?: QueryParams & { user_id?: string; status?: PosShiftStatus; warehouse_id?: number }): Promise<PosShift[]> {
    return this.accountingStorage.getPosShifts(params);
  }

  getActivePosShift(userId?: string, warehouseId?: number): Promise<PosShift | null> {
    return this.accountingStorage.getActivePosShift(userId, warehouseId);
  }

  savePosShift(shiftData: Partial<PosShift>): Promise<PosShift> {
    return this.accountingStorage.savePosShift(shiftData);
  }

  closePosShift(id: number, closingBalance: number | string, notes?: string): Promise<PosShift> {
    return this.accountingStorage.closePosShift(id, closingBalance, notes);
  }

  deletePosShift(id: number): Promise<boolean> {
    return this.accountingStorage.deletePosShift(id);
  }

  // ==========================================
  // WooCommerce Integration
  // ==========================================
  getWooCommerceSettings(params?: QueryParams): Promise<WooCommerceSettings | null> {
    return this.wooCommerceStorage.getWooCommerceSettings(params);
  }

  saveWooCommerceSettings(settings: Partial<WooCommerceSettings>): Promise<WooCommerceSettings> {
    return this.wooCommerceStorage.saveWooCommerceSettings(settings);
  }

  getWooCommerceLogs(params?: QueryParams & { limit?: number }): Promise<WooCommerceLog[]> {
    return this.wooCommerceStorage.getWooCommerceLogs(params);
  }

  addWooCommerceLog(log: Partial<WooCommerceLog>): Promise<WooCommerceLog> {
    return this.wooCommerceStorage.addWooCommerceLog(log);
  }

  getIntegrationMappings(params?: QueryParams & { entity_type?: string }): Promise<IntegrationMapping[]> {
    return this.wooCommerceStorage.getIntegrationMappings(params);
  }

  saveIntegrationMapping(mapping: Partial<IntegrationMapping>): Promise<IntegrationMapping> {
    return this.wooCommerceStorage.saveIntegrationMapping(mapping);
  }
}
