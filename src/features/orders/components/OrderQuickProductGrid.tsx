import React, { RefObject } from 'react';
import { useTranslation } from '../../../i18n';
import { Product, ProductVariant, Category } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { formatCurrency, toPersianDigits } from '../../../utils/formatters';
import { Barcode, Search, Plus, X } from 'lucide-react';

interface OrderQuickProductGridProps {
  barcodeInputRef: RefObject<HTMLInputElement>;
  productSearch: string;
  setProductSearch: (query: string) => void;
  onBarcodeSubmit: (e: React.FormEvent) => void;
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
  productSearch,
  setProductSearch,
  onBarcodeSubmit,
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
    <div className="w-full lg:col-span-7 space-y-3 sm:space-y-4 pb-24 lg:pb-0">
      {/* Unified Search & Barcode Scanner Toolbar */}
      <div className="bg-white dark:bg-[#13151a] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-2.5">
        {/* Smart Single Search/Scan Input */}
        <form onSubmit={onBarcodeSubmit} className="relative flex items-center">
          <input
            ref={barcodeInputRef}
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder={t('orders.searchAndScanPlaceholder') || 'جستجوی کالا، اسکن بارکد یا کد SKU...'}
            className="w-full ps-9 pe-24 sm:pe-28 py-2.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 focus:border-[#171717] dark:focus:border-neutral-400 focus:bg-white dark:focus:bg-[#13151a] rounded-xl text-xs text-[#171717] dark:text-neutral-100 placeholder:text-[#a1a1a1] dark:placeholder:text-neutral-500 focus:outline-none transition-all shadow-inner"
          />
          <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="absolute inset-y-0 end-1.5 flex items-center gap-1">
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch('')}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                title="پاک کردن"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="h-7 text-[11px] px-2.5 sm:px-3 font-bold rounded-lg"
            >
              <span>{t('orders.quickAdd')}</span>
            </Button>
          </div>
        </form>

        {/* Category Filter Pills & Items Count Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
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

          <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 text-end sm:text-start shrink-0">
            {t('orders.availableItemsCount', { count: isPersian ? toPersianDigits(filteredVariants.length) : filteredVariants.length })}
          </div>
        </div>
      </div>

      {/* Catalog Items Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-h-[60vh] sm:max-h-[500px] lg:max-h-[620px] overflow-y-auto custom-scrollbar p-0.5">
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
