import React from 'react';
import { useTranslation } from '../../../i18n';
import { Color, Size } from '../../../types';
import { toPersianDigits } from '../../../utils/formatters';
import { Sparkles, Palette, Ruler, Search, X, Check, Plus } from 'lucide-react';

interface ProductVariantMatrixSelectorProps {
  colors: Color[];
  sizes: Size[];
  selectedColorIds: number[];
  selectedSizeIds: number[];
  colorSearchQuery: string;
  setColorSearchQuery: (q: string) => void;
  sizeSearchQuery: string;
  setSizeSearchQuery: (q: string) => void;
  onToggleColor: (colorId: number) => void;
  onToggleSize: (sizeId: number) => void;
  onSelectAllColors: () => void;
  onDeselectAllColors: () => void;
  onSelectAllSizes: () => void;
  onDeselectAllSizes: () => void;
  onOpenAddColor: (initialName?: string) => void;
  onOpenAddSize: (initialName?: string) => void;
}

export const ProductVariantMatrixSelector: React.FC<ProductVariantMatrixSelectorProps> = ({
  colors,
  sizes,
  selectedColorIds,
  selectedSizeIds,
  colorSearchQuery,
  setColorSearchQuery,
  sizeSearchQuery,
  setSizeSearchQuery,
  onToggleColor,
  onToggleSize,
  onSelectAllColors,
  onDeselectAllColors,
  onSelectAllSizes,
  onDeselectAllSizes,
  onOpenAddColor,
  onOpenAddSize,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  const filteredColors = colors.filter(
    (c) =>
      !colorSearchQuery.trim() ||
      c.name.toLowerCase().includes(colorSearchQuery.toLowerCase()) ||
      (c.hex && c.hex.toLowerCase().includes(colorSearchQuery.toLowerCase()))
  );

  const filteredSizes = sizes.filter(
    (s) =>
      !sizeSearchQuery.trim() ||
      s.name.toLowerCase().includes(sizeSearchQuery.toLowerCase())
  );

  const totalCombinations =
    selectedColorIds.length > 0 && selectedSizeIds.length > 0
      ? selectedColorIds.length * selectedSizeIds.length
      : selectedColorIds.length + selectedSizeIds.length;

  return (
    <div className="bg-[#fafafa] dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 sm:p-5 mb-6 space-y-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/60 dark:border-neutral-800 pb-3">
        <div>
          <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{t('products.selectColorAndSizesTitle')}</span>
          </h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('products.selectColorAndSizesSubtitle')}
          </p>
        </div>

        {/* Dynamic Combination Counter Badge */}
        {(selectedColorIds.length > 0 || selectedSizeIds.length > 0) && (
          <div className="font-mono text-xs px-3 py-1 rounded-full bg-neutral-900 text-white font-medium flex items-center gap-1.5 self-start sm:self-auto shadow-xs">
            <span>{t('products.combinationsCount')}</span>
            <span className="font-bold text-amber-300">
              {isPersian ? toPersianDigits(totalCombinations) : totalCombinations} SKU
            </span>
          </div>
        )}
      </div>

      {/* Color Chips Selector */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
          <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            <span>
              {t('products.selectProductColors')} ({isPersian ? toPersianDigits(selectedColorIds.length) : selectedColorIds.length} {t('products.selectedOf')} {isPersian ? toPersianDigits(colors.length) : colors.length} {t('products.colorsSelected')})
            </span>
          </label>

          <div className="flex items-center gap-2">
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('products.searchColorPlaceholder')}
                value={colorSearchQuery}
                onChange={(e) => setColorSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs pr-8 pl-6 py-1 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              {colorSearchQuery && (
                <button
                  type="button"
                  onClick={() => setColorSearchQuery('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
              <button
                type="button"
                onClick={onSelectAllColors}
                className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:underline cursor-pointer"
              >
                {t('products.selectAll')}
              </button>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <button
                type="button"
                onClick={onDeselectAllColors}
                className="text-neutral-500 hover:text-red-600 hover:underline cursor-pointer"
              >
                {t('products.deselectAll')}
              </button>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <button
                type="button"
                onClick={() => onOpenAddColor()}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{t('products.newBadge')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Container for Color Chips */}
        <div className="max-h-36 overflow-y-auto p-2 bg-neutral-50/60 dark:bg-neutral-900/50 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
          {filteredColors.length === 0 ? (
            <div className="text-center py-3 text-xs text-neutral-500">
              <span>{t('products.noColorFound')}</span>
              <button
                type="button"
                onClick={() => onOpenAddColor(colorSearchQuery)}
                className="ms-2 text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                {t('products.addThisColor')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filteredColors.map((color, idx) => {
                const isSelected = selectedColorIds.includes(color.id);
                return (
                  <button
                    key={`color_${color.id}_${idx}`}
                    type="button"
                    onClick={() => onToggleColor(color.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs ring-1 ring-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100'
                        : 'bg-white dark:bg-[#181a20] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/20 shrink-0 shadow-2xs"
                      style={{ backgroundColor: color.hex || '#000000' }}
                    />
                    <span>{color.name}</span>
                    {isSelected && <Check className="w-3 h-3 ms-0.5 shrink-0 text-amber-300 dark:text-amber-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Size Chips Selector */}
      <div className="space-y-2 pt-3 border-t border-neutral-200/60 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
          <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            <span>
              {t('products.selectProductSizes')} ({isPersian ? toPersianDigits(selectedSizeIds.length) : selectedSizeIds.length} {t('products.selectedOf')} {isPersian ? toPersianDigits(sizes.length) : sizes.length} {t('products.sizesSelected')})
            </span>
          </label>

          <div className="flex items-center gap-2">
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('products.searchSizePlaceholder')}
                value={sizeSearchQuery}
                onChange={(e) => setSizeSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs pr-8 pl-6 py-1 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              {sizeSearchQuery && (
                <button
                  type="button"
                  onClick={() => setSizeSearchQuery('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
              <button
                type="button"
                onClick={onSelectAllSizes}
                className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:underline cursor-pointer"
              >
                {t('products.selectAll')}
              </button>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <button
                type="button"
                onClick={onDeselectAllSizes}
                className="text-neutral-500 hover:text-red-600 hover:underline cursor-pointer"
              >
                {t('products.deselectAll')}
              </button>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <button
                type="button"
                onClick={() => onOpenAddSize()}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{t('products.newBadge')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Container for Size Chips */}
        <div className="max-h-36 overflow-y-auto p-2 bg-neutral-50/60 dark:bg-neutral-900/50 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
          {filteredSizes.length === 0 ? (
            <div className="text-center py-3 text-xs text-neutral-500">
              <span>{t('products.noSizeFound')}</span>
              <button
                type="button"
                onClick={() => onOpenAddSize(sizeSearchQuery)}
                className="ms-2 text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                {t('products.addThisSize')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filteredSizes.map((size, idx) => {
                const isSelected = selectedSizeIds.includes(size.id);
                return (
                  <button
                    key={`size_${size.id}_${idx}`}
                    type="button"
                    onClick={() => onToggleSize(size.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs ring-1 ring-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100'
                        : 'bg-white dark:bg-[#181a20] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{size.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-amber-300 dark:text-amber-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
