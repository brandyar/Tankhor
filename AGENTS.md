# AGENTS.md - TANKHOR (تن‌خور) Project Guidelines & Instructions

## 📌 Project Identity
**TANKHOR (تن‌خور)** is a modern, high-performance product and inventory management platform tailored for apparel, fashion, footwear, bags, accessories, and garment manufacturing businesses.

---

## 🏗️ Architectural Directives

1. **Storage Adapter Pattern & Facade Architecture (MANDATORY)**:
   - ALL database read and write operations across the entire application **MUST** pass through the `storageManager` instance defined in `/src/storage/index.ts`.
   - Never import or make direct Directus API, SQLite, or LocalStorage calls inside UI React components.
   - UI components consume `useStorage()` or `storageManager` methods which conform to `IStorageProvider`.
   - **Modular Domain Decomposition (Facade Pattern)**:
     - All storage adapters are decomposed into decoupled domain modules inheriting from lightweight base contexts (`LocalStorageBase`, `SqliteStorageBase`, `CloudStorageBase`):
       - `*Org`: Organization, user profile, team members, roles, permissions
       - `*Catalog`: Products, variants, categories, brands, collections, attributes, size guides
       - `*Inventory`: Warehouses, locations, inventory items, stock movements, transfers
       - `*Sales`: Orders, order items, customers, customer ledger synchronization
       - `*Procurement`: Purchase orders, purchase order items, suppliers, supplier ledger synchronization
       - `*Accounting`: Expenses, expense categories, financial accounts, treasury transactions, cheques, landed costs
       - `*Production`: Production orders, BOMs, raw materials, contractors
       - `*WooCommerce`: WooCommerce credentials, variant mappings, synchronization logs
       - `*System`: Modules, settings, sync logs, media cache
     - Main adapter classes (`LocalOfflineAdapter`, `SqliteStorageAdapter`, `CloudDirectusAdapter`) serve as clean Facades assembling domain sub-modules without duplicate code or circular dependencies.
   - **Hybrid Storage Resolution**:
     - Desktop (Tauri): `SqliteStorageAdapter` connects to local `sqlite:tankhor.db` using official `tauri-plugin-sql`, guaranteeing high scalability and resilience across OS resets.
     - Web Browser: `LocalOfflineAdapter` uses scoped local storage with memory cache.
     - Cloud Mode: `CloudDirectusAdapter` communicates with Directus REST API with automated sync queues.

2. **Schema Fidelity & Variant-Level Stock**:
   - The canonical database schema is stored in `/directus-schema.json`.
   - Do **NOT** invent duplicate collections, change field names, or alter primary key conventions.
   - Products represent conceptual models (`products`). Stock balances live strictly on sellable variants (`product_variants` -> `inventory_items`).
   - `normalizeId()` strictly enforces positive numeric IDs (`number | undefined`) to prevent invalid queries or NaN keys in Directus and SQLite.
   - Server-side permissions (`/server/permissions.ts`) strictly sanitize `product_variants` and `inventory_items` payloads against unexpected fields.

3. **Multi-Tenancy & Tenant Boundary Enforcement**:
   - `organizations` is the tenant boundary. All operations **MUST** scope data by the active `organization_id`.
   - Backend API Proxy (`/server/proxy.ts`, `/server/routes/itemsRoutes.ts`) strictly enforces tenant isolation (`TENANT_SCOPED_COLLECTIONS`).
   - Directus handles authentication (`directus_users`). Membership and roles are managed via `organization_users` (`owner`, `manager`, `warehouse`, `sales`, `viewer`).

4. **Desktop (Tauri) & Web Hybrid Support (BFF Pattern)**:
   - Platform-agnostic frontend runs seamlessly in both browser and native desktop (Tauri) environments.
   - Authentication, tenant scoping, and third-party APIs pass through the secure BFF Gateway (`/server/auth.ts`, `/server/proxy.ts`), keeping admin credentials secure.
   - Directus API URL resolution (`/src/api/directus.ts`) detects Tauri vs browser dynamically, routing to `/api` or `https://my.tankhor.com/api`.

5. **Internationalization & Localization (i18n)**:
   - Primary UI language is **Persian (`fa`)** with **RTL** orientation and `Vazirmatn` font. English (`en`) is supported.
   - **NO HARDCODED UI STRINGS**: All labels, buttons, placeholders, table headers, error messages, and dialogs must use `t("namespace.key")`.
   - Translation keys are structured in `/src/i18n/locales/fa/` and `/src/i18n/locales/en/`.
   - Use CSS Logical Properties (`margin-inline-start`, `padding-inline-end`, `border-s-`, etc.) for seamless LTR/RTL switching.

6. **Navigation & Information Architecture**:
   - Sidebar menus follow a logical business workflow:
     1. **Dashboard (پیشخوان)**
     2. **Orders & Sales (فروش و سفارشات)**: Create Order, All Orders, Customers
     3. **Inventory & Warehouses (انبار و موجودی)**: Overview (موجودی انبارها), Barcode Print, Stock Movements, Stock Transfers, Warehouses & Locations
     4. **Catalog & Products (محصولات و کاتالوگ)**: Products, Variants (تنخور و تنوع‌ها), Size Guides, Attributes/Categories/Brands/Collections
     5. **Production & Manufacturing (تولید و کارگاه)**: Production Orders (دستورهای تولید), BOM (فرمول ساخت), Raw Materials (مواد اولیه), Contractors (کارگاه‌های همکار)
     6. **Purchasing & Procurement (تدارکات و خرید)**: Purchase Orders, Suppliers
     7. **Accounting & Treasury (حسابداری و مالی)**: Dashboard, Expenses, Accounts & Cashboxes, Person Ledgers, Cheques, Landed Costs, Tax Reports, Accounting Software Export
     8. **Reports & Analytics (گزارش‌ها و تحلیل‌ها)**: Sales & Profitability (`reports/sales`), Apparel & Demand (`reports/apparel`), Inventory Turnover & Dead Stock (`reports/inventory`)
     9. **Digital Catalog (کاتالوگ دیجیتال)**: Catalog Settings, Showcase Products, Size Finder Simulator
     10. **WooCommerce Sync (فروشگاه آنلاین ووکامرس)**: Store Connection, Inventory Sync, Order Import
     11. **Settings (تنظیمات)**: Organization Profile, Members & RBAC, Modules & Licensing, Backup & Restore, Appearance, Auto-Updater (Desktop)
   - Inactive modules automatically display in the bottom add-on section (*ماژول‌ها و افزونه‌ها*) and return to their primary workflow section upon activation or Pro plan.

7. **Modular Add-ons & Cryptographic Licensing (`useModuleAccess`)**:
   - Modules are registered in `system_modules` and entitlements stored in `organization_modules`.
   - `useModuleAccess()` coordinates entitlement checks (`hasAccess(slug)`), Pro auto-unlocking, and dynamic module loading.
   - Standalone offline licenses are bound to the hardware fingerprint via `getMachineFingerprint()`. Dynamic prices are retrieved from `system_modules` (never hardcoded).

8. **Payment Gateway Integration (Zibal & Zarinpal BFF Gateway)**:
   - Server-side payment processing (`/server/payment.ts`) proxies Zibal and Zarinpal for Pro subscriptions and lifetime module purchases.
   - Desktop client triggers system default browser via Tauri shell with real-time polling in `PurchaseModuleModal.tsx` for zero-friction activation.

9. **Dynamic Size Guide Architecture**:
   - Size Guides are generic (`size_guide_templates` -> `size_guide_measurements` -> `size_guide_values`).
   - Do NOT hardcode apparel dimensions. Render measurements dynamically based on the active template type (apparel, shoes, bags, accessories, custom).

10. **Accounting & Financial Module Architecture**:
    - **Phase 1 (Core MVP)**: Operational expenses (`expenses`, `expense_categories`), Customer/Supplier Party Ledgers (`person_transactions`), and Profit & Loss summary.
    - **Phase 2 (Treasury & Cheques)**: Bank accounts and cashboxes (`financial_accounts`), Treasury balance transfers (`treasury_transactions`), and Sayad Cheques management (`cheques`).
    - **Phase 3 (Landed Cost & Compliance)**: Landed Cost Allocation (`landed_costs`, `landed_cost_allocations`), Tax Reports (VAT & Art. 169 seasonal), and 1-click UTF-8 BOM CSV exports for Sepidar (سپیدار), Holoo (هلو), and Samaneh Moadian (سامانه مؤدیان).

11. **Comprehensive "Orders - Inventory - Accounting" Triangle Synchronization**:
    - **Sales Orders Flow (`CreateOrderView`, `OrdersView`)**:
      - Deducts sellable stock via `inventory_movements` (`type: 'sale'`, `reference_type: 'order'`) and updates `inventory_items`. Cancelling or deleting rolls back stock (`type: 'return'`).
      - Payments record deposits in `treasury_transactions` and update `current_balance` of the account.
      - Automatically logs sales invoice entries (`sale_invoice`, `debtor`) and receipt entries (`receipt`, `creditor`) in `person_transactions`.
    - **Purchasing Orders Flow (`PurchaseOrdersView`)**:
      - Receiving goods (`status: 'received'`) increments inventory (`type: 'purchase'`) and logs payable entries (`purchase_invoice`, `creditor`) in supplier ledgers.
      - Cancellation/deletion triggers reverse stock adjustments.
    - **WooCommerce Flow (`server/woocommerce.ts`)**:
      - Imports orders, deducts variant stocks, registers Treasury deposits, and posts dual ledger entries for paid orders.

12. **Production & Garment Manufacturing Flow (`production`)**:
    - **Production Orders (`production_orders`)**: Tracks batch status (`draft`, `in_progress`, `completed`, `cancelled`), target variant, planned/completed quantities, and target warehouse.
    - **Bill of Materials (`boms`, `bom_items`)**: Defines required fabrics, buttons, zippers, thread, and packaging per garment variant.
    - **Raw Materials (`raw_materials`)**: Manages fabric roll lengths, trims, and unit purchase costs.
    - **Contractors (`contractors`)**: Manages external pattern makers, cutters, sewing workshops, embroidery, and finishing partners with transaction ledgers.
    - Completing a production order deducts raw materials and increments finished garment variant stock.

13. **Locale-Aware Dual Calendar & Date Architecture (`DateInput` & `dateUtils`)**:
    - Persian (`fa`): Accessible Jalali (Shamsi) calendar popover powered by astronomical algorithms (`/src/utils/dateUtils.ts`) with Persian month names and numerals.
    - English (`en`): System Gregorian picker (`type="date"`).
    - Database storage format is strictly ISO-8601 (`YYYY-MM-DD` or ISO timestamp).

14. **Automated Desktop Releases & Self-Updater**:
    - Current App Version: `1.1.8`.
    - Automated multi-platform releases built via GitHub Actions (`/.github/workflows/release-tauri.yml`).
    - Windows desktop builds use NSIS target with `windows.installMode: "passive"` for seamless in-place updates.
    - Auto-updater powered by Tauri Updater (`tauri-plugin-updater`) and GitHub Releases manifest (`latest.json`).
    - **Version Synchronization**: Always synchronize version string simultaneously across:
      - `/package.json`
      - `/src-tauri/tauri.conf.json`
      - `/src-tauri/Cargo.toml`
      - `/src/utils/version.ts`
      - `/latest.json`
      - `/assets/latest.json`
      - `/AGENTS.md`
    - Preservation of local SQLite database (`tankhor.db`) across desktop updates.

15. **Universal Pagination Pattern (`Pagination.tsx`)**:
    - All high-volume listings (Products, Variants, Warehouse Inventory, Movements, Transfers, Production Orders, Raw Materials, Contractors, BOMs) **MUST** implement the universal `<Pagination />` component.
    - Supports smart ellipsis, localized Persian numerals (`toPersianDigits`), configurable page size options (`10, 25, 50, 100`), and previous/next navigation.
    - Filter Reset: Always reset `currentPage` to `1` via `useEffect` whenever search keywords, warehouse filters, or category filters change.
    - Dual View Integration: Both desktop tabular grids (`DataTable`) and mobile cards consume the memoized `paginated*` slice (`.slice(start, start + pageSize)`).

16. **Universal Iframe Printing Architecture (`printHtml`)**:
    - Printing barcodes, orders, and receipts relies on an isolated dynamic iframe in `/src/utils/print.ts` with explicit RTL, custom CSS, and font loading.
    - Works identically across macOS Tauri (WKWebView), Windows Tauri (WebView2), and Web Browsers.

17. **Strict Directus Cloud Schema Sanitization (`sanitizeForDirectus`)**:
    - Data migrations and demo seeding (`CloudMigrationManager.migrateLocalToCloud`) filter payload keys against canonical schema definitions using `sanitizeForDirectus()`, preventing 400 validation errors.

18. **Universal Image Resolution & Media Management (`ProductImage` & `mediaManager`)**:
    - All product, variant, category, brand, and material images **MUST** use `<ProductImage />` (`/src/components/ui/ProductImage.tsx`) or `mediaManager.getDisplayUrl()`.
    - Handles Directus UUIDs, Base64 strings, and local blob URLs with fallbacks and loading states.

19. **Digital Catalog & Dynamic Size Recommendation Engine (`online_catalog`)**:
    - Public catalog (`/c/:slug`), dynamic QR code generator, and WhatsApp order dispatch.
    - Garment-to-body size matching using size guide template measurements, tailor tape inputs or height/weight estimation, and fit preferences (`snug`, `regular`, `relaxed`).

20. **Interactive Onboarding Tour Architecture (`onboardingManager` & `Driver.js`)**:
    - Automatic guided tour introducing Dashboard KPIs, Quick Actions, Products, Multi-Warehouse Inventory, Orders, and Cloud Sync.
    - Registry in `/src/features/onboarding/tours/` with per-organization LocalStorage completion persistence (`tankhor_tour_seen_${tourName}_${orgId}`).

21. **Mobile-First Responsive Architecture & Dual Table/Card View Pattern (MANDATORY)**:
    - Dual rendering across all data tables:
      - **Desktop (`hidden md:block`)**: High-density tabular data grids with sortable columns.
      - **Mobile (`block md:hidden space-y-3`)**: Touch-friendly standalone cards with status badges and quick action buttons.
    - Touch Targets: Interactive controls maintain a minimum 40px touch target on mobile viewports.
    - Zero horizontal viewport overflow.

---

## 📂 Key Code Structure

- `/src/types/index.ts`: Strongly typed domain definitions for all Directus collections
- `/src/storage/types.ts`: Storage provider interface & sync queue definitions
- `/src/storage/index.ts`: Storage manager instance and adapter factory
- `/src/storage/localAdapter.ts`: Local persistence facade (Browser LocalStorage)
- `/src/storage/local/`: Modular LocalStorage domain providers (`localOrg.ts`, `localCatalog.ts`, `localInventory.ts`, `localSales.ts`, `localProcurement.ts`, `localAccounting.ts`, `localProduction.ts`, `localWooCommerce.ts`, `localSystem.ts`)
- `/src/storage/sqliteAdapter.ts`: Native SQLite persistence facade (Desktop Tauri)
- `/src/storage/sqlite/`: Modular SQLite domain providers (`sqliteOrg.ts`, `sqliteCatalog.ts`, `sqliteInventory.ts`, `sqliteSales.ts`, `sqliteProcurement.ts`, `sqliteAccounting.ts`, `sqliteProduction.ts`, `sqliteWooCommerce.ts`, `sqliteSystem.ts`)
- `/src/storage/cloudAdapter.ts`: Directus Cloud REST API persistence facade
- `/src/storage/cloud/`: Modular Directus Cloud domain providers (`cloudOrg.ts`, `cloudCatalog.ts`, `cloudInventory.ts`, `cloudSales.ts`, `cloudProcurement.ts`, `cloudAccounting.ts`, `cloudProduction.ts`, `cloudWooCommerce.ts`, `cloudSystem.ts`)
- `/src/storage/mediaManager.ts`: Offline media caching, blob storage, and image URL resolution
- `/src/components/ui/ProductImage.tsx`: Unified image rendering component with asset resolution
- `/src/components/ui/Pagination.tsx`: Universal RTL/LTR responsive pagination component
- `/src/features/products/`: Catalog & products management (`ProductsView.tsx`, `VariantsView.tsx`, `ProductEditView.tsx`, `ProductVariantsModal.tsx`)
- `/src/features/inventory/`: Inventory suite (`InventoryView.tsx`, `MovementsView.tsx`, `TransfersView.tsx`, `WarehousesView.tsx`, `LocationsView.tsx`, `BarcodePrintView.tsx`)
- `/src/features/production/`: Garment manufacturing suite (`ProductionOrdersView.tsx`, `BomsView.tsx`, `RawMaterialsView.tsx`, `ContractorsView.tsx`)
- `/src/features/orders/`: Sales & POS suite (`OrdersView.tsx`, `CreateOrderView.tsx`)
- `/src/features/purchasing/`: Procurement suite (`PurchaseOrdersView.tsx`, `SuppliersView.tsx`)
- `/src/features/accounting/`: Accounting suite (Dashboard, Expenses, Person Ledgers, Financial Accounts, Cheques, Landed Costs, Tax Reports, Accounting Export)
- `/src/features/reports/`: Executive analytics (`SalesReportPage.tsx`, `ApparelReportPage.tsx`, `InventoryPerformancePage.tsx`)
- `/src/features/online-catalog/`: Digital catalog & smart size finder (`PublicCatalogView.tsx`, `sizeRecommendationEngine.ts`)
- `/src/features/woocommerce/`: WooCommerce store integration (`WooCommercePage.tsx`)
- `/src/features/onboarding/`: Guided interactive tour suite (`onboardingManager.ts`, `dashboardTour.ts`)
- `/server/proxy.ts`: Multi-tenant API gateway and tenant isolation enforcement
- `/server/auth.ts`: Authentication, registration, and organization provisioning
- `/server/payment.ts`: Zibal & Zarinpal payment gateway proxy
- `/server/woocommerce.ts`: WooCommerce REST synchronization proxy
- `/src/hooks/useModuleAccess.ts`: Dynamic entitlement and module access checking hook
- `/src/utils/updater.ts`: Desktop update checker and installation helper
- `/src/utils/version.ts`: Canonical app version helper
- `/.github/workflows/release-tauri.yml`: Multi-platform release pipeline for Tauri desktop and Android

---

## 📌 UI & Design Rules
- The project design standards are documented in `DESIGN.md`.
- Live Directus API Endpoint: `https://api.tankhor.com`.
- **UI Naming Directive**: Do NOT display the word "Directus" in user-facing UI labels, badges, or dialogs. Refer to cloud features as "سرور ابری" / "همگام‌سازی ابری" / "Cloud Sync".
- Authentication is strictly account-based; guest/offline bypass buttons are removed from login interfaces.
