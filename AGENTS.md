# AGENTS.md - TANKHOR (تن‌خور) Project Guidelines & Instructions

## 📌 Project Identity
**TANKHOR (تن‌خور)** is a modern, high-performance product and inventory management platform tailored for apparel, fashion, footwear, bags, and accessories businesses.

---

## 🏗️ Architectural Directives

1. **Storage Adapter Pattern (MANDATORY)**:
   - ALL database read and write operations across the entire application **MUST** pass through the `storageManager` instance defined in `/src/storage/index.ts`.
   - Never import or make direct Directus API, SQLite, or LocalStorage calls inside UI React components.
   - UI components consume `useStorage()` or `storageManager` methods which conform to `IStorageProvider`.
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

4. **Desktop (Tauri) & Web Hybrid Support**:
   - The frontend remains platform-agnostic and runs seamlessly in both browser and native desktop (Tauri/Electron) environments.
   - Directus API URL resolution (`/src/api/directus.ts`) detects Tauri vs browser environments dynamically, routing requests directly or via local backend proxies without hardcoded localhost assumptions.

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
     6. **Settings (تنظیمات)**: Organization & User Management, Cloud Sync & Storage
   - Submenus support responsive collapsible states and auto-expansion based on the active route.

7. **Dynamic Size Guide Architecture**:
   - Size Guides are generic (`size_guide_templates` -> `size_guide_measurements` -> `size_guide_values`).
   - Do **NOT** hardcode apparel-specific dimensions (like chest/waist). Render measurement definitions dynamically based on the active template type (apparel, shoes, bags, accessories, custom).

8. **Automated Desktop Releases & Self-Updater**:
   - Automated multi-platform releases built via GitHub Actions (`/.github/workflows/release-tauri.yml`).
   - Desktop auto-update system powered by Tauri Updater (`tauri-plugin-updater`) and GitHub Releases.
   - Background check via `checkDesktopUpdate()` (`/src/utils/updater.ts`) on startup or manual trigger in Settings.
   - Universal RTL update notification modal (`UpdateNotificationModal.tsx`) showing release notes, real-time download progress, and zero-downtime relaunch via `@tauri-apps/plugin-process`.
   - Preservation of local SQLite database (`tankhor.db`) across desktop application updates.

---

## 📂 Key Code Structure

- `/src/types/index.ts`: Strongly typed domain definitions for all Directus collections
- `/src/storage/types.ts`: Storage provider interface & sync queue definitions
- `/src/storage/localAdapter.ts`: Local persistence provider with multi-tenant isolation (Browser)
- `/src/storage/sqliteAdapter.ts`: Native SQLite persistence provider for desktop (Tauri)
- `/src/storage/cloudAdapter.ts`: Cloud REST API provider with local mirror fallback
- `/src/storage/syncManager.ts`: Sync manager for offline changes
- `/src/storage/backupManager.ts`: Automated 1-click JSON backup, restore & demo data seeding engine
- `/src/api/directus.ts`: Directus API client with desktop/web support
- `/server/proxy.ts`: Multi-tenant API proxy and tenant isolation enforcement
- `/server/auth.ts`: Authentication, registration, and organization provisioning
- `/src/i18n/`: Translation keys (`fa`, `en`) and i18n helper hooks
- `/src/context/`: AuthContext, OrganizationContext, and I18nProvider
- `/src/components/ui/`: Reusable, locale-agnostic design system controls
- `/src/components/modals/UpdateNotificationModal.tsx`: Interactive modal for desktop app updates with progress bar and release notes
- `/src/components/layout/`: Responsive App Shell (Sidebar, Top Header, Org Switcher)
- `/src/features/`: Modular domain views (Dashboard, Products, Inventory, Orders, Purchasing, Size Guides, Settings, Organizations)
- `/src/utils/updater.ts`: Desktop update checker and installation helper using `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`
- `/.github/workflows/release-tauri.yml`: Multi-platform release pipeline for Tauri desktop (Windows, macOS) and Android APK

---

## 📌 UI & Design Rules
- The project design standards are documented in `DESIGN.md`.
- Use all possible fields from `directus-schema.json` where applicable across modules.
- Live Directus API Endpoint: `https://api.tankhor.com`.
- **UI Naming Directive**: Do NOT display the word "Directus" in user-facing UI labels, badges, or dialogs. Refer to cloud features as "سرور ابری" / "همگام‌سازی ابری" / "Cloud Sync".
- Authentication is strictly account-based; guest/offline bypass buttons are removed from login interfaces.
