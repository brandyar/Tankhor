import { CloudStorageBase } from './cloudBase';
import { QueryParams } from '../types';
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
  Order,
  OrderItem,
  Product,
  ProductVariant,
} from '../../types';

export class CloudAccountingStorage {
  constructor(private base: CloudStorageBase) {}

  // ==========================================
  // Accounting & Financials (Phase 1)
  // ==========================================

  async getExpenseCategories(params?: QueryParams): Promise<ExpenseCategory[]> {
    try {
      const query: Record<string, any> = {
        sort: ['id'],
      };
      if (params?.status) query['filter[status][_eq]'] = params.status;
      if (params?.search) query['filter[title][_icontains]'] = params.search;

      const items = await this.base.client.getItems<ExpenseCategory>('expense_categories', query);
      if (items.length === 0) {
        return await this.base.localAdapter.getExpenseCategories(params);
      }
      return items;
    } catch {
      return await this.base.localAdapter.getExpenseCategories(params);
    }
  }

  async saveExpenseCategory(cat: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    const localSaved = await this.base.localAdapter.saveExpenseCategory(cat);
    try {
      const directusPayload: Record<string, any> = {
        title: cat.title || 'سرفصل هزینه',
        code: cat.code || null,
        icon: cat.icon || 'Receipt',
        status: cat.status || 'active',
      };
      if (cat.organization_id) {
        directusPayload.organization_id = Number(typeof cat.organization_id === 'object' ? (cat.organization_id as any).id : cat.organization_id);
      }

      if (cat.id && typeof cat.id === 'number' && cat.id < 1000000000) {
        const updated = await this.base.client.updateItem<ExpenseCategory>('expense_categories', cat.id, directusPayload);
        const merged = { ...localSaved, ...updated };
        await this.base.localAdapter.saveExpenseCategory(merged);
        return merged;
      }
      const created = await this.base.client.createItem<ExpenseCategory>('expense_categories', directusPayload);
      if (localSaved.id && localSaved.id !== created.id) {
        await this.base.localAdapter.deleteExpenseCategory(localSaved.id);
      }
      const merged = { ...localSaved, ...created };
      await this.base.localAdapter.saveExpenseCategory(merged);
      return merged;
    } catch (err) {
      console.error('[CloudAccountingStorage] Error saving expense category to cloud:', err);
      this.base.syncManager.enqueue({ action: cat.id ? 'UPDATE' : 'CREATE', collection: 'expense_categories', payload: localSaved });
      return localSaved;
    }
  }

  async deleteExpenseCategory(id: number): Promise<boolean> {
    const deleted = await this.base.localAdapter.deleteExpenseCategory(id);
    try {
      await this.base.client.deleteItem('expense_categories', id);
    } catch {
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'expense_categories', payload: { id } });
    }
    return deleted;
  }

  async getExpenses(params?: QueryParams): Promise<Expense[]> {
    try {
      const query: Record<string, any> = {
        sort: ['-expense_date', '-id'],
        fields: ['*', 'category_id.*'],
      };
      const orgId = this.base.normalizeId(params?.organization_id);
      if (orgId) query['filter[organization_id][_eq]'] = orgId;
      if (params?.category_id) query['filter[category_id][_eq]'] = params.category_id;
      if (params?.search) query['filter[title][_icontains]'] = params.search;

      const items = await this.base.client.getItems<Expense>('expenses', query);
      const localItems = await this.base.localAdapter.getExpenses(params);

      if (!items || items.length === 0) {
        return localItems;
      }

      const mergedMap = new Map<number, Expense>();
      localItems.forEach((it) => mergedMap.set(it.id, it));
      items.forEach((exp) => {
        const cat = typeof exp.category_id === 'object' ? (exp.category_id as any) : null;
        mergedMap.set(exp.id, {
          ...exp,
          category_title: cat?.title || exp.category_title || 'سایر هزینه‌ها',
          category_code: cat?.code || exp.category_code,
          category_icon: cat?.icon || exp.category_icon || 'Receipt',
        });
      });

      return Array.from(mergedMap.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
    } catch {
      return await this.base.localAdapter.getExpenses(params);
    }
  }

  async saveExpense(exp: Partial<Expense>): Promise<Expense> {
    const localSaved = await this.base.localAdapter.saveExpense(exp);
    try {
      const catId = typeof exp.category_id === 'object' && exp.category_id !== null
        ? Number((exp.category_id as any).id)
        : (exp.category_id ? Number(exp.category_id) : null);

      const accId = typeof exp.account_id === 'object' && exp.account_id !== null
        ? Number((exp.account_id as any).id)
        : (exp.account_id ? Number(exp.account_id) : null);

      let pm: string = 'cash';
      if (exp.payment_method === 'bank_account' || exp.payment_method === 'card_transfer' || exp.payment_method === 'bank') {
        pm = 'bank';
      } else if (exp.payment_method === 'pos') {
        pm = 'pos';
      } else if (exp.payment_method === 'cheque') {
        pm = 'cheque';
      } else if (exp.payment_method === 'credit') {
        pm = 'credit';
      }

      const noteParts: string[] = [];
      if (exp.paid_to) noteParts.push(`دریافت‌کننده: ${exp.paid_to}`);
      if (exp.reference_code) noteParts.push(`کد پیگیری: ${exp.reference_code}`);
      if (exp.description) noteParts.push(exp.description);
      if (exp.notes && exp.notes !== exp.description) noteParts.push(exp.notes);

      const directusPayload: Record<string, any> = {
        title: exp.title || 'هزینه جاری',
        amount: Number(exp.amount) || 0,
        category_id: catId,
        payment_method: pm,
        notes: noteParts.length > 0 ? noteParts.join(' | ') : null,
      };

      if (exp.organization_id) {
        directusPayload.organization_id = Number(typeof exp.organization_id === 'object' ? (exp.organization_id as any).id : exp.organization_id);
      }
      if (accId) {
        directusPayload.account_id = accId;
      }
      if (exp.expense_date) {
        const dateStr = String(exp.expense_date);
        directusPayload.expense_date = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
      }
      if (exp.receipt_attachment) {
        directusPayload.receipt_attachment = exp.receipt_attachment;
      }

      if (exp.id && typeof exp.id === 'number' && exp.id < 1000000000) {
        const updated = await this.base.client.updateItem<Expense>('expenses', exp.id, directusPayload);
        const merged = { ...localSaved, ...updated };
        await this.base.localAdapter.saveExpense(merged);
        return merged;
      }

      const created = await this.base.client.createItem<Expense>('expenses', directusPayload);
      if (localSaved.id && localSaved.id !== created.id) {
        await this.base.localAdapter.deleteExpense(localSaved.id);
      }
      const merged = { ...localSaved, ...created };
      await this.base.localAdapter.saveExpense(merged);
      return merged;
    } catch (err) {
      console.error('[CloudAccountingStorage] Error saving expense to cloud:', err);
      this.base.syncManager.enqueue({ action: exp.id ? 'UPDATE' : 'CREATE', collection: 'expenses', payload: localSaved });
      return localSaved;
    }
  }

  async deleteExpense(id: number): Promise<boolean> {
    const deleted = await this.base.localAdapter.deleteExpense(id);
    try {
      await this.base.client.deleteItem('expenses', id);
    } catch {
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'expenses', payload: { id } });
    }
    return deleted;
  }

  async getPersonTransactions(params?: QueryParams): Promise<PersonTransaction[]> {
    try {
      const query: Record<string, any> = {
        sort: ['-transaction_date', '-id'],
        fields: ['*', 'customer_id.*', 'supplier_id.*', 'order_id.*', 'purchase_order_id.*'],
      };
      if (params?.type) query['filter[party_type][_eq]'] = params.type;
      if (params?.search) query['filter[description][_icontains]'] = params.search;

      const items = await this.base.client.getItems<PersonTransaction>('person_transactions', query);
      return items.map((tx) => {
        const cust = typeof tx.customer_id === 'object' ? (tx.customer_id as any) : null;
        const sup = typeof tx.supplier_id === 'object' ? (tx.supplier_id as any) : null;
        const ord = typeof tx.order_id === 'object' ? (tx.order_id as any) : null;
        const po = typeof tx.purchase_order_id === 'object' ? (tx.purchase_order_id as any) : null;
        return {
          ...tx,
          party_name: cust?.name || sup?.name || tx.party_name || '',
          order_number: ord?.order_number || tx.order_number,
          purchase_number: po?.purchase_number || tx.purchase_number,
        };
      });
    } catch {
      return await this.base.localAdapter.getPersonTransactions(params);
    }
  }

  async savePersonTransaction(tx: Partial<PersonTransaction>): Promise<PersonTransaction> {
    try {
      if (tx.id) {
        return await this.base.client.updateItem<PersonTransaction>('person_transactions', tx.id, tx);
      }
      return await this.base.client.createItem<PersonTransaction>('person_transactions', tx);
    } catch {
      const saved = await this.base.localAdapter.savePersonTransaction(tx);
      this.base.syncManager.enqueue({ action: tx.id ? 'UPDATE' : 'CREATE', collection: 'person_transactions', payload: saved });
      return saved;
    }
  }

  async deletePersonTransaction(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('person_transactions', id);
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deletePersonTransaction(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'person_transactions', payload: { id } });
      return deleted;
    }
  }

  async getProfitLossSummary(params?: QueryParams): Promise<ProfitLossSummary> {
    try {
      const orgId = params?.organization_id || (typeof window !== 'undefined' ? Number(localStorage.getItem('tankhor_active_org_id')) : 1) || 1;
      const orders = await this.base.client.getItems<Order>('orders', {
        filter: { organization_id: { _eq: orgId } },
      }).catch(() => this.base.localAdapter.getOrders({ organization_id: orgId }));

      const variants = await this.base.client.getItems<ProductVariant>('product_variants', {
        filter: { organization_id: { _eq: orgId } },
      }).catch(() => this.base.localAdapter.getVariants({ organization_id: orgId }));

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

      let orderItems: OrderItem[] = [];
      try {
        orderItems = await this.base.client.getItems<OrderItem>('order_items', { limit: -1 });
      } catch {
        const allItems = await Promise.all(validOrders.map((o) => this.base.localAdapter.getOrderItems(o.id)));
        orderItems = allItems.flat();
      }
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

      const netProfit = grossProfit - totalExpenses;
      const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      const expensesByCategorySnake = expensesByCategory.map((c) => ({
        category_id: c.categoryId,
        category_title: c.title,
        title: c.title,
        amount: c.amount,
        percentage: c.percentage,
      }));

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
        ordersCount: validOrders.length,
        orders_count: validOrders.length,
        expensesCount: filteredExpenses.length,
        expenses_count: filteredExpenses.length,
      };
    } catch {
      return await this.base.localAdapter.getProfitLossSummary(params);
    }
  }

  // ==========================================
  // Accounting & Treasury (Phase 2)
  // ==========================================

  async reconcileOrdersWithTreasury(organizationId?: number): Promise<void> {
    try {
      const orgId = organizationId || 1;
      const [allOrders, currentAccounts, existingTxs] = await Promise.all([
        this.base.client.getItems<Order>('orders', {
          filter: { organization_id: { _eq: orgId } },
        }).catch(() => this.base.localAdapter.getOrders({ organization_id: orgId })),
        this.getFinancialAccounts({ organization_id: orgId, skipReconcile: true }),
        this.getTreasuryTransactions({ organization_id: orgId }),
      ]);

      if (!currentAccounts || currentAccounts.length === 0) return;

      const defaultCashbox = currentAccounts.find((a) => a.type === 'cashbox') || currentAccounts[0];
      const defaultBank = currentAccounts.find((a) => a.type === 'bank') || defaultCashbox;
      const defaultPos = currentAccounts.find((a) => a.type === 'pos') || currentAccounts.find((a) => a.type === 'bank') || defaultCashbox;

      const completedOrPaidOrders = allOrders.filter((o) => {
        if (o.status === 'cancelled') return false;
        const isPaid = o.payment_status === 'paid' || (o as any).payment_status === 'settled';
        const isCompleted = o.status === 'completed';
        const isConfirmed = o.status === 'confirmed';
        const pMethod = (o as any).payment_method || (o as any).payment_type || 'pos';
        const isCashOrElectronic = ['cash', 'pos', 'card_to_card', 'card_reader', 'bank'].includes(pMethod);
        return isPaid || isCompleted || isConfirmed || (isCashOrElectronic && o.payment_status !== 'pending');
      });

      for (const ord of completedOrPaidOrders) {
        const orderNum = ord.order_number || String(ord.id);
        const ordTotal =
          Number(ord.total) ||
          Number((ord as any).grand_total) ||
          Number((ord as any).final_amount) ||
          Number((ord as any).total_amount) ||
          Number(ord.subtotal) ||
          0;

        if (ordTotal <= 0) continue;

        const exists = existingTxs.some((t) => {
          const tracking = t.tracking_code || '';
          const desc = t.description || '';
          return tracking.includes(orderNum) || desc.includes(orderNum) || (t as any).order_id === ord.id;
        });

        if (!exists && defaultCashbox) {
          let destAcc = defaultCashbox;
          const pMethod = (ord as any).payment_method || (ord as any).payment_type;
          const customAccId = (ord as any).financial_account_id || (ord as any).account_id;
          if (customAccId) {
            const found = currentAccounts.find((a) => Number(a.id) === Number(customAccId));
            if (found) destAcc = found;
          } else if (pMethod === 'pos' || pMethod === 'card_reader') {
            destAcc = defaultPos || defaultCashbox;
          } else if (pMethod === 'card_to_card' || pMethod === 'bank') {
            destAcc = defaultBank || defaultCashbox;
          }

          const txDate = ord.date_created || (ord as any).order_date || new Date().toISOString();
          await this.saveTreasuryTransaction({
            organization_id: orgId,
            source_account_id: null,
            destination_account_id: destAcc.id,
            type: 'deposit',
            amount: ordTotal,
            tracking_code: `ORD-${orderNum}`,
            description: `دریافت وجه فاکتور فروش #${orderNum} (همگام‌سازی خودکار)`,
            transaction_date: txDate,
          });
        }
      }
    } catch (err) {
      console.warn('[CloudAccountingStorage] Error in reconcileOrdersWithTreasury:', err);
    }
  }

  async getFinancialAccounts(params?: QueryParams & { skipReconcile?: boolean }): Promise<FinancialAccount[]> {
    try {
      const orgId = params?.organization_id ? Number(params.organization_id) : 1;

      if (!params?.skipReconcile) {
        await this.reconcileOrdersWithTreasury(orgId).catch(() => {});
      }

      const query: Record<string, any> = {
        sort: ['id'],
        fields: ['*', 'warehouse_id.*'],
      };
      if (params?.status) query['filter[status][_eq]'] = params.status;
      if (params?.type) query['filter[type][_eq]'] = params.type;
      if (params?.search) query['filter[name][_icontains]'] = params.search;
      if (params?.organization_id) query['filter[organization_id][_eq]'] = orgId;

      let items = await this.base.client.getItems<FinancialAccount>('financial_accounts', query);
      if (!items || items.length === 0) {
        items = await this.base.localAdapter.getFinancialAccounts(params);
      }

      const treasuryTxs = await this.getTreasuryTransactions({ organization_id: orgId }).catch(() => []);

      const accountsWithBalance = items.map((acc) => {
        const wh = typeof acc.warehouse_id === 'object' && acc.warehouse_id ? (acc.warehouse_id as any) : null;
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

        if (acc.current_balance !== balance) {
          this.base.client.updateItem('financial_accounts', acc.id, { current_balance: balance }).catch(() => {});
        }

        return {
          ...acc,
          current_balance: balance,
          warehouse_name: wh?.name || acc.warehouse_name,
        };
      });

      return accountsWithBalance;
    } catch {
      return await this.base.localAdapter.getFinancialAccounts(params);
    }
  }

  async getFinancialAccountById(id: number): Promise<FinancialAccount | null> {
    try {
      const acc = await this.base.client.getItemById<FinancialAccount>('financial_accounts', id);
      if (!acc) return await this.base.localAdapter.getFinancialAccountById(id);

      const orgId = typeof acc.organization_id === 'object' ? (acc.organization_id as any)?.id : acc.organization_id;
      const treasuryTxs = await this.getTreasuryTransactions({ organization_id: orgId || 1 }).catch(() => []);
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
    } catch {
      return await this.base.localAdapter.getFinancialAccountById(id);
    }
  }

  async saveFinancialAccount(account: Partial<FinancialAccount>): Promise<FinancialAccount> {
    try {
      if (account.id) {
        return await this.base.client.updateItem<FinancialAccount>('financial_accounts', account.id, account);
      }
      return await this.base.client.createItem<FinancialAccount>('financial_accounts', account);
    } catch {
      const saved = await this.base.localAdapter.saveFinancialAccount(account);
      this.base.syncManager.enqueue({ action: account.id ? 'UPDATE' : 'CREATE', collection: 'financial_accounts', payload: saved });
      return saved;
    }
  }

  async deleteFinancialAccount(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('financial_accounts', id);
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deleteFinancialAccount(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'financial_accounts', payload: { id } });
      return deleted;
    }
  }

  async getTreasuryTransactions(params?: QueryParams): Promise<TreasuryTransaction[]> {
    try {
      const query: Record<string, any> = {
        sort: ['-transaction_date', '-id'],
        fields: ['*', 'source_account_id.*', 'destination_account_id.*'],
      };
      if (params?.type) query['filter[type][_eq]'] = params.type;
      if (params?.search) query['filter[description][_icontains]'] = params.search;
      if (params?.organization_id) query['filter[organization_id][_eq]'] = params.organization_id;

      const items = await this.base.client.getItems<TreasuryTransaction>('treasury_transactions', query);
      return items.map((tx) => {
        const src = typeof tx.source_account_id === 'object' ? (tx.source_account_id as any) : null;
        const dst = typeof tx.destination_account_id === 'object' ? (tx.destination_account_id as any) : null;
        return {
          ...tx,
          source_account_name: src?.name || tx.source_account_name,
          destination_account_name: dst?.name || tx.destination_account_name,
        };
      });
    } catch {
      return await this.base.localAdapter.getTreasuryTransactions(params);
    }
  }

  async saveTreasuryTransaction(tx: Partial<TreasuryTransaction>): Promise<TreasuryTransaction> {
    try {
      let saved: TreasuryTransaction;
      if (tx.id) {
        saved = await this.base.client.updateItem<TreasuryTransaction>('treasury_transactions', tx.id, tx);
      } else {
        saved = await this.base.client.createItem<TreasuryTransaction>('treasury_transactions', tx);
      }

      await this.base.localAdapter.saveTreasuryTransaction(saved).catch(() => {});
      return saved;
    } catch {
      const saved = await this.base.localAdapter.saveTreasuryTransaction(tx);
      this.base.syncManager.enqueue({ action: tx.id ? 'UPDATE' : 'CREATE', collection: 'treasury_transactions', payload: saved });
      return saved;
    }
  }

  async deleteTreasuryTransaction(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('treasury_transactions', id);
      await this.base.localAdapter.deleteTreasuryTransaction(id).catch(() => {});
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deleteTreasuryTransaction(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'treasury_transactions', payload: { id } });
      return deleted;
    }
  }

  // Cheques
  async getCheques(params?: QueryParams): Promise<Cheque[]> {
    try {
      const query: Record<string, any> = {
        sort: ['due_date', 'id'],
        fields: ['*', 'customer_id.*', 'supplier_id.*', 'target_account_id.*'],
      };
      if (params?.status) query['filter[status][_eq]'] = params.status;
      if (params?.type) query['filter[type][_eq]'] = params.type;
      if (params?.search) query['filter[sayad_id][_icontains]'] = params.search;

      const items = await this.base.client.getItems<Cheque>('cheques', query);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return items.map((chk) => {
        const cust = typeof chk.customer_id === 'object' ? (chk.customer_id as any) : null;
        const sup = typeof chk.supplier_id === 'object' ? (chk.supplier_id as any) : null;
        const acc = typeof chk.target_account_id === 'object' ? (chk.target_account_id as any) : null;

        let daysUntilDue = 0;
        let isOverdue = false;
        if (chk.due_date) {
          const dueDate = new Date(chk.due_date);
          dueDate.setHours(0, 0, 0, 0);
          daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          isOverdue = daysUntilDue < 0 && chk.status !== 'cleared' && chk.status !== 'cancelled';
        }

        return {
          ...chk,
          customer_name: cust?.name || chk.customer_name,
          supplier_name: sup?.name || chk.supplier_name,
          target_account_name: acc?.name || chk.target_account_name,
          days_until_due: daysUntilDue,
          is_overdue: isOverdue,
        };
      });
    } catch {
      return await this.base.localAdapter.getCheques(params);
    }
  }

  async getChequeById(id: number): Promise<Cheque | null> {
    try {
      return await this.base.client.getItemById<Cheque>('cheques', id);
    } catch {
      return await this.base.localAdapter.getChequeById(id);
    }
  }

  async saveCheque(cheque: Partial<Cheque>): Promise<Cheque> {
    try {
      if (cheque.id) {
        return await this.base.client.updateItem<Cheque>('cheques', cheque.id, cheque);
      }
      return await this.base.client.createItem<Cheque>('cheques', cheque);
    } catch {
      const saved = await this.base.localAdapter.saveCheque(cheque);
      this.base.syncManager.enqueue({ action: cheque.id ? 'UPDATE' : 'CREATE', collection: 'cheques', payload: saved });
      return saved;
    }
  }

  async deleteCheque(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('cheques', id);
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deleteCheque(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'cheques', payload: { id } });
      return deleted;
    }
  }

  async updateChequeStatus(id: number, status: ChequeStatus, targetAccountId?: number): Promise<Cheque> {
    try {
      const payload: Partial<Cheque> = { status };
      if (targetAccountId) payload.target_account_id = targetAccountId;
      return await this.base.client.updateItem<Cheque>('cheques', id, payload);
    } catch {
      return await this.base.localAdapter.updateChequeStatus(id, status, targetAccountId);
    }
  }

  // ==========================================
  // Phase 3: Landed Cost & Tax / VAT Reports
  // ==========================================

  async getLandedCosts(params?: QueryParams): Promise<LandedCost[]> {
    try {
      const costs = await this.base.client.getItems<LandedCost>('landed_costs', {
        filter: params?.organization_id ? { organization_id: { _eq: params.organization_id } } : undefined,
        search: params?.search,
      });

      const purchaseOrders = await this.base.localAdapter.getPurchaseOrders();
      const suppliers = await this.base.localAdapter.getSuppliers();
      const allocations = await this.getLandedCostAllocations();

      return costs.map((cost) => {
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
    } catch {
      return await this.base.localAdapter.getLandedCosts(params);
    }
  }

  async getLandedCostById(id: number): Promise<LandedCost | null> {
    try {
      const cost = await this.base.client.getItemById<LandedCost>('landed_costs', id);
      if (!cost) return null;
      return cost;
    } catch {
      return await this.base.localAdapter.getLandedCostById(id);
    }
  }

  async saveLandedCost(cost: Partial<LandedCost>, allocations?: Partial<LandedCostAllocation>[]): Promise<LandedCost> {
    try {
      let saved: LandedCost;
      if (cost.id) {
        saved = await this.base.client.updateItem<LandedCost>('landed_costs', cost.id, cost);
      } else {
        saved = await this.base.client.createItem<LandedCost>('landed_costs', cost);
      }

      if (allocations && allocations.length > 0) {
        for (const alloc of allocations) {
          const payload = {
            ...alloc,
            landed_cost_id: saved.id,
          };
          if (alloc.id) {
            await this.base.client.updateItem<LandedCostAllocation>('landed_cost_allocations', alloc.id, payload);
          } else {
            await this.base.client.createItem<LandedCostAllocation>('landed_cost_allocations', payload);
          }
        }
      }

      return saved;
    } catch {
      const saved = await this.base.localAdapter.saveLandedCost(cost, allocations);
      this.base.syncManager.enqueue({ action: cost.id ? 'UPDATE' : 'CREATE', collection: 'landed_costs', payload: saved });
      return saved;
    }
  }

  async deleteLandedCost(id: number): Promise<boolean> {
    try {
      await this.base.client.deleteItem('landed_costs', id);
      return true;
    } catch {
      const deleted = await this.base.localAdapter.deleteLandedCost(id);
      this.base.syncManager.enqueue({ action: 'DELETE', collection: 'landed_costs', payload: { id } });
      return deleted;
    }
  }

  async getLandedCostAllocations(landedCostId?: number, purchaseOrderId?: number): Promise<LandedCostAllocation[]> {
    try {
      let allocations = await this.base.client.getItems<LandedCostAllocation>('landed_cost_allocations', {
        filter: landedCostId ? { landed_cost_id: { _eq: landedCostId } } : undefined,
      });

      const poItems = await this.base.localAdapter.getPurchaseOrderItems();
      const variants = await this.base.localAdapter.getVariants();
      const products = await this.base.localAdapter.getProducts();

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
    } catch {
      return await this.base.localAdapter.getLandedCostAllocations(landedCostId, purchaseOrderId);
    }
  }

  async saveLandedCostAllocation(allocation: Partial<LandedCostAllocation>): Promise<LandedCostAllocation> {
    try {
      if (allocation.id) {
        return await this.base.client.updateItem<LandedCostAllocation>('landed_cost_allocations', allocation.id, allocation);
      }
      return await this.base.client.createItem<LandedCostAllocation>('landed_cost_allocations', allocation);
    } catch {
      return await this.base.localAdapter.saveLandedCostAllocation(allocation);
    }
  }

  async applyLandedCostToVariants(landedCostId: number): Promise<{ updatedVariantsCount: number }> {
    return await this.base.localAdapter.applyLandedCostToVariants(landedCostId);
  }

  async getVatReport(params?: { organizationId?: number; year?: number; quarter?: 1 | 2 | 3 | 4 }): Promise<VatReportSummary> {
    return await this.base.localAdapter.getVatReport(params);
  }
}
