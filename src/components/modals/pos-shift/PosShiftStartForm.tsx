import React, { useState } from 'react';
import { useTranslation } from '../../../i18n';
import { Warehouse, OrganizationUser, Organization } from '../../../types';
import { FinancialAccount } from '../../../types/accounting';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Badge';
import { Play, User, Lock, Wallet } from 'lucide-react';

interface PosShiftStartFormProps {
  user: any;
  currentUserMember: OrganizationUser | null;
  warehouses: Warehouse[];
  financialAccounts: FinancialAccount[];
  hasAccounting: boolean;
  activeOrganization: Organization | null;
  initialWarehouseId: number | '';
  initialAccountId: number | '';
  initialOpeningBalance: string;
  onClose: () => void;
  onSubmit: (params: {
    warehouseId: number;
    financialAccountId: number | null;
    openingBalance: number;
  }) => Promise<void>;
}

export const PosShiftStartForm: React.FC<PosShiftStartFormProps> = ({
  user,
  currentUserMember,
  warehouses,
  financialAccounts,
  hasAccounting,
  activeOrganization,
  initialWarehouseId,
  initialAccountId,
  initialOpeningBalance,
  onClose,
  onSubmit,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  const [openWarehouseId, setOpenWarehouseId] = useState<number | ''>(initialWarehouseId);
  const [openAccountId, setOpenAccountId] = useState<number | ''>(initialAccountId);
  const [openingBalance, setOpeningBalance] = useState<string>(initialOpeningBalance);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openWarehouseId) {
      alert(isPersian ? 'لطفاً انبار یا شعبه صندوق را انتخاب کنید.' : 'Please select warehouse.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanOpening = parseFloat(openingBalance.replace(/,/g, '')) || 0;
      await onSubmit({
        warehouseId: Number(openWarehouseId),
        financialAccountId: openAccountId ? Number(openAccountId) : null,
        openingBalance: cleanOpening,
      });
    } catch (err: any) {
      alert(
        isPersian
          ? `خطا در باز کردن شیفت: ${err.message}`
          : `Error opening shift: ${err.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/50 flex items-start gap-3">
        <Play className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
          <p className="font-bold mb-1">
            {isPersian ? 'شروع شیفت جدید صندوق و ثبت سفارش' : 'Start New POS Shift'}
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            {isPersian
              ? 'با افتتاح شیفت، فروش‌ها، دریافت‌های نقدی و کارتی صندوق شما با موجودی اولیه تفکیک شده و در پایان شیفت گزارش مغایرت و Z-Report تولید می‌شود.'
              : 'Opening a shift isolates cash and POS transactions for clear end-of-day balancing and Z-Reports.'}
          </p>
        </div>
      </div>

      {/* Cashier Identity Badge */}
      <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-500" />
          <span className="text-neutral-500 dark:text-neutral-400">
            {isPersian ? 'صندوق‌دار متصل:' : 'Logged-in Cashier:'}
          </span>
          <span className="font-bold text-neutral-900 dark:text-neutral-100">
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}
          </span>
        </div>
        <Badge variant="neutral">
          {currentUserMember?.role === 'owner'
            ? 'مدیر ارشد'
            : currentUserMember?.role === 'manager'
            ? 'مدیر شعبه'
            : 'صندوق‌دار'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              {isPersian ? 'انبار / شعبه فروشگاه *' : 'Warehouse / Store Branch *'}
            </label>
            {currentUserMember?.can_change_warehouse === false &&
              currentUserMember?.warehouse_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  <Lock className="w-2.5 h-2.5" />
                  <span>{isPersian ? 'قفل بر اساس دسترسی کاربر' : 'Locked Branch'}</span>
                </span>
              )}
          </div>
          <Select
            value={String(openWarehouseId)}
            onChange={(e) => setOpenWarehouseId(Number(e.target.value) || '')}
            options={warehouses.map((w) => ({
              value: String(w.id),
              label: `${w.name} ${w.is_default ? (isPersian ? '(پیش‌فرض)' : '(Default)') : ''}`,
            }))}
            disabled={
              currentUserMember?.can_change_warehouse === false &&
              Boolean(currentUserMember?.warehouse_id)
            }
            required
          />
        </div>

        {hasAccounting ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                {isPersian ? 'صندوق نقدی / دستگاه پوز اختصاصی' : 'Dedicated Cashbox / POS Account'}
              </label>
              {currentUserMember?.financial_account_id && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    currentUserMember.can_change_warehouse === false ||
                    currentUserMember.role === 'sales'
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                      : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                  }`}
                >
                  {currentUserMember.can_change_warehouse === false ||
                  currentUserMember.role === 'sales' ? (
                    <Lock className="w-2.5 h-2.5" />
                  ) : (
                    <Wallet className="w-2.5 h-2.5" />
                  )}
                  <span>
                    {currentUserMember.can_change_warehouse === false ||
                    currentUserMember.role === 'sales'
                      ? isPersian
                        ? 'صندوق قفل‌شده شما'
                        : 'Locked Cashbox'
                      : isPersian
                      ? 'صندوق پیش‌فرض شما'
                      : 'Assigned Cashbox'}
                  </span>
                </span>
              )}
            </div>
            <Select
              value={String(openAccountId)}
              onChange={(e) => setOpenAccountId(Number(e.target.value) || '')}
              disabled={Boolean(
                currentUserMember?.financial_account_id &&
                  (currentUserMember.can_change_warehouse === false ||
                    currentUserMember.role === 'sales')
              )}
              options={[
                {
                  value: '',
                  label: isPersian
                    ? 'انتخاب خودکار بر اساس تراکنش'
                    : 'Auto match per transaction',
                },
                ...financialAccounts.map((a) => ({
                  value: String(a.id),
                  label: `${a.name} (${
                    a.type === 'cashbox' ? 'صندوق' : a.type === 'pos' ? 'پوز' : 'بانک'
                  })`,
                })),
              ]}
            />
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 text-xs text-neutral-500">
            <Lock className="w-4 h-4 text-neutral-400" />
            <span>
              {isPersian
                ? 'صندوق‌های پیشرفته در ماژول حسابداری فعال می‌شوند.'
                : 'Advanced cashbox requires Accounting module.'}
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
          {isPersian
            ? 'موجودی اولیه پول نقد در کشوی صندوق (تنخواه/پول خرد)'
            : 'Opening Cash in Drawer'}
        </label>
        <div className="relative">
          <input
            type="text"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0"
            className="w-full ps-3 pe-12 py-2 text-xs bg-neutral-50 dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100 font-mono tracking-wider transition-all"
          />
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 font-bold">
            {activeOrganization?.currency === 'IRR' ? 'ریال' : 'تومان'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
        <Button variant="outline" type="button" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          type="submit"
          isLoading={isSubmitting}
          icon={<Play className="w-4 h-4" />}
        >
          {isPersian ? 'افتتاح و شروع شیفت' : 'Start POS Shift'}
        </Button>
      </div>
    </form>
  );
};
