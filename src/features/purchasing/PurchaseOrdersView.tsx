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
  RawMaterial,
} from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SearchableVariantSelect } from '../../components/ui/SearchableVariantSelect';
import { SearchableRawMaterialSelect } from '../../components/ui/SearchableRawMaterialSelect';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { formatDate, formatCurrency, toPersianDigits } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';
import {
  Truck,
  Plus,
  Search,
  PackageCheck,
  Eye,
  Building2,
  Package,
  Trash2,
  Boxes,
  Shirt,
  Tag,
  UserPlus,
} from 'lucide-react';
import { useModuleAccess } from '../../hooks/useModuleAccess';

interface PurchaseOrdersViewProps {
  initialCreateMode?: boolean;
}

interface POFormItem {
  variant_id?: number;
  raw_material_id?: number;
  name: string;
  unit?: string;
  quantity: number;
  unit_cost: number;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({ initialCreateMode = false }) => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const { hasAccess } = useModuleAccess();
  const hasAccounting = hasAccess('accounting');
  const hasProduction = hasAccess('production') || hasAccess('produce');
  const isPersian = locale === 'fa';

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(initialCreateMode);
  const [purchaseType, setPurchaseType] = useState<'product' | 'raw_material'>('product');
  const [supplierId, setSupplierId] = useState<number>(0);
  const [warehouseId, setWarehouseId] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POFormItem[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<number>(0);
  const [selectedRawMaterialId, setSelectedRawMaterialId] = useState<number>(0);
  const [itemQty, setItemQty] = useState<number>(10);
  const [itemCost, setItemCost] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Quick Supplier Modal State
  const [isQuickSupplierModalOpen, setIsQuickSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Details Modal
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poDetailsItems, setPoDetailsItems] = useState<PurchaseOrderItem[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const promises: Promise<any>[] = [
        adapter.getPurchaseOrders({ organization_id: orgId }),
        adapter.getSuppliers({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
        adapter.getProducts({ organization_id: orgId }),
      ];

      if (hasProduction && adapter.getRawMaterials) {
        promises.push(adapter.getRawMaterials({ organization_id: orgId }));
      }

      const results = await Promise.all(promises);
      const poList: PurchaseOrder[] = results[0];
      const supList: Supplier[] = results[1];
      const whList: Warehouse[] = results[2];
      const varList: ProductVariant[] = results[3];
      const prodList: Product[] = results[4];
      const rawList: RawMaterial[] = results[5] || [];

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
      setRawMaterials(rawList);

      if (supList.length > 0 && (!supplierId || supplierId === 0)) {
        setSupplierId(supList[0].id);
      }
      if (whList.length > 0 && (!warehouseId || warehouseId === 0)) {
        setWarehouseId(whList[0].id);
      }
    } catch (err) {
      console.error('[PurchaseOrdersView] Error loading POs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization, hasProduction]);

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
    const qty = Math.max(1, Number(itemQty) || 1);
    const cost = Math.max(0, Number(itemCost) || 0);

    if (purchaseType === 'product') {
      if (!selectedVariantId || selectedVariantId <= 0) {
        alert(t('purchasing.pleaseSelectVariant'));
        return;
      }
      const v = variants.find((varObj) => varObj.id === selectedVariantId);
      const name = v ? getVariantLabel(v) : `#${selectedVariantId}`;

      const existingIndex = items.findIndex((i) => i.variant_id === selectedVariantId);
      if (existingIndex !== -1) {
        const updated = [...items];
        updated[existingIndex].quantity += qty;
        updated[existingIndex].unit_cost = cost;
        setItems(updated);
      } else {
        setItems([...items, { variant_id: selectedVariantId, name, quantity: qty, unit_cost: cost }]);
      }
      setSelectedVariantId(0);
    } else {
      if (!selectedRawMaterialId || selectedRawMaterialId <= 0) {
        alert('لطفاً متریال اولیه را انتخاب کنید');
        return;
      }
      const rm = rawMaterials.find((r) => r.id === selectedRawMaterialId);
      if (!rm) return;

      const existingIndex = items.findIndex((i) => i.raw_material_id === selectedRawMaterialId);
      if (existingIndex !== -1) {
        const updated = [...items];
        updated[existingIndex].quantity += qty;
        updated[existingIndex].unit_cost = cost;
        setItems(updated);
      } else {
        setItems([
          ...items,
          {
            raw_material_id: rm.id,
            name: `${rm.name} (${rm.code})`,
            unit: rm.unit,
            quantity: qty,
            unit_cost: cost,
          },
        ]);
      }
      setSelectedRawMaterialId(0);
    }

    setItemQty(10);
    setItemCost(0);
  };

  const handleQuickCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      alert('لطفاً نام تامین‌کننده یا شرکت را وارد کنید.');
      return;
    }
    setIsSavingSupplier(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const created = await adapter.saveSupplier({
        organization_id: orgId,
        name: newSupplierName.trim(),
        contact_name: newSupplierContact.trim() || undefined,
        phone: newSupplierPhone.trim() || undefined,
        status: 'active',
        balance: 0,
      });

      setSuppliers((prev) => [...prev, created]);
      setSupplierId(created.id);

      setNewSupplierName('');
      setNewSupplierContact('');
      setNewSupplierPhone('');
      setIsQuickSupplierModalOpen(false);
    } catch (err) {
      console.error('[PurchaseOrdersView] Error creating quick supplier:', err);
      alert('خطا در ثبت تامین‌کننده جدید');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleCreatePO = async (status: PurchaseOrderStatus = 'draft') => {
    if (!supplierId || supplierId <= 0) {
      alert('لطفاً ابتدا یک تامین‌کننده انتخاب کنید (یا از دکمه «تامین‌کننده جدید» ایجاد کنید).');
      return;
    }
    if (!warehouseId || warehouseId <= 0) {
      alert('لطفاً انبار تحویل را انتخاب کنید.');
      return;
    }
    if (items.length === 0) {
      alert('لطفاً حداقل یک قلم کالا یا متریال اولیه به فاکتور اضافه کنید.');
      return;
    }

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
        purchase_type: purchaseType,
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
        variant_id: i.variant_id || null,
        raw_material_id: i.raw_material_id || null,
        quantity_ordered: i.quantity,
        quantity_received: status === 'received' ? i.quantity : 0,
        unit_cost: i.unit_cost,
        total: i.quantity * i.unit_cost,
      }));

      const savedPO = await adapter.savePurchaseOrder(poData, poItems);

      // If status is received, record stock increment!
      if (status === 'received') {
        for (const item of items) {
          if (item.variant_id) {
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
          } else if (item.raw_material_id && adapter.saveRawMaterial && adapter.getRawMaterialById) {
            const mat = await adapter.getRawMaterialById(item.raw_material_id);
            if (mat) {
              const currentStock = Number(mat.current_stock) || 0;
              await adapter.saveRawMaterial({
                id: mat.id,
                current_stock: currentStock + item.quantity,
                unit_cost: item.unit_cost > 0 ? item.unit_cost : mat.unit_cost,
              });
            }
          }
        }

        // If accounting module is active, record Supplier Payable in Person Ledgers
        if (hasAccounting && supplierId) {
          try {
            const supp = suppliers.find((s) => Number(s.id) === Number(supplierId));
            const itemDesc = purchaseType === 'raw_material' ? 'خرید متریال و مواد اولیه' : 'خرید کالا و انبارداری';
            await adapter.savePersonTransaction({
              organization_id: Number(orgId),
              supplier_id: Number(supplierId),
              party_type: 'supplier',
              party_name: supp?.name || `تامین‌کننده #${supplierId}`,
              type: 'creditor',
              transaction_type: 'purchase_invoice',
              amount: totalAmount,
              credit_amount: totalAmount,
              status: 'pending',
              reference_number: poNumber,
              purchase_order_id: savedPO.id,
              description: `فاکتور ${itemDesc} #${poNumber}`,
              transaction_date: new Date().toISOString(),
            });
          } catch (accErr) {
            console.warn('[PurchaseOrdersView] Could not record supplier transaction:', accErr);
          }
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
      const orgId = activeOrganization?.id || 1;
      const whId = typeof po.warehouse_id === 'object' ? (po.warehouse_id as any)?.id : (po.warehouse_id || 1);
      const suppId = typeof po.supplier_id === 'object' ? (po.supplier_id as any)?.id : po.supplier_id;
      const poTotal = Number(po.total) || 0;

      const wasReceived = po.status === 'received';
      const willReceive = newStatus === 'received';

      await adapter.savePurchaseOrder({ id: po.id, status: newStatus });

      // If completing/receiving, increment stock based on ACTUAL order items
      if (!wasReceived && willReceive) {
        const poItems = await adapter.getPurchaseOrderItems(po.id);
        for (const item of poItems) {
          const varId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
          const rawMatId = (item as any).raw_material_id;
          const qty = item.quantity_received > 0 ? item.quantity_received : (item.quantity_ordered || 0);

          if (varId && qty > 0) {
            await adapter.recordMovement({
              organization_id: orgId,
              variant_id: Number(varId),
              warehouse_id: Number(whId),
              type: 'purchase',
              quantity: qty,
              reference_type: 'purchase_order',
              reference_id: String(po.id),
              note: `${t('purchasing.poReceiveStock')} #${po.purchase_number}`,
            });
          } else if (rawMatId && qty > 0 && adapter.getRawMaterialById && adapter.saveRawMaterial) {
            const mat = await adapter.getRawMaterialById(Number(rawMatId));
            if (mat) {
              const currentStock = Number(mat.current_stock) || 0;
              await adapter.saveRawMaterial({
                id: mat.id,
                current_stock: currentStock + qty,
              });
            }
          }
        }

        // Synchronize with accounting: record supplier payable
        if (hasAccounting && suppId) {
          try {
            const supp = suppliers.find((s) => Number(s.id) === Number(suppId));
            await adapter.savePersonTransaction({
              organization_id: Number(orgId),
              supplier_id: Number(suppId),
              party_type: 'supplier',
              party_name: supp?.name || `تامین‌کننده #${suppId}`,
              type: 'creditor',
              transaction_type: 'purchase_invoice',
              amount: poTotal,
              credit_amount: poTotal,
              status: 'pending',
              reference_number: po.purchase_number,
              purchase_order_id: po.id,
              description: `فاکتور خرید #${po.purchase_number} (تحویل در انبار)`,
              transaction_date: new Date().toISOString(),
            });
          } catch (accErr) {
            console.warn('[PurchaseOrdersView] Could not record supplier transaction on receive:', accErr);
          }
        }
      }
      // If was previously received and now cancelled, roll back inventory items
      else if (wasReceived && !willReceive) {
        const poItems = await adapter.getPurchaseOrderItems(po.id);
        for (const item of poItems) {
          const varId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
          const rawMatId = (item as any).raw_material_id;
          const qty = item.quantity_received > 0 ? item.quantity_received : (item.quantity_ordered || 0);

          if (varId && qty > 0) {
            await adapter.recordMovement({
              organization_id: orgId,
              variant_id: Number(varId),
              warehouse_id: Number(whId),
              type: 'adjustment',
              quantity: -qty,
              reference_type: 'purchase_order',
              reference_id: String(po.id),
              note: `برگشت ورود کالا بابت لغو سفارش خرید #${po.purchase_number}`,
            });
          } else if (rawMatId && qty > 0 && adapter.getRawMaterialById && adapter.saveRawMaterial) {
            const mat = await adapter.getRawMaterialById(Number(rawMatId));
            if (mat) {
              const currentStock = Number(mat.current_stock) || 0;
              await adapter.saveRawMaterial({
                id: mat.id,
                current_stock: Math.max(0, currentStock - qty),
              });
            }
          }
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
      const orgId = activeOrganization?.id || 1;
      const whId = typeof po.warehouse_id === 'object' ? (po.warehouse_id as any)?.id : (po.warehouse_id || 1);

      // If PO was already received, reverse stock before deleting
      if (po.status === 'received') {
        const poItems = await adapter.getPurchaseOrderItems(po.id);
        for (const item of poItems) {
          const varId = typeof item.variant_id === 'object' ? (item.variant_id as any)?.id : item.variant_id;
          const rawMatId = (item as any).raw_material_id;
          const qty = item.quantity_received > 0 ? item.quantity_received : (item.quantity_ordered || 0);

          if (varId && qty > 0) {
            await adapter.recordMovement({
              organization_id: orgId,
              variant_id: Number(varId),
              warehouse_id: Number(whId),
              type: 'adjustment',
              quantity: -qty,
              reference_type: 'purchase_order',
              reference_id: String(po.id),
              note: `کسر ورود کالا بابت حذف سفارش خرید #${po.purchase_number}`,
            });
          } else if (rawMatId && qty > 0 && adapter.getRawMaterialById && adapter.saveRawMaterial) {
            const mat = await adapter.getRawMaterialById(Number(rawMatId));
            if (mat) {
              const currentStock = Number(mat.current_stock) || 0;
              await adapter.saveRawMaterial({
                id: mat.id,
                current_stock: Math.max(0, currentStock - qty),
              });
            }
          }
        }
      }

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

  const handleOpenDetails = async (po: PurchaseOrder) => {
    setSelectedPO(po);
    setIsDetailModalOpen(true);
    setIsLoadingDetails(true);
    try {
      const adapter = storageManager.getAdapter();
      const itemsList = await adapter.getPurchaseOrderItems(po.id);
      setPoDetailsItems(itemsList);
    } catch (err) {
      console.error('[PurchaseOrdersView] Error loading PO details:', err);
    } finally {
      setIsLoadingDetails(false);
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

  const getPOTypeBadge = (poType?: string) => {
    if (poType === 'raw_material') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/50">
          <Boxes className="w-3 h-3" />
          مواد اولیه
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/50">
        <Shirt className="w-3 h-3" />
        محصول آماده
      </span>
    );
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

      {/* Unified Purchase Orders Container */}
      <Card className="border-0 sm:border bg-transparent sm:bg-white dark:sm:bg-[#181a20] shadow-none sm:shadow-sm p-0 sm:p-5 md:p-6">
        {/* Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
          <div className="w-full sm:w-80">
            <Input
              placeholder={t('purchasing.searchPOPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* 1. Desktop Tabular View */}
        <div className="hidden md:block">
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
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          {po.purchase_number}
                        </span>
                        {hasProduction && getPOTypeBadge((po as any).purchase_type)}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono mt-0.5">
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
              {
                key: 'actions',
                header: t('common.actions'),
                render: (po) => (
                  <div className="flex items-center justify-end gap-1.5">
                    {po.status === 'ordered' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUpdateStatus(po, 'received')}
                        icon={<PackageCheck className="w-3.5 h-3.5" />}
                        className="h-8 px-2.5 text-xs"
                      >
                        {t('purchasing.poReceiveStock')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetails(po)}
                      icon={<Eye className="w-3.5 h-3.5" />}
                      className="h-8 px-2.5 text-xs"
                    >
                      {t('purchasing.poDetails')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      onClick={() => handleDeletePO(po)}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* 2. Mobile Responsive Card List */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 dark:text-neutral-500 text-sm">
              {t('common.loading')}
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-neutral-500 text-sm">
              {t('purchasing.noPOsFound')}
            </div>
          ) : (
            filteredPOs.map((po) => (
              <div
                key={`mob_po_${po.id}`}
                className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#181a20] p-4 shadow-sm space-y-3 transition-all"
              >
                {/* Header: PO Number + Date + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-neutral-100 text-sm font-mono tracking-wide">
                          {po.purchase_number}
                        </h3>
                        {hasProduction && getPOTypeBadge((po as any).purchase_type)}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-neutral-500 font-mono mt-0.5">
                        {formatDate(po.date_created, isPersian)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {getPOStatusBadge(po.status)}
                  </div>
                </div>

                {/* Supplier info */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-neutral-200 truncate">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{po.supplier_name}</span>
                  </div>
                </div>

                {/* Total Invoice Amount */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">{t('purchasing.poTotalInvoice')}:</span>
                  <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                    {formatCurrency(po.total, activeOrganization?.currency, isPersian)}
                  </span>
                </div>

                {/* Bottom Actions Row */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
                  <div className="flex items-center gap-1">
                    {po.status === 'ordered' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUpdateStatus(po, 'received')}
                        icon={<PackageCheck className="w-3.5 h-3.5" />}
                        className="h-8 px-2.5 text-xs"
                      >
                        {t('purchasing.poReceiveStock')}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetails(po)}
                      icon={<Eye className="w-3.5 h-3.5" />}
                      className="h-8 px-2.5 text-xs"
                    >
                      {t('purchasing.poDetails')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      onClick={() => handleDeletePO(po)}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
          {/* Dual Purchase Type Tabs (Shown when Production module is active) */}
          {hasProduction && (
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-[#13151a] rounded-xl border border-slate-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setPurchaseType('product');
                  setItems([]);
                }}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  purchaseType === 'product'
                    ? 'bg-white dark:bg-[#1f222a] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-neutral-700'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Shirt className="w-4 h-4" />
                خرید کالای آماده (بازرگانی)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPurchaseType('raw_material');
                  setItems([]);
                }}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  purchaseType === 'raw_material'
                    ? 'bg-white dark:bg-[#1f222a] text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200/80 dark:border-neutral-700'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Boxes className="w-4 h-4" />
                خرید مواد اولیه و خرج‌کار (تولید)
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {t('purchasing.selectSupplierLabel')}
                  <span className="text-rose-500 ms-1">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickSupplierModalOpen(true)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  تامین‌کننده جدید
                </button>
              </div>
              <Select
                value={supplierId}
                onChange={(e) => setSupplierId(Number(e.target.value))}
                options={[
                  {
                    value: 0,
                    label: suppliers.length === 0 ? 'هیچ تامین‌کننده‌ای یافت نشد - تامین‌کننده جدید بسازید' : 'انتخاب تامین‌کننده...',
                  },
                  ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>

            <Select
              label={
                purchaseType === 'raw_material'
                  ? 'انبار تحویل مواد اولیه'
                  : t('purchasing.selectWarehouseLabel')
              }
              value={warehouseId}
              onChange={(e) => setWarehouseId(Number(e.target.value))}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </div>

          <div className="p-4 bg-slate-50 dark:bg-[#181a20] border border-slate-200/80 dark:border-neutral-800 rounded-xl space-y-3.5">
            <h4 className="text-xs font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {purchaseType === 'raw_material'
                ? 'انتخاب مواد اولیه و خرج‌کار سفارش'
                : t('purchasing.selectItemsBoxTitle')}
            </h4>

            {/* 1. Item Selection Field */}
            {purchaseType === 'product' ? (
              <div className="w-full">
                <SearchableVariantSelect
                  label={t('purchasing.selectVariantLabel')}
                  value={selectedVariantId || ''}
                  onChange={(id) => {
                    setSelectedVariantId(id);
                    const v = variants.find((varObj) => varObj.id === id);
                    if (v) {
                      const costVal =
                        v.cost !== undefined && v.cost !== null
                          ? Number(v.cost)
                          : (v as any).cost_price !== undefined
                          ? Number((v as any).cost_price)
                          : 0;
                      setItemCost(costVal);
                    } else {
                      setItemCost(0);
                    }
                  }}
                  variants={variants}
                  products={products}
                  placeholder={t('purchasing.selectVariantPlaceholder')}
                />
              </div>
            ) : (
              <div className="w-full">
                <SearchableRawMaterialSelect
                  label="انتخاب متریال / خرج‌کار"
                  value={selectedRawMaterialId || ''}
                  onChange={(id) => {
                    setSelectedRawMaterialId(id);
                    const rm = rawMaterials.find((r) => r.id === id);
                    if (rm) {
                      setItemCost(rm.unit_cost || 0);
                    } else {
                      setItemCost(0);
                    }
                  }}
                  rawMaterials={rawMaterials}
                  currency={activeOrganization?.currency}
                  placeholder="جستجو و انتخاب متریال اولیه یا خرج‌کار..."
                />
              </div>
            )}

            {/* 2. Quantity, Unit Cost, and Add Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-1">
              <div className="w-full sm:w-32 shrink-0">
                <Input
                  label={
                    purchaseType === 'raw_material' && selectedRawMaterialId
                      ? `مقدار (${rawMaterials.find((r) => r.id === selectedRawMaterialId)?.unit || 'واحد'})`
                      : t('purchasing.quantityLabel')
                  }
                  type="number"
                  min={1}
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                />
              </div>

              <div className="w-full sm:w-44 shrink-0">
                <Input
                  label={t('purchasing.unitCostLabel')}
                  type="number"
                  value={itemCost}
                  onChange={(e) => setItemCost(Number(e.target.value))}
                />
              </div>

              <div className="flex-1 sm:flex-initial">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddItem}
                  disabled={purchaseType === 'product' ? !selectedVariantId : !selectedRawMaterialId}
                  icon={<Plus className="w-4 h-4" />}
                  className="h-[42px] px-5 w-full sm:w-auto justify-center"
                >
                  {t('purchasing.addBtn')}
                </Button>
              </div>
            </div>

            {/* List of Added Order Items */}
            {items.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#13151a] text-slate-500 dark:text-neutral-400 text-xs">
                {t('purchasing.noItemsAdded')}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="divide-y divide-slate-100 dark:divide-neutral-800 bg-white dark:bg-[#13151a] border border-slate-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                  {items.map((item, idx) => (
                    <div
                      key={`po_item_row_${idx}`}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 pe-2">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">
                          {item.name}
                        </span>
                        <span className="text-slate-500 dark:text-neutral-400 text-[11px] font-mono">
                          {toPersianDigits(item.quantity)} {item.unit || 'عدد'} ×{' '}
                          {formatCurrency(item.unit_cost, activeOrganization?.currency, isPersian)}
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
                  ))}
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
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300">
              {t('purchasing.poNotesOptional')}
            </label>
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

      {/* Quick Supplier Creation Modal */}
      <Modal
        isOpen={isQuickSupplierModalOpen}
        onClose={() => setIsQuickSupplierModalOpen(false)}
        title="ثبت سریع تامین‌کننده جدید"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setIsQuickSupplierModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleQuickCreateSupplier}
              isLoading={isSavingSupplier}
              icon={<UserPlus className="w-4 h-4" />}
            >
              ثبت و انتخاب
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          <Input
            label="نام تامین‌کننده / کارخانه / فروشنده *"
            placeholder="مثلا: پارچه‌بافی همکاران یا آقای رضایی"
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            required
          />
          <Input
            label="نام مسئول یا رابط (اختیاری)"
            placeholder="مثلا: آقای محمدی"
            value={newSupplierContact}
            onChange={(e) => setNewSupplierContact(e.target.value)}
          />
          <Input
            label="شماره تماس / همراه (اختیاری)"
            placeholder="09121234567"
            value={newSupplierPhone}
            onChange={(e) => setNewSupplierPhone(e.target.value)}
          />
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
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-neutral-400">{t('purchasing.supplier')}:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedPO.supplier_name}</span>
              </div>
              {hasProduction && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-neutral-400">نوع سفارش:</span>
                  <div>{getPOTypeBadge((selectedPO as any).purchase_type)}</div>
                </div>
              )}
              <div className="flex justify-between items-center">
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

            {/* PO Items Table */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                لیست اقلام فاکتور خرید
              </h4>
              {isLoadingDetails ? (
                <div className="text-center py-4 text-slate-400">در حال بارگذاری اقلام...</div>
              ) : poDetailsItems.length === 0 ? (
                <div className="text-center py-4 text-slate-400 border border-dashed border-slate-200 dark:border-neutral-800 rounded-xl">
                  اقلامی یافت نشد.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-[#13151a]">
                  {poDetailsItems.map((item, idx) => {
                    let title = `#${item.id}`;
                    let unitStr = 'عدد';

                    if (item.variant_id) {
                      const v = variants.find(
                        (varObj) => varObj.id === (typeof item.variant_id === 'object' ? (item.variant_id as any).id : item.variant_id)
                      );
                      if (v) title = getVariantLabel(v);
                    } else if ((item as any).raw_material_id) {
                      const rm = rawMaterials.find(
                        (r) => r.id === Number((item as any).raw_material_id)
                      );
                      if (rm) {
                        title = `${rm.name} (${rm.code})`;
                        unitStr = rm.unit;
                      }
                    }

                    const qty = item.quantity_ordered || item.quantity_received || 0;
                    return (
                      <div key={`po_det_item_${item.id || idx}`} className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{title}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {toPersianDigits(qty)} {unitStr} × {formatCurrency(item.unit_cost, activeOrganization?.currency, isPersian)}
                          </span>
                        </div>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(qty * item.unit_cost, activeOrganization?.currency, isPersian)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
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
