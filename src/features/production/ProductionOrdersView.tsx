import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import {
  ProductionOrder,
  ProductionOrderItem,
  ProductionStage,
  Product,
  ProductVariant,
  Warehouse,
  BillOfMaterials,
  Contractor,
  ProductionStageType,
} from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';
import {
  Plus,
  Search,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

const STAGE_TYPE_KEYS: { key: ProductionStageType; labelKey: string }[] = [
  { key: 'cutting', labelKey: 'production.stageTypeCutting' },
  { key: 'printing', labelKey: 'production.stageTypePrinting' },
  { key: 'embroidery', labelKey: 'production.stageTypeEmbroidery' },
  { key: 'sewing', labelKey: 'production.stageTypeSewing' },
  { key: 'washing', labelKey: 'production.stageTypeWashing' },
  { key: 'iron_pack', labelKey: 'production.stageTypeIronPack' },
  { key: 'qc', labelKey: 'production.stageTypeQc' },
];

const SPECIALTY_LABEL_KEYS: Record<string, string> = {
  cutting: 'production.specialtyCutting',
  sewing: 'production.specialtySewing',
  embroidery: 'production.specialtyEmbroidery',
  printing: 'production.specialtyPrinting',
  washing: 'production.specialtyWashing',
  iron_pack: 'production.specialtyIronPack',
  general: 'production.specialtyGeneral',
};

export const ProductionOrdersView: React.FC = () => {
  const { t, isPersian } = useTranslation();
  const { activeOrganization } = useOrganization();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isStagesModalOpen, setIsStagesModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);

  // Create Form State
  const [formData, setFormData] = useState({
    order_number: '',
    product_id: 0,
    bom_id: 0,
    target_warehouse_id: 0,
    total_quantity: 100,
    notes: '',
  });

  const [selectedProductVariants, setSelectedProductVariants] = useState<ProductVariant[]>([]);
  const [variantQuantities, setVariantQuantities] = useState<Record<number, number>>({});

  // Stages Form State for tracking
  const [orderStages, setOrderStages] = useState<Partial<ProductionStage>[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordList, prodList, varList, whList, bomList, ctrList] = await Promise.all([
        storageManager.getProductionOrders(),
        storageManager.getProducts(),
        storageManager.getVariants(),
        storageManager.getWarehouses(),
        storageManager.getBillOfMaterials(),
        storageManager.getContractors(),
      ]);
      setOrders(ordList || []);
      setProducts(prodList || []);
      setVariants(varList || []);
      setWarehouses(whList || []);
      setBoms(bomList || []);
      setContractors(ctrList || []);
    } catch (err) {
      console.error('Error loading production orders data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const numMatch = o.order_number.toLowerCase().includes(search.toLowerCase());
      const prodMatch = (o.product_name || '').toLowerCase().includes(search.toLowerCase());
      const statusMatch = statusFilter === 'all' || o.status === statusFilter;
      return (numMatch || prodMatch) && statusMatch;
    });
  }, [orders, search, statusFilter]);

  // Paginated orders
  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Open Create Order Modal
  const handleOpenCreateModal = () => {
    const defaultProduct = products[0];
    const defaultBom = boms.find((b) => b.product_id === defaultProduct?.id);
    const pVars = defaultProduct ? variants.filter((v) => Number(v.product_id) === Number(defaultProduct.id)) : [];

    setFormData({
      order_number: `CUT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      product_id: defaultProduct?.id || 0,
      bom_id: defaultBom?.id || 0,
      target_warehouse_id: warehouses[0]?.id || 0,
      total_quantity: 100,
      notes: '',
    });

    setSelectedProductVariants(pVars);
    const initialQty: Record<number, number> = {};
    const qtyPerVar = Math.floor(100 / (pVars.length || 1));
    pVars.forEach((v) => {
      initialQty[v.id] = qtyPerVar;
    });
    setVariantQuantities(initialQty);
    setIsCreateModalOpen(true);
  };

  const handleProductChange = (productId: number) => {
    const foundBom = boms.find((b) => b.product_id === productId);
    const pVars = variants.filter((v) => Number(v.product_id) === Number(productId));
    setSelectedProductVariants(pVars);

    const initialQty: Record<number, number> = {};
    const qtyPerVar = Math.floor(formData.total_quantity / (pVars.length || 1));
    pVars.forEach((v) => {
      initialQty[v.id] = qtyPerVar;
    });
    setVariantQuantities(initialQty);

    setFormData((prev) => ({
      ...prev,
      product_id: productId,
      bom_id: foundBom?.id || 0,
    }));
  };

  const handleSaveOrder = async () => {
    if (!formData.product_id || !formData.order_number.trim()) return;

    try {
      const itemsPayload: Partial<ProductionOrderItem>[] = Object.entries(variantQuantities).map(
        ([variantId, qty]) => ({
          variant_id: Number(variantId),
          quantity_planned: Number(qty),
        })
      );

      const stagesPayload: Partial<ProductionStage>[] = STAGE_TYPE_KEYS.map((stg) => ({
        stage_type: stg.key,
        status: stg.key === 'cutting' ? 'in_progress' : 'pending',
        unit_fee: 0,
        total_fee: 0,
        quantity_sent: formData.total_quantity,
        quantity_received: 0,
      }));

      await storageManager.saveProductionOrder(
        {
          order_number: formData.order_number.trim(),
          product_id: Number(formData.product_id),
          bom_id: formData.bom_id ? Number(formData.bom_id) : null,
          target_warehouse_id: formData.target_warehouse_id ? Number(formData.target_warehouse_id) : null,
          total_quantity: Number(formData.total_quantity),
          status: 'cutting',
          notes: formData.notes.trim(),
        },
        itemsPayload,
        stagesPayload
      );

      setIsCreateModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Error creating production order:', err);
    }
  };

  // Open Stage Tracker Modal
  const handleOpenStagesModal = (order: ProductionOrder) => {
    setSelectedOrder(order);
    setOrderStages(
      order.stages && order.stages.length > 0
        ? order.stages
        : STAGE_TYPE_KEYS.map((stg) => ({
            production_order_id: order.id,
            stage_type: stg.key,
            status: 'pending',
            unit_fee: 0,
            total_fee: 0,
            quantity_sent: order.total_quantity,
            quantity_received: 0,
          }))
    );
    setIsStagesModalOpen(true);
  };

  const handleUpdateStage = (index: number, field: string, value: any) => {
    const updated = [...orderStages];
    updated[index] = { ...updated[index], [field]: value };
    // Auto recalculate total fee if unit fee or qty received changes
    if (field === 'unit_fee' || field === 'quantity_received') {
      const uFee = Number(field === 'unit_fee' ? value : updated[index].unit_fee || 0);
      const qRec = Number(field === 'quantity_received' ? value : updated[index].quantity_received || 0);
      updated[index].total_fee = uFee * qRec;
    }
    setOrderStages(updated);
  };

  const handleSaveStagesAndStatus = async (newOrderStatus?: string) => {
    if (!selectedOrder) return;
    try {
      const targetStatus = newOrderStatus || selectedOrder.status;
      await storageManager.saveProductionOrder(
        {
          id: selectedOrder.id,
          status: targetStatus as any,
          completed_date: targetStatus === 'completed' ? new Date().toISOString() : selectedOrder.completed_date,
        },
        selectedOrder.items,
        orderStages
      );

      // If completing order, automatically update contractor balance ledgers
      if (targetStatus === 'completed') {
        for (const stg of orderStages) {
          if (stg.contractor_id && stg.total_fee && stg.total_fee > 0) {
            const ctr = contractors.find((c) => c.id === Number(stg.contractor_id));
            if (ctr) {
              await storageManager.saveContractor({
                id: ctr.id,
                current_balance: (ctr.current_balance || 0) + Number(stg.total_fee),
              });
            }
          }
        }
      }

      setIsStagesModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Error updating production stages:', err);
    }
  };

  const handleDeleteOrder = async (id: number) => {
    const confirmed = await confirmAction(t('production.confirmDeleteOrder'), t('common.confirmDeleteTitle'));
    if (confirmed) {
      try {
        await storageManager.deleteProductionOrder(id);
        await loadData();
      } catch (err) {
        console.error('Error deleting production order:', err);
      }
    }
  };

  const formatNum = (num: number) => (isPersian ? toPersianDigits(num) : num.toString());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {t('production.statusDraft')}
          </span>
        );
      case 'cutting':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            {t('production.statusCutting')}
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
            {t('production.statusInProgress')}
          </span>
        );
      case 'qc':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
            {t('production.statusQc')}
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            {t('production.statusCompleted')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
            {t('production.statusCancelled')}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('production.ordersTitle')}
        subtitle={t('production.ordersSubtitle')}
        action={
          <Button variant="primary" onClick={handleOpenCreateModal} icon={<Plus className="w-4 h-4" />}>
            {t('production.createOrderBtn')}
          </Button>
        }
      />

      {/* Filter & Search Bar */}
      <Card className="p-4 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              type="text"
              placeholder={t('production.searchOrdersPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="ps-9 w-full text-xs"
            />
          </div>

          <div className="w-full sm:w-64">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs"
            >
              <option value="all">{t('production.allStatuses')}</option>
              <option value="cutting">{t('production.statusCutting')}</option>
              <option value="in_progress">{t('production.statusInProgress')}</option>
              <option value="qc">{t('production.statusQc')}</option>
              <option value="completed">{t('production.statusCompleted')}</option>
              <option value="cancelled">{t('production.statusCancelled')}</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Data Table / Cards */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400">{t('production.loadingOrders')}</div>
      ) : paginatedOrders.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">{t('production.noOrdersFound')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Mobile Cards (md:hidden) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {paginatedOrders.map((ord) => (
              <Card key={`pord_mcard_${ord.id}`} className="p-4 bg-white dark:bg-[#13151a]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      {ord.order_number}
                    </span>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                      {ord.product_name || t('production.productCodeFallback', { id: ord.product_id })}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenStagesModal(ord)}>
                      {t('production.trackBtn')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteOrder(ord.id)} title={t('common.delete')}>
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-400 block">{t('production.plannedQtyLabel')}</span>
                    <span className="font-bold font-mono text-neutral-900 dark:text-white">
                      {formatNum(ord.total_quantity)} {t('production.piecesUnit')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 block">{t('production.colStatus')}:</span>
                    {getStatusBadge(ord.status)}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#13151a] shadow-vercel-sm">
            <table className="w-full text-start text-xs">
              <thead className="bg-neutral-50 dark:bg-[#181a20] border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold">
                <tr>
                  <th className="px-4 py-3 text-start">{t('production.colOrderNumber')}</th>
                  <th className="px-4 py-3 text-start">{t('production.colProductTitle')}</th>
                  <th className="px-4 py-3 text-center">{t('production.colQuantity')}</th>
                  <th className="px-4 py-3 text-center">{t('production.colTargetWarehouse')}</th>
                  <th className="px-4 py-3 text-center">{t('production.colStatus')}</th>
                  <th className="px-4 py-3 text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {paginatedOrders.map((ord) => (
                  <tr key={`pord_drow_${ord.id}`} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-neutral-900 dark:text-white">
                      {ord.order_number}
                    </td>
                    <td className="px-4 py-3 font-bold text-neutral-800 dark:text-neutral-200">
                      {ord.product_name || t('production.productCodeFallback', { id: ord.product_id })}
                    </td>
                    <td className="px-4 py-3 text-center font-bold font-mono text-neutral-900 dark:text-white">
                      {formatNum(ord.total_quantity)}
                    </td>
                    <td className="px-4 py-3 text-center text-neutral-500">
                      {ord.target_warehouse_name || t('production.mainWarehouseFallback')}
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(ord.status)}</td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenStagesModal(ord)}
                          className="text-amber-600 font-bold"
                        >
                          {t('production.trackAndControlBtn')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOrder(ord.id)}
                          className="text-rose-600"
                        >
                          {t('common.delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Create Order Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title={t('production.createOrderModalTitle')}
        >
          <div className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pe-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">
                  {t('production.orderNumberRequired')}
                </label>
                <Input
                  type="text"
                  value={formData.order_number}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">
                  {t('production.targetProductRequired')}
                </label>
                <Select
                  value={formData.product_id}
                  onChange={(e) => handleProductChange(Number(e.target.value))}
                >
                  {products.map((p) => (
                    <option key={`po_popt_${p.id}`} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">
                  {t('production.bomRecipeLabel')}
                </label>
                <Select
                  value={formData.bom_id}
                  onChange={(e) => setFormData({ ...formData, bom_id: Number(e.target.value) })}
                >
                  <option value={0}>{t('production.noBomOption')}</option>
                  {boms.map((b) => (
                    <option key={`po_bomopt_${b.id}`} value={b.id}>
                      {b.name} ({b.version})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">
                  {t('production.targetFinishedWarehouseLabel')}
                </label>
                <Select
                  value={formData.target_warehouse_id}
                  onChange={(e) => setFormData({ ...formData, target_warehouse_id: Number(e.target.value) })}
                >
                  {warehouses.map((w) => (
                    <option key={`po_whopt_${w.id}`} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">
                {t('production.totalPlannedQtyLabel')}
              </label>
              <Input
                type="number"
                value={formData.total_quantity}
                onChange={(e) => {
                  const newTotal = Number(e.target.value);
                  setFormData({ ...formData, total_quantity: newTotal });
                  if (selectedProductVariants.length > 0) {
                    const qtyPerVar = Math.floor(newTotal / selectedProductVariants.length);
                    const updated: Record<number, number> = {};
                    selectedProductVariants.forEach((v) => {
                      updated[v.id] = qtyPerVar;
                    });
                    setVariantQuantities(updated);
                  }
                }}
              />
            </div>

            {/* Variant Quantities Breakdown */}
            {selectedProductVariants.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <label className="block font-bold text-neutral-900 dark:text-white">
                  {t('production.variantBreakdownLabel')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedProductVariants.map((v) => (
                    <div
                      key={`po_var_item_${v.id}`}
                      className="p-2 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200/80 dark:border-neutral-800"
                    >
                      <span className="text-[10px] text-neutral-500 font-bold block truncate">{v.sku}</span>
                      <Input
                        type="number"
                        className="mt-1 text-center font-bold font-mono"
                        value={variantQuantities[v.id] || 0}
                        onChange={(e) => {
                          setVariantQuantities({
                            ...variantQuantities,
                            [v.id]: Number(e.target.value),
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">
                {t('production.workshopNotesLabel')}
              </label>
              <Input
                type="text"
                placeholder={t('production.workshopNotesPlaceholder')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" onClick={handleSaveOrder}>
                {t('production.issueOrderBtn')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Stage Tracker & Contractor Assignment Modal */}
      {isStagesModalOpen && selectedOrder && (
        <Modal
          isOpen={isStagesModalOpen}
          onClose={() => setIsStagesModalOpen(false)}
          title={t('production.stagesModalTitle', { number: selectedOrder.order_number })}
        >
          <div className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pe-1">
            <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <p className="font-bold text-neutral-900 dark:text-white">
                  {t('production.productLabel')} {selectedOrder.product_name || t('production.productCodeFallback', { id: selectedOrder.product_id })}
                </p>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  {t('production.totalQtyLabel')}{' '}
                  <strong className="font-mono">{formatNum(selectedOrder.total_quantity)}</strong>{' '}
                  {t('production.piecesUnit')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSaveStagesAndStatus('completed')}
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  {t('production.completeProductionBtn')}
                </Button>
              </div>
            </div>

            <h4 className="font-bold text-neutral-900 dark:text-white">
              {t('production.stagesSectionTitle')}
            </h4>

            <div className="space-y-3">
              {orderStages.map((stg, idx) => {
                const foundStage = STAGE_TYPE_KEYS.find((s) => s.key === stg.stage_type);
                const stageLabel = foundStage ? t(foundStage.labelKey) : stg.stage_type;
                return (
                  <div
                    key={`stg_row_${idx}`}
                    className="p-3 bg-white dark:bg-[#13151a] rounded-xl border border-neutral-200/80 dark:border-neutral-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">
                        {t('production.stageStepLabel', { step: formatNum(idx + 1), label: stageLabel })}
                      </span>

                      <Select
                        value={stg.status}
                        onChange={(e) => handleUpdateStage(idx, 'status', e.target.value)}
                        className="text-xs w-36"
                      >
                        <option value="pending">{t('production.stageStatusPending')}</option>
                        <option value="in_progress">{t('production.stageStatusInProgress')}</option>
                        <option value="completed">{t('production.stageStatusCompleted')}</option>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">
                          {t('production.contractorExecutorLabel')}
                        </label>
                        <Select
                          value={stg.contractor_id || 0}
                          onChange={(e) => handleUpdateStage(idx, 'contractor_id', Number(e.target.value))}
                        >
                          <option value={0}>{t('production.internalWorkshopOption')}</option>
                          {contractors.map((c) => {
                            const specKey = SPECIALTY_LABEL_KEYS[c.specialty];
                            const specLabel = specKey ? t(specKey) : c.specialty;
                            return (
                              <option key={`stg_c_${c.id}`} value={c.id}>
                                {c.name} ({specLabel})
                              </option>
                            );
                          })}
                        </Select>
                      </div>

                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">
                          {t('production.unitFeePerPieceLabel')}
                        </label>
                        <Input
                          type="number"
                          value={stg.unit_fee || 0}
                          onChange={(e) => handleUpdateStage(idx, 'unit_fee', Number(e.target.value))}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">
                          {t('production.qtyReceivedLabel')}
                        </label>
                        <Input
                          type="number"
                          value={stg.quantity_received || 0}
                          onChange={(e) => handleUpdateStage(idx, 'quantity_received', Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="text-end text-[11px] text-neutral-500">
                      {t('production.stageTotalFeeLabel')}{' '}
                      <strong className="font-mono text-neutral-900 dark:text-white">
                        {formatCurrency(stg.total_fee || 0, activeOrganization?.currency, isPersian)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="ghost" onClick={() => setIsStagesModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" onClick={() => handleSaveStagesAndStatus()}>
                {t('production.saveStagesBtn')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
