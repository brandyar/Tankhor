# AGENTS.md - TANKHOR (تن‌خور) Project Guidelines & Instructions

## 📌 Project Identity
**TANKHOR (تن‌خور)** is a modern, high-performance product and inventory management platform tailored for apparel, fashion, footwear, bags, and accessories businesses.

---

## 🏗️ Architectural Directives

1. **Storage Adapter Pattern (MANDATORY)**:
   - ALL database read and write operations across the entire application **MUST** pass through the `storageManager` instance defined in `/src/storage/index.ts`.
   - Never import or make direct Directus API or LocalStorage calls inside UI React components.
   - UI components consume `useStorage()` or `storageManager` methods which conform to `IStorageProvider`.

2. **Schema Fidelity**:
   - The canonical database schema is stored in `/directus-schema.json` (25 collections).
   - Do **NOT** invent duplicate collections, change field names, or alter primary key conventions.
   - Variant-level stock rule: Products represent concepts (`products`). Stock balances live strictly on sellable variants (`product_variants` -> `inventory_items`).

3. **Multi-Tenancy & Tenant Boundary**:
   - `organizations` is the tenant boundary.
   - All query operations **MUST** scope data by the current `organization_id`.
   - Directus handles user authentication (`directus_users`). Never create custom user/password tables.

4. **Internationalization & Localization (i18n)**:
   - First production UI language is **Persian (`fa`)** with **RTL** orientation and `Vazirmatn` font.
   - **NO HARDCODED UI STRINGS**: All labels, buttons, form placeholders, table headers, error messages, and dialog titles must use translation keys `t("namespace.key")`.
   - Translation keys are organized in `/src/i18n/locales/fa/` and `/src/i18n/locales/en/`.
   - Use CSS Logical Properties (`margin-inline-start`, `padding-inline-end`, `border-s-`, etc.) to guarantee seamless LTR/RTL switching.

5. **Dynamic Size Guide Architecture**:
   - Size Guides are generic (`size_guide_templates` -> `size_guide_measurements` -> `size_guide_values`).
   - Do **NOT** hardcode apparel-specific dimensions (like chest/waist). Render measurement definitions dynamically based on the active template type (apparel, shoes, bags, accessories, custom).

---

## 📂 Key Code Structure

- `/src/types/index.ts`: Strongly typed domain definitions for all Directus collections
- `/src/storage/types.ts`: Storage provider interface & sync queue definitions
- `/src/storage/localAdapter.ts`: Local offline persistence provider
- `/src/storage/cloudAdapter.ts`: Directus REST API provider
- `/src/storage/syncManager.ts`: Sync manager for offline changes
- `/src/api/directus.ts`: Directus API client
- `/src/i18n/`: Translation keys (`fa`, `en`) and i18n helper hooks
- `/src/context/`: Auth, Tenant, and i18n React Contexts
- `/src/components/ui/`: Reusable, locale-agnostic design system controls
- `/src/components/layout/`: Responsive App Shell (Sidebar, Top Header, Org Switcher)
- `/src/features/`: Modular domain views (Dashboard, Products, Inventory, Orders, Purchasing, Size Guides)
- `/src/utils/`: Jalali date formatting, Persian number formatters, currency formatters


## Notes
- The Project design standards is in DESIGN.md file
- use all possible fields in directus-schema.json in parts off project.
- Live Directus API Endpoint: `https://api.tankhor.com`
- **UI Naming Directive**: Do NOT display the word "Directus" in user-facing UI labels, badges, or dialogs. Refer to cloud features as "سرور ابری" / "همگام‌سازی ابری" / "Cloud Sync".
