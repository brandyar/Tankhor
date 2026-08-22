# TANKHOR (تن‌خور) Project Roadmap

## 📌 Vision
TANKHOR is a modern, full-featured product, inventory, size guide, and order management platform designed for fashion, apparel, footwear, bags, and accessories businesses. It supports dual deployment models: Free Desktop (Offline / Local) and Pro (Cloud Sync via Directus & PostgreSQL).

---

## 🚀 Development Phases

### Phase 1: Core Architectural Foundation (Completed)
- [x] Schema analysis and Directus 25-collection domain mappings (100% field alignment)
- [x] Multi-tenant architecture (`organizations` boundary with `logo`, `currency`, `timezone`, `plan`, `status` fields)
- [x] Membership roles and organization users (`organization_users` with `user_id`, `role`, `status`, `date_joined`, `first_name`, `last_name`, `email`)
- [x] Storage Adapter Architecture (`IStorageProvider`, `CloudDirectusAdapter`, `LocalOfflineAdapter`, `StorageSyncManager`)
- [x] Dual-language i18n infrastructure (Persian `fa` RTL default + English `en` LTR support)
- [x] Application Shell, Navigation Sidebar, Top Header with Tenant & Language Switchers, Storage Mode Indicator
- [x] Reusable UI Component System (`DataTable`, `Modal`, `Button`, `Input`, `Select`, `Badge`, `Toast`, `PageHeader`, `LoadingSpinner`)
- [x] Interactive Persian Dashboard with analytics summaries and quick shortcuts

### Phase 2: Catalog & Product Management (Completed)
- [x] Full Product & Product Variant CRUD with image support, status badges, tags, and all schema fields (`title`, `slug`, `brand`, `tags`, `sort`, `description`, `main_image`, `status`, `category_id`, `collection_id`, `season_id`, `size_guide_template_id`)
- [x] Hierarchical Tree View for Categories using `parent_id` with visual level indentation (`Folder`, `CornerDownLeft`), parent category badges, and nested parent selector in modals
- [x] Full Taxonomy & Attributes Management (`collections` with `description`, `seasons` with `code`/`start_date`/`end_date`, `colors` with `hex`/`code`, `size_groups` with `category` type, `sizes` with `sort` order)
- [x] Variant fields full alignment (`sku`, `barcode`, `price`, `cost`, `image`, `status`, `sort`, `color_id`, `size_id`)
- [x] Image URL integration for main product images (`main_image`) and variant thumbnails (`image`)
- [x] Multi-attribute variant generator (Matrix builder for Color × Size) with auto SKU/barcode generation
- [x] Hierarchical Category filtering, text search, and action controls for catalog items

### Phase 3: Inventory & Warehouse Management (Completed)
- [x] Warehouses & Multi-tiered Warehouse Locations (Zone / Aisle / Rack / Shelf / Bin) with barcode tags
- [x] Real-time Stock Balance matrix per Variant / Warehouse / Location
- [x] Immutable Inventory Movement Audit Trail (Purchase, Sale, Return, Adjustment, Transfer In/Out, Damage)
- [x] Interactive Stock Adjustment Modal with movement reason and reference logging
- [x] Low stock reorder alerts & safety stock threshold tracking
- [x] Dedicated Inter-Warehouse Stock Transfers manager with automatic inventory movement balancing

### Phase 4: Sales Orders & Customer Operations (Completed)
- [x] Order list & detailed view with status badges and invoice summaries
- [x] Interactive POS / Order Creation form with real-time cart, discounts, tax, and customer selection
- [x] Customer directory management & purchase history timeline
- [x] Automatic inventory deduction (`sale` movement) upon order completion/confirmation

### Phase 5: Purchasing & Supplier Procurement (Completed)
- [x] Supplier directory management with contact info and address records
- [x] Purchase Order flow (Draft → Ordered → Partially Received → Received → Cancelled)
- [x] Automated inventory incrementing (`purchase` movement) upon PO receiving

### Phase 6: Inter-Warehouse Stock Transfers (Completed)
- [x] Stock transfer request & dispatch workflow
- [x] In-Transit stock tracking (`in_transit` status)
- [x] Receiving stock validation at target warehouse (`completed` status with automatic `transfer_out` & `transfer_in` movements)

### Phase 7: Generic Dynamic Size Guides (Completed)
- [x] Generic template builder (Apparel, Footwear, Bags, Accessories, Custom)
- [x] Measurement definition manager (Length, Width, Circumference, Weight, etc.)
- [x] Matrix editor for exact measurement values per size

---

## 🔮 Future Extensions (Post-MVP)
- WooCommerce and Shopify eCommerce integration adapters
- Tauri Native SQLite local persistence engine
- LAN multi-terminal POS sync over local network
- Barcode scanner camera/hardware integration
