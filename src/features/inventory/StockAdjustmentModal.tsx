import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { ProductVariant, Warehouse, WarehouseLocation, MovementType, MovementReferenceType, InventoryItem } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SearchableVariantSelect } from '../../components/ui/SearchableVariantSelect';
import { toPersianDigits, normalizeId } from '../../utils/formatters';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, AlertCircle, Package } from 'lucide-react';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  variants: ProductVariant[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  onAdjustmentComplete: () => void;
  initialItem?: InventoryItem | null;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  variants,
  warehouses,
  locations,
  onAdjustmentComplete,
  initialItem,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';
  const { activeOrganization } = useOrganization();

  const [selectedVariantId, setSelectedVariantId] = useState<number | ''>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');
  const [movementType, setMovementType] = useState<MovementType>('adjustment');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [referenceType, setReferenceType] = useState<MovementReferenceType>('manual');
  const [referenceId, setReferenceId] = useState('');
  const [note, setNote] = useState('');
  const [reorderPoint, setReorderPoint] = useState<number | ''>(5);
  const [safetyStock, setSafetyStock] = useState<number | ''>(2);
  const [isSaving, setIsSaving] = useState(false);

  // Direction: 'increase' (+) or 'decrease' (-) for non-adjustment or signed input
  const [adjustDirection, setAdjustDirection] = useState<'increase' | 'decrease'>('increase');

  // When modal opens or initialItem changes, initialize form
  useEffect(() => {
    if (!isOpen) return;

    if (initialItem) {
      const vId = normalizeId(initialItem.variant_id);
      const wId = normalizeId(initialItem.warehouse_id);
      const lId = normalizeId(initialItem.location_id);

      setSelectedVariantId(vId || '');
      setSelectedWarehouseId(wId || (warehouses[0]?.id ?? ''));
      setSelectedLocationId(lId || '');
      setReorderPoint(initialItem.reorder_point ?? 5);
      setSafetyStock(initialItem.safety_stock ?? 2);
      setMovementType('adjustment');
      setQuantity(Math.max(0, initialItem.quantity ?? 0));
      setNote('');
      setReferenceId('');
      setAdjustDirection('increase');
    } else {
      if (warehouses.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(warehouses[0].id);
      }
      if (variants.length > 0 && !selectedVariantId) {
        setSelectedVariantId(variants[0].id);
      }
      setMovementType('adjustment');
      setQuantity(1);
      setAdjustDirection('increase');
    }
  }, [isOpen, initialItem, warehouses, variants]);

  // Available locations for active warehouse
  const availableLocations = locations.filter(
    (l) => !selectedWarehouseId || l.warehouse_id === Number(selectedWarehouseId)
  );

  // Resolved selected variant details
  const selectedVariant = variants.find((v) => v.id === Number(selectedVariantId));

  const handleQuantityChange = (valStr: string) => {
    if (valStr === '') {
      setQuantity('');
      return;
    }
    const val = Number(valStr);
    if (isNaN(val)) return;

    // If user enters a negative number
    if (val < 0) {
      if (movementType === 'adjustment') {
        // Absolute final balance cannot be below zero
        setQuantity(0);
      } else {
        setAdjustDirection('decrease');
        setQuantity(Math.abs(val));
      }
    } else {
      setQuantity(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId || !selectedWarehouseId || quantity === '' || isNaN(Number(quantity))) {
      return;
    }

    const rawQty = Number(quantity);
    let finalMovementType: MovementType = movementType;
    let finalQty = Math.abs(rawQty);

    if (movementType === 'adjustment') {
      // Direct exact balance setting: quantity is the desired stock count
      finalMovementType = 'adjustment';
      finalQty = Math.max(0, Math.floor(rawQty));
    } else {
      // Relative change: if user selected decrease, map to sale or damage or keep type
      if (adjustDirection === 'decrease') {
        if (movementType === 'purchase') {
          finalMovementType = 'sale';
        } else if (movementType === 'transfer_in') {
          finalMovementType = 'transfer_out';
        } else if (movementType === 'return') {
          finalMovementType = 'sale';
        }
      }
      if (finalQty <= 0) return;
    }

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const variantIdNum = Number(selectedVariantId);
      const warehouseIdNum = Number(selectedWarehouseId);
      const locationIdNum = selectedLocationId ? Number(selectedLocationId) : undefined;

      const variantObj = variants.find((v) => v.id === variantIdNum);
      const warehouseObj = warehouses.find((w) => w.id === warehouseIdNum);

      // 1. Record movement (auto-adjusts existing item balance across Cloud, Local, and SQLite adapters)
      await adapter.recordMovement({
        organization_id: orgId,
        variant_id: variantIdNum,
        warehouse_id: warehouseIdNum,
        location_id: locationIdNum,
        type: finalMovementType,
        quantity: finalQty,
        reference_type: referenceType,
        reference_id: referenceId || `MAN-${Date.now().toString().slice(-5)}`,
        note: note || t('inventory.stockAdjustment'),
        sku: variantObj?.sku,
        warehouse_name: warehouseObj?.name,
      });

      // 2. If reorder point or safety stock was customized, ensure it's saved on the inventory item
      if (reorderPoint !== '' || safetyStock !== '') {
        const currentItems = await adapter.getInventoryItems({ organization_id: orgId });
        const existingItem = currentItems.find((i) => {
          const vId = normalizeId(i.variant_id);
          const wId = normalizeId(i.warehouse_id);
          return vId === variantIdNum && wId === warehouseIdNum;
        });

        if (existingItem) {
          await adapter.saveInventoryItem({
            id: existingItem.id,
            reorder_point: reorderPoint !== '' ? Number(reorderPoint) : existingItem.reorder_point,
            safety_stock: safetyStock !== '' ? Number(safetyStock) : existingItem.safety_stock,
          });
        }
      }

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
        <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100">
          <RefreshCw className="w-5 h-5 text-indigo-600" />
          <span>{t('inventory.stockAdjustmentModalTitle')}</span>
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
            disabled={quantity === '' || (!selectedVariantId && !initialItem)}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {t('inventory.saveAdjustmentBtn')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* If invoked directly for a specific item, show fixed item banner */}
        {initialItem ? (
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/80 rounded-2xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block mb-0.5 font-medium">
                {t('inventory.adjustItemIndividual')}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100 px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700">
                  {initialItem.sku || (selectedVariant?.sku ?? `VAR-#${initialItem.variant_id}`)}
                </span>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                  {initialItem.product_title || selectedVariant?.product_title || t('products.product')}
                </span>
                {(initialItem.size_name || initialItem.color_name) && (
                  <span className="text-xs text-neutral-500 font-mono">
                    ({initialItem.size_name !== '-' ? initialItem.size_name : ''} {initialItem.color_name !== '-' ? initialItem.color_name : ''})
                  </span>
                )}
              </div>
            </div>
            <div className="text-end shrink-0">
              <span className="text-[10px] text-neutral-400 block">{t('inventory.currentStockInWarehouse')}</span>
              <span className="font-mono font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                {isPersian ? toPersianDigits(initialItem.quantity) : initialItem.quantity}
              </span>
            </div>
          </div>
        ) : (
          <SearchableVariantSelect
            label={t('inventory.selectVariantSku')}
            required
            value={selectedVariantId}
            onChange={(variantId) => setSelectedVariantId(variantId)}
            variants={variants}
            placeholder={t('inventory.selectOrSearchVariant')}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={t('inventory.destWarehouseStore') + ' *'}
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
            options={warehouses.map((w) => ({
              value: w.id,
              label: `${w.name} (${w.code || w.type})`,
            }))}
          />

          <Select
            label={t('inventory.locationShelf')}
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: t('inventory.noDedicatedLocation') },
              ...availableLocations.map((l) => ({
                value: l.id,
                label: `${l.name} (${l.code || l.type})`,
              })),
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={t('inventory.movementTypeRequired')}
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as MovementType)}
            options={[
              { value: 'adjustment', label: `${t('inventory.movementTypeAdjustment')} (${t('inventory.adjustModeExactBalance')})` },
              { value: 'purchase', label: t('inventory.movementTypePurchase') },
              { value: 'sale', label: t('inventory.movementTypeSale') },
              { value: 'return', label: t('inventory.movementTypeReturn') },
              { value: 'damage', label: t('inventory.movementTypeDamage') },
              { value: 'transfer_in', label: t('inventory.movementTypeTransferIn') },
              { value: 'transfer_out', label: t('inventory.movementTypeTransferOut') },
            ]}
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                {movementType === 'adjustment'
                  ? `${t('inventory.quantityOnHand')} (${t('inventory.adjustModeExactBalance')}) *`
                  : `${t('inventory.quantityChange')} *`}
              </label>

              {movementType !== 'adjustment' && (
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setAdjustDirection('increase')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      adjustDirection === 'increase'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700'
                        : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    {t('inventory.adjustDirectionIncrease')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustDirection('decrease')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      adjustDirection === 'decrease'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-700'
                        : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    {t('inventory.adjustDirectionDecrease')}
                  </button>
                </div>
              )}
            </div>

            <Input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              placeholder={movementType === 'adjustment' ? '0' : '1'}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('inventory.reorderPoint')}
            type="number"
            min={0}
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value ? Number(e.target.value) : '')}
          />
          <Input
            label={t('inventory.safetyStock')}
            type="number"
            min={0}
            value={safetyStock}
            onChange={(e) => setSafetyStock(e.target.value ? Number(e.target.value) : '')}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {t('inventory.movementDescriptionLabel')}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full bg-white dark:bg-[#181a20] border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 text-xs p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={t('inventory.movementDescriptionPlaceholder')}
          />
        </div>
      </form>
    </Modal>
  );
};
