import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Product, ProductVariant, Color, Size, InventoryItem } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ProductImage } from '../../components/ui/ProductImage';
import { formatCurrency, toPersianDigits, normalizeId } from '../../utils/formatters';
import { directusClient } from '../../api/directus';
import { Shirt, Layers, Edit, CheckCircle, AlertCircle, Barcode, Tag } from 'lucide-react';

interface ProductVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  colors: Color[];
  sizes: Size[];
  onEditProduct?: (product: Product) => void;
}

export const ProductVariantsModal: React.FC<ProductVariantsModalProps> = ({
  isOpen,
  onClose,
  product,
  colors,
  sizes,
  onEditProduct,
}) => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isPersian = locale === 'fa';

  useEffect(() => {
    if (isOpen && product) {
      loadVariantsData();
    }
  }, [isOpen, product]);

  const loadVariantsData = async () => {
    if (!product) return;
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;

      const [vList, iList] = await Promise.all([
        adapter.getVariantsByProductId(product.id),
        adapter.getInventoryItems({ organization_id: orgId }),
      ]);

      setVariants(vList);
      setInventoryItems(iList);
    } catch (err) {
      console.error('[ProductVariantsModal] Error loading variants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) return null;

  const totalStockSum = variants.reduce((acc, v) => {
    const vNormId = normalizeId(v.id);
    const vStock = inventoryItems
      .filter((i) => {
        const vId = normalizeId(i.variant_id);
        return vId === vNormId;
      })
      .reduce((s, curr) => s + (Number(curr.quantity) || 0), 0);
    return acc + vStock;
  }, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('products.variantsOf')}: ${product.title}`}
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700 rounded-xl">
          <div className="flex items-center gap-3">
            <ProductImage
              src={product.main_image}
              alt={product.title}
              fallbackText={product.title}
              containerClassName="w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700 shadow-2xs"
            />
            <div>
              <h4 className="font-bold text-slate-900 dark:text-neutral-100 text-sm flex items-center gap-2">
                <span>{product.title}</span>
                <Badge variant={product.status === 'published' ? 'success' : 'warning'}>
                  {product.status === 'published' ? t('products.statusPublished') : t('products.statusDraft')}
                </Badge>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('products.brand')}: <span className="font-semibold text-slate-700 dark:text-neutral-300">{typeof product.brand === 'object' ? (product.brand as any)?.name : product.brand || t('products.defaultBrand')}</span> | Slug: {product.slug || '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-left font-mono">
              <span className="text-xs text-slate-500 block">{t('products.skuCount')}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-neutral-100">{isPersian ? toPersianDigits(variants.length) : variants.length} {t('products.variantUnit')}</span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-neutral-700" />
            <div className="text-left font-mono">
              <span className="text-xs text-slate-500 block">{t('products.inventoryStock')}</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{isPersian ? toPersianDigits(totalStockSum) : totalStockSum} {t('products.unitItems')}</span>
            </div>
            {onEditProduct && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onEditProduct(product);
                }}
                icon={<Edit className="w-3.5 h-3.5" />}
                className="ms-2"
              >
                {t('products.editProduct')}
              </Button>
            )}
          </div>
        </div>

        {/* Variants List Table */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-500 text-xs font-medium">
            {t('products.loadingVariants')}
          </div>
        ) : variants.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 dark:bg-neutral-900/30 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 space-y-3">
            <Layers className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700 dark:text-neutral-300">{t('products.noVariantsRegistered')}</p>
            {onEditProduct && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onEditProduct(product);
                }}
                icon={<Edit className="w-3.5 h-3.5" />}
              >
                {t('products.createVariantsInEdit')}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-700">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 font-bold border-b border-slate-200 dark:border-neutral-700">
                <tr>
                  <th className="px-2 py-2.5 text-center">{t('products.image')}</th>
                  <th className="px-3 py-2.5">{t('products.variantColor')}</th>
                  <th className="px-3 py-2.5">{t('products.variantSize')}</th>
                  <th className="px-3 py-2.5">{t('products.variantSku')}</th>
                  <th className="px-3 py-2.5">{t('products.variantBarcode')}</th>
                  <th className="px-3 py-2.5">{t('products.sellingPrice')}</th>
                  <th className="px-3 py-2.5">{t('products.costPrice')}</th>
                  <th className="px-3 py-2.5">{t('products.inventoryStock')}</th>
                  <th className="px-3 py-2.5">{t('products.productStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 bg-white dark:bg-[#14161d]">
                {variants.map((v, index) => {
                  const vNormId = normalizeId(v.id);
                  const colorObj = colors.find((c) => c.id === normalizeId(v.color_id));
                  const sizeObj = sizes.find((s) => s.id === normalizeId(v.size_id));

                  const stockQty = inventoryItems
                    .filter((i) => {
                      const vId = normalizeId(i.variant_id);
                      return vId === vNormId;
                    })
                    .reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

                  return (
                    <tr key={`pvm_var_${v.id || 'temp'}_${index}`} className="hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="px-2 py-2 text-center">
                        <ProductImage
                          src={v.image || product.main_image}
                          alt={v.sku}
                          containerClassName="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-neutral-700 mx-auto"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-neutral-100">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: colorObj?.hex || '#000' }}
                          />
                          <span>{colorObj?.name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-bold font-mono text-slate-800 dark:text-neutral-200">
                        {sizeObj?.name || '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-neutral-400 text-[11px]">
                        {v.sku || '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-neutral-400 text-[11px]">
                        {v.barcode || '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-neutral-100">
                        {v.price ? formatCurrency(v.price, activeOrganization?.currency, isPersian) : '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-neutral-400">
                        {(v.cost !== undefined || (v as any).cost_price !== undefined) ? formatCurrency(v.cost ?? (v as any).cost_price, activeOrganization?.currency, isPersian) : '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                          stockQty > 0
                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                        }`}>
                          {isPersian ? toPersianDigits(stockQty) : stockQty} {t('products.unitItems')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {stockQty > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>{t('products.inStock')}</span>
                          </span>
                        ) : (
                          <span className="text-rose-500 dark:text-rose-400 font-semibold text-[11px] inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{t('products.outOfStock')}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-neutral-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
