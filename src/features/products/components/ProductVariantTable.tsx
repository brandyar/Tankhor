import React, { useState } from 'react';
import { useTranslation } from '../../../i18n';
import { ProductVariant, Color, Size, Warehouse, WarehouseLocation } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { formatCurrency, toPersianDigits } from '../../../utils/formatters';
import { Shirt, Sliders, Trash2 } from 'lucide-react';

interface ProductVariantTableProps {
  productId?: string | number;
  variants: (Partial<ProductVariant> & { _tempId?: string })[];
  colors: Color[];
  sizes: Size[];
  warehouses: Warehouse[];
  selectedWarehouseId: number;
  setSelectedWarehouseId: (id: number) => void;
  locations: WarehouseLocation[];
  selectedLocationId: number | '';
  setSelectedLocationId: (id: number | '') => void;
  onUpdateVariantRow: (index: number, field: keyof ProductVariant, value: any) => void;
  onDeleteVariantRow: (index: number) => void;
  currency?: string;
  onApplyBulkValues: (price: number | '', cost: number | '', stock: number | '') => void;
}

export const ProductVariantTable: React.FC<ProductVariantTableProps> = ({
  productId,
  variants,
  colors,
  sizes,
  warehouses,
  selectedWarehouseId,
  setSelectedWarehouseId,
  locations,
  selectedLocationId,
  setSelectedLocationId,
  onUpdateVariantRow,
  onDeleteVariantRow,
  currency,
  onApplyBulkValues,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  // Bulk Edit Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState<number | ''>('');
  const [bulkCost, setBulkCost] = useState<number | ''>('');
  const [bulkStock, setBulkStock] = useState<number | ''>('');

  const totalVariants = variants.length;
  const totalStockSum = variants.reduce((acc, v) => acc + (Number(v.stock_quantity) || 0), 0);
  const avgPrice =
    totalVariants > 0
      ? variants.reduce((acc, v) => acc + (Number(v.price) || 0), 0) / totalVariants
      : 0;

  const handleApplyBulk = () => {
    onApplyBulkValues(bulkPrice, bulkCost, bulkStock);
    setIsBulkModalOpen(false);
    setBulkPrice('');
    setBulkCost('');
    setBulkStock('');
  };

  return (
    <>
      {/* Warehouse & Shelf Location Selector for Initial Stock */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-[#181a20] p-4 rounded-xl border border-slate-200 dark:border-neutral-800 mb-5">
        <Select
          label={t('products.initialWarehouseLabel')}
          value={selectedWarehouseId}
          onChange={(e) => {
            const whId = Number(e.target.value);
            setSelectedWarehouseId(whId);
            setSelectedLocationId('');
          }}
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        />
        <Select
          label={t('products.warehouseLocationLabel')}
          value={selectedLocationId}
          onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : '')}
          options={[
            { value: '', label: locations.length === 0 ? t('products.noLocationDefined') : t('products.selectLocationPlaceholder') },
            ...locations.map((loc) => ({
              value: loc.id,
              label: `${loc.name}${loc.code ? ` (${loc.code})` : ''}`,
            })),
          ]}
        />
      </div>

      {/* Table Header: Variants, prices and stock */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <Shirt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-neutral-100">
              {t('products.productVariantsAndStock')} ({isPersian ? toPersianDigits(variants.length) : variants.length} {t('products.variantUnit')})
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {t('products.variantsTableSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {variants.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsBulkModalOpen(true)}
              icon={<Sliders className="w-3.5 h-3.5" />}
            >
              {t('products.bulkEditPricesAndStock')}
            </Button>
          )}
        </div>
      </div>

      {/* Variants Editable Table */}
      {variants.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-[#181a20] rounded-2xl border-2 border-dashed border-slate-200 dark:border-neutral-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Shirt className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-neutral-200">
            {t('products.noVariantsSelectedForProduct')}
          </h4>
          <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
            {t('products.selectColorsAndSizesToGenerate')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-800">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 dark:bg-[#181a20] text-slate-700 dark:text-neutral-300 font-bold border-b border-slate-200 dark:border-neutral-800">
              <tr>
                <th className="py-3 px-3">{t('products.rowNum')}</th>
                <th className="py-3 px-2 text-center">{t('products.variantRowImage')}</th>
                <th className="py-3 px-3">{t('products.variantRowColor')}</th>
                <th className="py-3 px-3">{t('products.variantRowSize')}</th>
                <th className="py-3 px-3 min-w-[130px]">{t('products.variantRowSku')}</th>
                <th className="py-3 px-3 min-w-[120px]">{t('products.variantRowBarcode')}</th>
                <th className="py-3 px-3 min-w-[130px]">
                  {`${t('products.variantRowPrice')} (${currency === 'TOMAN' ? (isPersian ? 'تومان' : 'Toman') : (isPersian ? 'ریال' : 'Rial')})`}
                </th>
                <th className="py-3 px-3 min-w-[120px]">{t('products.variantRowCost')}</th>
                <th className="py-3 px-3 min-w-[110px]">{t('products.variantRowStock')}</th>
                <th className="py-3 px-3">{t('common.status')}</th>
                <th className="py-3 px-3 text-center">{t('common.delete')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-[#13151a]">
              {variants.map((v, index) => (
                <tr
                  key={`pe_vrow_${v.id || v._tempId || 'idx'}_${index}`}
                  className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <td className="py-2.5 px-3 font-bold text-slate-400">
                    {isPersian ? toPersianDigits(index + 1) : index + 1}
                  </td>

                  {/* Variant Image */}
                  <td className="py-2.5 px-2 text-center">
                    <ImageUpload
                      mode="compact"
                      value={v.image || ''}
                      onChange={(newImg) => onUpdateVariantRow(index, 'image', newImg)}
                      productId={productId ? Number(productId) : undefined}
                    />
                  </td>

                  {/* Color Select */}
                  <td className="py-2.5 px-3">
                    <select
                      value={typeof v.color_id === 'object' ? (v.color_id as any)?.id || '' : v.color_id || ''}
                      onChange={(e) => onUpdateVariantRow(index, 'color_id', e.target.value ? Number(e.target.value) : undefined)}
                      className="bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="">{t('products.noColor')}</option>
                      {colors.map((c, cIdx) => (
                        <option key={`pe_c_opt_${c.id}_${cIdx}`} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Size Select */}
                  <td className="py-2.5 px-3">
                    <select
                      value={typeof v.size_id === 'object' ? (v.size_id as any)?.id || '' : v.size_id || ''}
                      onChange={(e) => onUpdateVariantRow(index, 'size_id', e.target.value ? Number(e.target.value) : undefined)}
                      className="bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="">{t('products.noSize')}</option>
                      {sizes.map((s, sIdx) => (
                        <option key={`pe_s_opt_${s.id}_${sIdx}`} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* SKU Input */}
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={v.sku || ''}
                      onChange={(e) => onUpdateVariantRow(index, 'sku', e.target.value)}
                      placeholder="SKU-1001"
                      className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-900 dark:text-neutral-100 text-xs px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>

                  {/* Barcode Input */}
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={v.barcode || ''}
                      onChange={(e) => onUpdateVariantRow(index, 'barcode', e.target.value)}
                      placeholder="62600000000"
                      className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-900 dark:text-neutral-100 text-xs px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>

                  {/* Price Input */}
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={v.price !== undefined ? v.price : ''}
                      onChange={(e) => onUpdateVariantRow(index, 'price', e.target.value !== '' ? Number(e.target.value) : 0)}
                      placeholder="0"
                      className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-900 dark:text-neutral-100 text-xs px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>

                  {/* Cost Input */}
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={v.cost !== undefined ? v.cost : ''}
                      onChange={(e) => onUpdateVariantRow(index, 'cost', e.target.value !== '' ? Number(e.target.value) : 0)}
                      placeholder="0"
                      className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-700 dark:text-neutral-200 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>

                  {/* Stock Input */}
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={v.stock_quantity !== undefined ? v.stock_quantity : ''}
                      onChange={(e) => onUpdateVariantRow(index, 'stock_quantity', e.target.value !== '' ? Number(e.target.value) : 0)}
                      placeholder="0"
                      className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-amber-950 dark:text-amber-200 font-extrabold text-xs px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3">
                    <select
                      value={v.status || 'published'}
                      onChange={(e) => onUpdateVariantRow(index, 'status', e.target.value)}
                      className="bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-100 text-[11px] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="published">{t('common.active')}</option>
                      <option value="draft">{t('common.inactive')}</option>
                    </select>
                  </td>

                  {/* Action Delete */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteVariantRow(index)}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-colors"
                      title={t('products.deleteVariantRow')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Table Footer Summary */}
          <div className="bg-slate-100 dark:bg-[#181a20] p-3.5 border-t border-slate-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs font-bold text-slate-800 dark:text-neutral-200 gap-3">
            <div className="flex items-center gap-4">
              <span>{t('products.totalVariantsCount')} {isPersian ? toPersianDigits(totalVariants) : totalVariants} SKU</span>
              <span className="text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg">
                {t('products.totalWarehouseStock')} {isPersian ? toPersianDigits(totalStockSum) : totalStockSum} {t('products.unitItems')}
              </span>
            </div>
            <div>
              {t('products.averageSellingPrice')} {formatCurrency(avgPrice, currency, isPersian)}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Price / Stock Applicator Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>{t('products.bulkModalTitle')}</span>
          </div>
        }
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsBulkModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleApplyBulk}>
              {t('products.applyToAllVariants')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {isPersian
              ? `مقادیر وارد شده به تمامی ${toPersianDigits(totalVariants)} واریانت جدول اعمال خواهد شد (هرکدام را که نمی‌خواهید خالی بگذارید).`
              : `Entered values will be applied to all ${totalVariants} variants in the table (leave empty to keep unchanged).`}
          </p>

          <div className="space-y-3">
            <Input
              label={t('products.bulkSellingPriceLabel')}
              type="number"
              placeholder="مثال: 450000"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <Input
              label={t('products.bulkCostPriceLabel')}
              type="number"
              placeholder="مثال: 300000"
              value={bulkCost}
              onChange={(e) => setBulkCost(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <Input
              label={t('products.bulkStockLabel')}
              type="number"
              placeholder="مثال: 10"
              value={bulkStock}
              onChange={(e) => setBulkStock(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>
      </Modal>
    </>
  );
};
