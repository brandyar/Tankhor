import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n';
import { FinancialAccount, FinancialAccountType } from '../../../types/accounting';
import { Warehouse } from '../../../types';
import { X } from 'lucide-react';

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount: FinancialAccount | null;
  warehouses: Warehouse[];
  defaultWarehouseId?: number | '';
  isFirstAccount?: boolean;
  onSave: (payload: Partial<FinancialAccount>) => Promise<void>;
}

export const AccountFormModal: React.FC<AccountFormModalProps> = ({
  isOpen,
  onClose,
  editingAccount,
  warehouses,
  defaultWarehouseId = '',
  isFirstAccount = false,
  onSave,
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<{
    name: string;
    type: FinancialAccountType;
    warehouse_id: number | '';
    bank_name: string;
    account_number: string;
    card_number: string;
    shaba_number: string;
    pos_terminal_id: string;
    initial_balance: number | '';
    is_default: boolean;
    status: 'active' | 'archived';
  }>({
    name: '',
    type: 'cashbox',
    warehouse_id: defaultWarehouseId,
    bank_name: '',
    account_number: '',
    card_number: '',
    shaba_number: '',
    pos_terminal_id: '',
    initial_balance: '',
    is_default: isFirstAccount,
    status: 'active',
  });

  useEffect(() => {
    if (editingAccount) {
      const rawWhId =
        typeof editingAccount.warehouse_id === 'object' && editingAccount.warehouse_id
          ? (editingAccount.warehouse_id as any).id
          : editingAccount.warehouse_id;

      setForm({
        name: editingAccount.name,
        type: editingAccount.type as FinancialAccountType,
        warehouse_id: rawWhId ? Number(rawWhId) : '',
        bank_name: editingAccount.bank_name || '',
        account_number: editingAccount.account_number || '',
        card_number: editingAccount.card_number || '',
        shaba_number: editingAccount.shaba_number || '',
        pos_terminal_id: editingAccount.pos_terminal_id || '',
        initial_balance: editingAccount.initial_balance,
        is_default: editingAccount.is_default,
        status: (editingAccount.status as 'active' | 'archived') || 'active',
      });
    } else {
      setForm({
        name: '',
        type: 'cashbox',
        warehouse_id: defaultWarehouseId || (warehouses[0]?.id || ''),
        bank_name: '',
        account_number: '',
        card_number: '',
        shaba_number: '',
        pos_terminal_id: '',
        initial_balance: '',
        is_default: isFirstAccount,
        status: 'active',
      });
    }
  }, [editingAccount, defaultWarehouseId, warehouses, isFirstAccount, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<FinancialAccount> = {
        id: editingAccount?.id,
        name: form.name.trim(),
        type: form.type,
        warehouse_id: form.warehouse_id !== '' ? Number(form.warehouse_id) : null,
        bank_name: form.bank_name.trim() || null,
        account_number: form.account_number.trim() || null,
        card_number: form.card_number.trim() || null,
        shaba_number: form.shaba_number.trim() || null,
        pos_terminal_id: form.pos_terminal_id.trim() || null,
        initial_balance: Number(form.initial_balance) || 0,
        current_balance: editingAccount
          ? editingAccount.current_balance
          : Number(form.initial_balance) || 0,
        is_default: form.is_default,
        status: form.status,
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Error saving account in modal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              {editingAccount ? t('accounting.editAccount') : t('accounting.newAccount')}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('accounting.accountName')} *
              </label>
              <input
                type="text"
                required
                placeholder="مثلاً صندوق فروشگاه، جاری ملت، پوز سامان..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('accounting.accountType')}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as FinancialAccountType })}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                >
                  <option value="cashbox">{t('accounting.cashbox')}</option>
                  <option value="bank">{t('accounting.bank')}</option>
                  <option value="pos">{t('accounting.pos')}</option>
                  <option value="petty_cash">{t('accounting.pettyCash')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('accounting.initialBalance')} ({t('accounting.toman')})
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.initial_balance}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      initial_balance: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  disabled={!!editingAccount}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white disabled:opacity-50"
                />
              </div>
            </div>

            {/* Linked Warehouse Selection */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                انبار پیش‌فرض / متصل به این صندوق
              </label>
              <select
                value={form.warehouse_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    warehouse_id: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
              >
                <option value="">{t('common.all') || 'همه انبارها / بدون انبار خاص'}</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
              <p className="text-[10.5px] text-neutral-500 dark:text-neutral-400 mt-1">
                در صفحه ثبت سفارش، با انتخاب این انبار، این صندوق یا حساب به عنوان صندوق پیش‌فرض تسویه فعال می‌شود.
              </p>
            </div>

            {(form.type === 'bank' || form.type === 'pos') && (
              <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.bankName')}
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً ملت، سامان، ملی..."
                      value={form.bank_name}
                      onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.accountNumber')}
                    </label>
                    <input
                      type="text"
                      placeholder="شماره حساب..."
                      value={form.account_number}
                      onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('accounting.cardNumber')}
                  </label>
                  <input
                    type="text"
                    maxLength={19}
                    placeholder="۶۱۰۴-۳۳۷۸-۹۰۱۲-۳۴۵۶"
                    value={form.card_number}
                    onChange={(e) => setForm({ ...form, card_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('accounting.shabaNumber')}
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="IR120120000000012345678901"
                    value={form.shaba_number}
                    onChange={(e) => setForm({ ...form, shaba_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono text-center"
                  />
                </div>

                {form.type === 'pos' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('accounting.posTerminalId')}
                    </label>
                    <input
                      type="text"
                      placeholder="شماره پایانه کارتخوان..."
                      value={form.pos_terminal_id}
                      onChange={(e) => setForm({ ...form, pos_terminal_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-hidden font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="rounded-sm border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <span>{t('accounting.isDefaultAccount')}</span>
              </label>
            </div>
          </div>

          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2 bg-neutral-50 dark:bg-neutral-800/40">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              {editingAccount ? 'بروزرسانی حساب' : 'ذخیره حساب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
