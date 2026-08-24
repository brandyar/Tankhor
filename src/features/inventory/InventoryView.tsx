import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { InventoryItem, ProductVariant, Warehouse, WarehouseLocation } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { toPersianDigits, formatCurrency } from '../../utils/formatters';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { Package, Warehouse as WarehouseIcon, AlertTriangle, RefreshCw, Plus, Search, Layers, ShieldAlert, Barcode as BarcodeIcon } from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);

  const [search, setSearch] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<number | ''>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Adjustment Modal
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);

  const isPersian = locale === 'fa';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;

      const [items, vList, wList, locList] = await Promise.all([
        adapter.getInventoryItems({
          organization_id: orgId,
          warehouse_id: selectedWarehouseFilter ? Number(selectedWarehouseFilter) : undefined,
        }).catch((err) => {
          console.warn('[InventoryView] Failed to fetch inventory items:', err);
          return [];
        }),
        adapter.getVariants({ organization_id: orgId }).catch(() => []),
        adapter.getWarehouses({ organization_id: orgId }).catch(() => []),
        adapter.getWarehouseLocations(
          selectedWarehouseFilter ? { warehouse_id: Number(selectedWarehouseFilter) } : undefined
        ).catch(() => []),
      ]);

      let filtered = items;

      if (lowStockOnly) {
        filtered = filtered.filter(
          (i) => i.quantity <= (i.reorder_point || 5) || i.quantity <= (i.safety_stock || 2)
        );
      }

      if (search.trim()) {
        const term = search.toLowerCase();
        filtered = filtered.filter((i) => {
          const vId = typeof i.variant_id === 'number' ? i.variant_id : (i.variant_id as any)?.id;
          const v = vList.find((varObj) => varObj.id === vId);
          return (
            (v && v.sku && v.sku.toLowerCase().includes(term)) ||
            (v && v.product_title && v.product_title.toLowerCase().includes(term)) ||
            (v && v.barcode && v.barcode.includes(term)) ||
            (i.sku && i.sku.toLowerCase().includes(term)) ||
            (i.product_title && i.product_title.toLowerCase().includes(term))
          );
        });
      }

      setInventoryItems(filtered);
      setVariants(vList);
      setWarehouses(wList);
      setLocations(locList);
    } catch (err) {
      console.error('[InventoryView] Error loading inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization, selectedWarehouseFilter, lowStockOnly, search]);

  // Calculations for KPI Cards
  const totalQuantity = inventoryItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalAvailable = inventoryItems.reduce((acc, curr) => acc + (Number(curr.available_quantity) || Number(curr.quantity) || 0), 0);
  const totalReserved = inventoryItems.reduce((acc, curr) => acc + (Number(curr.reserved_quantity) || 0), 0);
  const totalDamaged = inventoryItems.reduce((acc, curr) => acc + (Number(curr.damaged_quantity) || 0), 0);
  const lowStockCount = inventoryItems.filter(
    (i) => (Number(i.quantity) || 0) <= (i.reorder_point || 5) || (Number(i.quantity) || 0) <= (i.safety_stock || 2)
  ).length;

  const columns: Column<InventoryItem>[] = [
    {
      key: 'variant_id',
      header: 'شناسه و عنوان کالا (SKU)',
      render: (item) => {
        const vId = typeof item.variant_id === 'number' ? item.variant_id : (item.variant_id as any)?.id;
        const v = variants.find((varObj) => varObj.id === vId);
        const sku = item.sku || v?.sku || (vId ? `VAR-#${vId}` : '-');
        const prodTitle = item.product_title || v?.product_title || 'محصول';
        const colorName = item.color_name || v?.color_name || '-';
        const sizeName = item.size_name || v?.size_name || '-';

        return (
          <div>
            <p className="font-extrabold text-slate-900 font-mono text-xs">{sku}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {prodTitle} ({colorName} / {sizeName})
            </p>
          </div>
        );
      },
    },
    {
      key: 'warehouse_id',
      header: 'انبار و جایگاه',
      render: (item) => {
        const wId = typeof item.warehouse_id === 'number' ? item.warehouse_id : (item.warehouse_id as any)?.id;
        const locId = typeof item.location_id === 'number' ? item.location_id : (item.location_id as any)?.id;
        const wh = warehouses.find((w) => w.id === wId);
        const loc = locations.find((l) => l.id === locId);
        const whName = item.warehouse_name || wh?.name || 'انبار مرکزی';
        const locName = item.location_name || loc?.name;

        return (
          <div>
            <p className="font-bold text-slate-800 text-xs">{whName}</p>
            {locName && locName !== '-' && (
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                قفسه: {locName}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'quantity',
      header: 'موجودی کل کل',
      render: (item) => (
        <span className="font-extrabold text-slate-900 text-sm">
          {toPersianDigits(item.quantity)} عدد
        </span>
      ),
    },
    {
      key: 'available_quantity',
      header: 'موجودی قابل فروش',
      render: (item) => (
        <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs">
          {toPersianDigits(item.available_quantity ?? item.quantity)} عدد
        </span>
      ),
    },
    {
      key: 'reserved_quantity',
      header: 'رزرو در سفارشات',
      render: (item) => (
        <span className="text-slate-500 font-medium text-xs">
          {toPersianDigits(item.reserved_quantity || 0)} عدد
        </span>
      ),
    },
    {
      key: 'damaged_quantity',
      header: 'ضایعات / آسیب‌دیده',
      render: (item) => (
        <span className={`text-xs font-bold ${item.damaged_quantity > 0 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-slate-400'}`}>
          {toPersianDigits(item.damaged_quantity || 0)} عدد
        </span>
      ),
    },
    {
      key: 'status_alert',
      header: 'وضعیت هشدار',
      render: (item) => {
        const isLow = item.quantity <= (item.reorder_point || 5);
        const isCritical = item.quantity <= (item.safety_stock || 2);

        if (isCritical) {
          return <Badge variant="danger">بحرانی / ذخیره اطمینان</Badge>;
        }
        if (isLow) {
          return <Badge variant="warning">نیازمند نقطه سفارش</Badge>;
        }
        return <Badge variant="success">کافی</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('navigation.inventory')}
        subtitle="مدیریت موجودی فیزیکی انبارها، موجودی قابل فروش، رزرو سفارشات و نقطه سفارش مجدد"
        action={
          <Button
            onClick={() => setIsAdjustmentModalOpen(true)}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            ثبت ورود/خروج و اصلاح موجودی
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="caption-mono">موجودی فیزیکی کل</p>
            <Package className="w-4 h-4 text-neutral-500" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 tracking-tight font-mono mt-2">
            {toPersianDigits(totalQuantity)} <span className="text-xs font-mono font-normal text-neutral-400">عدد</span>
          </p>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="caption-mono">موجودی قابل فروش</p>
            <Package className="w-4 h-4 text-neutral-500" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 tracking-tight font-mono mt-2">
            {toPersianDigits(totalAvailable)} <span className="text-xs font-mono font-normal text-neutral-400">عدد</span>
          </p>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="caption-mono">رزرو سفارشات</p>
            <RefreshCw className="w-4 h-4 text-neutral-500" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 tracking-tight font-mono mt-2">
            {toPersianDigits(totalReserved)} <span className="text-xs font-mono font-normal text-neutral-400">عدد</span>
          </p>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="caption-mono">ضایعات / مرجوعی</p>
            <AlertTriangle className="w-4 h-4 text-neutral-500" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 tracking-tight font-mono mt-2">
            {toPersianDigits(totalDamaged)} <span className="text-xs font-mono font-normal text-neutral-400">عدد</span>
          </p>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow bg-amber-50/20 border-amber-200/80">
          <div className="flex items-center justify-between">
            <p className="caption-mono text-amber-800">هشدار کسری موجودی</p>
            <ShieldAlert className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-2xl font-extrabold text-amber-900 tracking-tight font-mono mt-2">
            {toPersianDigits(lowStockCount)} <span className="text-xs font-mono font-normal text-amber-700">کالا</span>
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="جستجو با SKU، نام کالا یا بارکد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value ? Number(e.target.value) : '')}
              className="bg-white border border-slate-300 rounded-xl text-slate-800 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">همه انبارها</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                lowStockOnly
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              فقط کالاهای کم‌موجودی ({toPersianDigits(lowStockCount)})
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={inventoryItems}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
        />
      </Card>

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        variants={variants}
        warehouses={warehouses}
        locations={locations}
        onAdjustmentComplete={loadData}
      />
    </div>
  );
};
