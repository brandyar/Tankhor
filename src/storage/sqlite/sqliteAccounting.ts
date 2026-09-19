import { QueryParams } from '../types';
import { SqliteStorageBase } from './sqliteBase';
import {
  ExpenseCategory,
  Expense,
  PersonTransaction,
  ProfitLossSummary,
  FinancialAccount,
  TreasuryTransaction,
  Cheque,
  ChequeStatus,
  LandedCost,
  LandedCostAllocation,
  VatReportSummary,
  PosShift,
  PosShiftStatus,
  Order,
  OrderItem,
  ProductVariant,
  Customer,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  Warehouse,
  OrganizationUser,
  Product,
} from '../../types';
import { normalizeId } from '../../utils/formatters';

export class SqliteAccountingStorage {
  constructor(private base: SqliteStorageBase) {}

  // ==========================================
  // Expense Categories & Expenses
  // ==========================================
  getDefaultExpenseCategories(orgId: number): ExpenseCategory[] {
    const defaults = [
      { title: 'اجاره محل و دفتر', code: 'EXP-101', icon: 'Building' },
      { title: 'حقوق و دستمزد پرسنل', code: 'EXP-102', icon: 'Users' },
      { title: 'حمل، نقل و باربری', code: 'EXP-103', icon: 'Truck' },
      { title: 'تبلیغات و بازاریابی', code: 'EXP-104', icon: 'Megaphone' },
      { title: 'ملزومات، بسته بندی و کارتن', code: 'EXP-105', icon: 'Package' },
      { title: 'قبوض آب، برق، گاز و اینترنت', code: 'EXP-106', icon: 'Zap' },
      { title: 'پذیرایی و ملزومات مصرفی', code: 'EXP-107', icon: 'Coffee' },
      { title: 'سایر هزینه‌های عمومی', code: 'EXP-199', icon: 'HelpCircle' },
    ];
    const now = new Date().toISOString();
    return defaults.map((d, index) => ({
      id: index + 1,
      organization_id: orgId,
      title: d.title,
      code: d.code,
      icon: d.icon,
      status: 'active' as const,
      date_created: now,
    }));
  }

  async getExpenseCategories(params?: QueryParams): Promise<ExpenseCategory[]> {
    const orgId = this.base.getActiveOrgId(params) || 1;
    let items = await this.base.getItems<ExpenseCategory>('expense_categories', orgId);

    if (items.length === 0) {
      const defaults = this.getDefaultExpenseCategories(orgId);
      for (const cat of defaults) {
        await this.base.saveItem('expense_categories', cat);
      }
      items = defaults;
    }

    if (params?.status) {
      items = items.filter((c) => c.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((c) => c.title.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q)));
    }
    return items;
  }

  async saveExpenseCategory(cat: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    const list = await this.base.getItems<ExpenseCategory>('expense_categories');
    const validId = typeof cat.id === 'number' && cat.id > 0 ? cat.id : this.base.generateUniqueId(list);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(cat.organization_id) }) || 1;

    const saved: ExpenseCategory = {
      id: validId,
      organization_id: orgId,
      title: cat.title || 'سرفصل جدید',
      code: cat.code || `EXP-${Math.floor(100 + Math.random() * 900)}`,
      icon: cat.icon || 'Tag',
      status: cat.status || 'active',
      date_created: new Date().toISOString(),
      ...cat,
    };

    await this.base.saveItem('expense_categories', saved);
    return saved;
  }

  async deleteExpenseCategory(id: number): Promise<boolean> {
    return this.base.deleteItem('expense_categories', id);
  }

  async getExpenses(params?: QueryParams): Promise<Expense[]> {
    const orgId = this.base.getActiveOrgId(params) || 1;
    let items = await this.base.getItems<Expense>('expenses', orgId);
    const categories = await this.getExpenseCategories({ organization_id: orgId });

    const enriched = items.map((exp) => {
      const catId = typeof exp.category_id === 'number' ? exp.category_id : (exp.category_id as any)?.id;
      const cat = categories.find((c) => c.id === catId);
      return {
        ...exp,
        category_title: cat?.title || exp.category_title || 'سایر هزینه‌ها',
        category_code: cat?.code || exp.category_code,
        category_icon: cat?.icon || exp.category_icon || 'Receipt',
      };
    });

    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((e) => e.title.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q)));
    }
    if (params?.category_id) {
      return enriched.filter((e) => {
        const catId = typeof e.category_id === 'number' ? e.category_id : (e.category_id as any)?.id;
        return Number(catId) === Number(params.category_id);
      });
    }

    return enriched;
  }

  async getExpenseById(id: number): Promise<Expense | null> {
    const list = await this.getExpenses();
    return list.find((e) => e.id === id) || null;
  }

  async saveExpense(exp: Partial<Expense>): Promise<Expense> {
    const list = await this.base.getItems<Expense>('expenses');
    const validId = typeof exp.id === 'number' && exp.id > 0 ? exp.id : this.base.generateUniqueId(list);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(exp.organization_id) }) || 1;

    const saved: Expense = {
      id: validId,
      organization_id: orgId,
      category_id: exp.category_id || 1,
      title: exp.title || 'هزینه جدید',
      amount: Math.max(0, Number(exp.amount) || 0),
      expense_date: exp.expense_date || new Date().toISOString(),
      payment_method: exp.payment_method || 'cash',
      notes: exp.notes || '',
      date_created: new Date().toISOString(),
      ...exp,
    };

    await this.base.saveItem('expenses', saved);

    // If payment is linked to a financial account/cashbox, record treasury withdrawal
    if (saved.account_id && saved.amount > 0) {
      try {
        await this.saveTreasuryTransaction({
          organization_id: orgId,
          type: 'withdrawal',
          source_account_id: saved.account_id,
          amount: saved.amount,
          expense_id: saved.id,
          description: `پرداخت هزینه: ${saved.title}`,
          transaction_date: saved.expense_date,
        });
      } catch (tErr) {
        console.warn('[SqliteAccountingStorage] Failed to record treasury tx for expense:', tErr);
      }
    }

    return saved;
  }

  async deleteExpense(id: number): Promise<boolean> {
    return this.base.deleteItem('expenses', id);
  }

  // ==========================================
  // Person Transactions (Customer & Supplier Ledgers)
  // ==========================================
  async getPersonTransactions(params?: QueryParams): Promise<PersonTransaction[]> {
    const orgId = this.base.getActiveOrgId(params) || 1;
    let items = await this.base.getItems<PersonTransaction>('person_transactions', orgId);

    const customers = await this.base.getItems<Customer>('customers', orgId);
    const suppliers = await this.base.getItems<Supplier>('suppliers', orgId);
    const orders = await this.base.getItems<Order>('orders', orgId);
    const purchaseOrders = await this.base.getItems<PurchaseOrder>('purchase_orders', orgId);

    const enriched = items.map((tx) => {
      let partyName = tx.party_name || '';
      if (!partyName) {
        if (tx.party_type === 'customer' && tx.customer_id) {
          const cId = typeof tx.customer_id === 'number' ? tx.customer_id : (tx.customer_id as any)?.id;
          const cust = customers.find((c) => c.id === cId);
          partyName = cust?.name || `مشتری #${cId}`;
        } else if (tx.party_type === 'supplier' && tx.supplier_id) {
          const sId = typeof tx.supplier_id === 'number' ? tx.supplier_id : (tx.supplier_id as any)?.id;
          const sup = suppliers.find((s) => s.id === sId);
          partyName = sup?.name || `تامین‌کننده #${sId}`;
        }
      }

      let orderNumber = tx.order_number;
      if (!orderNumber && tx.order_id) {
        const oId = typeof tx.order_id === 'number' ? tx.order_id : (tx.order_id as any)?.id;
        const ord = orders.find((o) => o.id === oId);
        orderNumber = ord?.order_number;
      }

      let purchaseNumber = tx.purchase_number;
      if (!purchaseNumber && tx.purchase_order_id) {
        const pId = typeof tx.purchase_order_id === 'number' ? tx.purchase_order_id : (tx.purchase_order_id as any)?.id;
        const po = purchaseOrders.find((p) => p.id === pId);
        purchaseNumber = po?.purchase_number;
      }

      return {
        ...tx,
        party_name: partyName,
        order_number: orderNumber,
        purchase_number: purchaseNumber,
      };
    });

    if (params?.type) {
      return enriched.filter((tx) => tx.party_type === params.type || tx.type === params.type);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((tx) => (tx.party_name && tx.party_name.toLowerCase().includes(q)) || (tx.description && tx.description.toLowerCase().includes(q)) || (tx.reference_number && tx.reference_number.toLowerCase().includes(q)));
    }

    return enriched;
  }

  async getPersonTransactionById(id: number): Promise<PersonTransaction | null> {
    const list = await this.getPersonTransactions();
    return list.find((t) => t.id === id) || null;
  }

  async savePersonTransaction(tx: Partial<PersonTransaction>): Promise<PersonTransaction> {
    const list = await this.base.getItems<PersonTransaction>('person_transactions');
    const validId = typeof tx.id === 'number' && tx.id > 0 ? tx.id : this.base.generateUniqueId(list);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(tx.organization_id) }) || 1;

    const saved: PersonTransaction = {
      id: validId,
      organization_id: orgId,
      party_type: tx.party_type || 'customer',
      customer_id: tx.customer_id || null,
      supplier_id: tx.supplier_id || null,
      type: tx.type || 'debtor',
      transaction_type: tx.transaction_type || 'cash_payment',
      amount: Math.max(0, Number(tx.amount) || 0),
      transaction_date: tx.transaction_date || new Date().toISOString(),
      status: tx.status || 'cleared',
      reference_number: tx.reference_number || `TX-${Math.floor(1000 + Math.random() * 9000)}`,
      description: tx.description || '',
      date_created: new Date().toISOString(),
      ...tx,
    };

    await this.base.saveItem('person_transactions', saved);

    // Auto-recalculate customer / supplier balance
    if (saved.party_type === 'customer' && saved.customer_id) {
      const cId = typeof saved.customer_id === 'number' ? saved.customer_id : (saved.customer_id as any)?.id;
      const customers = await this.base.getItems<Customer>('customers');
      const customer = customers.find((c) => c.id === cId);
      if (customer) {
        const allTxs = await this.base.getItems<PersonTransaction>('person_transactions');
        const partyTxs = allTxs.filter((t) => {
          const tCId = typeof t.customer_id === 'number' ? t.customer_id : (t.customer_id as any)?.id;
          return t.party_type === 'customer' && tCId === cId && t.status !== 'cancelled';
        });
        const currentBalance = partyTxs.reduce((sum, t) => {
          const amt = Number(t.amount) || 0;
          return t.type === 'debtor' ? sum + amt : sum - amt;
        }, 0);
        customer.balance = currentBalance;
        await this.base.saveItem('customers', customer);
      }
    } else if (saved.party_type === 'supplier' && saved.supplier_id) {
      const sId = typeof saved.supplier_id === 'number' ? saved.supplier_id : (saved.supplier_id as any)?.id;
      const suppliers = await this.base.getItems<Supplier>('suppliers');
      const supplier = suppliers.find((s) => s.id === sId);
      if (supplier) {
        const allTxs = await this.base.getItems<PersonTransaction>('person_transactions');
        const partyTxs = allTxs.filter((t) => {
          const tSId = typeof t.supplier_id === 'number' ? t.supplier_id : (t.supplier_id as any)?.id;
          return t.party_type === 'supplier' && tSId === sId && t.status !== 'cancelled';
        });
        const currentBalance = partyTxs.reduce((sum, t) => {
          const amt = Number(t.amount) || 0;
          return t.type === 'creditor' ? sum + amt : sum - amt;
        }, 0);
        supplier.balance = currentBalance;
        await this.base.saveItem('suppliers', supplier);
      }
    }

    return saved;
  }

  async deletePersonTransaction(id: number): Promise<boolean> {
    return this.base.deleteItem('person_transactions', id);
  }

  // ==========================================
  // Profit & Loss Summary
  // ==========================================
  async getProfitAndLoss(params?: QueryParams): Promise<ProfitLossSummary> {
    const orgId = this.base.getActiveOrgId(params) || 1;

    const orders = await this.base.getItems<Order>('orders', orgId);
    const orderItems = await this.base.getItems<OrderItem>('order_items');
    const variants = await this.base.getItems<ProductVariant>('product_variants', orgId);
    const expenses = await this.getExpenses({ organization_id: orgId });
    const categories = await this.getExpenseCategories({ organization_id: orgId });

    const period = params?.period || params?.type || 'all';

    let startDate: Date | null = null;
    if (period === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      startDate = d;
    } else if (period === 'year') {
      const d = new Date();
      d.setDate(d.getDate() - 365);
      d.setHours(0, 0, 0, 0);
      startDate = d;
    }

    const getOrderTotal = (o: Order): number => {
      return (
        Number(o.total) ||
        Number((o as any).final_amount) ||
        Number((o as any).total_amount) ||
        Number(o.subtotal) ||
        0
      );
    };

    const validOrders = orders.filter((o) => {
      if (o.status === 'cancelled') return false;
      if (startDate) {
        const orderDateStr = o.date_created || (o as any).order_date;
        if (orderDateStr) {
          const od = new Date(orderDateStr);
          if (!isNaN(od.getTime()) && od < startDate) return false;
        }
      }
      return true;
    });
    const totalRevenue = validOrders.reduce((sum, o) => sum + getOrderTotal(o), 0);

    let totalCogs = 0;
    validOrders.forEach((o) => {
      const items = orderItems.filter((it) => {
        const itOrderId = typeof it.order_id === 'object' ? (it.order_id as any)?.id : it.order_id;
        return Number(itOrderId) === Number(o.id);
      });
      items.forEach((it) => {
        const vId = typeof it.variant_id === 'object' ? (it.variant_id as any)?.id : it.variant_id;
        const variant = variants.find((v) => v.id === Number(vId));
        const unitCost = Number(variant?.cost) || 0;
        const qty = Number(it.quantity) || 1;
        totalCogs += unitCost * qty;
      });
    });

    const grossProfit = totalRevenue - totalCogs;
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const filteredExpenses = expenses.filter((e) => {
      if (startDate) {
        const expDateStr = e.expense_date || e.date_created;
        if (expDateStr) {
          const ed = new Date(expDateStr);
          if (!isNaN(ed.getTime()) && ed < startDate) return false;
        }
      }
      return true;
    });

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const catMap = new Map<number, { title: string; amount: number }>();
    categories.forEach((c) => {
      catMap.set(c.id, { title: c.title, amount: 0 });
    });
    filteredExpenses.forEach((e) => {
      const cId = typeof e.category_id === 'number' ? e.category_id : (e.category_id as any)?.id || 1;
      const existing = catMap.get(cId) || { title: e.category_title || 'سایر', amount: 0 };
      existing.amount += Number(e.amount) || 0;
      catMap.set(cId, existing);
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

    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const customers = await this.base.getItems<Customer>('customers', orgId);
    const suppliers = await this.base.getItems<Supplier>('suppliers', orgId);
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

  // ==========================================
  // Financial Accounts & Treasury
  // ==========================================
  getDefaultFinancialAccounts(orgId: number): FinancialAccount[] {
    const now = new Date().toISOString();
    return [
      {
        id: 1,
        organization_id: orgId,
        name: 'صندوق نقدی مرکزی',
        type: 'cashbox',
        initial_balance: 0,
        current_balance: 0,
        is_default: true,
        status: 'active',
        date_created: now,
      },
      {
        id: 2,
        organization_id: orgId,
        name: 'حساب جاری بانک ملت',
        type: 'bank',
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
        id: 3,
        organization_id: orgId,
        name: 'کارتخوان فروشگاه (POS)',
        type: 'pos',
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
    let items = await this.base.getItems<FinancialAccount>('financial_accounts', orgId);

    if (items.length === 0) {
      const defaults = this.getDefaultFinancialAccounts(orgId);
      for (const acc of defaults) {
        await this.base.saveItem('financial_accounts', acc);
      }
      items = defaults;
    }

    const treasuryTxs = await this.base.getItems<TreasuryTransaction>('treasury_transactions', orgId);
    items = items.map((acc) => {
      const accId = Number(acc.id);
      let balance = Number(acc.initial_balance) || 0;
      treasuryTxs.forEach((tx) => {
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
        ...acc,
        current_balance: balance,
      };
    });

    const warehouses = await this.base.getItems<Warehouse>('warehouses', orgId);
    const enriched = items.map((acc) => {
      const rawWhId = typeof acc.warehouse_id === 'object' && acc.warehouse_id ? (acc.warehouse_id as any).id : acc.warehouse_id;
      const wh = warehouses.find((w) => w.id === Number(rawWhId));
      return {
        ...acc,
        warehouse_name: wh?.name || acc.warehouse_name,
      };
    });

    let filtered = enriched;
    if (params?.status) {
      filtered = filtered.filter((a) => a.status === params.status);
    }
    if (params?.type) {
      filtered = filtered.filter((a) => a.type === params.type);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.bank_name && a.bank_name.toLowerCase().includes(q)) ||
        (a.account_number && a.account_number.includes(q)) ||
        (a.card_number && a.card_number.includes(q))
      );
    }
    return filtered;
  }

  async getFinancialAccountById(id: number): Promise<FinancialAccount | null> {
    const list = await this.getFinancialAccounts();
    return list.find((a) => a.id === id) || null;
  }

  async saveFinancialAccount(account: Partial<FinancialAccount>): Promise<FinancialAccount> {
    const list = await this.base.getItems<FinancialAccount>('financial_accounts');
    const validId = typeof account.id === 'number' && account.id > 0 ? account.id : this.base.generateUniqueId(list);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(account.organization_id) }) || 1;

    if (account.is_default) {
      for (const a of list) {
        if (a.organization_id === orgId && a.is_default && a.id !== validId) {
          a.is_default = false;
          await this.base.saveItem('financial_accounts', a);
        }
      }
    }

    const rawWhId = typeof account.warehouse_id === 'object' && account.warehouse_id ? (account.warehouse_id as any).id : account.warehouse_id;
    const saved: FinancialAccount = {
      id: validId,
      organization_id: orgId,
      name: account.name || 'حساب جدید',
      type: account.type || 'cashbox',
      warehouse_id: rawWhId ? Number(rawWhId) : null,
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

    await this.base.saveItem('financial_accounts', saved);
    return saved;
  }

  async deleteFinancialAccount(id: number): Promise<boolean> {
    return this.base.deleteItem('financial_accounts', id);
  }

  // ==========================================
  // Treasury Transactions
  // ==========================================
  async getTreasuryTransactions(params?: QueryParams): Promise<TreasuryTransaction[]> {
    const orgId = this.base.getActiveOrgId(params) || 1;
    let items = await this.base.getItems<TreasuryTransaction>('treasury_transactions', orgId);
    const accounts = await this.getFinancialAccounts({ organization_id: orgId });

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

    return enriched.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }

  async saveTreasuryTransaction(tx: Partial<TreasuryTransaction>): Promise<TreasuryTransaction> {
    const list = await this.base.getItems<TreasuryTransaction>('treasury_transactions');
    const validId = typeof tx.id === 'number' && tx.id > 0 ? tx.id : this.base.generateUniqueId(list);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(tx.organization_id) }) || 1;
    const amount = Math.max(0, Number(tx.amount) || 0);

    const saved: TreasuryTransaction = {
      id: validId,
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
    if (saved.type === 'deposit' && saved.destination_account_id) {
      const dstId = typeof saved.destination_account_id === 'object' ? (saved.destination_account_id as any)?.id : saved.destination_account_id;
      const acc = await this.getFinancialAccountById(Number(dstId));
      if (acc) {
        acc.current_balance = (Number(acc.current_balance) || 0) + amount;
        await this.saveFinancialAccount(acc);
      }
    } else if (saved.type === 'withdrawal' && saved.source_account_id) {
      const srcId = typeof saved.source_account_id === 'object' ? (saved.source_account_id as any)?.id : saved.source_account_id;
      const acc = await this.getFinancialAccountById(Number(srcId));
      if (acc) {
        acc.current_balance = (Number(acc.current_balance) || 0) - amount;
        await this.saveFinancialAccount(acc);
      }
    } else if (saved.type === 'transfer') {
      if (saved.source_account_id) {
        const srcId = typeof saved.source_account_id === 'object' ? (saved.source_account_id as any)?.id : saved.source_account_id;
        const acc = await this.getFinancialAccountById(Number(srcId));
        if (acc) {
          acc.current_balance = (Number(acc.current_balance) || 0) - amount;
          await this.saveFinancialAccount(acc);
        }
      }
      if (saved.destination_account_id) {
        const dstId = typeof saved.destination_account_id === 'object' ? (saved.destination_account_id as any)?.id : saved.destination_account_id;
        const acc = await this.getFinancialAccountById(Number(dstId));
        if (acc) {
          acc.current_balance = (Number(acc.current_balance) || 0) + amount;
          await this.saveFinancialAccount(acc);
        }
      }
    }

    await this.base.saveItem('treasury_transactions', saved);
    return saved;
  }

  async deleteTreasuryTransaction(id: number): Promise<boolean> {
    return this.base.deleteItem('treasury_transactions', id);
  }

  // ==========================================
  // Cheques Management
  // ==========================================
  async getCheques(params?: QueryParams): Promise<Cheque[]> {
    const orgId = this.base.getActiveOrgId(params) || 1;
    let items = await this.base.getItems<Cheque>('cheques', orgId);
    const customers = await this.base.getItems<Customer>('customers', orgId);
    const suppliers = await this.base.getItems<Supplier>('suppliers', orgId);
    const accounts = await this.getFinancialAccounts({ organization_id: orgId });

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
    const list = await this.base.getItems<Cheque>('cheques');
    const validId = typeof cheque.id === 'number' && cheque.id > 0 ? cheque.id : this.base.generateUniqueId(list);
    const orgId = this.base.getActiveOrgId({ organization_id: normalizeId(cheque.organization_id) }) || 1;

    const saved: Cheque = {
      id: validId,
      organization_id: orgId,
      type: cheque.type || 'received',
      sayad_id: cheque.sayad_id || '',
      cheque_number: cheque.cheque_number || '',
      bank_name: cheque.bank_name || 'بانک ملت',
      branch_name: cheque.branch_name || null,
      account_number: cheque.account_number || null,
      drawer_name: cheque.drawer_name || '',
      customer_id: cheque.customer_id ? Number(normalizeId(cheque.customer_id)) : null,
      supplier_id: cheque.supplier_id ? Number(normalizeId(cheque.supplier_id)) : null,
      amount: Math.max(0, Number(cheque.amount) || 0),
      issue_date: cheque.issue_date || new Date().toISOString().split('T')[0],
      due_date: cheque.due_date || new Date().toISOString().split('T')[0],
      status: cheque.status || 'registered',
      target_account_id: cheque.target_account_id ? Number(normalizeId(cheque.target_account_id)) : null,
      alert_days_before: Number(cheque.alert_days_before) || 3,
      image_front: cheque.image_front || null,
      image_back: cheque.image_back || null,
      notes: cheque.notes || '',
      date_created: new Date().toISOString(),
      ...cheque,
    };

    await this.base.saveItem('cheques', saved);
    return saved;
  }

  async deleteCheque(id: number): Promise<boolean> {
    return this.base.deleteItem('cheques', id);
  }

  async updateChequeStatus(id: number, status: ChequeStatus, targetAccountId?: number): Promise<Cheque> {
    const chk = await this.getChequeById(id);
    if (!chk) {
      throw new Error(`Cheque with id ${id} not found`);
    }

    const prevStatus = chk.status;
    chk.status = status;
    if (targetAccountId) {
      chk.target_account_id = targetAccountId;
    }

    if (status === 'cleared' && prevStatus !== 'cleared' && chk.target_account_id) {
      const accId = typeof chk.target_account_id === 'object' ? (chk.target_account_id as any)?.id : chk.target_account_id;
      const acc = await this.getFinancialAccountById(Number(accId));
      if (acc) {
        if (chk.type === 'received') {
          acc.current_balance = (Number(acc.current_balance) || 0) + Number(chk.amount);
        } else if (chk.type === 'issued') {
          acc.current_balance = (Number(acc.current_balance) || 0) - Number(chk.amount);
        }
        await this.saveFinancialAccount(acc);
      }
    }

    await this.base.saveItem('cheques', chk);
    return chk;
  }

  // ==========================================
  // Landed Cost & Allocations
  // ==========================================
  async getLandedCosts(params?: QueryParams): Promise<LandedCost[]> {
    const orgId = this.base.getActiveOrgId(params) || 1;
    let list = await this.base.getItems<LandedCost>('landed_costs', orgId);
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((item) => item.title?.toLowerCase().includes(q) || item.cost_type?.toLowerCase().includes(q));
    }

    const purchaseOrders = await this.base.getItems<PurchaseOrder>('purchase_orders', orgId);
    const suppliers = await this.base.getItems<Supplier>('suppliers', orgId);
    const allocations = await this.base.getItems<LandedCostAllocation>('landed_cost_allocations');

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
    const isNew = !cost.id;
    let savedCost: LandedCost;

    if (isNew) {
      const all = await this.base.getItems<LandedCost>('landed_costs');
      const newId = this.base.generateUniqueId(all);
      savedCost = {
        id: newId,
        organization_id: cost.organization_id || 1,
        purchase_order_id: cost.purchase_order_id || 0,
        cost_type: cost.cost_type || 'freight',
        title: cost.title || '',
        amount: Number(cost.amount) || 0,
        allocation_method: cost.allocation_method || 'by_value',
        expense_id: cost.expense_id || null,
        date_applied: cost.date_applied || new Date().toISOString().slice(0, 10),
        date_created: new Date().toISOString(),
      };
    } else {
      const existing = await this.base.getItemById<LandedCost>('landed_costs', cost.id!);
      if (!existing) throw new Error(`Landed cost with id ${cost.id} not found`);
      savedCost = {
        ...existing,
        ...cost,
        amount: Number(cost.amount !== undefined ? cost.amount : existing.amount),
      };
    }

    await this.base.saveItem('landed_costs', savedCost);

    if (allocations && allocations.length > 0) {
      const allAllocations = await this.base.getItems<LandedCostAllocation>('landed_cost_allocations');
      for (const alloc of allocations) {
        const allocId = alloc.id || this.base.generateUniqueId(allAllocations);
        const item: LandedCostAllocation = {
          id: allocId,
          landed_cost_id: savedCost.id,
          purchase_order_item_id: alloc.purchase_order_item_id || 0,
          allocated_amount: Number(alloc.allocated_amount) || 0,
          effective_unit_cost: Number(alloc.effective_unit_cost) || 0,
        };
        await this.base.saveItem('landed_cost_allocations', item);
      }
    }

    return savedCost;
  }

  async deleteLandedCost(id: number): Promise<boolean> {
    await this.base.deleteItem('landed_costs', id);
    const allocations = await this.base.getItems<LandedCostAllocation>('landed_cost_allocations');
    for (const alloc of allocations) {
      const cId = typeof alloc.landed_cost_id === 'object' ? (alloc.landed_cost_id as any)?.id : alloc.landed_cost_id;
      if (Number(cId) === id) {
        await this.base.deleteItem('landed_cost_allocations', alloc.id);
      }
    }
    return true;
  }

  async getLandedCostAllocations(landedCostId?: number, purchaseOrderId?: number): Promise<LandedCostAllocation[]> {
    let allocations = await this.base.getItems<LandedCostAllocation>('landed_cost_allocations');
    if (landedCostId) {
      allocations = allocations.filter((a) => {
        const cId = typeof a.landed_cost_id === 'object' ? (a.landed_cost_id as any)?.id : a.landed_cost_id;
        return Number(cId) === landedCostId;
      });
    }

    const poItems = await this.base.getItems<PurchaseOrderItem>('purchase_order_items');
    const variants = await this.base.getItems<ProductVariant>('product_variants');
    const products = await this.base.getItems<Product>('products');

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
    const isNew = !allocation.id;
    let saved: LandedCostAllocation;

    if (isNew) {
      const all = await this.base.getItems<LandedCostAllocation>('landed_cost_allocations');
      saved = {
        id: this.base.generateUniqueId(all),
        landed_cost_id: allocation.landed_cost_id || 0,
        purchase_order_item_id: allocation.purchase_order_item_id || 0,
        allocated_amount: Number(allocation.allocated_amount) || 0,
        effective_unit_cost: Number(allocation.effective_unit_cost) || 0,
      };
    } else {
      const existing = await this.base.getItemById<LandedCostAllocation>('landed_cost_allocations', allocation.id!);
      if (!existing) throw new Error(`Allocation with id ${allocation.id} not found`);
      saved = { ...existing, ...allocation };
    }

    await this.base.saveItem('landed_cost_allocations', saved);
    return saved;
  }

  async applyLandedCostToVariants(landedCostId: number): Promise<{ updatedVariantsCount: number }> {
    const allocations = await this.getLandedCostAllocations(landedCostId);
    if (!allocations || allocations.length === 0) {
      return { updatedVariantsCount: 0 };
    }

    let updatedCount = 0;
    for (const alloc of allocations) {
      if (alloc.variant_id && alloc.effective_unit_cost > 0) {
        const variant = await this.base.getItemById<ProductVariant>('product_variants', alloc.variant_id);
        if (variant) {
          variant.buy_price = Math.round(Number(alloc.effective_unit_cost));
          await this.base.saveItem('product_variants', variant);
          updatedCount++;
        }
      }
    }

    return { updatedVariantsCount: updatedCount };
  }

  // ==========================================
  // Tax / VAT Reports
  // ==========================================
  async getVatReport(params?: { organizationId?: number; year?: number; quarter?: 1 | 2 | 3 | 4 }): Promise<VatReportSummary> {
    const orgId = params?.organizationId || 1;
    const year = params?.year || 1403;
    const quarter = params?.quarter || 1;

    let orders = await this.base.getItems<Order>('orders', orgId);
    let purchaseOrders = await this.base.getItems<PurchaseOrder>('purchase_orders', orgId);
    const customers = await this.base.getItems<Customer>('customers', orgId);
    const suppliers = await this.base.getItems<Supplier>('suppliers', orgId);

    orders = orders.filter((o) => o.status !== 'cancelled');
    purchaseOrders = purchaseOrders.filter((p) => p.status !== 'cancelled');

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

  // ==========================================
  // POS Shifts (شیفت‌های صندوق)
  // ==========================================
  async getPosShifts(params?: QueryParams & { user_id?: string; status?: PosShiftStatus; warehouse_id?: number }): Promise<PosShift[]> {
    const orgId = this.base.getActiveOrgId(params) || 1;
    const rawItems = await this.base.getItems<PosShift>('pos_shifts', orgId);
    let filtered = rawItems;

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

    const warehouses = await this.base.getItems<Warehouse>('warehouses', orgId);
    const accounts = await this.getFinancialAccounts({ organization_id: orgId });
    const users = await this.base.getItems<OrganizationUser>('organization_users', orgId);
    const orders = await this.base.getItems<Order>('orders', orgId);

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
          const notesStr = String((o as any).notes || '');
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
            const oUser = String((o as any).user_created || (o as any).user_id || '').trim();
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
          const pMethod = String((ord as any).payment_method || (ord as any).payment_type || (ord as any).notes || '').toLowerCase();
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
    const list = await this.base.getItems<PosShift>('pos_shifts');
    const activeOrgId = Number(shiftData.organization_id || this.base.getActiveOrgId());
    const id = shiftData.id || this.base.generateUniqueId(list);

    const shiftObj: PosShift = {
      id,
      organization_id: activeOrgId,
      user_id: shiftData.user_id || null,
      warehouse_id: shiftData.warehouse_id || null,
      financial_account_id: shiftData.financial_account_id || null,
      opening_balance: shiftData.opening_balance ?? '0',
      closing_balance: shiftData.closing_balance ?? null,
      status: shiftData.status || 'open',
      opened_at: shiftData.opened_at || new Date().toISOString(),
      closed_at: shiftData.closed_at || null,
      ...shiftData,
    };

    await this.base.saveItem('pos_shifts', shiftObj);
    return shiftObj;
  }

  async closePosShift(id: number, closingBalance: number | string, notes?: string): Promise<PosShift> {
    const shifts = await this.getPosShifts();
    const existing = shifts.find((s) => s.id === id);
    if (!existing) {
      throw new Error(`Shift #${id} not found`);
    }

    const updated: PosShift = {
      ...existing,
      closing_balance: String(closingBalance),
      status: 'closed',
      closed_at: new Date().toISOString(),
      ...(notes ? { notes } : {}),
    };

    await this.base.saveItem('pos_shifts', updated);
    return updated;
  }

  async deletePosShift(id: number): Promise<boolean> {
    return this.base.deleteItem('pos_shifts', id);
  }
}
