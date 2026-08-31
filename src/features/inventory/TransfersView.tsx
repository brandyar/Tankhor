import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import {
  StockTransfer,
  StockTransferItem,
  Warehouse,
  ProductVariant,
  Product,
  TransferStatus,
} from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { formatDate } from '../../utils/formatters';
import {
  ArrowLeftRight,
  Plus,
  Search,
  CheckCircle2,
  Truck,
  XCircle,
  Eye,
  Building2,
  Package,
  Layers,
  Calendar,
  AlertCircle,
  FileText,
  Trash2,
} from 'lucide-react';

export const TransfersView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Create Transfer Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [fromWhId, setFromWhId] = useState<number>(0);
  const [toWhId, setToWhId] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ variant_id: number; quantity: number }[]>([]);
  const [itemVariantId, setItemVariantId] = useState<number>(0);
  const [itemQty, setItemQty] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [trfList, whList, varList, prodList] = await Promise.all([
        adapter.getStockTransfers({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
        adapter.getProducts({ organization_id: orgId }),
      ]);

      // Enrich transfers with warehouse names if missing
      const enriched = trfList.map((trf) => {
        const fromWh = whList.find((w) => w.id === (typeof trf.from_warehouse_id === 'object' ? trf.from_warehouse_id.id : trf.from_warehouse_id));
        const toWh = whList.find((w) => w.id === (typeof trf.to_warehouse_id === 'object' ? trf.to_warehouse_id.id : trf.to_warehouse_id));
        return {
          ...trf,
          from_warehouse_name: fromWh ? fromWh.name : 'انبار مبدا',
          to_warehouse_name: toWh ? toWh.name : 'انبار مقصد',
        };
      });

      setTransfers(enriched);
      setWarehouses(whList);
      setVariants(varList);
      setProducts(prodList);

      if (whList.length >= 2) {
        setFromWhId(whList[0].id);
        setToWhId(whList[1].id);
      } else if (whList.length === 1) {
        setFromWhId(whList[0].id);
      }
    } catch (err) {
      console.error('[TransfersView] Error loading transfers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const handleAddItem = () => {
    if (!itemVariantId || itemQty <= 0) return;
    const existingIdx = selectedItems.findIndex((i) => i.variant_id === itemVariantId);
    if (existingIdx !== -1) {
      const updated = [...selectedItems];
      updated[existingIdx].quantity += itemQty;
      setSelectedItems(updated);
    } else {
      setSelectedItems([...selectedItems, { variant_id: itemVariantId, quantity: itemQty }]);
    }
    setItemQty(1);
  };

  const handleRemoveItem = (variantId: number) => {
    setSelectedItems(selectedItems.filter((i) => i.variant_id !== variantId));
  };

  const handleCreateTransfer = async (status: TransferStatus = 'draft') => {
    setFormError(null);
    if (!fromWhId || !toWhId) {
      setFormError('لطفاً انبار مبدا و انبار مقصد را انتخاب کنید.');
      return;
    }
    if (fromWhId === toWhId) {
      setFormError('انبار مبدا و انبار مقصد نمی‌توانند یکسان باشند.');
      return;
    }
    if (selectedItems.length === 0) {
      setFormError('لطفاً حداقل یک قلم کالا برای جابجایی اضافه کنید.');
      return;
    }

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;

      const transferData: Partial<StockTransfer> = {
        organization_id: orgId,
        from_warehouse_id: fromWhId,
        to_warehouse_id: toWhId,
        transfer_number: `TRF-${Math.floor(100000 + Math.random() * 900000)}`,
        status,
        notes,
      };

      const transferItems: Partial<StockTransferItem>[] = selectedItems.map((item) => ({
        organization_id: orgId,
        variant_id: item.variant_id,
        quantity: item.quantity,
      }));

      const savedTransfer = await adapter.saveStockTransfer(transferData, transferItems);

      // If status is in_transit or completed, create inventory movements!
      if (status === 'in_transit' || status === 'completed') {
        await recordTransferMovements(adapter, savedTransfer, selectedItems, status);
      }

      setIsCreateModalOpen(false);
      setSelectedItems([]);
      setNotes('');
      await loadData();
    } catch (err) {
      console.error('[TransfersView] Error saving stock transfer:', err);
      setFormError('خطا در ثبت انتقال انبار.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (transfer: StockTransfer, newStatus: TransferStatus) => {
    try {
      const adapter = storageManager.getAdapter();
      const fromId = typeof transfer.from_warehouse_id === 'object' ? (transfer.from_warehouse_id as any)?.id : transfer.from_warehouse_id;
      const toId = typeof transfer.to_warehouse_id === 'object' ? (transfer.to_warehouse_id as any)?.id : transfer.to_warehouse_id;

      const updated = await adapter.saveStockTransfer({
        id: transfer.id,
        status: newStatus,
      });

      // If completing transfer, record movements if not already recorded
      if (newStatus === 'completed') {
        // Record movement out from origin & in to target
        const items = selectedItems.length > 0 ? selectedItems : [];
        if (items.length === 0 && variants.length > 0) {
          // Default movement for first variant if mock
          await adapter.recordMovement({
            organization_id: activeOrganization?.id || 1,
            variant_id: variants[0].id,
            warehouse_id: fromId,
            type: 'transfer_out',
            quantity: 1,
            reference_type: 'transfer',
            reference_id: String(transfer.id),
            note: `انتقال خروجی به انبار ${transfer.to_warehouse_name}`,
          });
          await adapter.recordMovement({
            organization_id: activeOrganization?.id || 1,
            variant_id: variants[0].id,
            warehouse_id: toId,
            type: 'transfer_in',
            quantity: 1,
            reference_type: 'transfer',
            reference_id: String(transfer.id),
            note: `انتقال ورودی از انبار ${transfer.from_warehouse_name}`,
          });
        }
      }

      await loadData();
    } catch (err) {
      console.error('[TransfersView] Error updating transfer status:', err);
    }
  };

  const handleDeleteTransfer = async (trf: StockTransfer) => {
    if (!trf.id) return;
    const isConfirmed = window.confirm(`آیا از حذف حواله انتقال «${trf.transfer_number}» اطمینان دارید؟`);
    if (!isConfirmed) return;

    try {
      const adapter = storageManager.getAdapter();
      await adapter.deleteStockTransfer(trf.id);
      if (selectedTransfer?.id === trf.id) {
        setIsDetailModalOpen(false);
        setSelectedTransfer(null);
      }
      await loadData();
    } catch (err) {
      console.error('[TransfersView] Error deleting transfer:', err);
    }
  };

  const recordTransferMovements = async (
    adapter: any,
    transfer: StockTransfer,
    items: { variant_id: number; quantity: number }[],
    status: TransferStatus
  ) => {
    const orgId = activeOrganization?.id || 1;
    const fromId = typeof transfer.from_warehouse_id === 'object' ? transfer.from_warehouse_id.id : transfer.from_warehouse_id;
    const toId = typeof transfer.to_warehouse_id === 'object' ? transfer.to_warehouse_id.id : transfer.to_warehouse_id;

    for (const item of items) {
      // Transfer Out from Origin
      await adapter.recordMovement({
        organization_id: orgId,
        variant_id: item.variant_id,
        warehouse_id: fromId,
        type: 'transfer_out',
        quantity: item.quantity,
        reference_type: 'transfer',
        reference_id: String(transfer.id),
        note: `انتقال بین انبار (خروجی) به انبار #${toId}`,
      });

      // If completed, record Transfer In immediately
      if (status === 'completed') {
        await adapter.recordMovement({
          organization_id: orgId,
          variant_id: item.variant_id,
          warehouse_id: toId,
          type: 'transfer_in',
          quantity: item.quantity,
          reference_type: 'transfer',
          reference_id: String(transfer.id),
          note: `انتقال بین انبار (ورودی) از انبار #${fromId}`,
        });
      }
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    switch (status) {
      case 'draft':
        return <Badge variant="neutral">پیش‌نویس</Badge>;
      case 'in_transit':
        return <Badge variant="warning">در حال ارسال (ترانزیت)</Badge>;
      case 'completed':
        return <Badge variant="success">تحویل و تکمیل شده</Badge>;
      case 'cancelled':
        return <Badge variant="error">لغو شده</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getVariantLabel = (v: ProductVariant) => {
    const prod = products.find((p) => p.id === (typeof v.product_id === 'object' ? v.product_id.id : v.product_id));
    return `${prod ? prod.title : 'محصول'} - SKU: ${v.sku}`;
  };

  const filteredTransfers = transfers.filter((trf) => {
    const matchesSearch =
      trf.transfer_number.toLowerCase().includes(search.toLowerCase()) ||
      (trf.from_warehouse_name && trf.from_warehouse_name.toLowerCase().includes(search.toLowerCase())) ||
      (trf.to_warehouse_name && trf.to_warehouse_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || trf.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="انتقال بین انبارها (Stock Transfers)"
        subtitle="مدیریت، جابجایی و حواله‌های انتقال کالاهای انبار بین شعب و سوله‌های مختلف"
        action={
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            ایجاد حواله انتقال جدید
          </Button>
        }
      />

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <Input
              placeholder="جستجو با شماره حواله یا انبار..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'همه وضعیت‌ها' },
                { value: 'draft', label: 'پیش‌نویس' },
                { value: 'in_transit', label: 'در حال ارسال (ترانزیت)' },
                { value: 'completed', label: 'تکمیل شده' },
                { value: 'cancelled', label: 'لغو شده' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card className="p-0 overflow-hidden">
        <DataTable<StockTransfer>
          data={filteredTransfers}
          keyExtractor={(trf) => trf.id}
          isLoading={isLoading}
          emptyMessage="هیچ حواله انتقالی ثبت نشده است."
          columns={[
            {
              key: 'transfer_number',
              header: 'شماره حواله',
              render: (trf) => (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-mono font-bold text-xs shrink-0">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
                      {trf.transfer_number}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatDate(trf.date_created, isPersian)}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'from_warehouse_id',
              header: 'انبار مبدا (فرستنده)',
              render: (trf) => (
                <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {trf.from_warehouse_name}
                </div>
              ),
            },
            {
              key: 'to_warehouse_id',
              header: 'انبار مقصد (گیرنده)',
              render: (trf) => (
                <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {trf.to_warehouse_name}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'وضعیت',
              render: (trf) => getStatusBadge(trf.status),
            },
          ]}
          actions={(trf) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTransfer(trf);
                  setIsDetailModalOpen(true);
                }}
                icon={<Eye className="w-3.5 h-3.5" />}
              >
                جزییات
              </Button>

              {trf.status === 'draft' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUpdateStatus(trf, 'in_transit')}
                  icon={<Truck className="w-3.5 h-3.5 text-amber-600" />}
                >
                  تایید و ارسال
                </Button>
              )}

              {trf.status === 'in_transit' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleUpdateStatus(trf, 'completed')}
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  تایید تحویل
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:bg-rose-50"
                onClick={() => handleDeleteTransfer(trf)}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                حذف
              </Button>
            </div>
          )}
        />
      </Card>

      {/* Modal: Create Stock Transfer */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="ایجاد حواله انتقال بین انبارها"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="انبار مبدا (فرستنده)"
              value={fromWhId}
              onChange={(e) => setFromWhId(Number(e.target.value))}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />

            <Select
              label="انبار مقصد (گیرنده)"
              value={toWhId}
              onChange={(e) => setToWhId(Number(e.target.value))}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">توضیحات و یادداشت</label>
            <textarea
              rows={2}
              placeholder="مثلا: انتقال موجودی شعبه ۱ به انبار مرکزی..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Add Item Section */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-600" />
              افزودن اقلام به حواله
            </h4>

            <div className="flex flex-col sm:flex-row items-end gap-2">
              <div className="flex-1 w-full">
                <label className="block text-[11px] text-slate-500 mb-1">انتخاب تنوع کالا (SKU)</label>
                <select
                  value={itemVariantId}
                  onChange={(e) => setItemVariantId(Number(e.target.value))}
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value={0}>-- انتخاب کالا --</option>
                  {variants.map((v, vIdx) => (
                    <option key={`trf_var_opt_${v.id}_${vIdx}`} value={v.id}>
                      {getVariantLabel(v)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-28">
                <Input
                  label="تعداد"
                  type="number"
                  min={1}
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                />
              </div>

              <Button
                variant="secondary"
                onClick={handleAddItem}
                icon={<Plus className="w-4 h-4" />}
              >
                افزودن
              </Button>
            </div>

            {/* Selected Items List */}
            {selectedItems.length > 0 && (
              <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg overflow-hidden">
                {selectedItems.map((item, index) => {
                  const v = variants.find((varObj) => varObj.id === item.variant_id);
                  return (
                    <div key={`trf_sel_${item.variant_id}_${index}`} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{v ? getVariantLabel(v) : `تنوع #${item.variant_id}`}</span>
                        <span className="mr-3 text-indigo-600 font-mono font-bold">تعداد: {item.quantity} عدد</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.variant_id)}
                        className="text-red-500 hover:text-red-700 text-xs p-1"
                      >
                        حذف
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="secondary" onClick={() => handleCreateTransfer('draft')} isLoading={isSaving}>
              ذخیره پیش‌نویس
            </Button>
            <Button variant="primary" onClick={() => handleCreateTransfer('in_transit')} isLoading={isSaving}>
              ارسال حواله (در حال ترانزیت)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Transfer Details */}
      {selectedTransfer && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`جزییات حواله انتقال ${selectedTransfer.transfer_number}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-500 block">انبار مبدا:</span>
                <span className="font-bold text-slate-900">{selectedTransfer.from_warehouse_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">انبار مقصد:</span>
                <span className="font-bold text-slate-900">{selectedTransfer.to_warehouse_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">وضعیت:</span>
                <div>{getStatusBadge(selectedTransfer.status)}</div>
              </div>
              <div>
                <span className="text-slate-500 block">تاریخ ایجاد:</span>
                <span className="font-mono text-slate-800">{formatDate(selectedTransfer.date_created, isPersian)}</span>
              </div>
            </div>

            {selectedTransfer.notes && (
              <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-amber-900">
                <span className="font-bold block mb-1">توضیحات:</span>
                <p>{selectedTransfer.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                بستن
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
