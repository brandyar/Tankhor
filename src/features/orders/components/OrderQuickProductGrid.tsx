import React, { RefObject } from 'react';
import { useTranslation } from '../../../i18n';
import { Product, ProductVariant, Category } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { formatCurrency, toPersianDigits } from '../../../utils/formatters';
import { Barcode, Search, Plus } from 'lucide-react';

interface OrderQuickProductGridProps {
  barcodeInputRef: RefObject<HTMLInputElement>;
  barcodeQuery: string;
  setBarcodeQuery: (query: string) => void;
  onBarcodeSubmit: (e: React.FormEvent) => void;
  productSearch: string;
  setProductSearch: (query: string) => void;
  categories: Category[];
  selectedCategoryId: number | 'all';
  setSelectedCategoryId: (id: number | 'all') => void;
  filteredVariants: ProductVariant[];
  products: Product[];
  selectedWarehouseId: number;
  getVariantAvailableStock: (variantId: number, warehouseId?: number) => number;
  cart: { variant: ProductVariant; quantity: number }[];
  onAddToCart: (variant: ProductVariant) => void;
  isLoading: boolean;
}

export const OrderQuickProductGrid: React.FC<OrderQuickProductGridProps> = ({
  barcodeInputRef,
  barcodeQuery,
  setBarcodeQuery,
  onBarcodeSubmit,
  productSearch,
  setProductSearch,
  categories,
  selectedCategoryId,
  setSelectedCategoryId,
  filteredVariants,
  products,
  selectedWarehouseId,
  getVariantAvailableStock,
  cart,
  onAddToCart,
  isLoading,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  return (
    <div className="lg:col-span-7 space-y-4">
      {/* Quick Barcode Scanner Bar */}
      <form onSubmit={onBarcodeSubmit} className="bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-800 rounded-xl p-3 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-[#171717] dark:text-neutral-100">
          <span className="flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {t('orders.scanBarcodeOrSku')}
          </span>
          <span className="text-[10px] text-[#888888] dark:text-neutral-400 font-mono">{t('orders.enterKeyHint')}</span>
        </div>

        <div className="relative">
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeQuery}
            onChange={(e) => setBarcodeQuery(e.target.value)}
            placeholder={t('orders.barcodeScannerActivePlaceholder')}
            className="w-full ps-9 pe-24 py-2 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 focus:border-[#171717] dark:focus:border-neutral-400 focus:bg-white dark:focus:bg-[#13151a] rounded-lg text-xs font-mono text-[#171717] dark:text-neutral-100 placeholder:text-[#a1a1a1] dark:placeholder:text-neutral-500 focus:outline-none transition-all shadow-inner"
          />
          <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-[#888888] dark:text-neutral-400">
            <Barcode className="w-4 h-4" />
          </div>
          <div className="absolute inset-y-0 end-1.5 flex items-center">
            <Button type="submit" variant="primary" size="sm" className="h-7 text-[11px] px-3 font-bold">
              {t('orders.quickAdd')}
            </Button>
          </div>
        </div>
      </form>

      {/* Catalog Filter Bar */}
      <div className="bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-800 rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-64">
            <Input
              placeholder={t('orders.searchPlaceholder')}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              icon={<Search className="w-3.5 h-3.5" />}
            />
          </div>

          <div className="text-xs font-mono text-[#888888] dark:text-neutral-400">
            {t('orders.availableItemsCount', { count: filteredVariants.length })}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-1">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedCategoryId === 'all'
                ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
            }`}
          >
            {t('orders.allCategories')}
          </button>
          {categories.map((cat, idx) => (
            <button
              key={`ord_cat_${cat.id}_${idx}`}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                selectedCategoryId === cat.id
                  ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                  : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Items Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar p-1">
        {isLoading ? (
          <div className="col-span-3 p-12 text-center text-[#888888] dark:text-neutral-400 text-xs">{t('orders.loadingCatalog')}</div>
        ) : filteredVariants.length === 0 ? (
          <div className="col-span-3 p-12 text-center text-[#888888] dark:text-neutral-400 text-xs bg-white dark:bg-[#13151a] rounded-xl border border-[#ebebeb] dark:border-neutral-800">
            {t('orders.noProductsFound')}
          </div>
        ) : (
          filteredVariants.map((v, vIdx) => {
            const prod = products.find((p) => p.id === (v.product_id && typeof v.product_id === 'object' ? (v.product_id as any).id : v.product_id));
            const stock = getVariantAvailableStock(v.id, selectedWarehouseId);
            const inCart = cart.find((c) => c.variant.id === v.id);
            const isOutOfStock = stock <= 0;

            return (
              <div
                key={`ord_var_${v.id}_${vIdx}`}
                onClick={() => {
                  if (isOutOfStock) return;
                  onAddToCart(v);
                }}
                className={`p-3 bg-white dark:bg-[#13151a] border rounded-xl transition-all duration-150 flex flex-col justify-between space-y-2 relative group ${
                  isOutOfStock
                    ? 'opacity-65 border-dashed border-red-200 dark:border-red-950/60 bg-red-50/10 cursor-not-allowed'
                    : 'cursor-pointer hover:shadow-md'
                } ${
                  inCart
                    ? 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20'
                    : !isOutOfStock
                    ? 'border-[#ebebeb] dark:border-neutral-800 hover:border-[#171717] dark:hover:border-neutral-500'
                    : ''
                }`}
              >
                {inCart && (
                  <div className="absolute top-2 end-2 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono shadow-2xs">
                    {inCart.quantity}
                  </div>
                )}

                <div>
                  <div className="font-bold text-[#171717] dark:text-neutral-100 text-xs leading-snug group-hover:text-black dark:group-hover:text-white line-clamp-2">
                    {prod ? prod.title : t('orders.untitledProduct')}
                  </div>

                  {/* Variant Specs Badge */}
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {v.color_name && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded text-[#4d4d4d] dark:text-neutral-300">
                        {v.color_name}
                      </span>
                    )}
                    {v.size_name && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded text-[#171717] dark:text-neutral-100 font-bold">
                        {t('orders.size')}: {v.size_name}
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-[#888888] dark:text-neutral-400 font-mono mt-1">
                    SKU: {v.sku}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#ebebeb] dark:border-neutral-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#171717] dark:text-neutral-100 text-xs font-mono">
                      {formatCurrency(v.price, 'TOMAN', isPersian)}
                    </div>
                    <div className={`text-[10px] font-mono mt-0.5 ${
                      stock > 5
                        ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                        : stock > 0
                        ? 'text-amber-700 dark:text-amber-400 font-bold'
                        : 'text-red-600 dark:text-red-400 font-bold'
                    }`}>
                      {stock > 0 ? (
                        <span>{t('orders.stockInCount', { count: isPersian ? toPersianDigits(stock) : stock })}</span>
                      ) : (
                        <span className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          {t('orders.outOfStockInSelectedWarehouse')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                    isOutOfStock
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700'
                      : 'bg-[#fafafa] dark:bg-[#181a20] group-hover:bg-[#171717] dark:group-hover:bg-neutral-100 group-hover:text-white dark:group-hover:text-neutral-900 text-[#171717] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 group-hover:border-[#171717]'
                  }`}>
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
