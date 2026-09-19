import { QueryParams } from '../types';
import { LocalStorageBase } from './localBase';
import { normalizeId } from '../../utils/formatters';
import {
  ExpenseCategory,
  Expense,
  PersonTransaction,
  FinancialAccount,
  TreasuryTransaction,
  Cheque,
  ChequeStatus,
  LandedCost,
  LandedCostAllocation,
  PosShift,
  PosShiftStatus,
  ProfitLossSummary,
  VatReportSummary,
  Customer,
  Supplier,
  Order,
  OrderItem,
  PurchaseOrder,
  PurchaseOrderItem,
  ProductVariant,
  Product,
  Warehouse,
  OrganizationUser
} from '../../types';

export class LocalAccountingStorage {
  constructor(private base: LocalStorageBase) {}

  // Expenses & Categories
  private getDefaultExpenseCategories(orgId: number): ExpenseCategory[] {
    const existing = this.base.getItem<ExpenseCategory>('expense_categories', []);
    const baseId = this.base.generateUniqueId(existing);
    return [
      { id: baseId, organization_id: orgId, title: 'اجاره و شارژ فروشگاه/انبار', code: 'rent', status: 'active' },
      { id: baseId + 1, organization_id: orgId, title: 'حقوق و دستمزد پرسنل', code: 'salary', status: 'active' },
      { id: baseId + 2, organization_id: orgId, title: 'حمل و نقل و ارسال سفارشات', code: 'shipping', status: 'active' },
      { id: baseId + 3, organization_id: orgId, title: 'بسته‌بندی و پاکت‌سازی', code: 'packaging', status: 'active' },
      { id: baseId + 4, organization_id: orgId, title: 'تبلیغات، بلاگر و بازاریابی', code: 'marketing', status: 'active' },
      { id: baseId + 5, organization_id: orgId, title: 'قبوض آب، برق، گاز و اینترنت', code: 'utilities', status: 'active' },
      { id: baseId + 6, organization_id: orgId, title: 'سایر هزینه‌های عمومی', code: 'general', status: 'active' },
    ];
  }

  async getExpenseCategories(params?: QueryParams): Promise<ExpenseCategory[]> {
    let items = this.base.getItem<ExpenseCategory>('expense_categories', []);
    const orgId = this.base.getActiveOrgId(params) || 1;

    const orgCategories = items.filter((c) => {
      const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
      return Number(cOrgId) === Number(orgId) || (!cOrgId && Number(orgId) === 1);
    });

    if (orgCategories.length === 0) {
      const defaults = this.getDefaultExpenseCategories(orgId);
      items = [...items, ...defaults];
      this.base.setItem('expense_categories', items);
      return defaults;
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      return orgCategories.filter((c) => c.title.toLowerCase().includes(q));
    }
    return orgCategories;
  }

  async saveExpenseCategory(category: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    const list = this.base.getItem<ExpenseCategory>('expense_categories', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(category.organization_id) }) || 1;

    let savedCat: ExpenseCategory;
    if (category.id) {
      const idx = list.findIndex((c) => c.id === category.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...category, id: category.id };
        savedCat = list[idx];
      } else {
        savedCat = { ...category, id: category.id } as ExpenseCategory;
        list.push(savedCat);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      savedCat = {
        id: newId,
        organization_id: orgId,
        title: category.title || 'دسته‌بندی جدید',
        code: category.code || `cat-${Date.now().toString().slice(-4)}`,
        status: category.status || 'active',
        ...category,
      };
      list.push(savedCat);
    }
    this.base.setItem('expense_categories', list);
    return savedCat;
  }

  async deleteExpenseCategory(id: number): Promise<boolean> {
    const list = this.base.getItem<ExpenseCategory>('expense_categories', []);
    const filtered = list.filter((c) => c.id !== id);
    this.base.setItem('expense_categories', filtered);
    return true;
  }

  async getExpenses(params?: QueryParams): Promise<Expense[]> {
    let items = this.base.getItem<Expense>('expenses', []);
    const orgId = this.base.getActiveOrgId(params);
    const categories = await this.getExpenseCategories({ organization_id: orgId });

    if (orgId) {
      items = items.filter((e) => {
        const eOrgId = typeof e.organization_id === 'number' ? e.organization_id : Number((e.organization_id as any)?.id || (e as any).organization_id);
        return eOrgId === orgId;
      });
    }

    const enriched = items.map((e) => {
      const catId = typeof e.category_id === 'object' ? (e.category_id as any)?.id : e.category_id;
      const cat = categories.find((c) => c.id === Number(catId));

      return {
        ...e,
        category_title: cat?.title || (e as any).category_name,
        category_code: cat?.code,
      };
    });

    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.paid_to && e.paid_to.toLowerCase().includes(q))
      );
    }
    return enriched;
  }

  async getExpenseById(id: number): Promise<Expense | null> {
    const list = await this.getExpenses();
    return list.find((e) => e.id === id) || null;
  }

  async saveExpense(expense: Partial<Expense>): Promise<Expense> {
    const list = this.base.getItem<Expense>('expenses', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(expense.organization_id) }) || 1;

    let savedExp: Expense;
    if (expense.id) {
      const idx = list.findIndex((e) => e.id === expense.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...expense, id: expense.id };
        savedExp = list[idx];
      } else {
        savedExp = { ...expense, id: expense.id } as Expense;
        list.push(savedExp);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      savedExp = {
        id: newId,
        organization_id: orgId,
        title: expense.title || 'هزینه جدید',
        amount: Math.max(0, Number(expense.amount) || 0),
        expense_date: expense.expense_date || new Date().toISOString().split('T')[0],
        category_id: expense.category_id || 1,
        payment_method: expense.payment_method || 'cash',
        account_id: expense.account_id || null,
        reference_code: expense.reference_code || null,
        description: expense.description || '',
        paid_to: expense.paid_to || '',
        receipt_attachment: expense.receipt_attachment || null,
        date_created: new Date().toISOString(),
        ...expense,
      };
      list.push(savedExp);
    }

    this.base.setItem('expenses', list);

    // Auto-create Treasury Transaction if account is selected
    if (savedExp.account_id && savedExp.amount > 0) {
      try {
        const accId = typeof savedExp.account_id === 'object' ? (savedExp.account_id as any)?.id : savedExp.account_id;
        const treasuryTxs = this.base.getItem<TreasuryTransaction>('treasury_transactions', []);
        const existingTx = treasuryTxs.find((tx) => tx.expense_id === savedExp.id);
        if (!existingTx) {
          await this.saveTreasuryTransaction({
            organization_id: orgId,
            source_account_id: accId,
            type: 'withdrawal',
            amount: savedExp.amount,
            expense_id: savedExp.id,
            description: `پرداخت هزینه: ${savedExp.title}`,
            transaction_date: savedExp.expense_date,
          });
        }
      } catch {}
    }

    return savedExp;
  }

  async deleteExpense(id: number): Promise<boolean> {
    const list = this.base.getItem<Expense>('expenses', []);
    const filtered = list.filter((e) => e.id !== id);
    this.base.setItem('expenses', filtered);
    return true;
  }

  // Person Transactions (Customer & Supplier Ledgers)
  async getPersonTransactions(params?: QueryParams): Promise<PersonTransaction[]> {
    let items = this.base.getItem<PersonTransaction>('person_transactions', []);
    const orgId = this.base.getActiveOrgId(params);
    const customers = this.base.getItem<Customer>('customers', []);
    const suppliers = this.base.getItem<Supplier>('suppliers', []);

    if (orgId) {
      items = items.filter((t) => {
        const tOrgId = typeof t.organization_id === 'number' ? t.organization_id : Number((t.organization_id as any)?.id || (t as any).organization_id);
        return tOrgId === orgId;
      });
    }

    const enriched = items.map((t) => {
      const custId = typeof t.customer_id === 'object' ? (t.customer_id as any)?.id : t.customer_id;
      const supId = typeof t.supplier_id === 'object' ? (t.supplier_id as any)?.id : t.supplier_id;

      let partyName = '-';
      if (t.party_type === 'customer' || custId) {
        const c = customers.find((cust) => cust.id === Number(custId));
        if (c) partyName = c.name;
      } else if (t.party_type === 'supplier' || supId) {
        const s = suppliers.find((supp) => supp.id === Number(supId));
        if (s) partyName = s.name;
      }

      return {
        ...t,
        party_name: partyName,
      };
    });

    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((t) =>
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.reference_code && t.reference_code.toLowerCase().includes(q)) ||
        (t.party_name && t.party_name.toLowerCase().includes(q))
      );
    }
    return enriched.sort((a, b) => new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime());
  }

  async getPersonTransactionById(id: number): Promise<PersonTransaction | null> {
    const list = await this.getPersonTransactions();
    return list.find((t) => t.id === id) || null;
  }

  async savePersonTransaction(tx: Partial<PersonTransaction>): Promise<PersonTransaction> {
    const list = this.base.getItem<PersonTransaction>('person_transactions', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(tx.organization_id) }) || 1;

    let savedTx: PersonTransaction;
    if (tx.id) {
      const idx = list.findIndex((t) => t.id === tx.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...tx, id: tx.id };
        savedTx = list[idx];
      } else {
        savedTx = { ...tx, id: tx.id } as PersonTransaction;
        list.push(savedTx);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      const amount = Math.max(0, Number(tx.amount) || 0);
      const isDebtor = tx.type === 'debtor';
      savedTx = {
        id: newId,
        organization_id: orgId,
        party_type: tx.party_type || 'customer',
        customer_id: tx.customer_id || null,
        supplier_id: tx.supplier_id || null,
        transaction_type: tx.transaction_type || 'adjustment',
        type: tx.type || 'debtor',
        amount,
        debit_amount: isDebtor ? amount : 0,
        credit_amount: !isDebtor ? amount : 0,
        balance_after: 0,
        reference_code: tx.reference_code || null,
        transaction_date: tx.transaction_date || new Date().toISOString(),
        description: tx.description || '',
        date_created: new Date().toISOString(),
        ...tx,
      };
      list.push(savedTx);
    }

    this.base.setItem('person_transactions', list);
    return savedTx;
  }

  async deletePersonTransaction(id: number): Promise<boolean> {
    const list = this.base.getItem<PersonTransaction>('person_transactions', []);
    const filtered = list.filter((t) => t.id !== id);
    this.base.setItem('person_transactions', filtered);
    return true;
  }

  // Profit & Loss
  async getProfitAndLoss(params?: QueryParams): Promise<ProfitLossSummary> {
    const orgId = params?.organization_id || this.base.getActiveOrgId() || 1;
    const period = params?.period || 'all';

    const orders = this.base.getItem<Order>('orders', []);
    const orderItems = this.base.getItem<OrderItem>('order_items', []);
    const variants = this.base.getItem<ProductVariant>('product_variants', []);
    const expenses = await this.getExpenses({ organization_id: orgId });

    // Filter valid orders by org and exclude cancelled
    const orgOrders = orders.filter((o) => {
      const oOrg = typeof o.organization_id === 'object' ? (o.organization_id as any)?.id : o.organization_id;
      return Number(oOrg) === orgId && o.status !== 'cancelled';
    });

    const now = new Date();
    const isWithinPeriod = (dateStr: string) => {
      if (period === 'all') return true;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      if (period === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (period === 'this_week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= weekAgo;
      }
      if (period === 'this_month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return d >= monthAgo;
      }
      if (period === 'this_quarter') {
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return d >= quarterAgo;
      }
      if (period === 'this_year') {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return d >= yearAgo;
      }
      return true;
    };

    const validOrders = orgOrders.filter((o) => isWithinPeriod(o.date_created || ''));

    // 1. Total Revenue
    const totalRevenue = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // 2. Cost of Goods Sold (COGS)
    let totalCogs = 0;
    const validOrderIds = new Set(validOrders.map((o) => o.id));
    const validOrderItems = orderItems.filter((oi) => {
      const oId = typeof oi.order_id === 'object' ? (oi.order_id as any)?.id : oi.order_id;
      return validOrderIds.has(Number(oId));
    });

    validOrderItems.forEach((oi) => {
      const vId = normalizeId(oi.variant_id);
      const v = variants.find((variant) => normalizeId(variant.id) === vId);
      const unitBuyPrice = Number(v?.buy_price) || 0;
      const qty = Number(oi.quantity) || 1;
      totalCogs += unitBuyPrice * qty;
    });

    // 3. Gross Profit
    const grossProfit = totalRevenue - totalCogs;
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // 4. Operational Expenses
    const filteredExpenses = expenses.filter((e) => isWithinPeriod(e.expense_date || e.date_created || ''));
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const catMap = new Map<number, { title: string; amount: number }>();
    filteredExpenses.forEach((e) => {
      const catKey = Number(typeof e.category_id === 'object' ? (e.category_id as any)?.id : e.category_id) || 0;
      const catTitle = e.category_title || (e as any).category_name || 'سایر هزینه‌ها';
      const current = catMap.get(catKey) || { title: catTitle, amount: 0 };
      current.amount += Number(e.amount) || 0;
      catMap.set(catKey, current);
    });

    const expensesByCategory = Array.from(catMap.entries())
      .map(([catId, data]) => ({
        categoryId: catId,
        title: data.title,
        amount: data.amount,
        percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
      }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const expensesByCategorySnake = expensesByCategory.map((e) => ({
      category_id: e.categoryId,
      category_title: e.title,
      amount: e.amount,
      percentage: e.percentage,
    }));

    // 5. Net Profit
    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // 6. Customer Receivables & Supplier Payables
    const customers = this.base.getItem<Customer>('customers', []);
    const suppliers = this.base.getItem<Supplier>('suppliers', []);
    const personTxs = await this.getPersonTransactions({ organization_id: orgId });

    let totalReceivables = 0;
    customers.forEach((c) => {
      const bal = Number(c.balance) || 0;
      if (bal > 0) totalReceivables += bal;
    });
    if (totalReceivables === 0 && personTxs.length > 0) {
      const custTxs = personTxs.filter((t) => t.party_type === 'customer' || t.customer_id);
      custTxs.forEach((t) => {
        if (t.type === 'debtor' || t.transaction_type === 'sale_invoice') {
          totalReceivables += Number(t.debit_amount || t.amount) || 0;
        } else if (t.type === 'creditor' || t.transaction_type === 'cash_receipt' || t.transaction_type === 'receipt') {
          totalReceivables -= Number(t.credit_amount || t.amount) || 0;
        }
      });
      totalReceivables = Math.max(0, totalReceivables);
    }

    let totalPayables = 0;
    suppliers.forEach((s) => {
      const bal = Number(s.balance) || 0;
      if (bal > 0) totalPayables += bal;
    });
    if (totalPayables === 0 && personTxs.length > 0) {
      const supTxs = personTxs.filter((t) => t.party_type === 'supplier' || t.supplier_id);
      supTxs.forEach((t) => {
        if (t.type === 'creditor' || t.transaction_type === 'purchase_invoice') {
          totalPayables += Number(t.credit_amount || t.amount) || 0;
        } else if (t.type === 'debtor' || t.transaction_type === 'cash_payment' || t.transaction_type === 'payment') {
          totalPayables -= Number(t.debit_amount || t.amount) || 0;
        }
      });
      totalPayables = Math.max(0, totalPayables);
    }

    return {
      period,
      totalRevenue,
      total_revenue: totalRevenue,
      totalCogs,
      total_cogs: totalCogs,
      grossProfit,
      gross_profit: grossProfit,
      grossMarginPercent,
      gross_margin_percentage: grossMarginPercent,
      totalExpenses,
      total_expenses: totalExpenses,
      expensesByCategory,
      expenses_by_category: expensesByCategorySnake,
      netProfit,
      net_profit: netProfit,
      netMarginPercent,
      net_margin_percentage: netMarginPercent,
      total_receivables: totalReceivables,
      total_payables: totalPayables,
      ordersCount: validOrders.length,
      orders_count: validOrders.length,
      expensesCount: filteredExpenses.length,
      expenses_count: filteredExpenses.length,
    };
  }

  // Financial Accounts & Treasury
  private getDefaultFinancialAccounts(orgId: number): FinancialAccount[] {
    const now = new Date().toISOString();
    const existing = this.base.getItem<FinancialAccount>('financial_accounts', []);
    const baseId = this.base.generateUniqueId(existing);
    return [
      {
        id: baseId,
        organization_id: orgId,
        name: 'صندوق نقدی مرکزی',
        type: 'cashbox',
        warehouse_id: 1,
        initial_balance: 0,
        current_balance: 0,
        is_default: true,
        status: 'active',
        date_created: now,
      },
      {
        id: baseId + 1,
        organization_id: orgId,
        name: 'حساب جاری بانک ملت',
        type: 'bank',
        warehouse_id: null,
        bank_name: 'بانک ملت',
        account_number: '1234567890',
        card_number: '6104337890123456',
        shaba_number: 'IR120120000000012345678901',
        initial_balance: 0,
        current_balance: 0,
        is_default: false,
        status: 'active',
        date_created: now,
      },
      {
        id: baseId + 2,
        organization_id: orgId,
        name: 'کارتخوان فروشگاه (POS)',
        type: 'pos',
        warehouse_id: 1,
        bank_name: 'به‌پرداخت ملت',
        pos_terminal_id: '99887766',
        initial_balance: 0,
        current_balance: 0,
        is_default: false,
        status: 'active',
        date_created: now,
      },
    ];
  }

  async getFinancialAccounts(params?: QueryParams): Promise<FinancialAccount[]> {
    const orgId = this.base.getActiveOrgId(params) || 1;
    let allItems = this.base.getItem<FinancialAccount>('financial_accounts', []);

    const existingOrgAccs = allItems.filter((a) => {
      const aOrgId = typeof a.organization_id === 'number' ? a.organization_id : Number((a.organization_id as any)?.id || (a as any).organization_id);
      return Number(aOrgId) === Number(orgId) || (!aOrgId && Number(orgId) === 1);
    });

    if (existingOrgAccs.length === 0) {
      const defaultAccs = this.getDefaultFinancialAccounts(orgId);
      allItems = [...allItems, ...defaultAccs];
      this.base.setItem('financial_accounts', allItems);
    }

    // Dynamic balance computation from treasury transactions
    const allTreasuryTxs = this.base.getItem<TreasuryTransaction>('treasury_transactions', []);
    const orgTreasuryTxs = allTreasuryTxs.filter((tx) => {
      const txOrgId = typeof tx.organization_id === 'number' ? tx.organization_id : Number((tx.organization_id as any)?.id || (tx as any).organization_id);
      return Number(txOrgId) === Number(orgId) || (!txOrgId && (Number(orgId) === 1 || !orgId)) || String(txOrgId) === String(orgId);
    });

    allItems = allItems.map((a) => {
      const aOrgId = typeof a.organization_id === 'number' ? a.organization_id : Number((a.organization_id as any)?.id || (a as any).organization_id);
      const isTargetOrg = Number(aOrgId) === Number(orgId) || (!aOrgId && Number(orgId) === 1);
      if (!isTargetOrg) return a;

      const accId = Number(a.id);
      let balance = Number(a.initial_balance) || 0;
      orgTreasuryTxs.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        const srcId = typeof tx.source_account_id === 'object' ? (tx.source_account_id as any)?.id : tx.source_account_id;
        const dstId = typeof tx.destination_account_id === 'object' ? (tx.destination_account_id as any)?.id : tx.destination_account_id;

        if (tx.type === 'deposit' && Number(dstId) === accId) {
          balance += amt;
        } else if (tx.type === 'withdrawal' && Number(srcId) === accId) {
          balance -= amt;
        } else if (tx.type === 'transfer') {
          if (Number(dstId) === accId) balance += amt;
          if (Number(srcId) === accId) balance -= amt;
        }
      });
      return {
        ...a,
        current_balance: balance,
      };
    });
    this.base.setItem('financial_accounts', allItems);

    let items = allItems;
    if (orgId) {
      const matched = items.filter((a) => {
        const aOrgId = typeof a.organization_id === 'number' ? a.organization_id : Number((a.organization_id as any)?.id || (a as any).organization_id);
        return Number(aOrgId) === Number(orgId) || (!aOrgId && (Number(orgId) === 1 || !orgId)) || String(aOrgId) === String(orgId);
      });
      if (matched.length > 0) {
        items = matched;
      }
    }

    const warehouses = this.base.getItem<Warehouse>('warehouses', []);
    items = items.map((a) => {
      const wId = typeof a.warehouse_id === 'object' && a.warehouse_id ? (a.warehouse_id as any).id : a.warehouse_id;
      const foundWh = warehouses.find((w) => w.id === Number(wId));
      return {
        ...a,
        warehouse_id: wId ? Number(wId) : null,
        warehouse_name: foundWh ? foundWh.name : undefined,
      };
    });

    if (params?.status) {
      items = items.filter((a) => a.status === params.status);
    }
    if (params?.type) {
      items = items.filter((a) => a.type === params.type);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.bank_name && a.bank_name.toLowerCase().includes(q)) ||
        (a.account_number && a.account_number.includes(q)) ||
        (a.card_number && a.card_number.includes(q))
      );
    }
    return items;
  }

  async getFinancialAccountById(id: number): Promise<FinancialAccount | null> {
    const list = await this.getFinancialAccounts();
    return list.find((a) => a.id === id) || null;
  }

  async saveFinancialAccount(account: Partial<FinancialAccount>): Promise<FinancialAccount> {
    const list = this.base.getItem<FinancialAccount>('financial_accounts', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(account.organization_id) }) || 1;

    const parsedWarehouseId = account.warehouse_id !== undefined
      ? (account.warehouse_id ? Number(typeof account.warehouse_id === 'object' ? (account.warehouse_id as any).id : account.warehouse_id) : null)
      : undefined;

    let savedAcc: FinancialAccount;
    if (account.id) {
      const idx = list.findIndex((a) => a.id === account.id);
      if (idx !== -1) {
        if (account.is_default) {
          list.forEach((a) => {
            if (a.organization_id === orgId) a.is_default = false;
          });
        }
        list[idx] = {
          ...list[idx],
          ...account,
          warehouse_id: parsedWarehouseId !== undefined ? parsedWarehouseId : list[idx].warehouse_id,
          id: account.id,
        };
        savedAcc = list[idx];
      } else {
        savedAcc = {
          ...account,
          warehouse_id: parsedWarehouseId !== undefined ? parsedWarehouseId : null,
          id: account.id,
        } as FinancialAccount;
        list.push(savedAcc);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      if (account.is_default) {
        list.forEach((a) => {
          if (a.organization_id === orgId) a.is_default = false;
        });
      }
      savedAcc = {
        id: newId,
        organization_id: orgId,
        name: account.name || 'حساب جدید',
        type: account.type || 'cashbox',
        warehouse_id: parsedWarehouseId !== undefined ? parsedWarehouseId : null,
        bank_name: account.bank_name || null,
        account_number: account.account_number || null,
        card_number: account.card_number || null,
        shaba_number: account.shaba_number || null,
        pos_terminal_id: account.pos_terminal_id || null,
        initial_balance: Number(account.initial_balance) || 0,
        current_balance: Number(account.current_balance ?? account.initial_balance) || 0,
        is_default: Boolean(account.is_default),
        status: account.status || 'active',
        date_created: new Date().toISOString(),
        ...account,
      };
      list.push(savedAcc);
    }

    this.base.setItem('financial_accounts', list);
    return savedAcc;
  }

  async deleteFinancialAccount(id: number): Promise<boolean> {
    const list = this.base.getItem<FinancialAccount>('financial_accounts', []);
    const filtered = list.filter((a) => a.id !== id);
    this.base.setItem('financial_accounts', filtered);
    return true;
  }

  // Treasury Transactions
  async getTreasuryTransactions(params?: QueryParams): Promise<TreasuryTransaction[]> {
    let items = this.base.getItem<TreasuryTransaction>('treasury_transactions', []);
    const orgId = this.base.getActiveOrgId(params);
    const accounts = await this.getFinancialAccounts({ organization_id: orgId });

    if (orgId) {
      items = items.filter((t) => {
        const tOrgId = typeof t.organization_id === 'number' ? t.organization_id : Number((t.organization_id as any)?.id || (t as any).organization_id);
        return Number(tOrgId) === Number(orgId) || (!tOrgId && (Number(orgId) === 1 || !orgId)) || String(tOrgId) === String(orgId);
      });
    }

    const enriched = items.map((tx) => {
      const srcId = typeof tx.source_account_id === 'object' ? (tx.source_account_id as any)?.id : tx.source_account_id;
      const dstId = typeof tx.destination_account_id === 'object' ? (tx.destination_account_id as any)?.id : tx.destination_account_id;
      const src = accounts.find((a) => a.id === Number(srcId));
      const dst = accounts.find((a) => a.id === Number(dstId));
      return {
        ...tx,
        source_account_name: src?.name,
        destination_account_name: dst?.name,
      };
    });

    if (params?.type) {
      return enriched.filter((t) => t.type === params.type);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((t) =>
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.tracking_code && t.tracking_code.toLowerCase().includes(q))
      );
    }

    return enriched.sort((a, b) => new Date(b.transaction_date || 0).getTime() - new Date(a.transaction_date || 0).getTime());
  }

  async saveTreasuryTransaction(tx: Partial<TreasuryTransaction>): Promise<TreasuryTransaction> {
    const list = this.base.getItem<TreasuryTransaction>('treasury_transactions', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(tx.organization_id) }) || 1;
    const accounts = this.base.getItem<FinancialAccount>('financial_accounts', []);

    const newId = typeof tx.id === 'number' && tx.id > 0 ? tx.id : this.base.generateUniqueId(list);
    const amount = Math.max(0, Number(tx.amount) || 0);

    const savedTx: TreasuryTransaction = {
      id: newId,
      organization_id: orgId,
      source_account_id: tx.source_account_id || null,
      destination_account_id: tx.destination_account_id || null,
      type: tx.type || 'deposit',
      amount,
      tracking_code: tx.tracking_code || `TRX-${Date.now().toString().slice(-6)}`,
      transaction_date: tx.transaction_date || new Date().toISOString(),
      person_transaction_id: tx.person_transaction_id || null,
      expense_id: tx.expense_id || null,
      description: tx.description || '',
      receipt_attachment: tx.receipt_attachment || null,
      date_created: new Date().toISOString(),
      ...tx,
    };

    // Update account balances
    if (savedTx.type === 'deposit' && savedTx.destination_account_id) {
      const dstId = typeof savedTx.destination_account_id === 'object' ? (savedTx.destination_account_id as any)?.id : savedTx.destination_account_id;
      const accIdx = accounts.findIndex((a) => a.id === Number(dstId));
      if (accIdx !== -1) {
        accounts[accIdx].current_balance = (Number(accounts[accIdx].current_balance) || 0) + amount;
      }
    } else if (savedTx.type === 'withdrawal' && savedTx.source_account_id) {
      const srcId = typeof savedTx.source_account_id === 'object' ? (savedTx.source_account_id as any)?.id : savedTx.source_account_id;
      const accIdx = accounts.findIndex((a) => a.id === Number(srcId));
      if (accIdx !== -1) {
        accounts[accIdx].current_balance = (Number(accounts[accIdx].current_balance) || 0) - amount;
      }
    } else if (savedTx.type === 'transfer') {
      if (savedTx.source_account_id) {
        const srcId = typeof savedTx.source_account_id === 'object' ? (savedTx.source_account_id as any)?.id : savedTx.source_account_id;
        const srcIdx = accounts.findIndex((a) => a.id === Number(srcId));
        if (srcIdx !== -1) {
          accounts[srcIdx].current_balance = (Number(accounts[srcIdx].current_balance) || 0) - amount;
        }
      }
      if (savedTx.destination_account_id) {
        const dstId = typeof savedTx.destination_account_id === 'object' ? (savedTx.destination_account_id as any)?.id : savedTx.destination_account_id;
        const dstIdx = accounts.findIndex((a) => a.id === Number(dstId));
        if (dstIdx !== -1) {
          accounts[dstIdx].current_balance = (Number(accounts[dstIdx].current_balance) || 0) + amount;
        }
      }
    }

    this.base.setItem('financial_accounts', accounts);

    const existingIdx = list.findIndex((t) => t.id === savedTx.id);
    if (existingIdx !== -1) {
      list[existingIdx] = savedTx;
    } else {
      list.unshift(savedTx);
    }
    this.base.setItem('treasury_transactions', list);

    return savedTx;
  }

  async deleteTreasuryTransaction(id: number): Promise<boolean> {
    const list = this.base.getItem<TreasuryTransaction>('treasury_transactions', []);
    const filtered = list.filter((t) => t.id !== id);
    this.base.setItem('treasury_transactions', filtered);
    return true;
  }

  // Cheques Management
  async getCheques(params?: QueryParams): Promise<Cheque[]> {
    let items = this.base.getItem<Cheque>('cheques', []);
    const orgId = this.base.getActiveOrgId(params);
    const customers = this.base.getItem<Customer>('customers', []);
    const suppliers = this.base.getItem<Supplier>('suppliers', []);
    const accounts = await this.getFinancialAccounts({ organization_id: orgId });

    if (orgId) {
      items = items.filter((c) => {
        const cOrgId = typeof c.organization_id === 'number' ? c.organization_id : Number((c.organization_id as any)?.id || (c as any).organization_id);
        return cOrgId === orgId;
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = items.map((chk) => {
      const cId = typeof chk.customer_id === 'object' ? (chk.customer_id as any)?.id : chk.customer_id;
      const sId = typeof chk.supplier_id === 'object' ? (chk.supplier_id as any)?.id : chk.supplier_id;
      const tId = typeof chk.target_account_id === 'object' ? (chk.target_account_id as any)?.id : chk.target_account_id;

      const cust = customers.find((c) => c.id === Number(cId));
      const supp = suppliers.find((s) => s.id === Number(sId));
      const acc = accounts.find((a) => a.id === Number(tId));

      let daysUntilDue = 0;
      let isOverdue = false;

      if (chk.due_date) {
        const dueDate = new Date(chk.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const diffMs = dueDate.getTime() - today.getTime();
        daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        isOverdue = daysUntilDue < 0 && chk.status !== 'cleared' && chk.status !== 'cancelled';
      }

      return {
        ...chk,
        customer_name: cust?.name,
        supplier_name: supp?.name,
        target_account_name: acc?.name,
        days_until_due: daysUntilDue,
        is_overdue: isOverdue,
      };
    });

    if (params?.status) {
      return enriched.filter((c) => c.status === params.status);
    }
    if (params?.type) {
      return enriched.filter((c) => c.type === params.type);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((c) =>
        c.sayad_id.includes(q) ||
        c.cheque_number.includes(q) ||
        c.drawer_name.toLowerCase().includes(q) ||
        c.bank_name.toLowerCase().includes(q)
      );
    }

    return enriched.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }

  async getChequeById(id: number): Promise<Cheque | null> {
    const list = await this.getCheques();
    return list.find((c) => c.id === id) || null;
  }

  async saveCheque(cheque: Partial<Cheque>): Promise<Cheque> {
    const list = this.base.getItem<Cheque>('cheques', []);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(cheque.organization_id) }) || 1;

    let savedChk: Cheque;
    if (cheque.id) {
      const idx = list.findIndex((c) => c.id === cheque.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...cheque, id: cheque.id };
        savedChk = list[idx];
      } else {
        savedChk = { ...cheque, id: cheque.id } as Cheque;
        list.push(savedChk);
      }
    } else {
      const newId = this.base.generateUniqueId(list);
      savedChk = {
        id: newId,
        organization_id: orgId,
        type: cheque.type || 'received',
        sayad_id: cheque.sayad_id || '',
        cheque_number: cheque.cheque_number || '',
        bank_name: cheque.bank_name || 'بانک ملت',
        branch_name: cheque.branch_name || null,
        account_number: cheque.account_number || null,
        drawer_name: cheque.drawer_name || '',
        customer_id: cheque.customer_id || null,
        supplier_id: cheque.supplier_id || null,
        amount: Math.max(0, Number(cheque.amount) || 0),
        issue_date: cheque.issue_date || new Date().toISOString().split('T')[0],
        due_date: cheque.due_date || new Date().toISOString().split('T')[0],
        status: cheque.status || 'registered',
        target_account_id: cheque.target_account_id || null,
        alert_days_before: Number(cheque.alert_days_before) || 3,
        image_front: cheque.image_front || null,
        image_back: cheque.image_back || null,
        notes: cheque.notes || '',
        date_created: new Date().toISOString(),
        ...cheque,
      };
      list.push(savedChk);
    }

    this.base.setItem('cheques', list);
    return savedChk;
  }

  async deleteCheque(id: number): Promise<boolean> {
    const list = this.base.getItem<Cheque>('cheques', []);
    const filtered = list.filter((c) => c.id !== id);
    this.base.setItem('cheques', filtered);
    return true;
  }

  async updateChequeStatus(id: number, status: ChequeStatus, targetAccountId?: number): Promise<Cheque> {
    const list = this.base.getItem<Cheque>('cheques', []);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error(`Cheque with id ${id} not found`);
    }

    const chk = list[idx];
    const prevStatus = chk.status;
    chk.status = status;
    if (targetAccountId) {
      chk.target_account_id = targetAccountId;
    }

    if (status === 'cleared' && prevStatus !== 'cleared' && chk.target_account_id) {
      const accounts = this.base.getItem<FinancialAccount>('financial_accounts', []);
      const accId = typeof chk.target_account_id === 'object' ? (chk.target_account_id as any)?.id : chk.target_account_id;
      const accIdx = accounts.findIndex((a) => a.id === Number(accId));
      if (accIdx !== -1) {
        if (chk.type === 'received') {
          accounts[accIdx].current_balance = (Number(accounts[accIdx].current_balance) || 0) + Number(chk.amount);
        } else if (chk.type === 'issued') {
          accounts[accIdx].current_balance = (Number(accounts[accIdx].current_balance) || 0) - Number(chk.amount);
        }
        this.base.setItem('financial_accounts', accounts);
      }
    }

    this.base.setItem('cheques', list);
    return chk;
  }

  // Landed Cost & Tax / VAT Reports
  async getLandedCosts(params?: QueryParams): Promise<LandedCost[]> {
    let list = this.base.getItem<LandedCost>('landed_costs', []);
    const orgId = this.base.getActiveOrgId(params);
    if (orgId) {
      list = list.filter((item) => {
        const itemOrgId = typeof item.organization_id === 'object' ? (item.organization_id as any)?.id : item.organization_id;
        return Number(itemOrgId) === orgId;
      });
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((item) => item.title?.toLowerCase().includes(q) || item.cost_type?.toLowerCase().includes(q));
    }

    const purchaseOrders = this.base.getItem<PurchaseOrder>('purchase_orders', []);
    const suppliers = this.base.getItem<Supplier>('suppliers', []);
    const allocations = this.base.getItem<LandedCostAllocation>('landed_cost_allocations', []);

    return list.map((cost) => {
      const poId = typeof cost.purchase_order_id === 'object' ? (cost.purchase_order_id as any)?.id : cost.purchase_order_id;
      const po = purchaseOrders.find((p) => p.id === Number(poId));
      let supName = '';
      if (po) {
        const supId = typeof po.supplier_id === 'object' ? (po.supplier_id as any)?.id : po.supplier_id;
        const sup = suppliers.find((s) => s.id === Number(supId));
        supName = sup?.name || po.supplier_name || '';
      }

      const costAllocations = allocations.filter((a) => {
        const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
        return Number(cId) === cost.id;
      });

      return {
        ...cost,
        purchase_number: po?.purchase_number || '',
        supplier_name: supName,
        purchase_total: po?.total || 0,
        allocations_count: costAllocations.length,
      };
    });
  }

  async getLandedCostById(id: number): Promise<LandedCost | null> {
    const list = await this.getLandedCosts();
    return list.find((item) => item.id === id) || null;
  }

  async saveLandedCost(cost: Partial<LandedCost>, allocations?: Partial<LandedCostAllocation>[]): Promise<LandedCost> {
    const list = this.base.getItem<LandedCost>('landed_costs', []);
    const isNew = !cost.id;
    let savedCost: LandedCost;

    if (isNew) {
      const newId = this.base.generateUniqueId(list);
      savedCost = {
        id: newId,
        organization_id: cost.organization_id || this.base.getActiveOrgId() || 1,
        purchase_order_id: cost.purchase_order_id || 0,
        cost_type: cost.cost_type || 'freight',
        title: cost.title || '',
        amount: Number(cost.amount) || 0,
        allocation_method: cost.allocation_method || 'by_value',
        expense_id: cost.expense_id || null,
        date_applied: cost.date_applied || new Date().toISOString().slice(0, 10),
        date_created: new Date().toISOString(),
      };
      list.push(savedCost);
    } else {
      const idx = list.findIndex((c) => c.id === cost.id);
      if (idx === -1) throw new Error(`Landed cost with id ${cost.id} not found`);
      savedCost = {
        ...list[idx],
        ...cost,
        amount: Number(cost.amount !== undefined ? cost.amount : list[idx].amount),
      };
      list[idx] = savedCost;
    }

    this.base.setItem('landed_costs', list);

    if (allocations && allocations.length > 0) {
      let allAllocations = this.base.getItem<LandedCostAllocation>('landed_cost_allocations', []);
      allAllocations = allAllocations.filter((a) => {
        const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
        return Number(cId) !== savedCost.id;
      });

      for (const alloc of allocations) {
        const allocId = this.base.generateUniqueId(allAllocations);
        allAllocations.push({
          id: alloc.id || allocId,
          landed_cost_id: savedCost.id,
          purchase_order_item_id: alloc.purchase_order_item_id || 0,
          allocated_amount: Number(alloc.allocated_amount) || 0,
          effective_unit_cost: Number(alloc.effective_unit_cost) || 0,
        });
      }
      this.base.setItem('landed_cost_allocations', allAllocations);
    }

    return savedCost;
  }

  async deleteLandedCost(id: number): Promise<boolean> {
    const list = this.base.getItem<LandedCost>('landed_costs', []);
    this.base.setItem('landed_costs', list.filter((c) => c.id !== id));

    const allocations = this.base.getItem<LandedCostAllocation>('landed_cost_allocations', []);
    this.base.setItem('landed_cost_allocations', allocations.filter((a) => {
      const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
      return Number(cId) !== id;
    }));

    return true;
  }

  async getLandedCostAllocations(landedCostId?: number, purchaseOrderId?: number): Promise<LandedCostAllocation[]> {
    let allocations = this.base.getItem<LandedCostAllocation>('landed_cost_allocations', []);
    if (landedCostId) {
      allocations = allocations.filter((a) => {
        const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
        return Number(cId) === landedCostId;
      });
    }

    const poItems = this.base.getItem<PurchaseOrderItem>('purchase_order_items', []);
    const variants = this.base.getItem<ProductVariant>('product_variants', []);
    const products = this.base.getItem<Product>('products', []);

    return allocations.map((alloc) => {
      const item = poItems.find((pi) => pi.id === alloc.purchase_order_item_id);
      let variant: ProductVariant | undefined;
      let product: Product | undefined;
      if (item) {
        const vId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
        variant = variants.find((v) => v.id === Number(vId));
        if (variant) {
          const pId = typeof variant.product_id === 'object' ? (variant.product_id as any)?.id : variant.product_id;
          product = products.find((p) => p.id === Number(pId));
        }
      }

      return {
        ...alloc,
        variant_id: variant?.id,
        sku: variant?.sku || '',
        product_title: product?.title || '',
        variant_name: variant ? `${product?.title || ''} - ${variant.sku || ''}` : '',
        quantity: item?.quantity_ordered || item?.quantity_received || 1,
        base_unit_cost: item?.unit_cost || 0,
        base_total: item?.total || 0,
      };
    });
  }

  async saveLandedCostAllocation(allocation: Partial<LandedCostAllocation>): Promise<LandedCostAllocation> {
    const list = this.base.getItem<LandedCostAllocation>('landed_cost_allocations', []);
    const isNew = !allocation.id;
    let saved: LandedCostAllocation;

    if (isNew) {
      const newId = this.base.generateUniqueId(list);
      saved = {
        id: newId,
        landed_cost_id: allocation.landed_cost_id || 0,
        purchase_order_item_id: allocation.purchase_order_item_id || 0,
        allocated_amount: Number(allocation.allocated_amount) || 0,
        effective_unit_cost: Number(allocation.effective_unit_cost) || 0,
      };
      list.push(saved);
    } else {
      const idx = list.findIndex((a) => a.id === allocation.id);
      if (idx !== -1) throw new Error(`Allocation with id ${allocation.id} not found`);
      saved = {
        ...list[idx],
        ...allocation,
      };
      list[idx] = saved;
    }

    this.base.setItem('landed_cost_allocations', list);
    return saved;
  }

  async applyLandedCostToVariants(landedCostId: number): Promise<{ updatedVariantsCount: number }> {
    const allocations = await this.getLandedCostAllocations(landedCostId);
    if (!allocations || allocations.length === 0) {
      return { updatedVariantsCount: 0 };
    }

    const variants = this.base.getItem<ProductVariant>('product_variants', []);
    let updatedCount = 0;

    for (const alloc of allocations) {
      if (alloc.variant_id && alloc.effective_unit_cost && alloc.effective_unit_cost > 0) {
        const vIdx = variants.findIndex((v) => v.id === alloc.variant_id);
        if (vIdx !== -1) {
          variants[vIdx].buy_price = Math.round(Number(alloc.effective_unit_cost));
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      this.base.setItem('product_variants', variants);
    }

    return { updatedVariantsCount: updatedCount };
  }

  async getVatReport(params?: { organizationId?: number; year?: number; quarter?: 1 | 2 | 3 | 4 }): Promise<VatReportSummary> {
    const orgId = params?.organizationId || this.base.getActiveOrgId() || 1;
    const year = params?.year || 1403;
    const quarter = params?.quarter || 1;

    let orders = this.base.getItem<Order>('orders', []);
    let purchaseOrders = this.base.getItem<PurchaseOrder>('purchase_orders', []);
    const customers = this.base.getItem<Customer>('customers', []);
    const suppliers = this.base.getItem<Supplier>('suppliers', []);

    orders = orders.filter((o) => {
      const oOrg = typeof o.organization_id === 'object' ? (o.organization_id as any)?.id : o.organization_id;
      return Number(oOrg) === orgId && o.status !== 'cancelled';
    });

    purchaseOrders = purchaseOrders.filter((p) => {
      const pOrg = typeof p.organization_id === 'object' ? (p.organization_id as any)?.id : p.organization_id;
      return Number(pOrg) === orgId && p.status !== 'cancelled';
    });

    const salesTaxable = orders.reduce((sum, o) => sum + (Number(o.subtotal) || Number(o.total) || 0), 0);
    const salesVat = orders.reduce((sum, o) => sum + (Number(o.tax) || 0), 0);

    const purchasesTaxable = purchaseOrders.reduce((sum, p) => sum + (Number(p.subtotal) || Number(p.total) || 0), 0);
    const purchasesVat = purchaseOrders.reduce((sum, p) => sum + (Number(p.tax) || 0), 0);

    const netVatPayable = salesVat - purchasesVat;

    const quarterLabels: Record<number, string> = {
      1: `بهار ${year}`,
      2: `تابستان ${year}`,
      3: `پاییز ${year}`,
      4: `زمستان ${year}`,
    };

    const salesInvoices = orders.map((o) => {
      const custId = typeof o.customer_id === 'object' ? (o.customer_id as any)?.id : o.customer_id;
      const cust = customers.find((c) => c.id === Number(custId));
      return {
        id: o.id,
        orderNumber: o.order_number,
        customerName: cust?.name || o.customer_name || 'مشتری متفرقه',
        nationalId: cust?.phone || '',
        date: o.date_created || '',
        subtotal: Number(o.subtotal) || Number(o.total) || 0,
        vatAmount: Number(o.tax) || 0,
        total: Number(o.total) || 0,
      };
    });

    const purchaseInvoices = purchaseOrders.map((p) => {
      const supId = typeof p.supplier_id === 'object' ? (p.supplier_id as any)?.id : p.supplier_id;
      const sup = suppliers.find((s) => s.id === Number(supId));
      return {
        id: p.id,
        purchaseNumber: p.purchase_number,
        supplierName: sup?.name || p.supplier_name || 'تامین‌کننده',
        economicCode: sup?.phone || '',
        date: p.date_created || '',
        subtotal: Number(p.subtotal) || Number(p.total) || 0,
        vatAmount: Number(p.tax) || 0,
        total: Number(p.total) || 0,
      };
    });

    return {
      year,
      quarter,
      periodLabel: quarterLabels[quarter] || `فصل ${quarter} سال ${year}`,
      salesTaxableAmount: salesTaxable,
      salesVatAmount: salesVat,
      purchasesTaxableAmount: purchasesTaxable,
      purchasesVatAmount: purchasesVat,
      netVatPayable,
      vatRate: 10,
      ordersCount: orders.length,
      purchasesCount: purchaseOrders.length,
      salesInvoices,
      purchaseInvoices,
    };
  }

  // POS Shifts (شیفت‌های صندوق)
  async getPosShifts(params?: QueryParams & { user_id?: string; status?: PosShiftStatus; warehouse_id?: number }): Promise<PosShift[]> {
    const all = this.base.getItem<PosShift>('pos_shifts', []);
    let filtered = this.base.filterByOrg(all, params);

    if (params?.user_id) {
      filtered = filtered.filter((s) => s.user_id === params.user_id);
    }
    if (params?.status) {
      filtered = filtered.filter((s) => s.status === params.status);
    }
    if (params?.warehouse_id) {
      filtered = filtered.filter((s) => {
        const whId = typeof s.warehouse_id === 'object' ? (s.warehouse_id as any)?.id : s.warehouse_id;
        return Number(whId) === Number(params.warehouse_id);
      });
    }

    const warehouses = this.base.getItem<Warehouse>('warehouses', []);
    const accounts = this.base.getItem<FinancialAccount>('financial_accounts', []);
    const users = this.base.getItem<OrganizationUser>('organization_users', []);
    const orders = this.base.getItem<Order>('orders', []);

    return filtered
      .map((shift) => {
        const whId = typeof shift.warehouse_id === 'object' ? (shift.warehouse_id as any)?.id : shift.warehouse_id;
        const wh = warehouses.find((w) => w.id === Number(whId));

        const accId = typeof shift.financial_account_id === 'object' ? (shift.financial_account_id as any)?.id : shift.financial_account_id;
        const acc = accounts.find((a) => a.id === Number(accId));

        const usr = users.find((u) => u.user_id === shift.user_id || u.email === shift.user_id);

        const shiftStart = shift.opened_at ? new Date(shift.opened_at).getTime() : 0;
        const shiftEnd = shift.closed_at ? new Date(shift.closed_at).getTime() : 0;

        const shiftOrders = orders.filter((o) => {
          // 1. Direct pos_shift_id match
          const oShiftId = (o as any).pos_shift_id;
          if (oShiftId && Number(oShiftId) === Number(shift.id)) {
            return true;
          }

          // 2. Check notes for explicit shift reference [شیفت #X] or [Shift #X]
          const notesStr = String(o.notes || '');
          if (notesStr.includes(`شیفت #${shift.id}`) || notesStr.includes(`Shift #${shift.id}`)) {
            return true;
          }

          // 3. If the order explicitly specifies a DIFFERENT pos_shift_id, don't associate with this shift
          if (oShiftId && Number(oShiftId) !== Number(shift.id)) {
            return false;
          }

          // 4. Warehouse match: if shift is tied to a specific warehouse
          const oWhId = typeof o.warehouse_id === 'object' ? (o.warehouse_id as any)?.id : o.warehouse_id;
          if (whId && oWhId && Number(oWhId) !== Number(whId)) {
            return false;
          }

          // 5. Organization match
          const oOrgId = typeof o.organization_id === 'object' ? (o.organization_id as any)?.id : o.organization_id;
          const sOrgId = typeof shift.organization_id === 'object' ? (shift.organization_id as any)?.id : shift.organization_id;
          if (sOrgId && oOrgId && Number(oOrgId) !== Number(sOrgId)) {
            return false;
          }

          // 6. User match (permissive so UUID vs email differences don't reject legitimate shift orders)
          if (shift.user_id) {
            const oUser = String(o.user_created || (o as any).user_id || '').trim();
            const sUser = String(shift.user_id).trim();
            const sEmail = String((shift as any).user_email || usr?.email || '').trim();
            if (oUser && sUser && oUser !== sUser && oUser !== sEmail && !sUser.includes(oUser) && !oUser.includes(sUser)) {
              if (usr && (usr.user_id === oUser || usr.email === oUser)) {
                // matched via organization_users
              } else {
                return false;
              }
            }
          }

          // 7. Time window match (with 60-second grace period for clock drift)
          const oTime = o.date_created ? new Date(o.date_created).getTime() : 0;
          if (shiftStart > 0 && oTime > 0 && oTime < shiftStart - 60000) {
            return false;
          }
          if (shiftEnd > 0 && oTime > 0 && oTime > shiftEnd + 60000) {
            return false;
          }

          return true;
        });

        let totalSales = 0;
        let cashSales = 0;
        let posSales = 0;
        let cardSales = 0;
        let creditSales = 0;

        for (const ord of shiftOrders) {
          if (ord.status === 'cancelled') continue;

          const ordTotal = Number(ord.total) || 0;
          totalSales += ordTotal;
          const pMethod = String(ord.payment_method || (ord as any).payment_type || ord.notes || '').toLowerCase();
          if (pMethod.includes('cash') || pMethod.includes('نقدی') || pMethod.includes('نقد')) {
            cashSales += ordTotal;
          } else if (pMethod.includes('pos') || pMethod.includes('پوز') || pMethod.includes('کارتخوان')) {
            posSales += ordTotal;
          } else if (pMethod.includes('card') || pMethod.includes('کارت')) {
            cardSales += ordTotal;
            posSales += ordTotal; // Electronic card-to-card also counted in electronic card sales
          } else if (pMethod.includes('credit') || pMethod.includes('نسیه')) {
            creditSales += ordTotal;
          } else {
            posSales += ordTotal;
          }
        }

        return {
          ...shift,
          warehouse_name: wh?.name || (whId ? `انبار #${whId}` : undefined),
          account_name: acc?.name || (accId ? `حساب #${accId}` : undefined),
          user_name: usr ? `${usr.first_name || ''} ${usr.last_name || ''}`.trim() || usr.email : undefined,
          user_email: usr?.email,
          total_sales_amount: totalSales,
          total_cash_amount: cashSales,
          total_pos_amount: posSales,
          total_card_amount: cardSales,
          total_credit_amount: creditSales,
          total_orders_count: shiftOrders.filter((o) => o.status !== 'cancelled').length,
        };
      })
      .sort((a, b) => {
        const tA = a.opened_at ? new Date(a.opened_at).getTime() : 0;
        const tB = b.opened_at ? new Date(b.opened_at).getTime() : 0;
        return tB - tA;
      });
  }

  async getActivePosShift(userId?: string, warehouseId?: number): Promise<PosShift | null> {
    const shifts = await this.getPosShifts({ status: 'open' });
    if (!shifts || shifts.length === 0) return null;

    if (userId && warehouseId) {
      const match = shifts.find((s) => {
        const whId = typeof s.warehouse_id === 'object' ? (s.warehouse_id as any)?.id : s.warehouse_id;
        const uMatch = s.user_id === userId || (s as any).user_email === userId || String(s.user_id) === String(userId);
        return uMatch && Number(whId) === Number(warehouseId);
      });
      if (match) return match;
    }
    if (warehouseId) {
      const whShift = shifts.find((s) => {
        const whId = typeof s.warehouse_id === 'object' ? (s.warehouse_id as any)?.id : s.warehouse_id;
        return Number(whId) === Number(warehouseId);
      });
      if (whShift) return whShift;
    }
    if (userId) {
      const userShift = shifts.find((s) => s.user_id === userId || (s as any).user_email === userId || String(s.user_id) === String(userId));
      if (userShift) return userShift;
    }
    return shifts[0] || null;
  }

  async savePosShift(shiftData: Partial<PosShift>): Promise<PosShift> {
    const list = this.base.getItem<PosShift>('pos_shifts', []);
    const activeOrgId = Number(shiftData.organization_id || this.base.getActiveOrgId());
    let saved: PosShift;

    if (shiftData.id) {
      const idx = list.findIndex((s) => s.id === shiftData.id);
      if (idx !== -1) {
        saved = {
          ...list[idx],
          ...shiftData,
          organization_id: activeOrgId,
        };
        list[idx] = saved;
      } else {
        saved = {
          id: shiftData.id,
          organization_id: activeOrgId,
          user_id: shiftData.user_id || null,
          warehouse_id: shiftData.warehouse_id || null,
          financial_account_id: shiftData.financial_account_id || null,
          opening_balance: shiftData.opening_balance ?? '0',
          closing_balance: shiftData.closing_balance ?? null,
          status: shiftData.status || 'open',
          opened_at: shiftData.opened_at || new Date().toISOString(),
          closed_at: shiftData.closed_at || null,
        };
        list.push(saved);
      }
    } else {
      const nextId = this.base.generateUniqueId(list);
      saved = {
        id: nextId,
        organization_id: activeOrgId,
        user_id: shiftData.user_id || null,
        warehouse_id: shiftData.warehouse_id || null,
        financial_account_id: shiftData.financial_account_id || null,
        opening_balance: shiftData.opening_balance ?? '0',
        closing_balance: shiftData.closing_balance ?? null,
        status: shiftData.status || 'open',
        opened_at: shiftData.opened_at || new Date().toISOString(),
        closed_at: shiftData.closed_at || null,
      };
      list.push(saved);
    }

    this.base.setItem('pos_shifts', list);
    return saved;
  }

  async closePosShift(id: number, closingBalance: number | string, notes?: string): Promise<PosShift> {
    const list = this.base.getItem<PosShift>('pos_shifts', []);
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error(`Shift #${id} not found`);
    }

    const updated: PosShift = {
      ...list[idx],
      closing_balance: String(closingBalance),
      status: 'closed',
      closed_at: new Date().toISOString(),
    };

    list[idx] = updated;
    this.base.setItem('pos_shifts', list);
    return updated;
  }

  async deletePosShift(id: number): Promise<boolean> {
    const list = this.base.getItem<PosShift>('pos_shifts', []);
    const filtered = list.filter((s) => s.id !== id);
    this.base.setItem('pos_shifts', filtered);
    return true;
  }
}
