import { IStorageProvider, StorageMode, QueryParams } from './types';
import {
  Organization, OrganizationUser, Category, Collection, Season, Color, Brand,
  SizeGroup, Size, Product, ProductVariant, Warehouse, WarehouseLocation,
  InventoryItem, InventoryMovement, Customer, Order, OrderItem,
  Supplier, PurchaseOrder, PurchaseOrderItem, StockTransfer, StockTransferItem,
  SizeGuideTemplate, SizeGuideMeasurement, SizeGuideValue,
  Subscription, SystemModule, OrganizationModule,
  ExpenseCategory, Expense, PersonTransaction, ProfitLossSummary,
  FinancialAccount, TreasuryTransaction, Cheque, ChequeStatus,
  LandedCost, LandedCostAllocation, VatReportSummary,
  PosShift, PosShiftStatus,
  WooCommerceSettings, WooCommerceLog, IntegrationMapping,
  Feedback
} from '../types';
import { LocalOfflineAdapter } from './localAdapter';
import {
  CloudStorageBase,
  CloudOrgStorage,
  CloudCatalogStorage,
  CloudInventoryStorage,
  CloudSalesStorage,
  CloudProcurementStorage,
  CloudAccountingStorage,
  CloudWooCommerceStorage,
} from './cloud';

export class CloudDirectusAdapter implements IStorageProvider {
  mode: StorageMode = 'cloud_synced';
  public localAdapter: LocalOfflineAdapter;
  private base: CloudStorageBase;

  // Domain Storage Modules
  public org: CloudOrgStorage;
  public catalog: CloudCatalogStorage;
  public inventory: CloudInventoryStorage;
  public sales: CloudSalesStorage;
  public procurement: CloudProcurementStorage;
  public accounting: CloudAccountingStorage;
  public woocommerce: CloudWooCommerceStorage;

  constructor(localAdapter?: LocalOfflineAdapter) {
    this.localAdapter = localAdapter || new LocalOfflineAdapter();
    this.base = new CloudStorageBase(this.localAdapter);

    this.org = new CloudOrgStorage(this.base);
    this.catalog = new CloudCatalogStorage(this.base);
    this.inventory = new CloudInventoryStorage(this.base);
    this.sales = new CloudSalesStorage(this.base);
    this.procurement = new CloudProcurementStorage(this.base);
    this.accounting = new CloudAccountingStorage(this.base);
    this.woocommerce = new CloudWooCommerceStorage(this.base);
  }

  // ==========================================
  // Organizations & Users
  // ==========================================
  async getOrganizations(): Promise<Organization[]> {
    return this.org.getOrganizations();
  }

  async getOrganizationById(id: number): Promise<Organization | null> {
    return this.org.getOrganizationById(id);
  }

  async saveOrganization(org: Partial<Organization>): Promise<Organization> {
    return this.org.saveOrganization(org);
  }

  async getOrganizationUsers(params?: QueryParams): Promise<OrganizationUser[]> {
    return this.org.getOrganizationUsers(params);
  }

  async saveOrganizationUser(user: Partial<OrganizationUser>): Promise<OrganizationUser> {
    return this.org.saveOrganizationUser(user);
  }

  async deleteOrganizationUser(id: number): Promise<boolean> {
    return this.org.deleteOrganizationUser(id);
  }

  async getSubscriptions(params?: QueryParams): Promise<Subscription[]> {
    return this.org.getSubscriptions(params);
  }

  async getActiveSubscription(organizationId: number): Promise<Subscription | null> {
    return this.org.getActiveSubscription(organizationId);
  }

  async saveSubscription(sub: Partial<Subscription>): Promise<Subscription> {
    return this.org.saveSubscription(sub);
  }

  async getSystemModules(params?: QueryParams): Promise<SystemModule[]> {
    return this.org.getSystemModules(params);
  }

  async getOrganizationModules(params?: QueryParams): Promise<OrganizationModule[]> {
    return this.org.getOrganizationModules(params);
  }

  async saveOrganizationModule(mod: Partial<OrganizationModule>): Promise<OrganizationModule> {
    return this.org.saveOrganizationModule(mod);
  }

  async deleteOrganizationModule(id: number): Promise<boolean> {
    return this.org.deleteOrganizationModule(id);
  }

  // ==========================================
  // Products & Variants
  // ==========================================
  async getProducts(params?: QueryParams): Promise<Product[]> {
    return this.catalog.getProducts(params);
  }

  async getProductById(id: number): Promise<Product | null> {
    return this.catalog.getProductById(id);
  }

  async saveProduct(product: Partial<Product>): Promise<Product> {
    return this.catalog.saveProduct(product);
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.catalog.deleteProduct(id);
  }

  async getVariants(params?: QueryParams): Promise<ProductVariant[]> {
    return this.catalog.getVariants(params);
  }

  async getVariantsByProductId(productId: number): Promise<ProductVariant[]> {
    return this.catalog.getVariantsByProductId(productId);
  }

  async saveVariant(variant: Partial<ProductVariant>, warehouseId?: number, locationId?: number): Promise<ProductVariant> {
    return this.catalog.saveVariant(variant, warehouseId, locationId);
  }

  async deleteVariant(id: number): Promise<boolean> {
    return this.catalog.deleteVariant(id);
  }

  // ==========================================
  // Catalog Attributes
  // ==========================================
  async getCategories(params?: QueryParams): Promise<Category[]> {
    return this.catalog.getCategories(params);
  }

  async saveCategory(cat: Partial<Category>): Promise<Category> {
    return this.catalog.saveCategory(cat);
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.catalog.deleteCategory(id);
  }

  async getCollections(params?: QueryParams): Promise<Collection[]> {
    return this.catalog.getCollections(params);
  }

  async saveCollection(col: Partial<Collection>): Promise<Collection> {
    return this.catalog.saveCollection(col);
  }

  async deleteCollection(id: number): Promise<boolean> {
    return this.catalog.deleteCollection(id);
  }

  async getBrands(params?: QueryParams): Promise<Brand[]> {
    return this.catalog.getBrands(params);
  }

  async saveBrand(brand: Partial<Brand>): Promise<Brand> {
    return this.catalog.saveBrand(brand);
  }

  async deleteBrand(id: number): Promise<boolean> {
    return this.catalog.deleteBrand(id);
  }

  async getSeasons(params?: QueryParams): Promise<Season[]> {
    return this.catalog.getSeasons(params);
  }

  async saveSeason(season: Partial<Season>): Promise<Season> {
    return this.catalog.saveSeason(season);
  }

  async deleteSeason(id: number): Promise<boolean> {
    return this.catalog.deleteSeason(id);
  }

  async getColors(params?: QueryParams): Promise<Color[]> {
    return this.catalog.getColors(params);
  }

  async saveColor(color: Partial<Color>): Promise<Color> {
    return this.catalog.saveColor(color);
  }

  async deleteColor(id: number): Promise<boolean> {
    return this.catalog.deleteColor(id);
  }

  async getSizeGroups(params?: QueryParams): Promise<SizeGroup[]> {
    return this.catalog.getSizeGroups(params);
  }

  async saveSizeGroup(group: Partial<SizeGroup>): Promise<SizeGroup> {
    return this.catalog.saveSizeGroup(group);
  }

  async deleteSizeGroup(id: number): Promise<boolean> {
    return this.catalog.deleteSizeGroup(id);
  }

  async getSizes(params?: QueryParams): Promise<Size[]> {
    return this.catalog.getSizes(params);
  }

  async saveSize(size: Partial<Size>): Promise<Size> {
    return this.catalog.saveSize(size);
  }

  async deleteSize(id: number): Promise<boolean> {
    return this.catalog.deleteSize(id);
  }

  // ==========================================
  // Size Guides
  // ==========================================
  async getSizeGuideTemplates(params?: QueryParams): Promise<SizeGuideTemplate[]> {
    return this.catalog.getSizeGuideTemplates(params);
  }

  async getSizeGuideTemplateById(id: number): Promise<SizeGuideTemplate | null> {
    return this.catalog.getSizeGuideTemplateById(id);
  }

  async saveSizeGuideTemplate(tpl: Partial<SizeGuideTemplate>): Promise<SizeGuideTemplate> {
    return this.catalog.saveSizeGuideTemplate(tpl);
  }

  async deleteSizeGuideTemplate(id: number): Promise<boolean> {
    return this.catalog.deleteSizeGuideTemplate(id);
  }

  async getSizeGuideMeasurements(templateId: number): Promise<SizeGuideMeasurement[]> {
    return this.catalog.getSizeGuideMeasurements(templateId);
  }

  async saveSizeGuideMeasurement(meas: Partial<SizeGuideMeasurement>): Promise<SizeGuideMeasurement> {
    return this.catalog.saveSizeGuideMeasurement(meas);
  }

  async deleteSizeGuideMeasurement(id: number): Promise<boolean> {
    return this.catalog.deleteSizeGuideMeasurement(id);
  }

  async getSizeGuideValues(templateId: number): Promise<SizeGuideValue[]> {
    return this.catalog.getSizeGuideValues(templateId);
  }

  async saveSizeGuideValue(val: Partial<SizeGuideValue>): Promise<SizeGuideValue> {
    return this.catalog.saveSizeGuideValue(val);
  }

  async deleteSizeGuideValue(id: number): Promise<boolean> {
    return this.catalog.deleteSizeGuideValue(id);
  }

  // ==========================================
  // Warehouses & Locations
  // ==========================================
  async getWarehouses(params?: QueryParams): Promise<Warehouse[]> {
    return this.inventory.getWarehouses(params);
  }

  async getWarehouseById(id: number): Promise<Warehouse | null> {
    return this.inventory.getWarehouseById(id);
  }

  async saveWarehouse(wh: Partial<Warehouse>): Promise<Warehouse> {
    return this.inventory.saveWarehouse(wh);
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    return this.inventory.deleteWarehouse(id);
  }

  async getWarehouseLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.inventory.getWarehouseLocations(params);
  }

  async getLocations(params?: QueryParams): Promise<WarehouseLocation[]> {
    return this.inventory.getLocations(params);
  }

  async getLocationsByWarehouseId(warehouseId: number): Promise<WarehouseLocation[]> {
    return this.inventory.getLocationsByWarehouseId(warehouseId);
  }

  async saveWarehouseLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.inventory.saveWarehouseLocation(loc);
  }

  async saveLocation(loc: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
    return this.inventory.saveLocation(loc);
  }

  async deleteWarehouseLocation(id: number): Promise<boolean> {
    return this.inventory.deleteWarehouseLocation(id);
  }

  async deleteLocation(id: number): Promise<boolean> {
    return this.inventory.deleteLocation(id);
  }

  // ==========================================
  // Inventory Items & Movements
  // ==========================================
  async getInventoryItems(params?: QueryParams): Promise<InventoryItem[]> {
    return this.inventory.getInventoryItems(params);
  }

  async getInventoryItem(variantId: number, warehouseId: number): Promise<InventoryItem | null> {
    return this.inventory.getInventoryItem(variantId, warehouseId);
  }

  async saveInventoryItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    return this.inventory.saveInventoryItem(item);
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    return this.inventory.deleteInventoryItem(id);
  }

  async getInventoryMovements(params?: QueryParams): Promise<InventoryMovement[]> {
    return this.inventory.getInventoryMovements(params);
  }

  async saveInventoryMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    return this.inventory.saveInventoryMovement(movement);
  }

  async recordMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    return this.inventory.recordMovement(movement);
  }

  // ==========================================
  // Stock Transfers
  // ==========================================
  async getStockTransfers(params?: QueryParams): Promise<StockTransfer[]> {
    return this.inventory.getStockTransfers(params);
  }

  async getStockTransferById(id: number): Promise<StockTransfer | null> {
    return this.inventory.getStockTransferById(id);
  }

  async getStockTransferItems(transferId?: number): Promise<StockTransferItem[]> {
    return this.inventory.getStockTransferItems(transferId);
  }

  async saveStockTransfer(st: Partial<StockTransfer>, items?: Partial<StockTransferItem>[]): Promise<StockTransfer> {
    return this.inventory.saveStockTransfer(st, items);
  }

  async deleteStockTransfer(id: number): Promise<boolean> {
    return this.inventory.deleteStockTransfer(id);
  }

  // ==========================================
  // Sales & Orders
  // ==========================================
  async getOrders(params?: QueryParams): Promise<Order[]> {
    return this.sales.getOrders(params);
  }

  async getOrderById(id: number): Promise<Order | null> {
    return this.sales.getOrderById(id);
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return this.sales.getOrderItems(orderId);
  }

  async saveOrder(order: Partial<Order>, items?: Partial<OrderItem>[]): Promise<Order> {
    return this.sales.saveOrder(order, items);
  }

  async deleteOrder(id: number): Promise<boolean> {
    return this.sales.deleteOrder(id);
  }

  // ==========================================
  // Customers
  // ==========================================
  async getCustomers(params?: QueryParams): Promise<Customer[]> {
    return this.sales.getCustomers(params);
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    return this.sales.getCustomerById(id);
  }

  async saveCustomer(cust: Partial<Customer>): Promise<Customer> {
    return this.sales.saveCustomer(cust);
  }

  async deleteCustomer(id: number): Promise<boolean> {
    return this.sales.deleteCustomer(id);
  }

  // ==========================================
  // POS Shifts (شیفت‌های صندوق)
  // ==========================================
  async getPosShifts(params?: QueryParams & { user_id?: string; status?: PosShiftStatus; warehouse_id?: number }): Promise<PosShift[]> {
    return this.sales.getPosShifts(params);
  }

  async getActivePosShift(userId?: string, warehouseId?: number): Promise<PosShift | null> {
    return this.sales.getActivePosShift(userId, warehouseId);
  }

  async savePosShift(shift: Partial<PosShift>): Promise<PosShift> {
    return this.sales.savePosShift(shift);
  }

  async closePosShift(id: number, closingBalance: number | string, notes?: string): Promise<PosShift> {
    return this.sales.closePosShift(id, closingBalance, notes);
  }

  async deletePosShift(id: number): Promise<boolean> {
    return this.sales.deletePosShift(id);
  }

  // ==========================================
  // Procurement & Suppliers
  // ==========================================
  async getSuppliers(params?: QueryParams): Promise<Supplier[]> {
    return this.procurement.getSuppliers(params);
  }

  async getSupplierById(id: number): Promise<Supplier | null> {
    return this.procurement.getSupplierById(id);
  }

  async saveSupplier(sup: Partial<Supplier>): Promise<Supplier> {
    return this.procurement.saveSupplier(sup);
  }

  async deleteSupplier(id: number): Promise<boolean> {
    return this.procurement.deleteSupplier(id);
  }

  async getPurchaseOrders(params?: QueryParams): Promise<PurchaseOrder[]> {
    return this.procurement.getPurchaseOrders(params);
  }

  async getPurchaseOrderById(id: number): Promise<PurchaseOrder | null> {
    return this.procurement.getPurchaseOrderById(id);
  }

  async getPurchaseOrderItems(purchaseOrderId?: number): Promise<PurchaseOrderItem[]> {
    return this.procurement.getPurchaseOrderItems(purchaseOrderId);
  }

  async savePurchaseOrder(po: Partial<PurchaseOrder>, items?: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrder> {
    return this.procurement.savePurchaseOrder(po, items);
  }

  async deletePurchaseOrder(id: number): Promise<boolean> {
    return this.procurement.deletePurchaseOrder(id);
  }

  // ==========================================
  // Accounting & Financials (Phase 1)
  // ==========================================
  async getExpenseCategories(params?: QueryParams): Promise<ExpenseCategory[]> {
    return this.accounting.getExpenseCategories(params);
  }

  async saveExpenseCategory(cat: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    return this.accounting.saveExpenseCategory(cat);
  }

  async deleteExpenseCategory(id: number): Promise<boolean> {
    return this.accounting.deleteExpenseCategory(id);
  }

  async getExpenses(params?: QueryParams): Promise<Expense[]> {
    return this.accounting.getExpenses(params);
  }

  async saveExpense(exp: Partial<Expense>): Promise<Expense> {
    return this.accounting.saveExpense(exp);
  }

  async deleteExpense(id: number): Promise<boolean> {
    return this.accounting.deleteExpense(id);
  }

  async getPersonTransactions(params?: QueryParams): Promise<PersonTransaction[]> {
    return this.accounting.getPersonTransactions(params);
  }

  async savePersonTransaction(tx: Partial<PersonTransaction>): Promise<PersonTransaction> {
    return this.accounting.savePersonTransaction(tx);
  }

  async deletePersonTransaction(id: number): Promise<boolean> {
    return this.accounting.deletePersonTransaction(id);
  }

  async getProfitLossSummary(params?: QueryParams): Promise<ProfitLossSummary> {
    return this.accounting.getProfitLossSummary(params);
  }

  // ==========================================
  // Accounting & Treasury (Phase 2)
  // ==========================================
  async reconcileOrdersWithTreasury(organizationId?: number): Promise<void> {
    return this.accounting.reconcileOrdersWithTreasury(organizationId);
  }

  async getFinancialAccounts(params?: QueryParams & { skipReconcile?: boolean }): Promise<FinancialAccount[]> {
    return this.accounting.getFinancialAccounts(params);
  }

  async getFinancialAccountById(id: number): Promise<FinancialAccount | null> {
    return this.accounting.getFinancialAccountById(id);
  }

  async saveFinancialAccount(account: Partial<FinancialAccount>): Promise<FinancialAccount> {
    return this.accounting.saveFinancialAccount(account);
  }

  async deleteFinancialAccount(id: number): Promise<boolean> {
    return this.accounting.deleteFinancialAccount(id);
  }

  async getTreasuryTransactions(params?: QueryParams): Promise<TreasuryTransaction[]> {
    return this.accounting.getTreasuryTransactions(params);
  }

  async saveTreasuryTransaction(tx: Partial<TreasuryTransaction>): Promise<TreasuryTransaction> {
    return this.accounting.saveTreasuryTransaction(tx);
  }

  async deleteTreasuryTransaction(id: number): Promise<boolean> {
    return this.accounting.deleteTreasuryTransaction(id);
  }

  async getCheques(params?: QueryParams): Promise<Cheque[]> {
    return this.accounting.getCheques(params);
  }

  async getChequeById(id: number): Promise<Cheque | null> {
    return this.accounting.getChequeById(id);
  }

  async saveCheque(cheque: Partial<Cheque>): Promise<Cheque> {
    return this.accounting.saveCheque(cheque);
  }

  async deleteCheque(id: number): Promise<boolean> {
    return this.accounting.deleteCheque(id);
  }

  async updateChequeStatus(id: number, status: ChequeStatus, targetAccountId?: number): Promise<Cheque> {
    return this.accounting.updateChequeStatus(id, status, targetAccountId);
  }

  // ==========================================
  // Landed Costs & VAT (Phase 3)
  // ==========================================
  async getLandedCosts(params?: QueryParams): Promise<LandedCost[]> {
    return this.accounting.getLandedCosts(params);
  }

  async getLandedCostById(id: number): Promise<LandedCost | null> {
    return this.accounting.getLandedCostById(id);
  }

  async saveLandedCost(cost: Partial<LandedCost>, allocations?: Partial<LandedCostAllocation>[]): Promise<LandedCost> {
    return this.accounting.saveLandedCost(cost, allocations);
  }

  async deleteLandedCost(id: number): Promise<boolean> {
    return this.accounting.deleteLandedCost(id);
  }

  async getLandedCostAllocations(landedCostId?: number, purchaseOrderId?: number): Promise<LandedCostAllocation[]> {
    return this.accounting.getLandedCostAllocations(landedCostId, purchaseOrderId);
  }

  async saveLandedCostAllocation(allocation: Partial<LandedCostAllocation>): Promise<LandedCostAllocation> {
    return this.accounting.saveLandedCostAllocation(allocation);
  }

  async applyLandedCostToVariants(landedCostId: number): Promise<{ updatedVariantsCount: number }> {
    return this.accounting.applyLandedCostToVariants(landedCostId);
  }

  async getVatReport(params?: { organizationId?: number; year?: number; quarter?: 1 | 2 | 3 | 4 }): Promise<VatReportSummary> {
    return this.accounting.getVatReport(params);
  }

  // ==========================================
  // WooCommerce Integration
  // ==========================================
  async getWooCommerceSettings(params?: QueryParams): Promise<WooCommerceSettings | null> {
    return this.woocommerce.getWooCommerceSettings(params);
  }

  async saveWooCommerceSettings(settings: Partial<WooCommerceSettings>): Promise<WooCommerceSettings> {
    return this.woocommerce.saveWooCommerceSettings(settings);
  }

  async getWooCommerceLogs(params?: QueryParams & { limit?: number }): Promise<WooCommerceLog[]> {
    return this.woocommerce.getWooCommerceLogs(params);
  }

  async addWooCommerceLog(log: Partial<WooCommerceLog>): Promise<WooCommerceLog> {
    return this.woocommerce.addWooCommerceLog(log);
  }

  async getIntegrationMappings(params?: QueryParams & { entity_type?: string }): Promise<IntegrationMapping[]> {
    return this.woocommerce.getIntegrationMappings(params);
  }

  async saveIntegrationMapping(mapping: Partial<IntegrationMapping>): Promise<IntegrationMapping> {
    return this.woocommerce.saveIntegrationMapping(mapping);
  }

  // ==========================================
  // Feedback & Feature Suggestions
  // ==========================================
  async getFeedbacks(params?: QueryParams): Promise<Feedback[]> {
    return this.org.getFeedbacks(params);
  }

  async submitFeedback(feedback: Partial<Feedback>): Promise<Feedback> {
    return this.org.submitFeedback(feedback);
  }
}
