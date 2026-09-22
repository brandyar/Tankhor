# AGENTS.md - TANKHOR (تن‌خور) Project Guidelines & Instructions

## 📌 Project Identity
**TANKHOR (تن‌خور)** is a modern, high-performance product and inventory management platform tailored for apparel, fashion, footwear, bags, and accessories businesses.

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
       - `*WooCommerce`: WooCommerce credentials, variant mappings, synchronization logs
       - `*System`: Modules, settings, sync logs, media cache
     - Main adapter classes (`LocalOfflineAdapter`, `SqliteStorageAdapter`, `CloudDirectusAdapter`) serve as clean Facades assembling domain sub-modules without duplicate code or circular dependencies.
   - **Hybrid Storage Resolution**:
     - Desktop (Tauri): `SqliteStorageAdapter` connects to local `sqlite:tankhor.db` using official `tauri-plugin-sql`, guaranteeing high scalability and resilience across OS resets.
     - Web Browser: `LocalOfflineAdapter` uses scoped local storage with memory cache.
     - Cloud Mode: `CloudDirectusAdapter` communicates with Directus REST API with automated sync queues.

2. **Schema Fidelity**:
   - The canonical database schema is stored in `/directus-schema.json` (25 collections).
   - Do **NOT** invent duplicate collections, change field names, or alter primary key conventions.
   - Variant-level stock rule: Products represent concepts (`products`). Stock balances live strictly on sellable variants (`product_variants` -> `inventory_items`).

3. **Multi-Tenancy & Tenant Boundary Enforcement**:
   - `organizations` is the tenant boundary.
   - All query, create, update, and delete operations **MUST** scope data by the active `organization_id`.
   - Backend API Proxy (`/server/proxy.ts`) strictly validates and enforces tenant ownership (`TENANT_SCOPED_COLLECTIONS`), preventing data leakage across organizations.
   - Directus handles user authentication (`directus_users`). Membership and access permissions are managed via `organization_users` with defined roles (`owner`, `manager`, `warehouse`, `sales`, `viewer`).

4. **Desktop (Tauri) & Web Hybrid Support (BFF Pattern)**:
   - The frontend remains platform-agnostic and runs seamlessly in both browser and native desktop (Tauri/Electron) environments.
   - All authentication, registration, user management, and tenant scoping requests from both Web and Desktop clients pass through the secure Backend-For-Frontend (BFF) API Gateway (`/server/auth.ts`, `/server/proxy.ts`), keeping Admin tokens secure and enforcing tenant isolation.
   - Directus API URL resolution (`/src/api/directus.ts`) detects Tauri vs browser environments dynamically, routing requests to the BFF Gateway (`https://my.tankhor.com/api` or `/api`) without exposing admin credentials.

5. **Internationalization & Localization (i18n)**:
   - First production UI language is **Persian (`fa`)** with **RTL** orientation and `Vazirmatn` font.
   - **NO HARDCODED UI STRINGS**: All labels, buttons, form placeholders, table headers, error messages, and dialog titles must use translation keys `t("namespace.key")`.
   - Translation keys are organized in `/src/i18n/locales/fa/` and `/src/i18n/locales/en/`.
   - Use CSS Logical Properties (`margin-inline-start`, `padding-inline-end`, `border-s-`, etc.) to guarantee seamless LTR/RTL switching.

6. **Navigation & Information Architecture**:
   - Sidebar menus follow a logical business workflow:
     1. **Dashboard (پیشخوان)**
     2. **Orders & Sales (فروش و سفارشات)**: Create Order, All Orders, Customers
     3. **Inventory & Warehouses (انبار و موجودی)**: Overview, Barcode Print, Stock Movements/Transfers (Submenu), Warehouses & Locations (Submenu)
     4. **Catalog & Products (محصولات و کاتالوگ)**: Products, Variants, Size Guides, Attributes/Categories/Brands/Collections (Submenu)
     5. **Purchasing & Procurement (تدارکات و خرید)**: Purchase Orders, Suppliers
     6. **Accounting & Treasury (حسابداری و مالی)**: Hierarchical main menu and submenus after activation (Dashboard, Expenses, Accounts & Cashboxes, Person Ledgers, Cheques, Landed Costs, Tax Reports, Accounting Software Export)
     7. **WooCommerce Sync (فروشگاه آنلاین ووکامرس)**: Displayed right before Settings when activated, providing seamless store connection, inventory sync, and order import
     8. **Settings (تنظیمات)**: Organization & User Management, Cloud Sync & Storage
   - Submenus support responsive collapsible states and auto-expansion based on the active route.
   - **Settings Sub-menu Structure**: Settings is organized into modular dedicated sub-menus:
     - `settings/org`: Organization profile, currency, and general information
     - `settings/members`: Team members and role-based access control (RBAC)
     - `settings/modules`: Add-on module licensing, purchases, and hardware IDs
     - `settings/sync`: Database backup/restore, cloud sync, and JSON snapshots
     - `settings/appearance`: Visual theme, language, and display preferences
     - `settings/updater`: Desktop version checks and one-click auto-updater (Desktop only)
   - **Dynamic Module Placement in Sidebar**:
     - Modules not yet purchased/activated automatically move to the bottom group (*ماژول‌ها و افزونه‌ها*) with subtle inactive styling and a clean *ماژول* badge.
     - Once purchased or unlocked via Pro, modules immediately return to their native workflow section (e.g. *تولید و چاپ بارکد* under *انبار و موجودی*، *حسابداری و مالی* به عنوان منوی جامع، و *فروشگاه آنلاین ووکامرس* قبل از تنظیمات).
     - **Offline/Free Store Synchronization**: The WooCommerce integration module is fully functional in offline/local desktop storage (SQLite) as well as Cloud mode, allowing both free tier and Pro users to purchase and activate it standalone without requiring an active cloud subscription.

7. **Modular Add-ons & Cryptographic Licensing (`useModuleAccess`)**:
   - Modules are defined in `system_modules` (slug, name, descriptions, `price_ir`, `price_usd`, `included_in_pro`).
   - Tenant entitlements are stored in `organization_modules` (organization ID, slug, license key, hardware fingerprint, purchase date, lifetime status).
   - `useModuleAccess()` hook coordinates real-time entitlement checks (`hasAccess(slug)`), Pro plan auto-unlocking, and dynamic module loading.
   - Hardware ID fingerprinting binds standalone offline desktop licenses to the physical machine (`getMachineFingerprint()`).

8. **Payment Gateway Integration (Zibal & Zarinpal BFF Gateway)**:
   - Server-side payment processing (`/server/payment.ts`) proxies Zibal & Zarinpal securely:
     - **Subscription Upgrades**: `/api/payment/request` & `/api/payment/verify` for Organization Pro plans.
     - **Module Purchases**: `/api/payment/request-module` & `/api/payment/verify-module` for individual lifetime module licenses with automated cryptographic key generation.
   - Merchant IDs are dynamically resolved from Directus `project_settings` or secure server environment variables.
   - **Dynamic Pricing Rule**: Prices are NEVER hardcoded in client components. Prices (`price_ir`, `price_usd`) are dynamically queried from Directus `system_modules` and formatted via `formatModulePrice()`.
   - **Desktop Payment Workflow**: Opens system default browser via Tauri shell/external URL, with real-time polling in `PurchaseModuleModal.tsx` for zero-friction desktop activation upon gateway callback.

9. **Dynamic Size Guide Architecture**:
   - Size Guides are generic (`size_guide_templates` -> `size_guide_measurements` -> `size_guide_values`).
   - Do **NOT** hardcode apparel-specific dimensions (like chest/waist). Render measurement definitions dynamically based on the active template type (apparel, shoes, bags, accessories, custom).

10. **Accounting & Financial Module Architecture (Complete 3-Phase Implementation)**:
    - The Financial & Accounting module is fully implemented across all 3 phases according to `/accounting-roadmap.md`:
      - **Phase 1 (Core MVP)**: Operational expenses (`expenses`, `expense_categories`), Customer/Supplier Party Ledgers (`person_transactions`), and real-time Profit & Loss summary.
      - **Phase 2 (Treasury & Cheques)**: Bank accounts and cashboxes (`financial_accounts`), Treasury balance transfers (`treasury_transactions`), and Sayad Cheques management (`cheques`) with complete status lifecycles (pending, cleared, bounced, refunded).
      - **Phase 3 (Landed Cost & Compliance)**:
        - Landed Cost Allocation (`landed_costs`, `landed_cost_allocations`) with automated weighted distribution by variant value or quantity to determine true unit cost.
        - Tax Reports (`TaxReportsPage`): Output VAT, Input VAT credits, and Seasonal Purchase/Sale reporting (Art. 169 & Moadian system).
        - Accounting Software Exports (`AccountingExportPage`): Double-entry balanced journal generators with 1-click UTF-8 BOM CSV exports for Sepidar (سپیدار), Holoo (هلو), and Samaneh Moadian (سامانه مؤدیان).

11. **Comprehensive "Orders - Inventory - Accounting" Triangle Synchronization (MANDATORY)**:
    - **Sales Orders Flow (`CreateOrderView`, `OrdersView`)**:
      - **Inventory Side-Effects**: Confirming or completing an order automatically decrements sellable stock via `inventory_movements` (`type: 'sale'`, `reference_type: 'order'`) and updates `inventory_items`. Cancelling or deleting an order immediately triggers stock rollback (`type: 'return'`), restoring inventory balances.
      - **Treasury Side-Effects**: Cash/POS payments create an immediate deposit transaction in `treasury_transactions` for the selected bank account/cashbox, incrementing its `current_balance`.
      - **Person Ledger Side-Effects**: Every sale logs a sales invoice entry (`sale_invoice`, `debtor`) in `person_transactions` under the customer's account. Immediate payments concurrently register a receipt entry (`receipt`, `creditor`), keeping customer account statements fully audited.
      - **Quick Invoice Settlement**: Unpaid/credit orders support 1-click settlement (`Settle Payment` modal), allowing cashiers to record receipt to a financial account and update the order to `paid` status seamlessly.
    - **Purchasing Orders Flow (`PurchaseOrdersView`)**:
      - Receiving goods (`status: 'received'`) creates inventory increments (`type: 'purchase'`) for all actual items and quantities in the purchase order, while simultaneously logging a payable entry (`purchase_invoice`, `creditor`) in the supplier's ledger.
      - Cancelling or deleting a purchase order triggers reverse stock adjustments, preventing artificial stock inflation.
    - **WooCommerce Online Store Flow (`server/woocommerce.ts`)**:
      - Imported WooCommerce orders create native Tankhor orders, link or provision customers, deduct variant stocks from the designated warehouse, and for paid orders, automatically register Treasury deposits and dual ledger entries (`sale_invoice` + `receipt`).

12. **Locale-Aware Dual Calendar & Date Architecture (`DateInput` & `dateUtils`)**:
    - **Persian (`fa`)**: Automatically displays an interactive, accessible Jalali (Shamsi) calendar popover powered by high-precision astronomical algorithms (`/src/utils/dateUtils.ts`), with Persian month names (فروردین تا اسفند), Persian numerals, and quick "امروز" selection.
    - **English (`en`)**: Seamlessly falls back to standard Gregorian system picker (`type="date"`).
    - **Data Integrity**: Storage format is strictly ISO-8601 date strings (`YYYY-MM-DD` or ISO timestamp) across SQLite, LocalStorage, and Directus collections.
    - **Formatters**: Date helpers in `/src/utils/formatters.ts` (`formatDate`, `formatDateNumeric`, `formatPersianDate`) dynamically respect the active locale.

13. **Defensive UI & Runtime Error Boundaries**:
    - All complex views and accounting dashboards are wrapped with `ErrorBoundary` (`/src/components/ui/ErrorBoundary.tsx`) to prevent fatal application crashes or blank screens.
    - Design system controls (such as `Select.tsx`) implement defensive fallback guards to handle both declarative `options` arrays and arbitrary `children` elements safely.

14. **Automated Desktop Releases & Self-Updater**:
    - Current App Version: `1.0.31`.
    - Automated multi-platform releases built via GitHub Actions (`/.github/workflows/release-tauri.yml`).
    - Windows desktop builds use NSIS target (`bundle.targets: ["nsis", "app", "dmg"]`) with `windows.installMode: "passive"` for seamless in-place updates.
    - Desktop auto-update system powered by Tauri Updater (`tauri-plugin-updater`) and GitHub Releases with dedicated `latest.json` manifest.
    - Version synchronization across: `/package.json`, `/src-tauri/tauri.conf.json`, `/src-tauri/Cargo.toml`, `/src/utils/version.ts`, `/latest.json`, and `/assets/latest.json`.
    - Background check via `checkDesktopUpdate()` (`/src/utils/updater.ts`) on startup or manual trigger in Settings.
    - Universal RTL update notification modal (`UpdateNotificationModal.tsx`) showing release notes, real-time download progress, and zero-downtime relaunch via `@tauri-apps/plugin-process`.
    - Preservation of local SQLite database (`tankhor.db`) across desktop application updates.

15. **Universal Iframe Printing Architecture (`printHtml`)**:
    - Printing barcodes, orders, and receipts relies on an isolated, dynamic iframe in `/src/utils/print.ts` with explicit RTL, custom style inheritance, and font loading.
    - Guarantees seamless print dialog triggering across macOS Tauri (WKWebView), Windows Tauri (WebView2), and Web Browsers.

16. **Strict Directus Cloud Schema Sanitization (`sanitizeForDirectus`)**:
    - All automated data migrations and demo data seeding (`CloudMigrationManager.migrateLocalToCloud`) strictly filter payload keys using `sanitizeForDirectus()` against canonical schema definitions.
    - Prevents Directus 400 validation errors (such as unmapped `status` or `type` fields), ensuring onboarding demo data works smoothly in Cloud Mode.

17. **Universal Image Resolution & Media Management (`ProductImage` & `mediaManager`)**:
    - All product, variant, category, brand, collection, and dashboard metric images **MUST** be rendered using the `<ProductImage />` component (`/src/components/ui/ProductImage.tsx`) or resolved via `mediaManager.getDisplayUrl()`.
    - Prevents broken image links when referencing raw Directus File UUIDs, Base64 strings, or local IndexedDB/blob URLs.
    - Automatically provides elegant placeholder iconography, fallback text initials, and loading states across both offline/desktop and cloud setups.

---

## 📂 Key Code Structure

- `/src/types/index.ts`: Strongly typed domain definitions for all Directus collections
- `/src/storage/types.ts`: Storage provider interface & sync queue definitions
- `/src/storage/localAdapter.ts`: Local persistence provider facade (Browser)
- `/src/storage/local/`: Modular LocalStorage domain providers (`localOrg.ts`, `localCatalog.ts`, `localInventory.ts`, `localSales.ts`, `localProcurement.ts`, `localAccounting.ts`, `localWooCommerce.ts`, `localSystem.ts`)
- `/src/storage/sqliteAdapter.ts`: Native SQLite persistence provider facade (Desktop Tauri)
- `/src/storage/sqlite/`: Modular SQLite domain providers (`sqliteOrg.ts`, `sqliteCatalog.ts`, `sqliteInventory.ts`, `sqliteSales.ts`, `sqliteProcurement.ts`, `sqliteAccounting.ts`, `sqliteWooCommerce.ts`, `sqliteSystem.ts`)
- `/src/storage/cloudAdapter.ts`: Directus Cloud REST API persistence provider facade
- `/src/storage/cloud/`: Modular Directus Cloud domain providers (`cloudOrg.ts`, `cloudCatalog.ts`, `cloudInventory.ts`, `cloudSales.ts`, `cloudProcurement.ts`, `cloudAccounting.ts`, `cloudWooCommerce.ts`, `cloudSystem.ts`)
- `/src/storage/mediaManager.ts`: Offline media caching, blob storage, and image URL resolution
- `/src/components/ui/ProductImage.tsx`: Unified image rendering component with Directus asset resolution and fallback
- `/src/storage/syncManager.ts`: Sync manager for offline changes
- `/src/storage/backupManager.ts`: Automated 1-click JSON backup, restore & demo data seeding engine
- `/src/api/directus.ts`: Directus API client with desktop/web support
- `/server/proxy.ts`: Multi-tenant API proxy and tenant isolation enforcement
- `/server/auth.ts`: Authentication, registration, and organization provisioning
- `/server/payment.ts`: Zibal & Zarinpal payment gateway proxy, subscription & standalone module purchasing
- `/server/woocommerce.ts`: WooCommerce REST synchronization proxy (product & variant sync, order import, warehouse deductions, customer matching)
- `/src/hooks/useModuleAccess.ts`: Dynamic entitlement and module access checking hook
- `/src/utils/license.ts`: Cryptographic offline license verification, hardware fingerprinting & price formatters
- `/src/utils/dateUtils.ts`: High-precision Jalali-Gregorian conversion algorithms & constants
- `/src/utils/formatters.ts`: Locale-aware currency, number, and Jalali/Gregorian date formatting
- `/src/components/modals/PurchaseModuleModal.tsx`: Dynamic module purchase modal with real-time gateway polling for desktop
- `/accounting-roadmap.md`: Architectural specification and schema design for Financial & Accounting module
- `/src/i18n/`: Translation keys (`fa`, `en`) and i18n helper hooks
- `/src/context/`: AuthContext, OrganizationContext, and I18nProvider
- `/src/components/ui/`: Reusable, locale-agnostic design system controls (`DateInput`, `ErrorBoundary`, `Button`, `Input`, `Select`, `Card`)
- `/src/components/modals/UpdateNotificationModal.tsx`: Interactive modal for desktop app updates with progress bar and release notes
- `/src/components/layout/`: Responsive App Shell (Sidebar, Top Header, Org Switcher)
- `/src/features/`: Modular domain views (Dashboard, Products, Inventory, Orders, Purchasing, Size Guides, Settings, Organizations)
- `/src/features/accounting/`: Complete accounting suite (Dashboard, Expenses, Person Ledgers, Financial Accounts, Cheques, Landed Costs, Tax Reports, Accounting Export)
- `/src/features/woocommerce/`: WooCommerce integration module (store credentials, synchronization dashboard, logs, variant mapping)
- `/src/utils/updater.ts`: Desktop update checker and installation helper using `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`
- `/.github/workflows/release-tauri.yml`: Multi-platform release pipeline for Tauri desktop (Windows, macOS) and Android APK

---

## 📌 UI & Design Rules
- The project design standards are documented in `DESIGN.md`.
- Use all possible fields from `directus-schema.json` where applicable across modules.
- Live Directus API Endpoint: `https://api.tankhor.com`.
- **UI Naming Directive**: Do NOT display the word "Directus" in user-facing UI labels, badges, or dialogs. Refer to cloud features as "سرور ابری" / "همگام‌سازی ابری" / "Cloud Sync".
- Authentication is strictly account-based; guest/offline bypass buttons are removed from login interfaces.
