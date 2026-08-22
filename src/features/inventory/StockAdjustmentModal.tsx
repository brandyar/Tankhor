import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { ProductVariant, Warehouse, WarehouseLocation, MovementType, MovementReferenceType } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toPersianDigits } from '../../utils/formatters';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, AlertCircle, Package } from 'lucide-react';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  variants: ProductVariant[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  onAdjustmentComplete: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  variants,
  warehouses,
  locations,
  onAdjustmentComplete,
}) => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [selectedVariantId, setSelectedVariantId] = useState<number | ''>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');
  const [movementType, setMovementType] = useState<MovementType>('purchase');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [referenceType, setReferenceType] = useState<MovementReferenceType>('manual');
  const [referenceId, setReferenceId] = useState('');
  const [note, setNote] = useState('');
  const [reorderPoint, setReorderPoint] = useState<number | ''>(5);
  const [safetyStock, setSafetyStock] = useState<number | ''>(2);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].id);
    }
    if (variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(variants[0].id);
    }
  }, [warehouses, variants, isOpen]);

  // Available locations for active warehouse
  const availableLocations = locations.filter(
    (l) => !selectedWarehouseId || l.warehouse_id === Number(selectedWarehouseId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId || !selectedWarehouseId || !quantity || Number(quantity) <= 0) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const variantIdNum = Number(selectedVariantId);
      const warehouseIdNum = Number(selectedWarehouseId);
      const locationIdNum = selectedLocationId ? Number(selectedLocationId) : undefined;
      const qtyNum = Number(quantity);

      // 1. Record Inventory Movement audit log
      const variantObj = variants.find((v) => v.id === variantIdNum);
      const warehouseObj = warehouses.find((w) => w.id === warehouseIdNum);

      await adapter.recordMovement({
        organization_id: orgId,
        variant_id: variantIdNum,
        warehouse_id: warehouseIdNum,
        location_id: locationIdNum,
        type: movementType,
        quantity: qtyNum,
        reference_type: referenceType,
        reference_id: referenceId || `MAN-${Date.now().toString().slice(-5)}`,
        note: note || 'تغییر دستی موجودی توسط کاربر',
        sku: variantObj?.sku,
        warehouse_name: warehouseObj?.name,
      });

      // 2. Update Inventory Items stock balances
      const currentItems = await adapter.getInventoryItems({ organization_id: orgId });
      let existingItem = currentItems.find(
        (i) => i.variant_id === variantIdNum && i.warehouse_id === warehouseIdNum
      );

      let currentQty = existingItem ? existingItem.quantity : 0;
      let currentDamaged = existingItem ? existingItem.damaged_quantity : 0;
      let currentReserved = existingItem ? existingItem.reserved_quantity : 0;

      // Adjust balances based on movement type
      if (movementType === 'purchase' || movementType === 'transfer_in' || movementType === 'return') {
        currentQty += qtyNum;
      } else if (movementType === 'sale' || movementType === 'transfer_out') {
        currentQty = Math.max(0, currentQty - qtyNum);
      } else if (movementType === 'damage') {
        currentDamaged += qtyNum;
        currentQty = Math.max(0, currentQty - qtyNum);
      } else if (movementType === 'adjustment') {
        currentQty = qtyNum; // Direct replacement
      }

      const availableQty = Math.max(0, currentQty - currentReserved);

      // Save or update inventory balance record
      const itemsList = localStorage.getItem('tankhor_db_inventory_items');
      let parsed: any[] = itemsList ? JSON.parse(itemsList) : [];

      if (existingItem) {
        parsed = parsed.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                quantity: currentQty,
                available_quantity: availableQty,
                damaged_quantity: currentDamaged,
                location_id: locationIdNum || item.location_id,
                reorder_point: reorderPoint ? Number(reorderPoint) : item.reorder_point,
                safety_stock: safetyStock ? Number(safetyStock) : item.safety_stock,
                updated_at: new Date().toISOString(),
              }
            : item
        );
      } else {
        const maxExistingId = parsed.reduce((max, i) => (typeof i.id === 'number' && i.id > max ? i.id : max), 0);
        const newInventoryId = Math.max(maxExistingId + 1, Date.now());
        parsed.unshift({
          id: newInventoryId,
          organization_id: orgId,
          variant_id: variantIdNum,
          warehouse_id: warehouseIdNum,
          location_id: locationIdNum,
          quantity: currentQty,
          reserved_quantity: 0,
          available_quantity: availableQty,
          damaged_quantity: currentDamaged,
          reorder_point: reorderPoint ? Number(reorderPoint) : 5,
          safety_stock: safetyStock ? Number(safetyStock) : 2,
          updated_at: new Date().toISOString(),
        });
      }

      localStorage.setItem('tankhor_db_inventory_items', JSON.stringify(parsed));

      // 3. Update variant total stock quantity cache
      const allVariantItems = parsed.filter((i) => i.variant_id === variantIdNum);
      const totalVariantStock = allVariantItems.reduce((acc, curr) => acc + curr.quantity, 0);

      await adapter.saveVariant({
        id: variantIdNum,
        stock_quantity: totalVariantStock,
      });

      onAdjustmentComplete();
      onClose();
    } catch (err) {
      console.error('[StockAdjustmentModal] Error recording adjustment:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <RefreshCw className="w-5 h-5 text-indigo-600" />
          <span>ثبت ورود/خروج و اصلاح موجودی کالا</span>
        </div>
      }
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSaving}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            ثبت گردش و بروزرسانی موجودی
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="انتخاب کالا / تنوع (SKU) *"
          value={selectedVariantId}
          onChange={(e) => setSelectedVariantId(Number(e.target.value))}
          options={variants.map((v) => ({
            value: v.id,
            label: `${v.sku} - ${v.product_title || ''} (${v.color_name || ''} / ${v.size_name || ''})`,
          }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="انبار / فروشگاه مقصد *"
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
            options={warehouses.map((w) => ({
              value: w.id,
              label: `${w.name} (${w.code || w.type})`,
            }))}
          />

          <Select
            label="قفسه / جایگاه دقیق انبار"
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: 'بدون جایگاه اختصاصی' },
              ...availableLocations.map((l) => ({
                value: l.id,
                label: `${l.name} (${l.code || l.type})`,
              })),
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="نوع گردش کالا *"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as MovementType)}
            options={[
              { value: 'purchase', label: 'ورود خرید (Purchase)' },
              { value: 'sale', label: 'خروج فروش (Sale)' },
              { value: 'return', label: 'ورود مرجوعی (Return)' },
              { value: 'adjustment', label: 'اصلاح دستی موجودی (Adjustment)' },
              { value: 'damage', label: 'اعلام ضایعات / آسیب (Damage)' },
              { value: 'transfer_in', label: 'ورود از انتقال (Transfer In)' },
              { value: 'transfer_out', label: 'خروج برای انتقال (Transfer Out)' },
            ]}
          />

          <Input
            label="تعداد / مقدار تغییر *"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="نقطه سفارش مجدد (Reorder Point)"
            type="number"
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value ? Number(e.target.value) : '')}
          />
          <Input
            label="ذخیره اطمینان (Safety Stock)"
            type="number"
            value={safetyStock}
            onChange={(e) => setSafetyStock(e.target.value ? Number(e.target.value) : '')}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">توضیحات و علت گردش کالا</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full bg-white border border-slate-300 rounded-xl text-slate-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="مثال: رسید فاکتور خرید فصلی، انبارگردانی پایان ماه..."
          />
        </div>
      </form>
    </Modal>
  );
};
