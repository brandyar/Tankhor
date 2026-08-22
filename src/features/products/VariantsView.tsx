import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { ProductVariant, Product, Color, Size } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { Search, Shirt, Barcode as BarcodeIcon, Tag, Trash2, Edit } from 'lucide-react';

export const VariantsView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
        const color = colors.find((c) => c.id === v.color_id);
        const size = sizes.find((s) => s.id === v.size_id);
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
          {formatCurrency(v.cost, activeOrganization?.currency, isPersian)}
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
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => handleDeleteVariant(v.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        />
      </Card>
    </div>
  );
};
