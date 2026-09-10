# نقشه راه جامع توسعه ماژول حسابداری تن‌خور (TANKHOR Accounting Roadmap)

این مستند، طرح مهندسی، معماری پایگاه‌داده دایرکتوس (Directus Schema)، روابط و مراحل پیاده‌سازی گام‌به‌گام ماژول تخصصی حسابداری و مالی پلتفرم تن‌خور را در ۳ فاز عملیاتی تشریح می‌کند.

---

## 🎯 اهداف کلیدی ماژول حسابداری
1. یکپارچگی کامل با کاتالوگ محصولات، انبارداری و فروش/سفارشات.
2. معماری آفلاین‌فرست و پشتیبانی همزمان در وب و دسکتاپ (Tauri / SQLite).
3. تفکیک دقیق سطوح دسترسی (مالی، فروش، انبار، مدیریت).
4. صدور خودکار گردش‌های مالی هنگام ثبت فاکتورهای فروش و خریدهای انبار.

---

## 🏗️ معماری کالکشن‌های دایرکتوس به تفکیک فاز

```
┌────────────────────────────────────────────────────────────────────────┐
│                          فاز ۱: MVP حسابداری                            │
│  • expense_categories (دسته‌بندی هزینه‌ها)                              │
│  • expenses (ثبت هزینه‌ها)                                              │
│  • person_transactions (دفتر بدهکار/بستانکار اشخاص)                    │
│  • آپدیت فیلدهای customers, suppliers, product_variants                │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        فاز ۲: خزانه، بانک و چک                         │
│  • financial_accounts (صندوق‌ها، بانک‌ها و دستگاه‌های پوز)              │
│  • treasury_transactions (واریز، برداشت و انتقال حساب‌ها)              │
│  • cheques (چک‌های صیادی دریافتی و پرداختی + آلارم سررسید)             │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       فاز ۳: بهای تمام‌شده و مالیات                    │
│  • landed_costs (هزینه‌های حمل، گمرک و سربار خرید)                    │
│  • landed_cost_allocations (تسهیم بهای تمام‌شده روی واریانت‌ها)         │
│  • accounting_documents (اسناد دوبل حسابداری و خروجی استاندارد)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 جزئیات کالکشن‌ها و فیلدهای دایرکتوس

### 🔹 فاز ۱: MVP حسابداری و سود و زیان

#### ۱.۱ کالکشن `expense_categories` (دسته‌بندی هزینه‌ها)
| نام فیلد | نوع داده در دایرکتوس | نوع اینترفیس | توضیحات |
| :--- | :--- | :--- | :--- |
| `id` | integer (Auto-inc) | input | کلید اصلی |
| `organization_id` | integer (M2O -> `organizations`) | select-dropdown-m2o | شناسه سازمان (چندمستأجری) |
| `title` | string (100) | input | عنوان (مثلاً اجاره، حقوق، حمل‌ونقل، تبلیغات) |
| `code` | string (50) | input | کد سرفصل یا معین |
| `icon` | string (50) | input | آیکون دسته‌بندی |
| `status` | string (default: 'active') | select-dropdown | وضعیت (active / archived) |
| `date_created` | dateTime | datetime | تاریخ ایجاد |

#### ۱.۲ کالکشن `expenses` (هزینه‌های جاری)
| نام فیلد | نوع داده در دایرکتوس | نوع اینترفیس | توضیحات |
| :--- | :--- | :--- | :--- |
| `id` | integer (Auto-inc) | input | کلید اصلی |
| `organization_id` | integer (M2O -> `organizations`) | select-dropdown-m2o | شناسه سازمان |
| `category_id` | integer (M2O -> `expense_categories`) | select-dropdown-m2o | سرفصل هزینه |
| `title` | string (255) | input | شرح یا بابت هزینه |
| `amount` | bigInteger / decimal | input | مبلغ هزینه (به تومان/ریال) |
| `expense_date` | dateTime | datetime | تاریخ و زمان انجام هزینه |
| `payment_method` | string | select-dropdown | روش پرداخت (cash, bank, card, cheque, credit) |
| `account_id` | integer (M2O -> `financial_accounts`, Nullable) | select-dropdown-m2o | حساب پرداخت‌کننده (فاز ۲) |
| `receipt_attachment` | uuid (M2O -> `directus_files`, Nullable) | file | تصویر فاکتور/فیش پرداخت |
| `notes` | text | textarea | توضیحات تکمیلی |
| `created_by` | uuid (M2O -> `directus_users`) | select-dropdown-m2o | کاربر ثبت‌کننده |

#### ۱.۳ کالکشن `person_transactions` (دفتر معین / بدهکار و بستانکار اشخاص)
| نام فیلد | نوع داده در دایرکتوس | نوع اینترفیس | توضیحات |
| :--- | :--- | :--- | :--- |
| `id` | integer (Auto-inc) | input | کلید اصلی |
| `organization_id` | integer (M2O -> `organizations`) | select-dropdown-m2o | شناسه سازمان |
| `party_type` | string (50) | select-dropdown | نوع طرف حساب (`customer` / `supplier` / `other`) |
| `customer_id` | integer (M2O -> `customers`, Nullable) | select-dropdown-m2o | شناسه مشتری |
| `supplier_id` | integer (M2O -> `suppliers`, Nullable) | select-dropdown-m2o | شناسه تامین‌کننده |
| `type` | string (20) | select-dropdown | ماهیت (`debtor` [بدهکار] / `creditor` [بستانکار]) |
| `transaction_type` | string (50) | select-dropdown | نوع تراکنش (`sale_invoice`, `purchase_invoice`, `cash_payment`, `cash_receipt`, `cheque`, `discount`, `opening_balance`, `adjustment`) |
| `amount` | bigInteger | input | مبلغ تراکنش |
| `balance_after` | bigInteger | input | مانده حساب پس از این سند |
| `order_id` | integer (M2O -> `orders`, Nullable) | select-dropdown-m2o | فاکتور فروش مرتبط |
| `purchase_order_id` | integer (M2O -> `purchase_orders`, Nullable) | select-dropdown-m2o | فاکتور خرید مرتبط |
| `reference_number` | string (100) | input | شماره سند / پیگیری |
| `transaction_date` | dateTime | datetime | تاریخ تراکنش |
| `description` | text | textarea | شرح سند |
| `status` | string (default: 'cleared') | select-dropdown | وضعیت (`cleared`, `pending`, `cancelled`) |

#### ۱.۴ فیلدهای افزوده شده به کالکشن‌های فعلی
- **`customers`**:
  - `balance`: bigInteger (default: 0) — مانده حساب لحظه‌ای
  - `credit_limit`: bigInteger (default: 0) — سقف اعتبار نسیه
- **`suppliers`**:
  - `balance`: bigInteger (default: 0) — مانده حساب لحظه‌ای
- **`product_variants`**:
  - `buy_price`: bigInteger (قیمت خرید پایه)
  - `sell_price`: bigInteger (قیمت فروش)

---

### 🔹 فاز ۲: خزانه، بانک، صندوق و چک‌ها

#### ۲.۱ کالکشن `financial_accounts` (حساب‌های مالی و صندوق‌ها)
| نام فیلد | نوع داده در دایرکتوس | نوع اینترفیس | توضیحات |
| :--- | :--- | :--- | :--- |
| `id` | integer (Auto-inc) | input | کلید اصلی |
| `organization_id` | integer (M2O -> `organizations`) | select-dropdown-m2o | شناسه سازمان |
| `name` | string (150) | input | نام حساب (مثلاً صندوق مرکزی، بانک ملت، پوز سامان) |
| `type` | string (50) | select-dropdown | نوع (`cashbox` [صندوق], `bank` [حساب بانکی], `pos` [کارتخوان], `petty_cash` [تنخواه]) |
| `bank_name` | string (100, Nullable) | input | نام بانک |
| `account_number` | string (50, Nullable) | input | شماره حساب |
| `card_number` | string (20, Nullable) | input | شماره کارت ۱۶ رقمی |
| `shaba_number` | string (30, Nullable) | input | شماره شبا (IR...) |
| `pos_terminal_id` | string (50, Nullable) | input | شماره ترمینال پوز |
| `initial_balance` | bigInteger (default: 0) | input | موجودی اول دوره |
| `current_balance` | bigInteger (default: 0) | input | موجودی لحظه‌ای |
| `is_default` | boolean (default: false) | boolean | حساب پیش‌فرض دریافت/پرداخت |
| `status` | string (default: 'active') | select-dropdown | وضعیت |

#### ۲.۲ کالکشن `treasury_transactions` (گردش خزانه و انتقالات)
| نام فیلد | نوع داده در دایرکتوس | نوع اینترفیس | توضیحات |
| :--- | :--- | :--- | :--- |
| `id` | integer (Auto-inc) | input | کلید اصلی |
| `organization_id` | integer (M2O -> `organizations`) | select-dropdown-m2o | شناسه سازمان |
| `source_account_id` | integer (M2O -> `financial_accounts`, Nullable) | select-dropdown-m2o | حساب مبدأ |
| `destination_account_id`| integer (M2O -> `financial_accounts`, Nullable) | select-dropdown-m2o | حساب مقصد |
| `type` | string (50) | select-dropdown | نوع (`deposit` [واریز], `withdrawal` [برداشت], `transfer` [انتقال بین‌حسابی], `fee` [کارمزد]) |
| `amount` | bigInteger | input | مبلغ گردش |
| `tracking_code` | string (100) | input | کد رهگیری / ارجاع بانکی |
| `transaction_date` | dateTime | datetime | تاریخ تراکنش |
| `person_transaction_id` | integer (M2O -> `person_transactions`, Nullable)| select-dropdown-m2o | سند شخص مرتبط |
| `expense_id` | integer (M2O -> `expenses`, Nullable) | select-dropdown-m2o | هزینه مرتبط |
| `description` | text | textarea | توضیحات |
| `receipt_attachment` | uuid (M2O -> `directus_files`, Nullable) | file | تصویر رسید واریز |

#### ۲.۳ کالکشن `cheques` (چک‌های صیادی دریافتی / پرداختی)
| نام فیلد | نوع داده در دایرکتوس | نوع اینترفیس | توضیحات |
| :--- | :--- | :--- | :--- |
| `id` | integer (Auto-inc) | input | کلید اصلی |
| `organization_id` | integer (M2O -> `organizations`) | select-dropdown-m2o | شناسه سازمان |
| `type` | string (20) | select-dropdown | نوع چک (`received` [دریافتی], `issued` [پرداختی]) |
| `sayad_id` | string (16) | input | شناسه ۱۶ رقمی صیاد |
| `cheque_number` | string (50) | input | سریال چک |
| `bank_name` | string (100) | input | نام بانک صادرکننده |
| `branch_name` | string (100, Nullable) | input | نام / کد شعبه |
| `account_number` | string (50, Nullable) | input | شماره حساب صاحب چک |
| `drawer_name` | string (150) | input | نام صادرکننده / صاحب حساب |
| `customer_id` | integer (M2O -> `customers`, Nullable) | select-dropdown-m2o | مشتری (در چک دریافتی) |
| `supplier_id` | integer (M2O -> `suppliers`, Nullable) | select-dropdown-m2o | تامین‌کننده (در چک پرداختی) |
| `amount` | bigInteger | input | مبلغ چک |
| `issue_date` | date | date | تاریخ صدور |
| `due_date` | date | date | تاریخ سررسید |
| `status` | string (50) | select-dropdown | وضعیت (`registered`, `in_bank`, `cleared`, `bounced`, `transferred`, `returned`, `cancelled`) |
| `target_account_id` | integer (M2O -> `financial_accounts`, Nullable) | select-dropdown-m2o | حساب بانکی وصول / خواباندن |
| `alert_days_before` | integer (default: 3) | input | روزهای مانده به سررسید جهت هشدار |
| `image_front` | uuid (M2O -> `directus_files`, Nullable) | file | تصویر روی چک |
| `image_back` | uuid (M2O -> `directus_files`, Nullable) | file | تصویر پشت چک |
| `notes` | text | textarea | یادداشت و توضیحات |

---

### 🔹 فاز ۳: بهای تمام‌شده (Landed Cost) و گزارش‌های پیشرفته حسابداری

#### ۳.۱ کالکشن `landed_costs` (هزینه‌های سربار و بهای تمام‌شده خرید)
| نام فیلد | نوع داده در دایرکتوس | نوع اینترفیس | توضیحات |
| :--- | :--- | :--- | :--- |
| `id` | integer (Auto-inc) | input | کلید اصلی |
| `organization_id` | integer (M2O -> `organizations`) | select-dropdown-m2o | شناسه سازمان |
| `purchase_order_id` | integer (M2O -> `purchase_orders`) | select-dropdown-m2o | فاکتور خرید کل |
| `cost_type` | string (50) | select-dropdown | نوع هزینه (`freight`, `customs`, `packaging`, `commission`, `insurance`, `other`) |
| `title` | string (200) | input | شرح هزینه (مثلاً باربری تهران-شیراز) |
| `amount` | bigInteger | input | مبلغ هزینه سربار |
| `allocation_method` | string (50) | select-dropdown | نحوه تسهیم (`by_value` [ارزش], `by_quantity` [تعداد], `manual` [دستی]) |
| `expense_id` | integer (M2O -> `expenses`, Nullable) | select-dropdown-m2o | سند هزینه مرتبط |
| `date_applied` | date | date | تاریخ اعمال |

#### ۳.۲ کالکشن `landed_cost_allocations` (تسهیم سربار روی اقلام خرید)
| نام فیلد | نوع داده در دایرکتوس | نوع اینترفیس | توضیحات |
| :--- | :--- | :--- | :--- |
| `id` | integer (Auto-inc) | input | کلید اصلی |
| `landed_cost_id` | integer (M2O -> `landed_costs`) | select-dropdown-m2o | هزینه سربار والد |
| `purchase_order_item_id` | integer (M2O -> `purchase_order_items`) | select-dropdown-m2o | قلم کالای خرید |
| `allocated_amount` | bigInteger | input | سهم هزینه سربار برای این ردیف |
| `effective_unit_cost` | bigInteger | input | بهای تمام‌شده واقعی نهایی هر عدد کالا |

---

## 📅 مراحل پیاده‌سازی و لیست تسک‌ها

### گام‌های فاز ۱ (MVP):
1. **ایجاد تایپ‌ها (`src/types/accounting.ts`)**: تایپ‌های TypeScript برای Expense, ExpenseCategory, PersonTransaction.
2. **بروزرسانی لایه Storage (`localAdapter`, `sqliteAdapter`, `cloudAdapter`)**: متدهای CRUD حسابداری و اتصال به SQLite در دسکتاپ.
3. **طراحی ماژول UI (`src/features/accounting/`)**:
   - `AccountingOverview.tsx`: داشبورد سود و زیان (مجموع درآمد فروش - بهای خرید کالا - هزینه‌های جاری = سود خالص).
   - `ExpensesList.tsx` & `ExpenseModal.tsx`: لیست و ثبت هزینه‌ها با تفکیک سرفصل و فیلتر تاریخی.
   - `PartyLedgerView.tsx`: دفتر حساب اشخاص (جستجوی مشتری/تامین‌کننده، مشاهده فاکتورها، پرداختی‌ها، مانده حساب و چاپ صورتحساب).
4. **ثبت اتوماتیک سند در فروش و خرید**: هنگام صدور سفارش جدید (`Order`) یا خرید انبار (`PurchaseOrder`)، سند متناظر در `person_transactions` به صورت خودکار ایجاد شود.

### گام‌های فاز ۲ (خزانه و چک):
1. پیاده‌سازی مدیریت صندوق‌ها و حساب‌های بانکی (`FinancialAccountsView.tsx`).
2. ثبت و رهگیری چک‌های صیادی (`ChequesView.tsx`) با فیلتر سررسید و تعیین وضعیت (پاس‌شده، برگشتی، در جریان وصول).
3. ماژول هشدار هوشمند سررسید چک‌ها در داشبورد و اعلان‌ها.

### گام‌های فاز ۳ (پیشرفته):
1. محاسبه بهای تمام‌شده (Landed Cost) روی سفارشات خرید و بروزرسانی قیمت تمام‌شده واریانت‌ها.
2. ماژول گزارشات مالیاتی و ارزش‌افزوده.
3. خروجی استاندارد اکسل/CSV سازگار با نرم‌افزارهای حسابداری رسمی (سپیدار، هلو و سامانه مودیان).
