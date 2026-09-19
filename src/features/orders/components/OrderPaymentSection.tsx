import React from 'react';
import { useTranslation } from '../../../i18n';
import { Customer, Warehouse } from '../../../types';
import { FinancialAccount } from '../../../types/accounting';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatters';
import {
  CreditCard,
  DollarSign,
  Tag,
  User,
  Wallet,
  Lock,
  CheckCircle2,
  Printer,
} from 'lucide-react';

export type POSPaymentType = 'pos' | 'cash' | 'card_to_card' | 'credit';

interface OrderPaymentSectionProps {
  customers: Customer[];
  selectedCustomerId: number;
  setSelectedCustomerId: (id: number) => void;
  warehouses: Warehouse[];
  selectedWarehouseId: number;
  onWarehouseChange: (whId: number) => void;
  isWarehouseLocked: boolean;
  paymentType: POSPaymentType;
  onPaymentTypeChange: (type: POSPaymentType) => void;
  hasAccounting: boolean;
  financialAccounts: FinancialAccount[];
  selectedAccountId: number | '';
  setSelectedAccountId: (id: number | '') => void;
  isAccountLocked: boolean;
  onRefreshAccounts: () => void;
  cashReceived: number;
  setCashReceived: (val: number) => void;
  cashChange: number;
  subtotal: number;
  totalDiscount: number;
  hasTax: boolean;
  taxAmount: number;
  grandTotal: number;
  isSaving: boolean;
  cartLength: number;
  onPreviewPrint: () => void;
  activeOrgId?: number | string;
  userId?: string | number;
}

export const OrderPaymentSection: React.FC<OrderPaymentSectionProps> = ({
  customers,
  selectedCustomerId,
  setSelectedCustomerId,
  warehouses,
  selectedWarehouseId,
  onWarehouseChange,
  isWarehouseLocked,
  paymentType,
  onPaymentTypeChange,
  hasAccounting,
  financialAccounts,
  selectedAccountId,
  setSelectedAccountId,
  isAccountLocked,
  onRefreshAccounts,
  cashReceived,
  setCashReceived,
  cashChange,
  subtotal,
  totalDiscount,
  hasTax,
  taxAmount,
  grandTotal,
  isSaving,
  cartLength,
  onPreviewPrint,
  activeOrgId,
  userId,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  return (
    <div className="space-y-4 pt-1">
      {/* Customer & Warehouse Selection */}
      <div className="grid grid-cols-1 gap-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-[#171717] dark:text-neutral-200">
              {t('orders.invoiceCustomer')}
            </label>
            <button
              type="button"
              onClick={() => setSelectedCustomerId(0)}
              className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
            >
              {t('orders.selectGeneralCustomer')}
            </button>
          </div>
          <Select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
            options={[
              { value: 0, label: t('orders.generalCustomer') },
              ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.phone || '-'})` })),
            ]}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-[#171717] dark:text-neutral-200">
              {t('orders.deliveryWarehouse')}
            </label>
            {isWarehouseLocked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                <Lock className="w-2.5 h-2.5" />
                <span>{isPersian ? 'انبار اختصاصی شما' : 'Locked Branch'}</span>
              </span>
            )}
          </div>
          <Select
            value={selectedWarehouseId}
            disabled={isWarehouseLocked}
            onChange={(e) => onWarehouseChange(Number(e.target.value))}
            options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code || w.id})` }))}
          />
        </div>
      </div>

      {/* Payment Method Selector Cards */}
      <div className="space-y-1.5 pt-1">
        <label className="block text-xs font-bold text-[#171717] dark:text-neutral-200">{t('orders.paymentMethodPos')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onPaymentTypeChange('pos')}
            className={`py-2 px-2 rounded-xl border text-center transition-all ${
              paymentType === 'pos'
                ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
            }`}
          >
            <CreditCard className="w-4 h-4 mx-auto mb-1" />
            <span className="text-[11px] sm:text-[10px] font-bold block">{t('orders.posTerminal')}</span>
          </button>

          <button
            type="button"
            onClick={() => onPaymentTypeChange('cash')}
            className={`py-2 px-2 rounded-xl border text-center transition-all ${
              paymentType === 'cash'
                ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
            }`}
          >
            <DollarSign className="w-4 h-4 mx-auto mb-1" />
            <span className="text-[11px] sm:text-[10px] font-bold block">{t('orders.cash')}</span>
          </button>

          <button
            type="button"
            onClick={() => onPaymentTypeChange('card_to_card')}
            className={`py-2 px-2 rounded-xl border text-center transition-all ${
              paymentType === 'card_to_card'
                ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
            }`}
          >
            <Tag className="w-4 h-4 mx-auto mb-1" />
            <span className="text-[11px] sm:text-[10px] font-bold block">{t('orders.cardToCard')}</span>
          </button>

          <button
            type="button"
            onClick={() => onPaymentTypeChange('credit')}
            className={`py-2 px-2 rounded-xl border text-center transition-all ${
              paymentType === 'credit'
                ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
            }`}
          >
            <User className="w-4 h-4 mx-auto mb-1" />
            <span className="text-[11px] sm:text-[10px] font-bold block">{t('orders.storeCredit')}</span>
          </button>
        </div>
      </div>

      {/* Financial Account / Cashbox Selector (When Accounting Module is Active) */}
      {hasAccounting && paymentType !== 'credit' && (
        <div className="p-3 bg-neutral-50 dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-neutral-800 dark:text-neutral-200">
              <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('orders.settlementAccount') || 'واریز به حساب / صندوق تسویه:'}</span>
            </div>
            <div className="flex items-center gap-2">
              {isAccountLocked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  <Lock className="w-2.5 h-2.5" />
                  <span>{isPersian ? 'صندوق اختصاصی شما' : 'Locked Cashbox'}</span>
                </span>
              )}
              {selectedAccountId && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                  {(() => {
                    const acc = financialAccounts.find((a) => a.id === selectedAccountId);
                    return acc && acc.current_balance !== undefined
                      ? `موجودی: ${formatCurrency(acc.current_balance, 'TOMAN', isPersian)}`
                      : '';
                  })()}
                </span>
              )}
            </div>
          </div>

          {financialAccounts.length === 0 ? (
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
              <span>هنوز حساب مالی یا صندوق نقدی در ماژول حسابداری تعریف نشده است.</span>
              <button
                type="button"
                onClick={onRefreshAccounts}
                className="px-2 py-1 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded text-[10px] font-bold hover:bg-amber-300"
              >
                بروزرسانی
              </button>
            </div>
          ) : (
            <>
              <select
                value={selectedAccountId ? String(selectedAccountId) : ''}
                disabled={isAccountLocked}
                onChange={(e) => {
                  if (isAccountLocked) return;
                  const val = e.target.value ? Number(e.target.value) : '';
                  setSelectedAccountId(val);
                  if (val && activeOrgId) {
                    localStorage.setItem(
                      `tankhor_pos_account_${activeOrgId}_${userId || 'default'}`,
                      String(val)
                    );
                  }
                }}
                className={`w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-xs font-medium text-neutral-900 dark:text-neutral-100 focus:ring-1 focus:ring-emerald-500 ${
                  isAccountLocked ? 'opacity-80 cursor-not-allowed bg-neutral-100 dark:bg-neutral-800/80 border-amber-300 dark:border-amber-700' : ''
                }`}
              >
                {/* Accounts linked to selected warehouse */}
                {(() => {
                  const linkedAccs = financialAccounts.filter((acc) => {
                    const aWhId = typeof acc.warehouse_id === 'object' && acc.warehouse_id ? (acc.warehouse_id as any).id : acc.warehouse_id;
                    return Number(aWhId) === Number(selectedWarehouseId);
                  });
                  const otherAccs = financialAccounts.filter((acc) => {
                    const aWhId = typeof acc.warehouse_id === 'object' && acc.warehouse_id ? (acc.warehouse_id as any).id : acc.warehouse_id;
                    return Number(aWhId) !== Number(selectedWarehouseId);
                  });

                  const selectedWhObj = warehouses.find((w) => w.id === selectedWarehouseId);

                  return (
                    <>
                      {linkedAccs.length > 0 && (
                        <optgroup label={`⭐ متصل به انبار انتخابی (${selectedWhObj?.name || 'این انبار'})`}>
                          {linkedAccs.map((acc) => (
                            <option key={acc.id} value={String(acc.id)}>
                              {acc.type === 'cashbox' ? '💵' : '💳'} {acc.name} {acc.bank_name ? `(${acc.bank_name})` : ''} - پیش‌فرض انبار
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {otherAccs.length > 0 && (
                        <optgroup label={linkedAccs.length > 0 ? 'سایر صندوق‌ها و حساب‌های مالی' : 'تمامی صندوق‌ها و حساب‌های بانکی'}>
                          {otherAccs.map((acc) => {
                            const accWh = acc.warehouse_name || (typeof acc.warehouse_id === 'object' && acc.warehouse_id ? (acc.warehouse_id as any).name : null);
                            return (
                              <option key={acc.id} value={String(acc.id)}>
                                {acc.type === 'cashbox' ? '💵' : '💳'} {acc.name} {acc.bank_name ? `(${acc.bank_name})` : ''} {accWh ? `[انبار: ${accWh}]` : ''} {acc.is_default ? '(پیش‌فرض عمومی)' : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </>
                  );
                })()}
              </select>

              {/* Indicator if current selection matches warehouse */}
              {(() => {
                const selAcc = financialAccounts.find((a) => a.id === selectedAccountId);
                if (!selAcc) return null;
                const aWhId = typeof selAcc.warehouse_id === 'object' && selAcc.warehouse_id ? (selAcc.warehouse_id as any).id : selAcc.warehouse_id;
                const isLinkedToCurrentWh = Number(aWhId) === Number(selectedWarehouseId);

                return (
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      نوع حساب: <strong className="text-neutral-700 dark:text-neutral-300">{selAcc.type === 'cashbox' ? 'صندوق نقدی' : selAcc.type === 'pos' ? 'کارتخوان (POS)' : 'حساب بانکی'}</strong>
                    </span>
                    {isLinkedToCurrentWh ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full font-bold">
                        ✓ متصل به انبار انتخابی
                      </span>
                    ) : aWhId ? (
                      <span className="text-[10px] text-neutral-400">
                        (متصل به انبار دیگر)
                      </span>
                    ) : null}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Cash Return Calculator (If Cash Selected) */}
      {paymentType === 'cash' && (
        <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-emerald-900">{t('orders.cashReceived')}</span>
            <input
              type="number"
              value={cashReceived || ''}
              onChange={(e) => setCashReceived(Number(e.target.value))}
              placeholder={t('orders.cashReceivedPlaceholder')}
              className="w-32 px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-mono font-bold text-emerald-900 text-end"
            />
          </div>

          <div className="flex justify-between items-center text-xs border-t border-emerald-200/60 pt-2 font-bold">
            <span className="text-emerald-800">{t('orders.cashChange')}</span>
            <span className="font-mono text-emerald-900 text-sm">
              {formatCurrency(cashChange, 'TOMAN', isPersian)}
            </span>
          </div>
        </div>
      )}

      {/* Financial Totals Summary (Dark Ink Vercel Theme) */}
      <div className="p-4 bg-[#171717] text-white rounded-xl space-y-2 text-xs shadow-md">
        <div className="flex justify-between text-neutral-400">
          <span>{t('orders.subtotal')}:</span>
          <span className="font-mono">{formatCurrency(subtotal, 'TOMAN', isPersian)}</span>
        </div>

        {totalDiscount > 0 && (
          <div className="flex justify-between text-emerald-400">
            <span>{t('orders.totalDiscount')}</span>
            <span className="font-mono">- {formatCurrency(totalDiscount, 'TOMAN', isPersian)}</span>
          </div>
        )}

        {hasTax && (
          <div className="flex justify-between text-neutral-300">
            <span>{t('orders.vatIncluded')}:</span>
            <span className="font-mono">+ {formatCurrency(taxAmount, 'TOMAN', isPersian)}</span>
          </div>
        )}

        <div className="flex justify-between items-center text-white font-bold text-base pt-2 border-t border-neutral-800">
          <span>{t('orders.payableAmount')}</span>
          <span className="font-mono text-emerald-400 text-lg">
            {formatCurrency(grandTotal, 'TOMAN', isPersian)}
          </span>
        </div>
      </div>

      {/* Order Action Buttons */}
      <div className="space-y-2">
        <Button
          type="submit"
          variant="primary"
          className="w-full py-3 text-sm font-bold justify-center"
          isLoading={isSaving}
          disabled={cartLength === 0}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        >
          {t('orders.submitOrderAndFinalize')}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onPreviewPrint}
          disabled={cartLength === 0}
          className="w-full py-2.5 text-xs text-neutral-300 border-neutral-700 hover:bg-neutral-800 hover:text-white justify-center"
          icon={<Printer className="w-3.5 h-3.5 text-emerald-400" />}
        >
          {t('orders.previewAndPrint')}
        </Button>
      </div>
    </div>
  );
};
