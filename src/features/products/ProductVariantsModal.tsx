import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Product, ProductVariant, Color, Size, InventoryItem } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
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
      title={`تنوع‌های کالا: ${product.title}`}
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-3">
            {product.main_image ? (
              <img
                src={directusClient.getAssetUrl(product.main_image)}
                alt={product.title}
                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 bg-neutral-900 text-white rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
                {product.title[0]}
              </div>
            )}
            <div>
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>{product.title}</span>
                <Badge variant={product.status === 'published' ? 'success' : 'warning'}>
                  {product.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}
                </Badge>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                برند: <span className="font-semibold text-slate-700">{product.brand || 'تن‌خور'}</span> | کد اسلاگ: {product.slug || '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-left font-mono">
              <span className="text-xs text-slate-500 block">تعداد SKU</span>
              <span className="text-sm font-bold text-slate-900">{toPersianDigits(variants.length)} تنوع</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-left font-mono">
              <span className="text-xs text-slate-500 block">موجودی انبار</span>
              <span className="text-sm font-bold text-amber-700">{toPersianDigits(totalStockSum)} عدد</span>
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
                ویرایش محصول
              </Button>
            )}
          </div>
        </div>

        {/* Variants List Table */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-500 text-xs font-medium">
            در حال بارگذاری لیست تنوع‌ها...
          </div>
        ) : variants.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 space-y-3">
            <Layers className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">هیچ تنوعی (رنگ و سایز) برای این محصول ثبت نشده است.</p>
            {onEditProduct && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onEditProduct(product);
                }}
                icon={<Edit className="w-3.5 h-3.5" />}
              >
                ایجاد تنوع در صفحه ویرایش
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">رنگ</th>
                  <th className="px-3 py-2.5">سایز</th>
                  <th className="px-3 py-2.5">کد SKU</th>
                  <th className="px-3 py-2.5">بارکد</th>
                  <th className="px-3 py-2.5">قیمت فروش</th>
                  <th className="px-3 py-2.5">قیمت خرید</th>
                  <th className="px-3 py-2.5">موجودی انبار</th>
                  <th className="px-3 py-2.5">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
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
                    <tr key={`pvm_var_${v.id || 'temp'}_${index}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: colorObj?.hex || '#000' }}
                          />
                          <span>{colorObj?.name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-bold font-mono text-slate-800">
                        {sizeObj?.name || '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px]">
                        {v.sku || '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-500 text-[11px]">
                        {v.barcode || '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                        {v.price ? formatCurrency(v.price, 'TOMAN', isPersian) : '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">
                        {v.cost_price ? formatCurrency(v.cost_price, 'TOMAN', isPersian) : '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                          stockQty > 0
                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {toPersianDigits(stockQty)} عدد
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {stockQty > 0 ? (
                          <span className="text-emerald-600 font-semibold text-[11px] inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>موجود</span>
                          </span>
                        ) : (
                          <span className="text-rose-500 font-semibold text-[11px] inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>ناموجود</span>
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

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            بستن
          </Button>
        </div>
      </div>
    </Modal>
  );
};
