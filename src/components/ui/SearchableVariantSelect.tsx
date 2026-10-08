import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ProductVariant, Product } from '../../types';
import { ProductImage } from './ProductImage';
import { useTranslation } from '../../i18n';
import { Search, Check, ChevronDown, X, Package } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';

export interface SearchableVariantSelectProps {
  variants: ProductVariant[];
  products?: Product[];
  value: number | '' | undefined;
  onChange: (variantId: number) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const SearchableVariantSelect: React.FC<SearchableVariantSelectProps> = ({
  variants,
  products = [],
  value,
  onChange,
  label,
  placeholder,
  required,
  error,
  disabled,
  className = '',
  id,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected variant resolution
  const selectedVariant = useMemo(() => {
    if (!value) return null;
    return variants.find((v) => v.id === Number(value)) || null;
  }, [variants, value]);

  // Normalize search helper (Arabic/Persian character normalization)
  const normalize = (str?: string | null) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ة/g, 'ه')
      .trim();
  };

  // Filtered variants
  const filteredVariants = useMemo(() => {
    const term = normalize(searchTerm);
    if (!term) return variants;

    return variants.filter((v) => {
      const prod = products.find(
        (p) => p.id === (typeof v.product_id === 'object' ? v.product_id.id : v.product_id)
      );
      const title = normalize(v.product_title || prod?.title);
      const sku = normalize(v.sku);
      const barcode = normalize(v.barcode);
      const color = normalize(v.color_name);
      const size = normalize(v.size_name);

      return (
        sku.includes(term) ||
        title.includes(term) ||
        barcode.includes(term) ||
        color.includes(term) ||
        size.includes(term)
      );
    });
  }, [variants, products, searchTerm]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Keydown handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getVariantDisplayTitle = (v: ProductVariant) => {
    const prod = products.find(
      (p) => p.id === (typeof v.product_id === 'object' ? v.product_id.id : v.product_id)
    );
    return v.product_title || prod?.title || t('products.product', 'کالا');
  };

  return (
    <div ref={containerRef} className={`w-full space-y-1 relative ${className}`} id={id}>
      {label && (
        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          {label}
          {required && <span className="text-rose-500 ms-1">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3 py-2 bg-white dark:bg-[#181a20] border text-start rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs ${
          error
            ? 'border-rose-500 ring-1 ring-rose-500'
            : isOpen
            ? 'border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-neutral-200/90 dark:border-neutral-700/80 hover:border-neutral-300 dark:hover:border-neutral-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-neutral-50 dark:bg-neutral-900' : ''}`}
      >
        {selectedVariant ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <ProductImage
              src={selectedVariant.image}
              fallbackText={selectedVariant.sku}
              containerClassName="w-8 h-8 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/60 shrink-0">
                  {selectedVariant.sku}
                </span>
                <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                  {getVariantDisplayTitle(selectedVariant)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {selectedVariant.color_name && selectedVariant.color_name !== '-' && (
                  <span>{selectedVariant.color_name}</span>
                )}
                {selectedVariant.color_name && selectedVariant.size_name && selectedVariant.size_name !== '-' && (
                  <span>•</span>
                )}
                {selectedVariant.size_name && selectedVariant.size_name !== '-' && (
                  <span className="font-mono font-semibold">{selectedVariant.size_name}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            {placeholder || t('inventory.selectOrSearchVariant', 'جستجو و انتخاب کالا یا تنوع (SKU)...')}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0 text-neutral-400">
          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hidden sm:inline-block px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50">
            {selectedVariant ? t('inventory.changeVariant', 'تغییر') : t('common.select', 'انتخاب')}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Popover / Dropdown Menu */}
      {isOpen && (
        <div
          onKeyDown={handleKeyDown}
          className="absolute z-50 start-0 end-0 mt-1.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search Header */}
          <div className="p-2.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 flex items-center gap-2">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t(
                'inventory.searchVariantPlaceholder',
                'جستجو با نام، SKU، بارکد، رنگ یا سایز...'
              )}
              className="w-full text-xs bg-transparent text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {filteredVariants.length === 0 ? (
              <div className="p-6 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center justify-center">
                <Package className="w-8 h-8 mb-2 stroke-1 text-neutral-300 dark:text-neutral-600" />
                <p className="text-xs font-medium">
                  {t('inventory.noVariantFound', 'هیچ کالایی با این مشخصات یافت نشد')}
                </p>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {t('common.clearFilter', 'پاک کردن جستجو')}
                  </button>
                )}
              </div>
            ) : (
              filteredVariants.map((v) => {
                const isSelected = selectedVariant?.id === v.id;
                const title = getVariantDisplayTitle(v);

                return (
                  <button
                    key={`search_variant_${v.id}`}
                    type="button"
                    onClick={() => {
                      onChange(v.id);
                      setIsOpen(false);
                    }}
                    className={`w-full p-2.5 text-start flex items-center justify-between gap-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/70 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'text-neutral-900 dark:text-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <ProductImage
                        src={v.image}
                        fallbackText={v.sku}
                        containerClassName="w-9 h-9 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-200/80 dark:border-indigo-800/60 shrink-0">
                            {v.sku}
                          </span>
                          <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                            {title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {v.color_name && v.color_name !== '-' && (
                            <span className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded text-[10px]">
                              {v.color_name}
                            </span>
                          )}
                          {v.size_name && v.size_name !== '-' && (
                            <span className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded font-mono font-semibold text-[10px]">
                              {v.size_name}
                            </span>
                          )}
                          {v.barcode && (
                            <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                              #{v.barcode}
                            </span>
                          )}
                          {v.stock_quantity !== undefined && (
                            <span className="text-neutral-500 text-[10px]">
                              {t('inventory.stockCol', 'موجودی')}:{' '}
                              <strong className="font-mono">
                                {isPersian ? toPersianDigits(v.stock_quantity) : v.stock_quantity}
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Stats */}
          <div className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900/60 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-500 flex items-center justify-between font-mono">
            <span>
              {isPersian
                ? `${toPersianDigits(filteredVariants.length)} کالا`
                : `${filteredVariants.length} items`}
            </span>
            <span className="text-[10px] text-neutral-400">
              ESC: {t('common.close', 'بستن')}
            </span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
};
