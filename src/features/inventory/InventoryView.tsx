import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { InventoryItem, ProductVariant, Warehouse, WarehouseLocation, Color } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { toPersianDigits, formatCurrency } from '../../utils/formatters';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { Modal } from '../../components/ui/Modal';
import { ProductImage } from '../../components/ui/ProductImage';
import { Package, Warehouse as WarehouseIcon, AlertTriangle, RefreshCw, Plus, Search, Layers, ShieldAlert, Barcode as BarcodeIcon, FileSpreadsheet, Download, Upload, SlidersHorizontal, MapPin } from 'lucide-react';
import { exportInventoryToExcel, parseInventoryFromExcel } from '../../utils/excelUtils';

export const InventoryView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);

  const [search, setSearch] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<number | ''>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Adjustment Modal
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);

  // Edit Thresholds Modal
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editReorderPoint, setEditReorderPoint] = useState<number>(5);
  const [editSafetyStock, setEditSafetyStock] = useState<number>(2);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  const isPersian = locale === 'fa';

  const getColorHex = (colorId?: number | Color | null, colorName?: string) => {
    const cId = typeof colorId === 'number' ? colorId : (colorId as any)?.id;
    if (cId) {
      const c = colors.find((item) => item.id === cId);
      if (c?.hex) return c.hex;
    }
    if (colorName && colorName !== '-') {
      const lower = colorName.trim().toLowerCase();
      const colorMap: Record<string, string> = {
        'مشکی': '#18181b',
        'سیاه': '#18181b',
        'black': '#18181b',
        'سفید': '#ffffff',
        'white': '#ffffff',
        'قرمز': '#ef4444',
        'red': '#ef4444',
        'آبی': '#3b82f6',
        'blue': '#3b82f6',
        'سبز': '#22c55e',
        'green': '#22c55e',
        'زرد': '#eab308',
        'yellow': '#eab308',
        'نارنجی': '#f97316',
        'orange': '#f97316',
        'طوسی': '#9ca3af',
        'خاکستری': '#6b7280',
        'grey': '#6b7280',
        'gray': '#6b7280',
        'سرمه‌ای': '#1e3a8a',
        'navy': '#1e3a8a',
        'قهوه‌ای': '#78350f',
        'brown': '#78350f',
        'کرم': '#fef08a',
        'بژ': '#d6d3d1',
        'beige': '#d6d3d1',
        'صورتی': '#ec4899',
        'pink': '#ec4899',
        'بنفش': '#a855f7',
        'purple': '#a855f7',
      };
      if (colorMap[lower]) return colorMap[lower];
    }
    return null;
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;

      const [items, vList, cList, wList, locList] = await Promise.all([
        adapter.getInventoryItems({
          organization_id: orgId,
          warehouse_id: selectedWarehouseFilter ? Number(selectedWarehouseFilter) : undefined,
        }).catch((err) => {
          console.warn('[InventoryView] Failed to fetch inventory items:', err);
          return [];
        }),
        adapter.getVariants({ organization_id: orgId }).catch(() => []),
        adapter.getColors({ organization_id: orgId }).catch(() => []),
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
      setColors(cList);
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
      header: t('inventory.skuAndTitle'),
      render: (item) => {
        const vId = typeof item.variant_id === 'number' ? item.variant_id : (item.variant_id as any)?.id;
        const v = variants.find((varObj) => varObj.id === vId);
        const sku = item.sku || v?.sku || (vId ? `VAR-#${vId}` : '-');
        const prodTitle = item.product_title || v?.product_title || t('products.product');
        const colorName = item.color_name || v?.color_name || '-';
        const sizeName = item.size_name || v?.size_name || '-';
        const colorHex = getColorHex(v?.color_id, colorName);

        return (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-slate-900 dark:text-neutral-100 font-mono text-xs whitespace-nowrap shrink-0">{sku}</span>
              {colorHex ? (
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-neutral-300 dark:border-neutral-600 inline-block shadow-2xs"
                  style={{ backgroundColor: colorHex }}
                  title={colorName !== '-' ? colorName : undefined}
                />
              ) : colorName !== '-' ? (
                <span className="text-[11px] text-slate-600 dark:text-neutral-300 font-medium">
                  {colorName}
                </span>
              ) : null}
              {sizeName !== '-' && (
                <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono font-semibold">
                  {sizeName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 max-w-sm leading-snug break-words" title={prodTitle}>
              {prodTitle}
            </p>
          </div>
        );
      },
    },
    {
      key: 'warehouse_id',
      header: t('inventory.warehouseAndLocation'),
      render: (item) => {
        const wId = typeof item.warehouse_id === 'number' ? item.warehouse_id : (item.warehouse_id as any)?.id;
        const locId = typeof item.location_id === 'number' ? item.location_id : (item.location_id as any)?.id;
        const wh = warehouses.find((w) => w.id === wId);
        const loc = locations.find((l) => l.id === locId);
        const whName = item.warehouse_name || wh?.name || t('inventory.allWarehouses');
        const locName = item.location_name || loc?.name;

        return (
          <div>
            <p className="font-bold text-slate-800 dark:text-neutral-100 text-xs">{whName}</p>
            {locName && locName !== '-' && (
              <p className="text-[10px] text-slate-400 dark:text-neutral-400 font-mono mt-0.5">
                {t('inventory.location')}: {locName}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'quantity',
      header: t('inventory.quantityOnHand'),
      render: (item) => (
        <span className="font-extrabold text-slate-900 dark:text-neutral-100 text-sm">
          {isPersian ? toPersianDigits(item.quantity) : item.quantity}
        </span>
      ),
    },
    {
      key: 'available_quantity',
      header: t('inventory.quantityAvailable'),
      render: (item) => (
        <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg text-xs">
          {isPersian ? toPersianDigits(item.available_quantity ?? item.quantity) : (item.available_quantity ?? item.quantity)}
        </span>
      ),
    },
    {
      key: 'reserved_quantity',
      header: t('inventory.quantityReserved'),
      render: (item) => (
        <span className="text-slate-500 dark:text-neutral-400 font-medium text-xs">
          {isPersian ? toPersianDigits(item.reserved_quantity || 0) : (item.reserved_quantity || 0)}
        </span>
      ),
    },
    {
      key: 'damaged_quantity',
      header: t('inventory.reasonDamage'),
      render: (item) => (
        <span className={`text-xs font-bold ${item.damaged_quantity > 0 ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded' : 'text-slate-400 dark:text-neutral-500'}`}>
          {isPersian ? toPersianDigits(item.damaged_quantity || 0) : (item.damaged_quantity || 0)}
        </span>
      ),
    },
    {
      key: 'status_alert',
      header: t('inventory.stockStatus'),
      render: (item) => {
        const qty = item.available_quantity ?? item.quantity ?? 0;
        const isOutOfStock = qty <= 0;
        const isLow = !isOutOfStock && (qty <= (item.safety_stock ?? 2) || qty <= (item.reorder_point ?? 5));

        if (isOutOfStock) {
          return <Badge variant="danger">{t('inventory.statusOutOfStock')}</Badge>;
        }
        if (isLow) {
          return <Badge variant="warning">{t('inventory.statusLowStock')}</Badge>;
        }
        return <Badge variant="success">{t('inventory.statusInStock')}</Badge>;
      },
    },
  ];

  const handleOpenThresholdModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditReorderPoint(item.reorder_point ?? 5);
    setEditSafetyStock(item.safety_stock ?? 2);
    setIsThresholdModalOpen(true);
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSavingThreshold(true);
    try {
      const adapter = storageManager.getAdapter();
      await adapter.saveInventoryItem({
        id: editingItem.id,
        reorder_point: Number(editReorderPoint) >= 0 ? Number(editReorderPoint) : 5,
        safety_stock: Number(editSafetyStock) >= 0 ? Number(editSafetyStock) : 2,
      });

      setIsThresholdModalOpen(false);
      setEditingItem(null);
      await loadData();
    } catch (err) {
      console.error('[InventoryView] Error updating inventory item thresholds:', err);
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportExcel = () => {
    exportInventoryToExcel(inventoryItems, variants, warehouses);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const res = parseInventoryFromExcel(buffer);
      if (!res.success) {
        alert(res.errors.join('\n') || 'خطا در خواندن فایل اکسل');
        return;
      }

      alert(`فایل اکسل موجودی انبار با موفقیت بررسی شد. ${res.importedCount} ردیف داده شناسایی گردید.`);
    } catch (err: any) {
      alert(`خطا در پردازش فایل اکسل: ${err?.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        action={
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500 dark:text-neutral-400" />}
            >
              <span className="hidden sm:inline">ورود اکسل</span>
              <span className="sm:hidden">ورود</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              icon={<FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />}
            >
              <span className="hidden sm:inline">خروجی اکسل</span>
              <span className="sm:hidden">خروجی</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAdjustmentModalOpen(true)}
              icon={<RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            >
              <span className="hidden sm:inline">{t('inventory.stockAdjustment')}</span>
              <span className="sm:hidden">تعدیل موجودی</span>
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="caption-mono text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">{t('inventory.quantityOnHand')}</p>
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500 dark:text-neutral-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight font-mono mt-1.5 sm:mt-2">
            {isPersian ? toPersianDigits(totalQuantity) : totalQuantity}
          </p>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="caption-mono text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">{t('inventory.quantityAvailable')}</p>
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500 dark:text-neutral-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight font-mono mt-1.5 sm:mt-2">
            {isPersian ? toPersianDigits(totalAvailable) : totalAvailable}
          </p>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="caption-mono text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">{t('inventory.quantityReserved')}</p>
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500 dark:text-neutral-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight font-mono mt-1.5 sm:mt-2">
            {isPersian ? toPersianDigits(totalReserved) : totalReserved}
          </p>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="caption-mono text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">{t('inventory.damagedQuantity', 'ضایعات و آسیب')}</p>
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500 dark:text-neutral-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight font-mono mt-1.5 sm:mt-2">
            {isPersian ? toPersianDigits(totalDamaged) : totalDamaged}
          </p>
        </Card>

        <Card className="hover:shadow-vercel-md transition-shadow bg-amber-50/20 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/50 col-span-2 sm:col-span-2 md:col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="caption-mono text-[11px] sm:text-xs text-amber-800 dark:text-amber-300">{t('inventory.statusLowStock')}</p>
            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 dark:text-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-900 dark:text-amber-200 tracking-tight font-mono mt-1.5 sm:mt-2">
            {isPersian ? toPersianDigits(lowStockCount) : lowStockCount}
          </p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <select
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value ? Number(e.target.value) : '')}
            className="flex-1 sm:flex-initial bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-neutral-100 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="">{t('inventory.allWarehouses')}</option>
            {warehouses.map((w, wIdx) => (
              <option key={`inv_wh_${w.id}_${wIdx}`} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
              lowStockOnly
                ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : 'bg-white dark:bg-neutral-800 border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-750'
            }`}
          >
            {t('inventory.statusLowStock')} ({isPersian ? toPersianDigits(lowStockCount) : lowStockCount})
          </button>
        </div>
      </div>

      {/* 1. Desktop Tabular View (md and above) */}
      <div className="hidden md:block bg-white dark:bg-[#13151a] border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl shadow-sm p-5 overflow-hidden">
        <DataTable
          columns={columns}
          data={inventoryItems}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          actions={(item) => (
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 transition-colors"
                onClick={() => handleOpenThresholdModal(item)}
                title={t('inventory.editThresholds')}
                icon={<SlidersHorizontal className="w-4 h-4" />}
              />
            </div>
          )}
        />
      </div>

      {/* 2. Mobile Clean Minimalist Card View (under md - Unboxed directly on viewport) */}
      <div className="block md:hidden">
        {isLoading ? (
          <div className="w-full py-12 flex flex-col items-center justify-center text-neutral-400">
            <div className="w-7 h-7 border-2 border-neutral-900 dark:border-neutral-100 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs font-mono text-neutral-500">{t('common.loadingData')}</span>
          </div>
        ) : inventoryItems.length === 0 ? (
          <div className="w-full py-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-900/40 p-6 text-center">
            <Package className="w-8 h-8 text-neutral-400 mb-2 stroke-1" />
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inventoryItems.map((item) => {
              const vId = typeof item.variant_id === 'number' ? item.variant_id : (item.variant_id as any)?.id;
              const v = variants.find((varObj) => varObj.id === vId);
              const sku = item.sku || v?.sku || (vId ? `VAR-#${vId}` : '-');
              const prodTitle = item.product_title || v?.product_title || t('products.product');
              const colorName = item.color_name || v?.color_name || '-';
              const sizeName = item.size_name || v?.size_name || '-';
              const colorHex = getColorHex(v?.color_id, colorName);

              const wId = typeof item.warehouse_id === 'number' ? item.warehouse_id : (item.warehouse_id as any)?.id;
              const locId = typeof item.location_id === 'number' ? item.location_id : (item.location_id as any)?.id;
              const wh = warehouses.find((w) => w.id === wId);
              const loc = locations.find((l) => l.id === locId);
              const whName = item.warehouse_name || wh?.name || t('inventory.allWarehouses');
              const locName = item.location_name || loc?.name;

              const qty = item.available_quantity ?? item.quantity ?? 0;
              const isOutOfStock = qty <= 0;
              const isLow = !isOutOfStock && (qty <= (item.safety_stock ?? 2) || qty <= (item.reorder_point ?? 5));

              return (
                <div
                  key={`mob_inv_${item.id}`}
                  className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#13151a] p-4 shadow-sm space-y-3.5 transition-all"
                >
                  {/* 1. Top Section: Title & Pills on Start, Large Thumbnail on End */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight"
                        title={prodTitle}
                      >
                        {prodTitle}
                      </h3>

                      <div className="flex items-center gap-2 flex-wrap mt-2.5">
                        {/* SKU Pill */}
                        <div className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-850/60 font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-2xs shrink-0">
                          {sku}
                        </div>

                        {/* Variant Specs Pill (Size | Color) */}
                        {(sizeName !== '-' || colorName !== '-' || colorHex) && (
                          <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-850/60 text-xs overflow-hidden shadow-2xs shrink-0">
                            {sizeName !== '-' && (
                              <span className="px-2.5 py-1 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                                {sizeName}
                              </span>
                            )}
                            {(colorName !== '-' || colorHex) && (
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 ${sizeName !== '-' ? 'border-s border-neutral-200 dark:border-neutral-700' : ''}`}>
                                {colorHex && (
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600 shadow-2xs inline-block shrink-0"
                                    style={{ backgroundColor: colorHex }}
                                  />
                                )}
                                {colorName !== '-' && (
                                  <span className="font-medium text-[11px] text-neutral-700 dark:text-neutral-300">
                                    {colorName}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Product Thumbnail */}
                    <ProductImage
                      src={v?.image}
                      fallbackText={sku || 'TN'}
                      containerClassName="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200/90 dark:border-neutral-700/90 shadow-2xs"
                    />
                  </div>

                  {/* 2. Middle Row: Status Badge + Warehouse Pill <---> Sliders Button */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status Pill */}
                      {isOutOfStock ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60">
                          {t('inventory.statusOutOfStock', 'ناموجود')}
                        </span>
                      ) : isLow ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                          {t('inventory.statusLowStock', 'موجودی کم')}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                          {t('inventory.statusInStock', 'موجود')}
                        </span>
                      )}

                      {/* Warehouse Pill */}
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-50 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700/80">
                        <WarehouseIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span className="font-medium">{whName}</span>
                        {locName && locName !== '-' && (
                          <span className="text-neutral-400 dark:text-neutral-500 font-mono text-[10px]">({locName})</span>
                        )}
                      </div>
                    </div>

                    {/* Sliders Action Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenThresholdModal(item)}
                      title={t('inventory.editThresholds', 'تنظیم حد سفارش')}
                      className="w-9 h-9 rounded-xl border border-neutral-200/90 dark:border-neutral-700/90 bg-neutral-50/80 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 3. Bottom Quantity Bar with Vertical Dividing Lines */}
                  <div className="grid grid-cols-4 divide-x divide-neutral-200 dark:divide-neutral-800 rtl:divide-x-reverse pt-3 border-t border-neutral-200/80 dark:border-neutral-800 text-center">
                    <div className="px-1">
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                        کل
                      </p>
                      <p className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono mt-0.5">
                        {isPersian ? toPersianDigits(item.quantity) : item.quantity}
                      </p>
                    </div>

                    <div className="px-1">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                        قابل فروش
                      </p>
                      <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                        {isPersian
                          ? toPersianDigits(item.available_quantity ?? item.quantity)
                          : (item.available_quantity ?? item.quantity)}
                      </p>
                    </div>

                    <div className="px-1">
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                        رزرو
                      </p>
                      <p className="text-base font-bold text-neutral-700 dark:text-neutral-300 font-mono mt-0.5">
                        {isPersian ? toPersianDigits(item.reserved_quantity || 0) : (item.reserved_quantity || 0)}
                      </p>
                    </div>

                    <div className="px-1">
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                        ضایعات
                      </p>
                      <p className={`text-base font-bold font-mono mt-0.5 ${item.damaged_quantity > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        {isPersian ? toPersianDigits(item.damaged_quantity || 0) : (item.damaged_quantity || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Edit Reorder Point and Safety Stock */}
      {editingItem && (
        <Modal
          isOpen={isThresholdModalOpen}
          onClose={() => {
            setIsThresholdModalOpen(false);
            setEditingItem(null);
          }}
          title={t('inventory.editThresholds')}
        >
          <form onSubmit={handleSaveThresholds} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-neutral-850 rounded-xl border border-slate-200 dark:border-neutral-700">
              <span className="text-slate-500 dark:text-neutral-400 block mb-1">{t('inventory.skuAndTitle')}:</span>
              <span className="font-bold text-slate-900 dark:text-neutral-100 font-mono">
                {editingItem.sku || (typeof editingItem.variant_id === 'number' ? `VAR-#${editingItem.variant_id}` : '-')}
              </span>
              <p className="text-slate-600 dark:text-neutral-300 mt-1">
                {editingItem.product_title || t('products.product')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
                  {t('inventory.reorderPoint')}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={editReorderPoint}
                  onChange={(e) => setEditReorderPoint(Number(e.target.value))}
                  placeholder="5"
                />
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-1">
                  {t('inventory.reorderPointNotice')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
                  {t('inventory.safetyStock')}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={editSafetyStock}
                  onChange={(e) => setEditSafetyStock(Number(e.target.value))}
                  placeholder="2"
                />
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-1">
                  {t('inventory.safetyStockNotice')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsThresholdModalOpen(false);
                  setEditingItem(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSavingThreshold}
              >
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

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
