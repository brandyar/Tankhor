# TANKHOR - Universal Pagination Overhaul & Production Module Blueprint

Comprehensive implementation plan for **Universal Listing Pagination** (removing hardcoded item limits and adding standard pagination + mobile cards across all views) and **Full Completion of the Tankhor Production & Apparel Manufacturing Module** (BOM, Raw Materials, Cut Orders, Contractor Ledgers, Inventory & Accounting Sync, and Production UI).

---

## 📌 User Review & Confirmed Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1:

- **Pagination Style**: Standard numeric pagination (`صفحه‌بندی عددی استاندارد`) with page size selector (`۱۰، ۲۵، ۵۰، ۱۰۰ آیتم در هر صفحه`) and responsive mobile card view support.
- **Default Page Size**: **25 items per page** across all listing pages.
- **Production Module Strategy**: Complete, end-to-end unified implementation of all remaining production phases (BOM, Raw Materials, Work Orders / Cut Orders, Contractor Ledgers, COGS Calculation, and Production Views).

---

## 1. Overview & Core Concept

### 1.1 Universal Pagination & Unlimited Item Access
Currently, several data views rely on default Directus query limits or hardcoded local array slices without page navigation. This overhaul will:
- Update storage adapters (`LocalOfflineAdapter`, `SqliteStorageAdapter`, `CloudDirectusAdapter`) to support paginated queries with `page`, `limit`, `search`, and `totalCount` metadata.
- Create a reusable, accessible, RTL-native `Pagination` component (`/src/components/ui/Pagination.tsx`) featuring Persian numbers, page size selection, page jumps, and total item count displays.
- Apply pagination + dual Mobile Card / Desktop Table layout across **all** listing views in Tankhor.

### 1.2 Tankhor Production & Apparel Manufacturing Module (تولید و پوشاک)
A dedicated apparel manufacturing system tailored for clothing brands, tailor shops, and garment production workflows:
- **Raw Materials Inventory (انبار متریال و خرج‌کار)**: Fabrics (پارچه), zips, buttons, threads, labels, linings, packaging with custom UOMs (meter, kg, roll, piece, dozen).
- **Bill of Materials (BOM / فرمول ساخت)**: Multi-variant material formulas, wastage margins (% loss), and estimated material cost calculation.
- **Work Orders & Cut Orders (دستور تولید و حواله برش)**: Batch creation, shortage analysis against raw material stock, and routing through production stages (Cut ✂️ ➔ Print/Embroidery 🎨 ➔ Sew 🧵 ➔ Iron/Pack 📦 ➔ QC ✔️).
- **Contractors & Outsourcing (پیمانکاران و کارمزدی‌ها)**: Assigning stages to tailors/cutters with fixed rates, tracking fabric deposits, and automatic supplier/person ledger postings (`person_transactions`).
- **Inventory & Accounting Triangle Sync**: Automated stock issuance (`production_issue`), finished product receipt (`production_receipt`), contractor payable entries, and true COGS update on variant `cost_price`.

---

## 2. User Experience & Visual Design

### 2.1 Reusable Pagination Component (`Pagination.tsx`)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  نمایش ۱ تا ۲۵ از مجموع ۱۳۴ مورد    |  تعداد در صفحه: [ ۲۵ ▾ ]   |  « قبلی  ۱  ۲ [۳] ۴ ۵  بعدی » │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **Desktop Grid**: Integrated neatly into card footers with border-t styling, dark/light theme awareness, and Vazirmatn typography.
- **Mobile View (`md:hidden`)**: Compact pagination bar with prominent "قبلی" / "بعدی" buttons, current page badge, and touch-friendly targets ($\ge 44\text{px}$).

### 2.2 Responsive Dual Table/Card View Pattern
Every listing view guarantees two layouts:
- **Desktop (`hidden md:table`)**: Dense, high-information-density table with sticky headers, sortable columns, and tabular numerals (`tabular-nums`).
- **Mobile (`md:hidden space-y-3`)**: High-contrast, touch-optimized cards displaying title, key metrics, status badges, and quick action popovers without horizontal overflow.

### 2.3 Production Module Navigation & Interface
- **Sidebar Integration**: Added under "تولید و پوشاک" or "ماژول‌های پیشنهادی" depending on the `production` module license state.
- **Production View Tabs**:
  1. **پیشخوان تولید (Production Dashboard)**: Active WIP, raw material shortage alerts, contractor balances, and monthly output metrics.
  2. **مواد اولیه و خرج‌کار (Raw Materials)**: Material list, safety stock alerts, UOM conversions, and material stock movements.
  3. **شناسنامه و فرمول ساخت (BOM Manager)**: Product & variant BOM definitions with interactive material selection and wastage calculation.
  4. **دستورهای تولید و حواله برش (Production Orders)**: Batch status, stage progress, contractor assignment, and material shortage verification.
  5. **پیمانکاران و کارمزدی‌ها (Contractor Ledgers)**: Contractor list, piece-rate fees, delivery receipts, and 1-click accounting settlement.

---

## 3. Key Technical Decisions & Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TANKHOR FRONTEND UI VIEWS                          │
│   Products, Variants, Warehouses, Stock Movements, Orders, Customers,       │
│   Purchase Orders, Suppliers, Expenses, Cheques, Ledgers, Production Views   │
└───────────────────────┬─────────────────────────────────────────────────────┘
                        │  Calls via useStorage() / storageManager
                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STORAGE MANAGER FACADE PATTERN                        │
│                         (/src/storage/index.ts)                             │
├───────────────────────┬───────────────────────────┬─────────────────────────┤
│  LocalOfflineAdapter  │   SqliteStorageAdapter    │   CloudDirectusAdapter  │
│     (Browser)         │      (Tauri Desktop)      │     (Directus Cloud)    │
└───────────┬───────────┴─────────────┬─────────────┴────────────┬────────────┘
            │                         │                          │
            ▼                         ▼                          ▼
   IndexedDB / LocalStorage     SQLite (tankhor.db)       Directus REST API
```

### 3.1 Listing Pagination Scope
The following 18 listing domains will receive full server/local paginated query support and the `<Pagination />` UI component:
1. **Products (`ProductsView.tsx`)**: Paginated product catalog search.
2. **Product Variants (`ProductVariantsView.tsx`)**: Variant SKU matrix with stock filters.
3. **Categories (`CategoriesView.tsx`)**: Hierarchical categories list.
4. **Brands (`BrandsView.tsx`)**: Brand catalog.
5. **Collections (`CollectionsView.tsx`)**: Seasonal collections.
6. **Attributes & Terms (`AttributesView.tsx`)**: Colors, sizes, fabrics.
7. **Size Guides (`SizeGuidesView.tsx`)**: Size guide templates.
8. **Warehouses & Locations (`WarehousesView.tsx`)**: Storage locations.
9. **Stock Movements (`StockMovementsView.tsx`)**: Transfer & adjustment logs.
10. **Sales Orders (`OrdersView.tsx`)**: Customer order invoices.
11. **Customers (`CustomersView.tsx`)**: Customer profiles & total debt summaries.
12. **Purchase Orders (`PurchaseOrdersView.tsx`)**: Supplier orders & receipts.
13. **Suppliers (`SuppliersView.tsx`)**: Supplier profiles & payables.
14. **Expenses (`ExpensesView.tsx`)**: Operating expense records.
15. **Expense Categories (`ExpenseCategoriesView.tsx`)**: Expense taxonomy.
16. **Person Transactions (`PersonLedgerModal.tsx` & `PersonLedgersView.tsx`)**: Ledger statement entries.
17. **Cheques (`ChequesView.tsx`)**: Sayad cheque life-cycle log.
18. **Production Orders & Raw Materials (`ProductionView.tsx`)**: Production batches and material inventories.

### 3.2 Production Module Data Schema (Directus Collections)
1. `raw_materials`: `id`, `organization_id`, `code`, `name`, `category`, `unit_of_measure`, `current_stock`, `minimum_stock`, `cost_price`, `warehouse_id`, `created_at`.
2. `bill_of_materials`: `id`, `organization_id`, `product_id`, `variant_id`, `title`, `notes`, `is_active`, `total_estimated_cost`, `created_at`.
3. `bom_items`: `id`, `bom_id`, `raw_material_id`, `quantity`, `wastage_percent`, `unit_cost`, `total_cost`.
4. `contractors`: `id`, `organization_id`, `code`, `name`, `phone`, `specialty`, `payment_rate_type`, `balance`, `notes`, `created_at`.
5. `production_orders`: `id`, `organization_id`, `order_number`, `bom_id`, `product_id`, `variant_id`, `target_quantity`, `completed_quantity`, `status` (`draft`, `approved`, `in_production`, `qc_completed`, `cancelled`), `warehouse_id`, `raw_material_warehouse_id`, `start_date`, `due_date`, `completion_date`, `notes`, `created_at`.
6. `production_order_items`: `id`, `production_order_id`, `variant_id`, `quantity`, `completed_quantity`.
7. `production_stages`: `id`, `production_order_id`, `stage_name`, `contractor_id`, `unit_fee`, `total_fee`, `status` (`pending`, `in_progress`, `completed`), `notes`.

---

## 4. Execution Plan & Phased Roadmap

### Phase 1: Pagination Infrastructure & UI Component
- Implement `/src/components/ui/Pagination.tsx`.
- Update `IStorageProvider` interface to return `{ data: T[]; totalCount: number }` for paginated queries.
- Update `LocalOfflineAdapter`, `SqliteStorageAdapter`, and `CloudDirectusAdapter` query helpers to execute SQL `LIMIT/OFFSET` or Directus `limit/offset` filters.

### Phase 2: Updating All Listing Views to Paginated Dual Card/Table Pattern
- Refactor all 18 listing views to consume paginated state (`page`, `pageSize`, `search`).
- Ensure every view includes desktop table + mobile card components with the `<Pagination />` control in the footer.

### Phase 3: Production Module Storage Domain Adapters (`*Production.ts`)
- Implement `localProduction.ts`, `sqliteProduction.ts`, and `cloudProduction.ts`.
- Expose methods on `storageManager`: `getRawMaterials`, `saveRawMaterial`, `getBOMs`, `saveBOM`, `getContractors`, `saveContractor`, `getProductionOrders`, `saveProductionOrder`, `updateProductionStatus`, `executeProductionReceipt`.

### Phase 4: Production Accounting & Inventory Triangle Integration
- When production order is approved/started: automatic `inventory_movements` (`type: 'production_issue'`) deducting raw materials.
- When production order is completed: automatic `inventory_movements` (`type: 'production_receipt'`) adding finished product variants to target warehouse.
- Automatic creation of `person_transactions` for contractors logging piece-rate fees as accounts payable (`creditor`).
- Recalculate and update `cost_price` on `product_variants`.

### Phase 5: Production Module UI Views & Navigation Integration
- Build `/src/features/production/ProductionView.tsx` with 5 interactive tabs (Dashboard, Raw Materials, BOM Manager, Work Orders, Contractor Ledgers).
- Integrate "تولید و پوشاک" into the sidebar navigation with `useModuleAccess()` checking `production` license.
- Run `compile_applet` and `lint_applet` to verify clean build state.

---

## 5. Verification & Quality Assurance

1. **Pagination Verification**:
   - Verify that searching, changing page size (10, 25, 50, 100), and navigating pages works instantaneously across Local, SQLite, and Directus modes.
   - Verify mobile card layout displays properly on narrow screens without horizontal scrollbars.
2. **Production Workflow Verification**:
   - Create raw materials ➔ Build BOM formula ➔ Create production order ➔ Verify raw material stock deduction ➔ Complete production order ➔ Verify finished variant stock increment and contractor ledger balance update.
3. **Build Integrity**:
   - Run `compile_applet` to ensure zero compilation or TypeScript errors.
