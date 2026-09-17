// Collections with strict organization_id tenant boundary
export const TENANT_SCOPED_COLLECTIONS = new Set([
  'products',
  'product_variants',
  'categories',
  'collections',
  'seasons',
  'colors',
  'brands',
  'size_groups',
  'sizes',
  'warehouses',
  'warehouse_locations',
  'inventory_items',
  'inventory_movements',
  'orders',
  'order_items',
  'customers',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'stock_transfers',
  'stock_transfer_items',
  'size_guide_templates',
  'size_guide_measurements',
  'size_guide_values',
  'organization_users',
  'subscriptions',
  'organization_modules',
  'expense_categories',
  'expenses',
  'person_transactions',
  'financial_accounts',
  'treasury_transactions',
  'cheques',
  'landed_costs',
  'landed_cost_allocations',
  'pos_shifts',
  'woocommerce_settings',
  'woocommerce_logs',
  'woocommerce_mappings',
]);

export function checkRolePermission(
  userRole: string,
  action: 'create' | 'update' | 'delete',
  collection: string
): { allowed: boolean; message?: string } {
  const role = (userRole || 'viewer').toLowerCase();
  if (role === 'owner' || role === 'manager') {
    return { allowed: true };
  }

  if (role === 'viewer') {
    return {
      allowed: false,
      message: 'دسترسی فقط مشاهده (Viewer): امکان ثبت، ویرایش یا حذف اطلاعات وجود ندارد.',
    };
  }

  if (role === 'sales') {
    if (action === 'delete') {
      return { allowed: false, message: 'نقش فروشنده (Sales) اجازه حذف اطلاعات را ندارد.' };
    }
    const salesAllowedCollections = [
      'orders',
      'order_items',
      'customers',
      'pos_shifts',
      'treasury_transactions',
      'person_transactions',
      'inventory_movements',
      'inventory_items',
      'financial_accounts',
    ];
    if (!salesAllowedCollections.includes(collection)) {
      return {
        allowed: false,
        message: `نقش فروشنده (Sales) مجاز به انجام عملیات روی «${collection}» نیست.`,
      };
    }
    return { allowed: true };
  }

  if (role === 'warehouse') {
    if (
      action === 'delete' &&
      (collection === 'products' ||
        collection === 'product_variants' ||
        collection === 'organizations' ||
        collection === 'organization_users')
    ) {
      return { allowed: false, message: 'نقش انباردار (Warehouse) اجازه حذف این بخش را ندارد.' };
    }
    const warehouseRestrictedCollections = [
      'orders',
      'order_items',
      'customers',
      'organizations',
      'organization_users',
    ];
    if (warehouseRestrictedCollections.includes(collection)) {
      return {
        allowed: false,
        message: `نقش انباردار (Warehouse) مجاز به تغییرات روی «${collection}» نیست.`,
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

export function sanitizePayloadForDirectus(
  collection: string,
  raw: Record<string, any>
): Record<string, any> {
  const payload = { ...raw };

  // 1. Extract IDs if relational objects were sent
  const relationalFields = [
    'organization_id',
    'category_id',
    'account_id',
    'financial_account_id',
    'customer_id',
    'supplier_id',
    'product_id',
    'variant_id',
    'order_id',
    'purchase_order_id',
    'warehouse_id',
    'destination_warehouse_id',
    'source_warehouse_id',
    'source_account_id',
    'destination_account_id',
    'target_account_id',
    'brand_id',
    'collection_id',
    'season_id',
    'color_id',
    'size_id',
    'size_group_id',
    'template_id',
  ];

  for (const f of relationalFields) {
    if (payload[f] !== undefined && payload[f] !== null) {
      if (typeof payload[f] === 'object' && payload[f].id !== undefined) {
        payload[f] = Number(payload[f].id);
      } else if (
        typeof payload[f] === 'string' &&
        !isNaN(Number(payload[f])) &&
        payload[f].trim() !== ''
      ) {
        payload[f] = Number(payload[f]);
      }
    }
  }

  // 2. Collection-specific sanitization & mapping
  if (collection === 'expenses') {
    const pm = payload.payment_method;
    if (pm === 'bank_account' || pm === 'card_transfer' || pm === 'bank') {
      payload.payment_method = 'bank';
    } else if (pm === 'pos') {
      payload.payment_method = 'pos';
    } else if (pm === 'cheque') {
      payload.payment_method = 'cheque';
    } else if (pm === 'credit') {
      payload.payment_method = 'credit';
    } else {
      payload.payment_method = 'cash';
    }

    const noteParts: string[] = [];
    if (payload.paid_to) noteParts.push(`دریافت‌کننده: ${payload.paid_to}`);
    if (payload.reference_code) noteParts.push(`کد پیگیری: ${payload.reference_code}`);
    if (payload.description) noteParts.push(payload.description);
    if (payload.notes && payload.notes !== payload.description) noteParts.push(payload.notes);
    if (noteParts.length > 0) {
      payload.notes = noteParts.join(' | ');
    }

    if (payload.amount !== undefined) {
      payload.amount = Number(payload.amount) || 0;
    }

    if (payload.expense_date) {
      const dateStr = String(payload.expense_date);
      payload.expense_date = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    }

    delete payload.paid_to;
    delete payload.reference_code;
    delete payload.description;
    delete payload.category_title;
    delete payload.category_code;
    delete payload.category_icon;
    delete payload.account_name;
    delete payload.created_by_name;
  }

  if (collection === 'expense_categories') {
    if (!payload.icon) payload.icon = 'Receipt';
    if (!payload.status) payload.status = 'active';
    delete payload.expense_count;
    delete payload.total_amount;
  }

  if (collection === 'financial_accounts') {
    if (payload.initial_balance !== undefined)
      payload.initial_balance = Number(payload.initial_balance) || 0;
    if (payload.current_balance !== undefined)
      payload.current_balance = Number(payload.current_balance) || 0;
    if (payload.is_default !== undefined) payload.is_default = Boolean(payload.is_default);
    delete payload.status;
  }

  if (collection === 'treasury_transactions') {
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;
    delete payload.source_account_name;
    delete payload.destination_account_name;
  }

  if (collection === 'cheques') {
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;
    if (payload.alert_days_before !== undefined)
      payload.alert_days_before = Number(payload.alert_days_before) || 3;
    delete payload.notes;
    delete payload.customer_name;
    delete payload.supplier_name;
  }

  if (collection === 'person_transactions') {
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;
    if (payload.balance_after !== undefined)
      payload.balance_after = Number(payload.balance_after) || 0;
    delete payload.debit_amount;
    delete payload.credit_amount;
    delete payload.running_balance;
    delete payload.status;
    delete payload.customer_name;
    delete payload.supplier_name;
  }

  if (collection === 'pos_shifts') {
    delete payload.organization_id;
    delete payload.notes;
    delete payload.warehouse_name;
    delete payload.account_name;
    delete payload.user_name;
    delete payload.user_email;
    delete payload.total_sales_amount;
    delete payload.total_cash_amount;
    delete payload.total_pos_amount;
    delete payload.total_card_amount;
    delete payload.total_credit_amount;
    delete payload.total_orders_count;
    if (payload.opening_balance !== undefined && payload.opening_balance !== null) {
      payload.opening_balance = String(payload.opening_balance);
    }
    if (payload.closing_balance !== undefined && payload.closing_balance !== null) {
      payload.closing_balance = String(payload.closing_balance);
    }
    if (payload.status !== undefined && payload.status !== null) {
      payload.status = Array.isArray(payload.status) ? payload.status : [payload.status];
    }
  }

  return payload;
}
