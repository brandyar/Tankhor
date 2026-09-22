import { IStorageProvider, QueryParams, StorageMode } from './types';
import { LocalStorageBase } from './local/localBase';
import { LocalOrgStorage } from './local/localOrg';
import { LocalCatalogStorage } from './local/localCatalog';
import { LocalInventoryStorage } from './local/localInventory';
import { LocalSalesStorage } from './local/localSales';
import { LocalProcurementStorage } from './local/localProcurement';
import { LocalAccountingStorage } from './local/localAccounting';
import { LocalWooCommerceStorage } from './local/localWooCommerce';

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
  Feedback,
} from '../types';

export class LocalOfflineAdapter implements IStorageProvider {
  public mode: StorageMode = 'local_offline';

  private base: LocalStorageBase;
  private orgStorage: LocalOrgStorage;
  private catalogStorage: LocalCatalogStorage;
  private inventoryStorage: LocalInventoryStorage;
  private salesStorage: LocalSalesStorage;
  private procurementStorage: LocalProcurementStorage;
  private accountingStorage: LocalAccountingStorage;
  private wooCommerceStorage: LocalWooCommerceStorage;

  constructor() {
    this.base = new LocalStorageBase();
    this.orgStorage = new LocalOrgStorage(this.base);
    this.catalogStorage = new LocalCatalogStorage(this.base);
    this.inventoryStorage = new LocalInventoryStorage(this.base);
    this.salesStorage = new LocalSalesStorage(this.base);
    this.procurementStorage = new LocalProcurementStorage(this.base);
    this.accountingStorage = new LocalAccountingStorage(this.base);
    this.wooCommerceStorage = new LocalWooCommerceStorage(this.base);
  }

  // Base utility proxies for backward compatibility & adapter fallbacks
  getItem<T>(key: string, defaultValue: T[]): T[] {
    return this.base.getItem(key, defaultValue);
  }

  setItem<T>(key: string, data: T[]): void {
    this.base.setItem(key, data);
  }

  generateUniqueId(items: { id: number | string }[]): number {
    return this.base.generateUniqueId(items);
  }

  getActiveOrgId(params?: QueryParams): number | undefined {
    return this.base.getActiveOrgId(params);
  }

  filterByOrg<T extends { organization_id?: any }>(items: T[], params?: QueryParams): T[] {
    return this.base.filterByOrg(items, params);
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

  saveCollection(col: Partial<Collection>): Promise<Collection> {
    return this.catalogStorage.saveCollection(col);
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

  saveSizeGuideTemplate(template: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    return this.catalogStorage.saveSizeGuideTemplate(template);
  }

  deleteSizeGuideTemplate(id: number): Promise<boolean> {
    return this.catalogStorage.deleteSizeGuideTemplate(id);
  }

  getSizeGuideMeasurements(templateId: number): Promise<SizeGuideMeasurement[]> {
    return this.catalogStorage.getSizeGuideMeasurements(templateId);
  }

  saveSizeGuideMeasurement(meas: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement> {
    return this.catalogStorage.saveSizeGuideMeasurement(meas);
  }

  deleteSizeGuideMeasurement(id: number): Promise<boolean> {
    return this.catalogStorage.deleteSizeGuideMeasurement(id);
  }

  getSizeGuideValues(templateId: number): Promise<SizeGuideValue[]> {
    return this.catalogStorage.getSizeGuideValues(templateId);
  }

  saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue> {
    return this.catalogStorage.saveSizeGuideValue(val);
  }

  deleteSizeGuideValue(id: number): Promise<boolean> {
    return this.catalogStorage.deleteSizeGuideValue(id);
  }

  // ==========================================
  // Warehouses & Locations
  // ==========================================
  getWarehouses(params?: QueryParams): Promise<Warehouse[]> {
    return this.inventoryStorage.getWarehouses(params);
  }

  getWarehouseById(id: number): Promise<Warehouse | null> {
    return this.inventoryStorage.getWarehouseById(id);
  }

  saveWarehouse(wh: Partial<Warehouse>): Promise<Warehouse> {
    return this.inventoryStorage.saveWarehouse(wh);
  }

  deleteWarehouse(id: number): Promise<boolean> {
    return this.inventoryStorage.deleteWarehouse(id);
  }

  getLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.inventoryStorage.getLocations(params);
  }

  getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.inventoryStorage.getWarehouseLocations(params);
  }

  getLocationsByWarehouseId(warehouseId: number): Promise<WarehouseLocation[]> {
    return this.inventoryStorage.getLocationsByWarehouseId(warehouseId);
  }

  saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.inventoryStorage.saveLocation(loc);
  }

  saveWarehouseLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.inventoryStorage.saveWarehouseLocation(loc);
  }

  deleteLocation(id: number): Promise<boolean> {
    return this.inventoryStorage.deleteLocation(id);
  }

  deleteWarehouseLocation(id: number): Promise<boolean> {
    return this.inventoryStorage.deleteWarehouseLocation(id);
  }

  // ==========================================
  // Inventory Items & Movements
  // ==========================================
  getInventoryItems(params?: QueryParams): Promise<InventoryItem[]> {
    return this.inventoryStorage.getInventoryItems(params);
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

  saveInventoryMovement(mov: Partial<InventoryMovement>): Promise<InventoryMovement> {
    return this.inventoryStorage.saveInventoryMovement(mov);
  }

  recordMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    return this.inventoryStorage.saveInventoryMovement(movement);
  }

  // ==========================================
  // Stock Transfers
  // ==========================================
  getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    return this.inventoryStorage.getStockTransfers(params);
  }

  getStockTransferItems(transferId?: number): Promise<StockTransferItem[]> {
    return this.inventoryStorage.getStockTransferItems(transferId);
  }

  saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    return this.inventoryStorage.saveStockTransfer(st, items);
  }

  deleteStockTransfer(id: number): Promise<boolean> {
    return this.inventoryStorage.deleteStockTransfer(id);
  }

  // ==========================================
  // Sales & Orders
  // ==========================================
  getCustomers(params?: QueryParams): Promise<Customer[]> {
    return this.salesStorage.getCustomers(params);
  }

  getCustomerById(id: number): Promise<Customer | null> {
    return this.salesStorage.getCustomerById(id);
  }

  saveCustomer(customer: Partial<Customer>): Promise<Customer> {
    return this.salesStorage.saveCustomer(customer);
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

  saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    return this.salesStorage.saveOrder(order, items);
  }

  deleteOrder(id: number): Promise<boolean> {
    return this.salesStorage.deleteOrder(id);
  }

  getOrderItems(orderId: number): Promise<OrderItem[]> {
    return this.salesStorage.getOrderItems(orderId);
  }

  saveOrderItem(item: Partial<OrderItem>): Promise<OrderItem> {
    return this.salesStorage.saveOrderItem(item);
  }

  deleteOrderItem(id: number): Promise<boolean> {
    return this.salesStorage.deleteOrderItem(id);
  }

  reconcileOrdersWithTreasury(orgId?: number): Promise<void> {
    const targetOrgId = orgId || this.base.getActiveOrgId() || 1;
    return this.salesStorage.reconcileOrdersWithTreasury(targetOrgId);
  }

  // ==========================================
  // Purchasing & Procurement
  // ==========================================
  getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    return this.procurementStorage.getSuppliers(params);
  }

  getSupplierById(id: number): Promise<Supplier | null> {
    return this.procurementStorage.getSupplierById(id);
  }

  saveSupplier(supplier: Partial<Supplier>): Promise<Supplier> {
    return this.procurementStorage.saveSupplier(supplier);
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

  savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    return this.procurementStorage.savePurchaseOrder(po, items);
  }

  deletePurchaseOrder(id: number): Promise<boolean> {
    return this.procurementStorage.deletePurchaseOrder(id);
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

  // ==========================================
  // Accounting & Treasury
  // ==========================================
  getExpenseCategories(params?: QueryParams): Promise<ExpenseCategory[]> {
    return this.accountingStorage.getExpenseCategories(params);
  }

  saveExpenseCategory(category: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    return this.accountingStorage.saveExpenseCategory(category);
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

  saveExpense(expense: Partial<Expense>): Promise<Expense> {
    return this.accountingStorage.saveExpense(expense);
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

  // ==========================================
  // Feedback & Feature Suggestions
  // ==========================================
  getFeedbacks(params?: QueryParams): Promise<Feedback[]> {
    return this.orgStorage.getFeedbacks(params);
  }

  submitFeedback(feedback: Partial<Feedback>): Promise<Feedback> {
    return this.orgStorage.submitFeedback(feedback);
  }
}
