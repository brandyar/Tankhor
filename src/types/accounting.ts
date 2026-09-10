import { Status, Organization, Customer, Supplier, Order, PurchaseOrder } from './index';

export type PartyType = 'customer' | 'supplier' | 'other';

export type PersonTransactionType =
  | 'sale_invoice'
  | 'purchase_invoice'
  | 'cash_payment'
  | 'cash_receipt'
  | 'cheque'
  | 'discount'
  | 'opening_balance'
  | 'adjustment';

export type PersonTransactionStatus = 'cleared' | 'pending' | 'cancelled';

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'cheque' | 'credit' | 'other';

export interface ExpenseCategory {
  id: number;
  organization_id: number | Organization;
  title: string;
  code?: string;
  icon?: string;
  status: Status;
  date_created?: string;
}

export interface Expense {
  id: number;
  organization_id: number | Organization;
  category_id: number | ExpenseCategory;
  title: string;
  amount: number;
  expense_date: string;
  payment_method: PaymentMethod | string;
  account_id?: number | null; // For Phase 2 Financial Accounts
  receipt_attachment?: string | null;
  paid_to?: string;
  description?: string;
  reference_code?: string;
  notes?: string;
  created_by?: string;
  date_created?: string;
  // Joined / Display fields
  category_title?: string;
  category_code?: string;
  category_icon?: string;
}

export interface PersonTransaction {
  id: number;
  organization_id: number | Organization;
  party_type: PartyType;
  customer_id?: number | Customer | string | null;
  supplier_id?: number | Supplier | string | null;
  type?: 'debtor' | 'creditor'; // debtor = بدهکار (+), creditor = بستانکار (-)
  transaction_type: PersonTransactionType | string;
  amount: number;
  debit_amount?: number;
  credit_amount?: number;
  running_balance?: number;
  balance_after?: number;
  order_id?: number | Order | null;
  purchase_order_id?: number | PurchaseOrder | null;
  reference_code?: string;
  reference_number?: string;
  payment_method?: string;
  transaction_date: string;
  description?: string;
  status?: PersonTransactionStatus | string;
  date_created?: string;
  // Joined / Display fields
  party_name?: string;
  order_number?: string;
  purchase_number?: string;
}

export interface ProfitLossSummary {
  period?: string; // e.g. 'all', 'month', 'year'
  startDate?: string;
  endDate?: string;
  total_revenue?: number;
  totalRevenue?: number; // مجموع درآمد فروش
  total_cogs?: number;
  totalCogs?: number; // بهای تمام‌شده کالای فروش‌رفته (COGS)
  gross_profit?: number;
  grossProfit?: number; // سود ناخالص (Revenue - COGS)
  gross_margin_percentage?: number;
  grossMarginPercent?: number; // درصد حاشیه سود ناخالص
  total_expenses?: number;
  totalExpenses?: number; // مجموع هزینه‌های جاری
  expenses_by_category?: { category_id: number; category_title: string; amount: number; percentage: number }[];
  expensesByCategory?: { categoryId: number; title: string; amount: number; percentage: number }[];
  net_profit?: number;
  netProfit?: number; // سود خالص (Gross Profit - Total Expenses)
  net_margin_percentage?: number;
  netMarginPercent?: number; // درصد حاشیه سود خالص
  total_receivables?: number;
  total_payables?: number;
  orders_count?: number;
  ordersCount?: number;
  expenses_count?: number;
  expensesCount?: number;
}

// ==========================================
// Phase 2 Types (Treasury, Accounts, Cheques)
// ==========================================

export type FinancialAccountType = 'cashbox' | 'bank' | 'pos' | 'petty_cash';

export interface FinancialAccount {
  id: number;
  organization_id: number | Organization;
  name: string;
  type: FinancialAccountType | string;
  bank_name?: string | null;
  account_number?: string | null;
  card_number?: string | null;
  shaba_number?: string | null;
  pos_terminal_id?: string | null;
  initial_balance: number;
  current_balance: number;
  is_default: boolean;
  status?: Status | string;
  date_created?: string;
}

export type TreasuryTransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'fee';

export interface TreasuryTransaction {
  id: number;
  organization_id: number | Organization;
  source_account_id?: number | FinancialAccount | null;
  destination_account_id?: number | FinancialAccount | null;
  type: TreasuryTransactionType | string;
  amount: number;
  tracking_code?: string;
  transaction_date: string;
  person_transaction_id?: number | PersonTransaction | null;
  expense_id?: number | Expense | null;
  description?: string;
  receipt_attachment?: string | null;
  date_created?: string;
  // Joined / Display fields
  source_account_name?: string;
  destination_account_name?: string;
}

export type ChequeType = 'received' | 'issued';
export type ChequeStatus =
  | 'registered'
  | 'in_bank'
  | 'cleared'
  | 'bounced'
  | 'transferred'
  | 'returned'
  | 'cancelled';

export interface Cheque {
  id: number;
  organization_id: number | Organization;
  type: ChequeType | string;
  sayad_id: string; // 16-digit Sayad ID
  cheque_number: string;
  bank_name: string;
  branch_name?: string | null;
  account_number?: string | null;
  drawer_name: string;
  customer_id?: number | Customer | string | null;
  supplier_id?: number | Supplier | string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  status: ChequeStatus | string;
  target_account_id?: number | FinancialAccount | string | null;
  alert_days_before: number;
  image_front?: string | null;
  image_back?: string | null;
  notes?: string;
  date_created?: string;
  // Joined / Display fields
  customer_name?: string;
  supplier_name?: string;
  target_account_name?: string;
  days_until_due?: number;
  is_overdue?: boolean;
}

// ==========================================
// Phase 3 Types (Landed Cost & Advanced Tax)
// ==========================================

export type LandedCostType = 'freight' | 'customs' | 'packaging' | 'commission' | 'insurance' | 'other';
export type AllocationMethod = 'by_value' | 'by_quantity' | 'manual';

export interface LandedCost {
  id: number;
  organization_id: number | Organization;
  purchase_order_id: number | PurchaseOrder;
  cost_type: LandedCostType;
  title: string;
  amount: number;
  allocation_method: AllocationMethod;
  expense_id?: number | Expense | null;
  date_applied: string;
  date_created?: string;
  notes?: string;
  // Joined / Display fields
  purchase_number?: string;
  supplier_name?: string;
  purchase_total?: number;
  allocations_count?: number;
}

export interface LandedCostAllocation {
  id: number;
  landed_cost_id?: number | LandedCost;
  purchase_order_item_id: number;
  allocated_amount: number;
  effective_unit_cost: number;
  // Joined / Display fields
  variant_id?: number;
  sku?: string;
  product_title?: string;
  variant_name?: string;
  quantity?: number;
  base_unit_cost?: number;
  base_total?: number;
}

export interface VatReportSummary {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  periodLabel: string;
  salesTaxableAmount: number;
  salesVatAmount: number;
  purchasesTaxableAmount: number;
  purchasesVatAmount: number;
  netVatPayable: number;
  vatRate: number;
  ordersCount: number;
  purchasesCount: number;
  salesInvoices: {
    id: number;
    orderNumber: string;
    customerName: string;
    nationalId?: string;
    date: string;
    subtotal: number;
    vatAmount: number;
    total: number;
  }[];
  purchaseInvoices: {
    id: number;
    purchaseNumber: string;
    supplierName: string;
    economicCode?: string;
    date: string;
    subtotal: number;
    vatAmount: number;
    total: number;
  }[];
}

export type AccountingExportFormat = 'moadian' | 'sepidar' | 'holo' | 'general_journal';

export interface AccountingJournalEntry {
  id: number | string;
  documentNumber?: string;
  entry_number?: string;
  date?: string;
  entry_date?: string;
  description: string;
  accountCode?: string;
  account_code?: string;
  accountName?: string;
  account_name?: string;
  debit: number;
  credit: number;
  referenceNumber?: string;
  reference_type?: string;
  reference_id?: number | string;
  partyName?: string;
}
