import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import {
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  Warehouse,
  ProductVariant,
  Product,
  PurchaseOrderStatus,
} from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { formatDate, formatCurrency, toPersianDigits } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  PackageCheck,
  Eye,
  Building2,
  Package,
  AlertCircle,
  Trash2,
} from 'lucide-react';

export const PurchaseOrdersView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<number>(0);
  const [warehouseId, setWarehouseId] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ variant_id: number; quantity: number; unit_cost: number }[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<number>(0);
  const [itemQty, setItemQty] = useState<number>(10);
  const [itemCost, setItemCost] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Details Modal
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [poList, supList, whList, varList, prodList] = await Promise.all([
        adapter.getPurchaseOrders({ organization_id: orgId }),
        adapter.getSuppliers({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
        adapter.getProducts({ organization_id: orgId }),
      ]);

      const enriched = poList.map((po) => {
        const sup = supList.find((s) => s.id === (typeof po.supplier_id === 'object' ? po.supplier_id.id : po.supplier_id));
        return {
          ...po,
          supplier_name: sup ? sup.name : t('purchasing.generalSupplier'),
        };
      });

      setPurchaseOrders(enriched);
      setSuppliers(supList);
      setWarehouses(whList);
      setVariants(varList);
      setProducts(prodList);

      if (supList.length > 0) setSupplierId(supList[0].id);
      if (whList.length > 0) setWarehouseId(whList[0].id);
    } catch (err) {
      console.error('[PurchaseOrdersView] Error loading POs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const getVariantLabel = (v: ProductVariant) => {
    const prod = products.find((p) => p.id === (typeof v.product_id === 'object' ? (v.product_id as any).id : v.product_id));
    const colorName = (v as any).color_name || (typeof v.color_id === 'object' ? (v.color_id as any).name : undefined);
    const sizeName = (v as any).size_name || (typeof v.size_id === 'object' ? (v.size_id as any).name : undefined);
    const title = prod?.title || (v as any).product_title || `#${v.id}`;
    const details = [colorName, sizeName].filter(Boolean).join(' / ');
    const skuText = v.sku ? ` (${v.sku})` : '';
    return `${title}${details ? ` - ${details}` : ''}${skuText}`;
  };

  const handleAddItem = () => {
    if (!selectedVariantId || selectedVariantId <= 0) {
      alert(t('purchasing.pleaseSelectVariant'));
      return;
    }
    const qty = Math.max(1, Number(itemQty) || 1);
    const cost = Math.max(0, Number(itemCost) || 0);

    const existingIndex = items.findIndex((i) => i.variant_id === selectedVariantId);
    if (existingIndex !== -1) {
      const updated = [...items];
      updated[existingIndex].quantity += qty;
      updated[existingIndex].unit_cost = cost;
      setItems(updated);
    } else {
      setItems([...items, { variant_id: selectedVariantId, quantity: qty, unit_cost: cost }]);
    }

    // Reset fields for next item
    setSelectedVariantId(0);
    setItemQty(10);
    setItemCost(0);
  };

  const handleCreatePO = async (status: PurchaseOrderStatus = 'draft') => {
    if (!supplierId || !warehouseId || items.length === 0) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const poNumber = `PO-${Math.floor(100000 + Math.random() * 900000)}`;

      const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

      const poData: Partial<PurchaseOrder> = {
        organization_id: orgId,
        supplier_id: supplierId,
        warehouse_id: warehouseId,
        purchase_number: poNumber,
        status,
        currency: activeOrganization?.currency || 'TOMAN',
        subtotal: totalAmount,
        discount: 0,
        tax: 0,
        total: totalAmount,
        notes,
      };

      const poItems: Partial<PurchaseOrderItem>[] = items.map((i) => ({
        organization_id: orgId,
        variant_id: i.variant_id,
        quantity_ordered: i.quantity,
        quantity_received: status === 'received' ? i.quantity : 0,
        unit_cost: i.unit_cost,
        total: i.quantity * i.unit_cost,
      }));

      const savedPO = await adapter.savePurchaseOrder(poData, poItems);

      // If status is received, record PURCHASE movement in inventory to INCREMENT stock!
      if (status === 'received') {
        for (const item of items) {
          await adapter.recordMovement({
            organization_id: orgId,
            variant_id: item.variant_id,
            warehouse_id: warehouseId,
            type: 'purchase',
            quantity: item.quantity,
            reference_type: 'purchase_order',
            reference_id: String(savedPO.id),
            note: `${t('purchasing.poReceiveStock')} #${poNumber}`,
          });
        }
      }

      setIsCreateModalOpen(false);
      setItems([]);
      setNotes('');
      await loadData();
    } catch (err) {
      console.error('[PurchaseOrdersView] Error creating PO:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (po: PurchaseOrder, newStatus: PurchaseOrderStatus) => {
    try {
      const adapter = storageManager.getAdapter();
      await adapter.savePurchaseOrder({ id: po.id, status: newStatus });

      // If completing/receiving, add stock
      if (newStatus === 'received') {
        const whId = typeof po.warehouse_id === 'object' ? (po.warehouse_id as any)?.id : po.warehouse_id;
        if (variants.length > 0) {
          await adapter.recordMovement({
            organization_id: activeOrganization?.id || 1,
            variant_id: variants[0].id,
            warehouse_id: whId,
            type: 'purchase',
            quantity: 10,
            reference_type: 'purchase_order',
            reference_id: String(po.id),
            note: `${t('purchasing.poReceiveStock')} #${po.purchase_number}`,
          });
        }
      }

      await loadData();
    } catch (err) {
      console.error('[PurchaseOrdersView] Error updating status:', err);
    }
  };

  const handleDeletePO = async (po: PurchaseOrder) => {
    if (!po.id) return;
    const isConfirmed = await confirmAction(`${t('purchasing.confirmDeletePO')} (${po.purchase_number})`);
    if (!isConfirmed) return;

    try {
      const adapter = storageManager.getAdapter();
      await adapter.deletePurchaseOrder(po.id);
      if (selectedPO?.id === po.id) {
        setIsDetailModalOpen(false);
        setSelectedPO(null);
      }
      await loadData();
    } catch (err) {
      console.error('[PurchaseOrdersView] Error deleting purchase order:', err);
    }
  };

  const getPOStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'received':
        return <Badge variant="success">{t('purchasing.poStatusReceivedBadge')}</Badge>;
      case 'ordered':
        return <Badge variant="primary">{t('purchasing.poStatusOrderedBadge')}</Badge>;
      case 'partially_received':
        return <Badge variant="warning">{t('purchasing.poStatusPartialBadge')}</Badge>;
      case 'draft':
        return <Badge variant="neutral">{t('purchasing.poStatusDraftBadge')}</Badge>;
      case 'cancelled':
        return <Badge variant="error">{t('purchasing.poStatusCancelledBadge')}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const filteredPOs = purchaseOrders.filter((po) => {
    return (
      po.purchase_number.toLowerCase().includes(search.toLowerCase()) ||
      (po.supplier_name && po.supplier_name.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('purchasing.poViewTitle')}
        subtitle={t('purchasing.poViewSubtitle')}
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
            {t('purchasing.createPOBtn')}
          </Button>
        }
      />

      <Card className="p-4">
        <div className="max-w-md">
          <Input
            placeholder={t('purchasing.searchPOPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <DataTable<PurchaseOrder>
          data={filteredPOs}
          keyExtractor={(po) => po.id}
          isLoading={isLoading}
          emptyMessage={t('purchasing.noPOsFound')}
          columns={[
            {
              key: 'purchase_number',
              header: t('purchasing.poNumber'),
              render: (po) => (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      {po.purchase_number}
                    </span>
                    <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                      {formatDate(po.date_created, isPersian)}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'supplier_id',
              header: t('purchasing.supplier'),
              render: (po) => (
                <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{po.supplier_name}</span>
              ),
            },
            {
              key: 'total',
              header: t('purchasing.poTotalInvoice'),
              render: (po) => (
                <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
                  {formatCurrency(po.total, activeOrganization?.currency, isPersian)}
                </span>
              ),
            },
            {
              key: 'status',
              header: t('purchasing.poStatus'),
              render: (po) => getPOStatusBadge(po.status),
            },
          ]}
          actions={(po) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedPO(po);
                  setIsDetailModalOpen(true);
                }}
                icon={<Eye className="w-3.5 h-3.5" />}
              >
                {t('purchasing.poDetails')}
              </Button>

              {po.status === 'ordered' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleUpdateStatus(po, 'received')}
                  icon={<PackageCheck className="w-3.5 h-3.5" />}
                >
                  {t('purchasing.poReceiveStock')}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                onClick={() => handleDeletePO(po)}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                {t('common.delete')}
              </Button>
            </div>
          )}
        />
      </Card>

      {/* Modal Create PO */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('purchasing.createPOModalTitle')}
        maxWidth="2xl"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleCreatePO('ordered')}
              isLoading={isSaving}
              disabled={items.length === 0}
            >
              {t('purchasing.submitPOToSupplier')}
            </Button>
            <Button
              variant="primary"
              onClick={() => handleCreatePO('received')}
              isLoading={isSaving}
              disabled={items.length === 0}
            >
              {t('purchasing.instantReceive')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={t('purchasing.selectSupplierLabel')}
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />

            <Select
              label={t('purchasing.selectWarehouseLabel')}
              value={warehouseId}
              onChange={(e) => setWarehouseId(Number(e.target.value))}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </div>

          <div className="p-4 bg-slate-50 dark:bg-[#181a20] border border-slate-200/80 dark:border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-neutral-100">{t('purchasing.selectItemsBoxTitle')}</h4>
            
            <div className="flex flex-col sm:flex-row items-end gap-2">
              <div className="flex-1 w-full">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-neutral-300 mb-1">{t('purchasing.selectVariantLabel')}</label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedVariantId(id);
                    const v = variants.find((varObj) => varObj.id === id);
                    if (v) {
                      const costVal = v.cost !== undefined && v.cost !== null ? Number(v.cost) : ((v as any).cost_price !== undefined ? Number((v as any).cost_price) : 0);
                      setItemCost(costVal);
                    } else {
                      setItemCost(0);
                    }
                  }}
                  className="w-full p-2.5 text-xs border border-slate-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-[#13151a] text-slate-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                >
                  <option value={0} className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">{t('purchasing.selectVariantPlaceholder')}</option>
                  {variants.map((v, vIdx) => (
                    <option key={`po_var_opt_${v.id}_${vIdx}`} value={v.id} className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">
                      {getVariantLabel(v)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-28 sm:w-24">
                <Input
                  label={t('purchasing.quantityLabel')}
                  type="number"
                  min={1}
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                />
              </div>

              <div className="w-36 sm:w-32">
                <Input
                  label={t('purchasing.unitCostLabel')}
                  type="number"
                  value={itemCost}
                  onChange={(e) => setItemCost(Number(e.target.value))}
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={handleAddItem}
                icon={<Plus className="w-4 h-4" />}
                className="whitespace-nowrap"
              >
                {t('purchasing.addBtn')}
              </Button>
            </div>

            {/* List of Added Order Items */}
            {items.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#13151a] text-slate-500 dark:text-neutral-400 text-xs">
                {t('purchasing.noItemsAdded')}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="divide-y divide-slate-100 dark:divide-neutral-800 bg-white dark:bg-[#13151a] border border-slate-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                  {items.map((item, idx) => {
                    const v = variants.find((varObj) => varObj.id === item.variant_id);
                    const label = v ? getVariantLabel(v) : `#${item.variant_id}`;
                    return (
                      <div key={`po_item_row_${item.variant_id}_${idx}`} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <div className="flex-1 min-w-0 pe-2">
                          <span className="font-bold text-slate-900 dark:text-white block truncate">{label}</span>
                          <span className="text-slate-500 dark:text-neutral-400 text-[11px] font-mono">
                            {toPersianDigits(item.quantity)} × {formatCurrency(item.unit_cost, activeOrganization?.currency, isPersian)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                            {formatCurrency(item.quantity * item.unit_cost, activeOrganization?.currency, isPersian)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setItems(items.filter((_, itemIdx) => itemIdx !== idx))}
                            className="p-1 text-slate-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                            title={t('purchasing.deleteItem')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center p-3 bg-indigo-50/80 dark:bg-indigo-950/60 rounded-xl border border-indigo-100 dark:border-indigo-900/60 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  <span>{t('purchasing.poTotalSum')}</span>
                  <span className="font-mono text-sm text-indigo-700 dark:text-indigo-300">
                    {formatCurrency(items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0), activeOrganization?.currency, isPersian)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300">{t('purchasing.poNotesOptional')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t('purchasing.poNotesPlaceholder')}
              className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-xs p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Details PO */}
      {selectedPO && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`${t('purchasing.poDetailsTitle')} ${selectedPO.purchase_number}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-neutral-800 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-neutral-400">{t('purchasing.supplier')}:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedPO.supplier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-neutral-400">{t('purchasing.poStatus')}:</span>
                <div>{getPOStatusBadge(selectedPO.status)}</div>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-neutral-100 pt-2 border-t border-slate-200 dark:border-neutral-800">
                <span>{t('purchasing.totalCost')}:</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(selectedPO.total, activeOrganization?.currency, isPersian)}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
