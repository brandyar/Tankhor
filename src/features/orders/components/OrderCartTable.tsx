import React from 'react';
import { useTranslation } from '../../../i18n';
import { ProductVariant } from '../../../types';
import { Badge } from '../../../components/ui/Badge';
import { formatCurrency } from '../../../utils/formatters';
import { ShoppingCart, Package, Trash2 } from 'lucide-react';

export interface CartLine {
  variant: ProductVariant;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface OrderCartTableProps {
  cart: CartLine[];
  onUpdateQty: (variantId: number, qty: number) => void;
  onRemoveLine: (variantId: number) => void;
  extraDiscount: number;
  setExtraDiscount: (val: number) => void;
  hasTax: boolean;
  setHasTax: (val: boolean) => void;
  taxAmount: number;
}

export const OrderCartTable: React.FC<OrderCartTableProps> = ({
  cart,
  onUpdateQty,
  onRemoveLine,
  extraDiscount,
  setExtraDiscount,
  hasTax,
  setHasTax,
  taxAmount,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  return (
    <div className="space-y-4">
      {/* Invoice Terminal Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb] dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="font-bold text-[#171717] dark:text-neutral-100 text-sm">{t('orders.invoiceItems')}</h2>
        </div>
        <Badge variant="neutral">{t('orders.itemsCount', { count: cart.length })}</Badge>
      </div>

      {/* Cart Items List */}
      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar border-y border-[#ebebeb] dark:border-neutral-800 py-3">
        {cart.length === 0 ? (
          <div className="p-8 text-center text-[#888888] dark:text-neutral-400 text-xs space-y-2">
            <Package className="w-8 h-8 text-[#a1a1a1] dark:text-neutral-500 mx-auto stroke-1" />
            <p>{t('orders.emptyCartHint')}</p>
          </div>
        ) : (
          cart.map((line, lIdx) => (
            <div
              key={`ord_cart_${line.variant.id}_${lIdx}`}
              className="p-2.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded-xl space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-[#171717] dark:text-neutral-100 block leading-tight">{line.productTitle}</span>
                  <div className="text-[10px] text-[#888888] dark:text-neutral-400 font-mono mt-0.5">
                    SKU: {line.variant.sku}
                    {line.variant.size_name ? ` | ${t('orders.size')}: ${line.variant.size_name}` : ''}
                    {line.variant.color_name ? ` | ${t('orders.color')}: ${line.variant.color_name}` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveLine(line.variant.id)}
                  className="text-[#888888] dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 p-1 transition-colors"
                  title={t('orders.removeFromCart')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#ebebeb]/60 dark:border-neutral-700/60">
                {/* Quantity Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateQty(line.variant.id, line.quantity - 1)}
                    className="w-6 h-6 rounded bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-700 font-bold text-[#171717] dark:text-neutral-100 flex items-center justify-center hover:bg-[#ebebeb] dark:hover:bg-neutral-800 transition-all"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => onUpdateQty(line.variant.id, parseInt(e.target.value) || 1)}
                    className="w-9 text-center font-bold font-mono text-[#171717] dark:text-neutral-100 bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-700 rounded py-0.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdateQty(line.variant.id, line.quantity + 1)}
                    className="w-6 h-6 rounded bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-700 font-bold text-[#171717] dark:text-neutral-100 flex items-center justify-center hover:bg-[#ebebeb] dark:hover:bg-neutral-800 transition-all"
                  >
                    +
                  </button>
                </div>

                {/* Line Discount & Total */}
                <div className="text-end">
                  <div className="font-bold font-mono text-[#171717] dark:text-neutral-100">
                    {formatCurrency(line.quantity * line.unitPrice - line.discount * line.quantity, 'TOMAN', isPersian)}
                  </div>
                  <div className="text-[10px] text-[#888888] dark:text-neutral-400 font-mono">
                    {formatCurrency(line.unitPrice, 'TOMAN', isPersian)} × {line.quantity}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Discounts & Tax Adjustments */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-[11px] font-bold text-[#4d4d4d] dark:text-neutral-300 mb-1">
            {t('orders.specialDiscount')}
          </label>
          <input
            type="number"
            min="0"
            value={extraDiscount || ''}
            onChange={(e) => setExtraDiscount(Math.max(0, Number(e.target.value)))}
            placeholder="0"
            className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded-lg text-xs font-mono text-[#171717] dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-[#171717] dark:focus:ring-neutral-400"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-bold text-[#4d4d4d] dark:text-neutral-300">
              {t('orders.vatRate')}
            </label>
            <button
              type="button"
              onClick={() => setHasTax(!hasTax)}
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-all ${
                hasTax ? 'bg-emerald-600 text-white' : 'bg-[#ebebeb] dark:bg-neutral-800 text-[#4d4d4d] dark:text-neutral-300'
              }`}
            >
              {hasTax ? t('orders.active') : t('orders.inactive')}
            </button>
          </div>
          <div className="px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded-lg text-xs font-mono text-[#888888] dark:text-neutral-400">
            {hasTax ? `${formatCurrency(taxAmount, 'TOMAN', isPersian)}` : t('orders.noTax')}
          </div>
        </div>
      </div>
    </div>
  );
};
