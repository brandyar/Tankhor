import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { Expense, ExpenseCategory } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DateInput } from '../../components/ui/DateInput';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatPersianDate, toPersianDigits } from '../../utils/formatters';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  FolderPlus,
  Layers,
  Calendar,
  CreditCard,
  FileText,
  DollarSign,
  Tag,
  Check,
  RefreshCw,
} from 'lucide-react';

export const ExpensesPage: React.FC = () => {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Add / Edit Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({
    title: '',
    amount: 0,
    category_id: 1,
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'card_transfer',
    paid_to: '',
    description: '',
    reference_code: '',
  });

  // Category Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<Partial<ExpenseCategory>>({
    title: '',
    code: '',
    icon: 'Receipt',
    description: '',
    status: 'active',
  });
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const adapter = storageManager.getAdapter();
      const [cats, exps] = await Promise.all([
        adapter.getExpenseCategories(),
        adapter.getExpenses(),
      ]);
      setCategories(cats);
      setExpenses(exps);
    } catch (err) {
      console.error('[ExpensesPage] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNewExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      title: '',
      amount: 0,
      category_id: categories.length > 0 ? Number(categories[0].id) : 1,
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'card_transfer',
      paid_to: '',
      description: '',
      reference_code: '',
    });
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    const catId = typeof exp.category_id === 'object' ? (exp.category_id as any)?.id : exp.category_id;
    setExpenseForm({
      title: exp.title,
      amount: exp.amount,
      category_id: catId,
      expense_date: exp.expense_date ? exp.expense_date.split('T')[0] : new Date().toISOString().split('T')[0],
      payment_method: exp.payment_method || 'card_transfer',
      paid_to: exp.paid_to || '',
      description: exp.description || '',
      reference_code: exp.reference_code || '',
    });
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount || Number(expenseForm.amount) <= 0) {
      alert('لطفاً عنوان و مبلغ معتبر هزینه را وارد کنید.');
      return;
    }

    try {
      const adapter = storageManager.getAdapter();
      const payload: Partial<Expense> = {
        ...expenseForm,
        amount: Number(expenseForm.amount),
        category_id: Number(expenseForm.category_id),
      };
      if (editingExpense) {
        payload.id = editingExpense.id;
      }

      await adapter.saveExpense(payload);
      setIsExpenseModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[ExpensesPage] Failed to save expense:', err);
      alert('خطا در ذخیره اطلاعات هزینه.');
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm(t('accounting.deleteExpenseConfirm'))) return;
    try {
      const adapter = storageManager.getAdapter();
      await adapter.deleteExpense(id);
      await loadData();
    } catch (err) {
      console.error('[ExpensesPage] Failed to delete expense:', err);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.title) {
      alert('لطفاً عنوان سرفصل را وارد کنید.');
      return;
    }

    try {
      const adapter = storageManager.getAdapter();
      const payload: Partial<ExpenseCategory> = {
        ...categoryForm,
        code: categoryForm.code || `EXP-${Date.now().toString().slice(-4)}`,
      };
      if (editingCategory) {
        payload.id = editingCategory.id;
      }

      await adapter.saveExpenseCategory(payload);
      setEditingCategory(null);
      setCategoryForm({ title: '', code: '', icon: 'Receipt', description: '', status: 'active' });
      await loadData();
    } catch (err) {
      console.error('[ExpensesPage] Failed to save category:', err);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm(t('accounting.deleteCategoryConfirm'))) return;
    try {
      const adapter = storageManager.getAdapter();
      await adapter.deleteExpenseCategory(id);
      await loadData();
    } catch (err) {
      console.error('[ExpensesPage] Failed to delete category:', err);
    }
  };

  // Filtered list
  const filteredExpenses = expenses.filter((exp) => {
    if (selectedCategory !== 'all') {
      const catId = typeof exp.category_id === 'object' ? (exp.category_id as any)?.id : exp.category_id;
      if (String(catId) !== selectedCategory) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = exp.title?.toLowerCase().includes(q);
      const matchDesc = exp.description?.toLowerCase().includes(q);
      const matchPaidTo = exp.paid_to?.toLowerCase().includes(q);
      const matchRef = exp.reference_code?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchPaidTo && !matchRef) return false;
    }
    return true;
  });

  const totalFilteredAmount = filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-rose-500" />
            <span>{t('accounting.expensesTitle')}</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t('accounting.expensesSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCategoryModalOpen(true)}
            icon={<Layers className="w-4 h-4" />}
          >
            {t('accounting.expenseCategories')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenNewExpense}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('accounting.newExpense')}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute start-3 top-3 text-neutral-400" />
              <input
                type="text"
                placeholder="جستجو در شرح، بابت، دریافت‌کننده و شماره پیگیری..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
              />
            </div>

            <div className="w-full sm:w-56">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
              >
                <option value="all">{t('accounting.allCategories')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs">
            <span className="text-neutral-500">مجموع هزینه‌های نمایش‌یافته:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-sm">
              {formatCurrency(totalFilteredAmount)}
            </span>
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center items-center text-xs text-neutral-500">
            <RefreshCw className="w-4 h-4 animate-spin me-2" />
            در حال بارگذاری اطلاعات هزینه‌ها...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              {t('accounting.noExpenses')}
            </h4>
            <p className="text-xs text-neutral-500 mt-1">
              برای ثبت اولین هزینه روی دکمه «ثبت هزینه جدید» کلیک کنید.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-500">
                <tr>
                  <th className="py-3 px-4 text-start font-semibold">عنوان و شرح هزینه</th>
                  <th className="py-3 px-4 text-start font-semibold">سرفصل</th>
                  <th className="py-3 px-4 text-start font-semibold">تاریخ ثبت</th>
                  <th className="py-3 px-4 text-start font-semibold">روش پرداخت</th>
                  <th className="py-3 px-4 text-start font-semibold">طرف‌حساب / دریافت‌کننده</th>
                  <th className="py-3 px-4 text-start font-semibold">مبلغ</th>
                  <th className="py-3 px-4 text-center font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        {exp.title}
                      </div>
                      {exp.description && (
                        <div className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
                          {exp.description}
                        </div>
                      )}
                      {exp.reference_code && (
                        <div className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                          کد پیگیری: {exp.reference_code}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral">
                        {exp.category_title || 'سایر هزینه‌ها'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-300">
                      {formatPersianDate(exp.expense_date)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-neutral-600 dark:text-neutral-400">
                        {exp.payment_method === 'cash' && 'نقدی / تنخواه'}
                        {exp.payment_method === 'card_transfer' && 'کارت به کارت / پایا'}
                        {exp.payment_method === 'cheque' && 'چک'}
                        {exp.payment_method === 'bank_account' && 'حساب بانکی'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                      {exp.paid_to || '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400 font-mono">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditExpense(exp)}
                          title="ویرایش"
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exp.id && handleDeleteExpense(exp.id)}
                          title="حذف"
                          className="text-rose-500 hover:text-rose-700"
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={editingExpense ? t('accounting.editExpense') : t('accounting.newExpense')}
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <Input
            label="عنوان هزینه *"
            placeholder="مثال: هزینه اجاره دفتر، شارژ، خرید بسته‌بندی..."
            value={expenseForm.title || ''}
            onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="مبلغ هزینه (تومان) *"
              type="number"
              min="0"
              placeholder="0"
              value={expenseForm.amount ? String(expenseForm.amount) : ''}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                سرفصل هزینه *
              </label>
              <select
                value={expenseForm.category_id ? String(expenseForm.category_id) : ''}
                onChange={(e) => setExpenseForm({ ...expenseForm, category_id: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInput
              label="تاریخ ثبت *"
              value={expenseForm.expense_date || ''}
              onChange={(iso) => setExpenseForm({ ...expenseForm, expense_date: iso })}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                روش پرداخت
              </label>
              <select
                value={expenseForm.payment_method || 'card_transfer'}
                onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="card_transfer">کارت به کارت / پایا</option>
                <option value="cash">نقدی / تنخواه</option>
                <option value="bank_account">حساب بانکی مستقیم</option>
                <option value="cheque">چک بانکی</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="دریافت‌کننده وجه / طرف‌حساب"
              placeholder="نام فروشنده، صاحب ملک، پرسنل..."
              value={expenseForm.paid_to || ''}
              onChange={(e) => setExpenseForm({ ...expenseForm, paid_to: e.target.value })}
            />

            <Input
              label="شماره پیگیری / شماره فاکتور"
              placeholder="مثال: TRX-998822"
              value={expenseForm.reference_code || ''}
              onChange={(e) => setExpenseForm({ ...expenseForm, reference_code: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              شرح و توضیحات تکمیلی
            </label>
            <textarea
              rows={3}
              placeholder="توضیحات و بابت هزینه..."
              value={expenseForm.description || ''}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsExpenseModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {editingExpense ? 'بروزرسانی هزینه' : 'ثبت نهایی هزینه'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Category Management Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        title="مدیریت سرفصل‌های هزینه"
      >
        <div className="space-y-6">
          {/* Add / Edit Category Mini Form */}
          <form onSubmit={handleSaveCategory} className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 space-y-3">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
              {editingCategory ? 'ویرایش سرفصل' : 'افزودن سرفصل جدید'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="عنوان سرفصل *"
                placeholder="مثال: هزینه بازاریابی و تبلیغات"
                value={categoryForm.title || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, title: e.target.value })}
                required
              />
              <Input
                label="کد سرفصل"
                placeholder="مثال: MARKETING"
                value={categoryForm.code || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {editingCategory && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryForm({ title: '', code: '', icon: 'Receipt', description: '', status: 'active' });
                  }}
                >
                  انصراف
                </Button>
              )}
              <Button variant="primary" size="sm" type="submit">
                {editingCategory ? 'ذخیره تغییرات' : 'افزودن سرفصل'}
              </Button>
            </div>
          </form>

          {/* Existing Categories List */}
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            <h4 className="text-xs font-semibold text-neutral-500">سرفصل‌های تعریف‌شده:</h4>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs"
              >
                <div>
                  <span className="font-bold text-neutral-900 dark:text-white">{cat.title}</span>
                  {cat.code && (
                    <span className="ms-2 text-[10px] text-neutral-400 font-mono">({cat.code})</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingCategory(cat);
                      setCategoryForm({
                        title: cat.title,
                        code: cat.code,
                        icon: cat.icon || 'Receipt',
                        description: cat.description || '',
                        status: cat.status || 'active',
                      });
                    }}
                    icon={<Edit2 className="w-3.5 h-3.5" />}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cat.id && handleDeleteCategory(cat.id)}
                    className="text-rose-500 hover:text-rose-700"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
