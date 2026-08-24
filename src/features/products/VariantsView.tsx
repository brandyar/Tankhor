import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { ProductVariant, Product, Color, Size } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { Search, Shirt, Barcode as BarcodeIcon, Tag, Trash2, Edit, Save, Plus } from 'lucide-react';

export const VariantsView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Edit Variant Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editCost, setEditCost] = useState<number | ''>('');
  const [editStock, setEditStock] = useState<number | ''>('');
  const [editColorId, setEditColorId] = useState<number | ''>('');
  const [editSizeId, setEditSizeId] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  const isPersian = locale === 'fa';

  const loadVariants = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [vList, cList, sList] = await Promise.all([
        adapter.getVariants({ organization_id: orgId }),
        adapter.getColors({ organization_id: orgId }),
        adapter.getSizes({ organization_id: orgId }),
      ]);

      let filtered = vList;
      if (search.trim()) {
        const term = search.toLowerCase();
        filtered = vList.filter(
          (v) =>
            v.sku.toLowerCase().includes(term) ||
            (v.barcode && v.barcode.includes(term)) ||
            (v.product_title && v.product_title.toLowerCase().includes(term))
        );
      }

      setVariants(filtered);
      setColors(cList);
      setSizes(sList);
    } catch (err) {
      console.error('[VariantsView] Error loading variants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVariants();
  }, [activeOrganization, search]);

  const handleOpenEdit = (v: ProductVariant) => {
    setEditingVariant(v);
    setEditSku(v.sku || '');
    setEditBarcode(v.barcode || '');
    setEditPrice(v.price !== undefined ? v.price : '');
    setEditCost(v.cost !== undefined ? v.cost : ((v as any).cost_price !== undefined ? (v as any).cost_price : ''));
    setEditStock(v.stock_quantity !== undefined ? v.stock_quantity : '');
    const cId = typeof v.color_id === 'number' ? v.color_id : (v.color_id as any)?.id || '';
    const sId = typeof v.size_id === 'number' ? v.size_id : (v.size_id as any)?.id || '';
    setEditColorId(cId);
    setEditSizeId(sId);
    setIsEditModalOpen(true);
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariant) return;
    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      await adapter.saveVariant({
        id: editingVariant.id,
        organization_id: editingVariant.organization_id || activeOrganization?.id || 1,
        product_id: editingVariant.product_id,
        sku: editSku.trim() || editingVariant.sku,
        barcode: editBarcode.trim(),
        price: editPrice !== '' ? Number(editPrice) : 0,
        cost: editCost !== '' ? Number(editCost) : 0,
        stock_quantity: editStock !== '' ? Number(editStock) : 0,
        color_id: editColorId ? Number(editColorId) : undefined,
        size_id: editSizeId ? Number(editSizeId) : undefined,
      });

      setIsEditModalOpen(false);
      await loadVariants();
    } catch (err) {
      console.error('[VariantsView] Error saving variant:', err);
      alert('خطا در ذخیره‌سازی تنوع کالا');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVariant = async (id: number) => {
    if (confirm(t('common.confirmDeleteMessage'))) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteVariant(id);
      await loadVariants();
    }
  };

  const columns: Column<ProductVariant>[] = [
    {
      key: 'sku',
      header: 'شناسه اختصاصی کالا (SKU)',
      render: (v) => (
        <div>
          <p className="font-extrabold text-neutral-900 font-mono text-xs tracking-wider">{v.sku}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">{v.product_title}</p>
        </div>
      ),
    },
    {
      key: 'color_id',
      header: 'رنگ و سایز',
      render: (v) => {
        const color = colors.find((c) => c.id === (typeof v.color_id === 'number' ? v.color_id : (v.color_id as any)?.id));
        const size = sizes.find((s) => s.id === (typeof v.size_id === 'number' ? v.size_id : (v.size_id as any)?.id));
        return (
          <div className="flex items-center gap-2">
            {color && (
              <span
                className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-2xs"
                style={{ backgroundColor: color.hex || '#000000' }}
                title={color.name}
              />
            )}
            <span className="font-semibold text-neutral-900 text-xs">
              {v.color_name || color?.name || '-'} / {v.size_name || size?.name || '-'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'barcode',
      header: 'بارکد کالا',
      render: (v) => (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-neutral-600 bg-neutral-100/80 border border-neutral-200/80 px-2 py-0.5 rounded-md">
          <BarcodeIcon className="w-3 h-3 text-neutral-400" />
          {toPersianDigits(v.barcode || '-')}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'قیمت فروش',
      render: (v) => (
        <span className="font-extrabold text-slate-900">
          {formatCurrency(v.price, activeOrganization?.currency, isPersian)}
        </span>
      ),
    },
    {
      key: 'cost',
      header: 'بهای تمام شده',
      render: (v) => (
        <span className="text-slate-500 font-medium">
          {formatCurrency(v.cost !== undefined ? v.cost : (v as any).cost_price, activeOrganization?.currency, isPersian)}
        </span>
      ),
    },
    {
      key: 'stock_quantity',
      header: 'موجودی کل',
      render: (v) => (
        <Badge variant={(v.stock_quantity || 0) > 0 ? 'success' : 'danger'}>
          {toPersianDigits(v.stock_quantity || 0)} عدد
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('navigation.variants')}
        subtitle="مدیریت مستقیم تمام تنوع‌های کالا، بارکدها، قیمت فروش و بهای تمام شده"
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="جستجو با SKU، بارکد یا نام محصول..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={variants}
          keyExtractor={(v) => v.id}
          isLoading={isLoading}
          actions={(v) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                onClick={() => handleOpenEdit(v)}
                title="ویرایش تنوع"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDeleteVariant(v.id)}
                title="حذف تنوع"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        />
      </Card>

      {/* Edit Variant Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`ویرایش تنوع: ${editingVariant?.sku || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveVariant} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">شناسه کالا (SKU)</label>
              <Input
                value={editSku}
                onChange={(e) => setEditSku(e.target.value)}
                placeholder="SKU..."
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">بارکد</label>
              <Input
                value={editBarcode}
                onChange={(e) => setEditBarcode(e.target.value)}
                placeholder="کد میله‌ای یا EAN..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">رنگ</label>
              <Select
                value={editColorId}
                onChange={(e) => setEditColorId(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: 'بدون رنگ مشخص' },
                  ...colors.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">سایز</label>
              <Select
                value={editSizeId}
                onChange={(e) => setEditSizeId(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: 'بدون سایز مشخص' },
                  ...sizes.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">قیمت فروش (تومان)</label>
              <Input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value ? Number(e.target.value) : '')}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">بهای تمام شده (تومان)</label>
              <Input
                type="number"
                value={editCost}
                onChange={(e) => setEditCost(e.target.value ? Number(e.target.value) : '')}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">موجودی انبار (عدد)</label>
              <Input
                type="number"
                value={editStock}
                onChange={(e) => setEditStock(e.target.value ? Number(e.target.value) : '')}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving} icon={<Save className="w-4 h-4" />}>
              ذخیره تغییرات
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
