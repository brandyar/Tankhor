import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../../i18n';
import { useOrganization } from '../../../context/OrganizationContext';
import { useAuth } from '../../../context/AuthContext';
import { useModuleAccess } from '../../../hooks/useModuleAccess';
import { storageManager } from '../../../storage';
import {
  InventoryItem,
  Order,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  OrderReturnItemCondition,
  OrderReturnReason,
  OrderReturnSettlementMethod,
  OrderReturnType,
  Product,
  ProductVariant,
  Warehouse,
} from '../../../types';
import { FinancialAccount } from '../../../types/accounting';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { SearchableVariantSelect } from '../../../components/ui/SearchableVariantSelect';
import { ProductImage } from '../../../components/ui/ProductImage';
import { formatCurrency, toPersianDigits } from '../../../utils/formatters';
import {
  calculateEffectiveUnitRefundPrice,
  processOrderReturnOrExchange,
} from '../utils/returnProcessor';
import { printReturnReceipt } from '../../../utils/returnReceiptPrint';
import {
  RotateCcw,
  ArrowLeftRight,
  Package,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
  Trash2,
  Printer,
  Receipt,
  Sparkles,
  Wallet,
  Building2,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface OrderReturnExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess?: (createdReturn: OrderReturn) => void;
}

interface ReturnRowState {
  orderItem: OrderItem;
  variantId: number;
  productId?: number;
  variant?: ProductVariant;
  productTitle: string;
  sku: string;
  colorName?: string;
  sizeName?: string;
  originalQty: number;
  previouslyReturned: number;
  remainingQty: number;
  selectedQty: number;
  effectiveUnitPrice: number;
  unitCost: number;
  condition: OrderReturnItemCondition;
}

interface ExchangeRowState {
  variant: ProductVariant;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  isPriceMatched?: boolean;
}

export const OrderReturnExchangeModal: React.FC<OrderReturnExchangeModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';
  const { activeOrganization } = useOrganization();
  const { user } = useAuth();
  const { hasAccess } = useModuleAccess();
  const hasAccounting = hasAccess('accounting');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Loaded data
  const [rawOrderItems, setRawOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);

  // Form state
  const [mode, setMode] = useState<OrderReturnType>('return');
  const [reason, setReason] = useState<OrderReturnReason>('size_mismatch');
  const [targetWarehouseId, setTargetWarehouseId] = useState<number>(0);
  const [returnRows, setReturnRows] = useState<ReturnRowState[]>([]);
  const [exchangeRows, setExchangeRows] = useState<ExchangeRowState[]>([]);
  const [matchOriginalPrice, setMatchOriginalPrice] = useState<boolean>(true);
  const [settlementMethod, setSettlementMethod] = useState<OrderReturnSettlementMethod>('cash');
  const [financialAccountId, setFinancialAccountId] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Success screen state
  const [completedResult, setCompletedResult] = useState<{
    orderReturn: OrderReturn;
    items: OrderReturnItem[];
  } | null>(null);

  const hasCustomer = useMemo(() => {
    if (!order) return false;
    const cid =
      typeof order.customer_id === 'object' ? (order.customer_id as any)?.id : order.customer_id;
    return Boolean(cid);
  }, [order]);

  useEffect(() => {
    if (!isOpen || !order) return;

    let cancelled = false;
    const loadModalData = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      setCompletedResult(null);
      setExchangeRows([]);
      setNotes('');
      setMode('return');
      setReason('size_mismatch');
      setMatchOriginalPrice(true);

      try {
        const adapter = storageManager.getAdapter();
        const orgId = activeOrganization?.id;

        const [orderItemsList, prodList, varList, whList, invList, accList] = await Promise.all([
          adapter.getOrderItems(order.id),
          adapter.getProducts({ organization_id: orgId }),
          adapter.getVariants({ organization_id: orgId }),
          adapter.getWarehouses({ organization_id: orgId }),
          adapter.getInventoryItems({ organization_id: orgId }),
          adapter.getFinancialAccounts
            ? adapter.getFinancialAccounts({ organization_id: orgId }).catch(() => [])
            : Promise.resolve([]),
        ]);

        if (cancelled) return;

        setRawOrderItems(orderItemsList);
        setProducts(prodList);
        setVariants(varList);
        setWarehouses(whList);
        setInventoryItems(invList);
        setFinancialAccounts(accList || []);

        const origWhId =
          typeof order.warehouse_id === 'object'
            ? (order.warehouse_id as any)?.id
            : order.warehouse_id;
        const defaultWh =
          whList.find((w) => Number(w.id) === Number(origWhId)) ||
          whList.find((w) => w.is_default) ||
          whList[0];
        setTargetWarehouseId(defaultWh ? Number(defaultWh.id) : Number(origWhId) || 1);

        if (accList && accList.length > 0) {
          const defAcc = accList.find((a) => a.is_default) || accList[0];
          setFinancialAccountId(Number(defAcc.id));
        }

        // Build return rows
        const rows: ReturnRowState[] = orderItemsList.map((oi) => {
          const varId =
            typeof oi.variant_id === 'object' ? (oi.variant_id as any)?.id : oi.variant_id;
          const matchedVar = varList.find((v) => Number(v.id) === Number(varId));
          const prodId = matchedVar
            ? typeof matchedVar.product_id === 'object'
              ? (matchedVar.product_id as any)?.id
              : matchedVar.product_id
            : undefined;
          const matchedProd = prodId
            ? prodList.find((p) => Number(p.id) === Number(prodId))
            : undefined;

          const origQty = Number(oi.quantity) || 0;
          const prevRet = Number(oi.returned_quantity) || 0;
          const remaining = Math.max(0, origQty - prevRet);
          const effPrice = calculateEffectiveUnitRefundPrice(order, oi);
          const unitCost = Number(matchedVar?.cost ?? matchedVar?.buy_price ?? 0) || 0;

          return {
            orderItem: oi,
            variantId: Number(varId) || 0,
            productId: prodId ? Number(prodId) : undefined,
            variant: matchedVar,
            productTitle: matchedProd?.title || matchedVar?.product_title || t('orders.orderedItem'),
            sku: oi.variant_sku || matchedVar?.sku || '-',
            colorName: matchedVar?.color_name,
            sizeName: matchedVar?.size_name,
            originalQty: origQty,
            previouslyReturned: prevRet,
            remainingQty: remaining,
            selectedQty: 0,
            effectiveUnitPrice: effPrice,
            unitCost,
            condition: 'restockable',
          };
        });

        // Pre-select 1 unit if there's only one returnable line item
        const returnableRows = rows.filter((r) => r.remainingQty > 0);
        if (returnableRows.length === 1) {
          returnableRows[0].selectedQty = 1;
        }

        setReturnRows(rows);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[OrderReturnExchangeModal] Failed to load data:', err);
          setErrorMsg(err?.message || 'خطا در بارگذاری اطلاعات سفارش.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadModalData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, order?.id, activeOrganization?.id]);

  // Stock map for selected target warehouse
  const warehouseStockMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const inv of inventoryItems) {
      const wId =
        typeof inv.warehouse_id === 'object' ? (inv.warehouse_id as any)?.id : inv.warehouse_id;
      if (Number(wId) !== Number(targetWarehouseId)) continue;
      const vId =
        typeof inv.variant_id === 'object' ? (inv.variant_id as any)?.id : inv.variant_id;
      const avail =
        inv.available_quantity !== undefined
          ? Number(inv.available_quantity)
          : Math.max(0, (Number(inv.quantity) || 0) - (Number(inv.reserved_quantity) || 0) - (Number(inv.damaged_quantity) || 0));
      map.set(Number(vId), (map.get(Number(vId)) || 0) + avail);
    }
    return map;
  }, [inventoryItems, targetWarehouseId]);

  // Enriched variants with stock for target warehouse
  const variantsWithStock = useMemo(() => {
    return variants.map((v) => ({
      ...v,
      stock_quantity: warehouseStockMap.get(Number(v.id)) || 0,
    }));
  }, [variants, warehouseStockMap]);

  // Sibling variants for quick apparel size/color swap
  const siblingGroups = useMemo(() => {
    const selected = returnRows.filter((r) => r.selectedQty > 0 && r.productId);
    const seenProducts = new Set<number>();
    const groups: {
      productId: number;
      productTitle: string;
      referenceUnitPrice: number;
      returnedVariantIds: Set<number>;
      siblings: (ProductVariant & { availableStock: number })[];
    }[] = [];

    for (const row of selected) {
      if (!row.productId || seenProducts.has(row.productId)) continue;
      seenProducts.add(row.productId);

      const retVarIds = new Set(
        selected.filter((s) => s.productId === row.productId).map((s) => s.variantId)
      );

      const siblings = variants
        .filter((v) => {
          const pId =
            typeof v.product_id === 'object' ? (v.product_id as any)?.id : v.product_id;
          return Number(pId) === row.productId;
        })
        .map((v) => ({
          ...v,
          availableStock: warehouseStockMap.get(Number(v.id)) || 0,
        }));

      if (siblings.length > 1) {
        groups.push({
          productId: row.productId,
          productTitle: row.productTitle,
          referenceUnitPrice: row.effectiveUnitPrice,
          returnedVariantIds: retVarIds,
          siblings,
        });
      }
    }
    return groups;
  }, [returnRows, variants, warehouseStockMap]);

  // Financial calculations
  const returnedTotal = useMemo(
    () =>
      returnRows.reduce(
        (sum, r) => sum + Math.round(r.selectedQty * r.effectiveUnitPrice),
        0
      ),
    [returnRows]
  );

  const exchangeTotal = useMemo(
    () =>
      mode === 'exchange'
        ? exchangeRows.reduce(
            (sum, r) => sum + Math.round(r.quantity * (Number(r.unitPrice) || 0)),
            0
          )
        : 0,
    [mode, exchangeRows]
  );

  const netAmount = exchangeTotal - returnedTotal;

  // Auto-adjust settlement method when netAmount direction changes
  useEffect(() => {
    if (netAmount === 0) {
      setSettlementMethod('none');
    } else if (netAmount < 0) {
      if (settlementMethod === 'none' || settlementMethod === 'credit') {
        setSettlementMethod('cash');
      }
    } else if (netAmount > 0) {
      if (settlementMethod === 'none' || settlementMethod === 'store_credit') {
        setSettlementMethod('pos');
      }
    }
  }, [netAmount]);

  const updateReturnQty = (orderItemId: number, delta: number) => {
    setReturnRows((prev) =>
      prev.map((row) => {
        if (row.orderItem.id !== orderItemId) return row;
        const next = Math.max(0, Math.min(row.remainingQty, row.selectedQty + delta));
        return { ...row, selectedQty: next };
      })
    );
  };

  const updateReturnCondition = (orderItemId: number, condition: OrderReturnItemCondition) => {
    setReturnRows((prev) =>
      prev.map((row) =>
        row.orderItem.id === orderItemId ? { ...row, condition } : row
      )
    );
  };

  const handleAddExchangeVariant = (
    variantId: number,
    overridePrice?: number,
    isPriceMatched?: boolean
  ) => {
    const found = variants.find((v) => Number(v.id) === Number(variantId));
    if (!found) return;
    const prodId =
      typeof found.product_id === 'object' ? (found.product_id as any)?.id : found.product_id;
    const prod = products.find((p) => Number(p.id) === Number(prodId));
    const title = prod?.title || found.product_title || t('orders.untitledProduct');

    const catalogPrice = Number(found.price) || 0;
    const finalPrice =
      overridePrice !== undefined ? overridePrice : catalogPrice;

    setExchangeRows((prev) => {
      const existingIdx = prev.findIndex((r) => Number(r.variant.id) === Number(found.id));
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + 1,
        };
        return next;
      }
      return [
        ...prev,
        {
          variant: found,
          productTitle: title,
          quantity: 1,
          unitPrice: finalPrice,
          isPriceMatched,
        },
      ];
    });
  };

  const handleTogglePriceMatch = (checked: boolean) => {
    setMatchOriginalPrice(checked);
    // Update existing sibling items' unit prices dynamically
    setExchangeRows((prev) =>
      prev.map((row) => {
        const vProdId =
          typeof row.variant.product_id === 'object'
            ? (row.variant.product_id as any)?.id
            : row.variant.product_id;
        const matchingGroup = siblingGroups.find((g) => g.productId === Number(vProdId));
        if (!matchingGroup) return row;
        return {
          ...row,
          unitPrice: checked ? matchingGroup.referenceUnitPrice : Number(row.variant.price) || 0,
          isPriceMatched: checked,
        };
      })
    );
  };

  const handleSubmit = async () => {
    if (!order || !activeOrganization?.id) return;
    setErrorMsg(null);

    const selectedReturns = returnRows.filter((r) => r.selectedQty > 0);
    if (selectedReturns.length === 0) {
      setErrorMsg('لطفاً حداقل یک کالا را برای مرجوعی یا تعویض انتخاب کنید.');
      return;
    }

    if (mode === 'exchange' && exchangeRows.length === 0) {
      setErrorMsg('لطفاً حداقل یک کالای جایگزین انتخاب کنید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await processOrderReturnOrExchange({
        organizationId: Number(activeOrganization.id),
        order,
        allOrderItems: rawOrderItems,
        type: mode,
        reason,
        warehouseId: targetWarehouseId,
        returnedLines: selectedReturns.map((r) => ({
          orderItem: r.orderItem,
          variantId: r.variantId,
          quantity: r.selectedQty,
          unitPrice: r.effectiveUnitPrice,
          unitCost: r.unitCost,
          condition: r.condition,
          productTitle: r.productTitle,
          sku: r.sku,
          colorName: r.colorName,
          sizeName: r.sizeName,
        })),
        exchangedLines:
          mode === 'exchange'
            ? exchangeRows.map((e) => ({
                variant: e.variant,
                quantity: e.quantity,
                unitPrice: e.unitPrice,
                productTitle: e.productTitle,
              }))
            : [],
        settlementMethod: netAmount === 0 ? 'none' : settlementMethod,
        financialAccountId: financialAccountId || null,
        notes,
        userId: user?.id ? String(user.id) : undefined,
        hasAccounting,
      });

      const whName = warehouses.find((w) => Number(w.id) === Number(targetWarehouseId))?.name;

      // Enrich items with titles/SKUs for immediate printing
      const enrichedItems: OrderReturnItem[] = result.savedItems.map((it) => {
        const vId =
          typeof it.variant_id === 'object' ? (it.variant_id as any)?.id : it.variant_id;
        const matchedVar = variants.find((v) => Number(v.id) === Number(vId));
        const pId = matchedVar
          ? typeof matchedVar.product_id === 'object'
            ? (matchedVar.product_id as any)?.id
            : matchedVar.product_id
          : undefined;
        const matchedProd = pId ? products.find((p) => Number(p.id) === Number(pId)) : undefined;

        return {
          ...it,
          sku: it.sku || matchedVar?.sku || '-',
          product_title: it.product_title || matchedProd?.title || matchedVar?.product_title || t('orders.orderedItem'),
          color_name: it.color_name || matchedVar?.color_name,
          size_name: it.size_name || matchedVar?.size_name,
        };
      });

      const enrichedReturn: OrderReturn = {
        ...result.savedReturn,
        original_order_number: order.order_number,
        customer_name: order.customer_name,
        warehouse_name: whName || (order as any).warehouse_name,
        items: enrichedItems,
      };

      setCompletedResult({
        orderReturn: enrichedReturn,
        items: enrichedItems,
      });

      onSuccess?.(enrichedReturn);
    } catch (err: any) {
      console.error('[OrderReturnExchangeModal] Submit failed:', err);
      setErrorMsg(err?.message || 'خطا در ثبت سند مرجوعی / تعویض.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  const hasAnyReturnable = returnRows.some((r) => r.remainingQty > 0);
  const selectedReturnCount = returnRows.reduce((s, r) => s + r.selectedQty, 0);
  const isLiquidSettlement =
    netAmount !== 0 && ['cash', 'pos', 'card', 'bank'].includes(settlementMethod);

  const reasonOptions: { value: OrderReturnReason; label: string }[] = [
    { value: 'size_mismatch', label: t('orders.reasonSizeMismatch') },
    { value: 'color_mismatch', label: t('orders.reasonColorMismatch') },
    { value: 'defective', label: t('orders.reasonDefective') },
    { value: 'wrong_item', label: t('orders.reasonWrongItem') },
    { value: 'customer_changed_mind', label: t('orders.reasonChangedMind') },
    { value: 'other', label: t('orders.reasonOther') },
  ];

  const settlementOptions: { value: OrderReturnSettlementMethod; label: string; disabled?: boolean }[] =
    netAmount < 0
      ? [
          { value: 'cash', label: t('orders.settlementCash') },
          { value: 'card', label: t('orders.settlementCard') },
          { value: 'bank', label: t('orders.settlementBank') },
          { value: 'pos', label: t('orders.settlementPos') },
          {
            value: 'store_credit',
            label: t('orders.settlementStoreCredit'),
            disabled: !hasCustomer,
          },
        ]
      : netAmount > 0
      ? [
          { value: 'pos', label: t('orders.settlementPos') },
          { value: 'cash', label: t('orders.settlementCash') },
          { value: 'card', label: t('orders.settlementCard') },
          { value: 'bank', label: t('orders.settlementBank') },
          {
            value: 'credit',
            label: t('orders.settlementCredit'),
            disabled: !hasCustomer,
          },
        ]
      : [{ value: 'none', label: t('orders.settlementNone') }];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={t('orders.returnModalTitle', { number: order.order_number })}
      maxWidth="max-w-4xl"
    >
      {completedResult ? (
        /* Success State with Instant Print */
        <div className="py-6 px-2 text-center space-y-5 font-sans">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              {t('orders.returnSuccessTitle', { number: completedResult.orderReturn.return_number })}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
              {t('orders.returnSuccessDesc')}
            </p>
          </div>

          <div className="max-w-md mx-auto p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">{t('orders.returnedTotalValue')}:</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-white">
                {formatCurrency(completedResult.orderReturn.returned_total, 'TOMAN', isPersian)}
              </span>
            </div>
            {completedResult.orderReturn.type === 'exchange' && (
              <div className="flex justify-between">
                <span className="text-neutral-500">{t('orders.exchangedTotalValue')}:</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">
                  {formatCurrency(completedResult.orderReturn.exchange_total, 'TOMAN', isPersian)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800 font-bold">
              <span>
                {completedResult.orderReturn.net_amount < 0
                  ? t('orders.netRefundToCustomer')
                  : completedResult.orderReturn.net_amount > 0
                  ? t('orders.netCollectFromCustomer')
                  : t('orders.netEvenExchange')}
              </span>
              <span
                className={`font-mono ${
                  completedResult.orderReturn.net_amount < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : completedResult.orderReturn.net_amount > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {formatCurrency(Math.abs(completedResult.orderReturn.net_amount), 'TOMAN', isPersian)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={() =>
                printReturnReceipt({
                  orderReturn: completedResult.orderReturn,
                  items: completedResult.items,
                  organization: activeOrganization,
                  format: 'a4',
                  isPersian,
                })
              }
              icon={<Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
            >
              {t('orders.printReturnA4')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                printReturnReceipt({
                  orderReturn: completedResult.orderReturn,
                  items: completedResult.items,
                  organization: activeOrganization,
                  format: 'thermal',
                  isPersian,
                })
              }
              icon={<Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            >
              {t('orders.printReturnThermal')}
            </Button>
            <Button variant="primary" onClick={onClose}>
              {t('orders.close')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 text-xs font-sans pt-1">
          {/* Top Mode Switcher */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setMode('return')}
              className={`p-3 rounded-xl border text-start transition-all flex items-center gap-2.5 cursor-pointer ${
                mode === 'return'
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-900 dark:text-rose-200 shadow-xs'
                  : 'bg-white dark:bg-[#181a20] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  mode === 'return'
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs truncate">{t('orders.modeReturn')}</div>
                <div className="text-[10px] opacity-75 mt-0.5 truncate">
                  {order.customer_name || t('orders.generalCustomer')}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('exchange')}
              className={`p-3 rounded-xl border text-start transition-all flex items-center gap-2.5 cursor-pointer ${
                mode === 'exchange'
                  ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                  : 'bg-white dark:bg-[#181a20] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  mode === 'exchange'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs truncate">{t('orders.modeExchange')}</div>
                <div className="text-[10px] opacity-75 mt-0.5 truncate">
                  {t('orders.quickSiblingSwap')}
                </div>
              </div>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-center text-neutral-400">{t('orders.loadingOrderItems')}</div>
          ) : !hasAnyReturnable ? (
            <div className="py-10 text-center space-y-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <Package className="w-8 h-8 text-neutral-400 mx-auto" />
              <p className="text-neutral-600 dark:text-neutral-300 font-bold">
                {t('orders.noReturnableItemsLeft')}
              </p>
            </div>
          ) : (
            <>
              {/* Section 1: Items to Return */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-rose-500" />
                    <span>{t('orders.selectItemsToReturn')}</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-48">
                      <Select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as OrderReturnReason)}
                        options={reasonOptions}
                        className="text-xs py-1"
                      />
                    </div>
                    <div className="w-44">
                      <Select
                        value={targetWarehouseId}
                        onChange={(e) => setTargetWarehouseId(Number(e.target.value))}
                        options={warehouses.map((w) => ({
                          value: w.id,
                          label: w.name,
                        }))}
                        className="text-xs py-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {returnRows.map((row) => {
                    const isDisabled = row.remainingQty <= 0;
                    const isSelected = row.selectedQty > 0;

                    return (
                      <div
                        key={`ret_row_${row.orderItem.id}`}
                        className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isDisabled
                            ? 'bg-neutral-50/70 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/60 opacity-60'
                            : isSelected
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/70'
                            : 'bg-white dark:bg-[#181a20] border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <ProductImage
                            src={row.variant?.image}
                            fallbackText={row.sku}
                            containerClassName="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-neutral-900 dark:text-neutral-100 truncate">
                              {row.productTitle}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                              <span>SKU: {row.sku}</span>
                              {row.sizeName && <span>• {t('orders.size')}: {row.sizeName}</span>}
                              {row.colorName && <span>• {t('orders.color')}: {row.colorName}</span>}
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                • {t('orders.returnUnitPrice')}:{' '}
                                {formatCurrency(row.effectiveUnitPrice, 'TOMAN', isPersian)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px]">
                              <span className="text-neutral-500">
                                {t('orders.originalQty')}:{' '}
                                <strong className="font-mono">
                                  {isPersian ? toPersianDigits(row.originalQty) : row.originalQty}
                                </strong>
                              </span>
                              {row.previouslyReturned > 0 && (
                                <Badge variant="warning">
                                  {t('orders.returnedQtyBadge', {
                                    count: isPersian
                                      ? toPersianDigits(row.previouslyReturned)
                                      : row.previouslyReturned,
                                  })}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {!isDisabled && (
                          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0">
                            {/* Condition toggle */}
                            {isSelected && (
                              <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-white dark:bg-neutral-900">
                                <button
                                  type="button"
                                  onClick={() => updateReturnCondition(row.orderItem.id, 'restockable')}
                                  className={`px-2 py-1.5 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                    row.condition === 'restockable'
                                      ? 'bg-emerald-600 text-white'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                  }`}
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>{t('orders.conditionRestockable')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateReturnCondition(row.orderItem.id, 'damaged')}
                                  className={`px-2 py-1.5 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                    row.condition === 'damaged'
                                      ? 'bg-rose-600 text-white'
                                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                  }`}
                                >
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>{t('orders.conditionDamaged')}</span>
                                </button>
                              </div>
                            )}

                            {/* Qty Stepper */}
                            <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => updateReturnQty(row.orderItem.id, -1)}
                                disabled={row.selectedQty <= 0}
                                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center font-mono font-black text-neutral-900 dark:text-white">
                                {isPersian ? toPersianDigits(row.selectedQty) : row.selectedQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateReturnQty(row.orderItem.id, 1)}
                                disabled={row.selectedQty >= row.remainingQty}
                                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Exchange Items (only in Exchange mode) */}
              {mode === 'exchange' && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/15 border border-indigo-200/80 dark:border-indigo-900/50 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <ArrowLeftRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{t('orders.exchangeSectionTitle')}</span>
                    </h4>

                    <label className="flex items-center gap-2 text-[11px] font-medium text-indigo-900 dark:text-indigo-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={matchOriginalPrice}
                        onChange={(e) => handleTogglePriceMatch(e.target.checked)}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{t('orders.matchOriginalPriceToggle')}</span>
                    </label>
                  </div>

                  {/* Quick Sibling Size/Color Swap Chips */}
                  {siblingGroups.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t('orders.quickSiblingSwap')}</span>
                      </div>
                      {siblingGroups.map((group) => (
                        <div
                          key={`sib_grp_${group.productId}`}
                          className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-indigo-100 dark:border-indigo-900/40 space-y-2"
                        >
                          <div className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                            {group.productTitle}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {group.siblings.map((sib) => {
                              const outOfStock = sib.availableStock <= 0;
                              const isSameAsReturned = group.returnedVariantIds.has(Number(sib.id));
                              return (
                                <button
                                  key={`sib_${sib.id}`}
                                  type="button"
                                  disabled={outOfStock}
                                  onClick={() =>
                                    handleAddExchangeVariant(
                                      sib.id,
                                      matchOriginalPrice ? group.referenceUnitPrice : Number(sib.price) || 0,
                                      matchOriginalPrice
                                    )
                                  }
                                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                                    outOfStock
                                      ? 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400 cursor-not-allowed line-through'
                                      : isSameAsReturned
                                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 hover:border-amber-400'
                                      : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                                  }`}
                                >
                                  <span className="font-bold">
                                    {sib.size_name || sib.sku}
                                    {sib.color_name ? ` / ${sib.color_name}` : ''}
                                  </span>
                                  <span className="font-mono text-[10px] opacity-80">
                                    ({isPersian ? toPersianDigits(sib.availableStock) : sib.availableStock})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* General Catalog Variant Picker */}
                  <div>
                    <SearchableVariantSelect
                      variants={variantsWithStock}
                      products={products}
                      value=""
                      onChange={(variantId) => handleAddExchangeVariant(variantId)}
                      label={t('orders.addAnyVariant')}
                      placeholder={t('orders.searchProductVariant')}
                    />
                  </div>

                  {/* Selected Replacement Items */}
                  {exchangeRows.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                        {t('orders.selectedExchangeItems')}
                      </div>
                      {exchangeRows.map((ex, idx) => {
                        const stock = warehouseStockMap.get(Number(ex.variant.id)) || 0;
                        return (
                          <div
                            key={`ex_row_${ex.variant.id}_${idx}`}
                            className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-1.5">
                                <span>{ex.productTitle}</span>
                                {ex.isPriceMatched && (
                                  <Badge variant="info">{t('orders.matchOriginalPriceToggle').split('(')[0].trim()}</Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                                SKU: {ex.variant.sku}
                                {ex.variant.size_name ? ` • ${ex.variant.size_name}` : ''}
                                {ex.variant.color_name ? ` • ${ex.variant.color_name}` : ''}
                                {' • '}
                                {t('orders.stockInCount', {
                                  count: isPersian ? toPersianDigits(stock) : stock,
                                })}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                type="number"
                                min={0}
                                value={ex.unitPrice}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  setExchangeRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, unitPrice: val, isPriceMatched: false } : r
                                    )
                                  );
                                }}
                                className="w-28 px-2 py-1.5 text-xs font-mono bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
                              />
                              <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExchangeRows((prev) =>
                                      prev
                                        .map((r, i) =>
                                          i === idx ? { ...r, quantity: r.quantity - 1 } : r
                                        )
                                        .filter((r) => r.quantity > 0)
                                    )
                                  }
                                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center font-mono font-bold">
                                  {isPersian ? toPersianDigits(ex.quantity) : ex.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExchangeRows((prev) =>
                                      prev.map((r, i) =>
                                        i === idx ? { ...r, quantity: r.quantity + 1 } : r
                                      )
                                    )
                                  }
                                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setExchangeRows((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-[11px] text-indigo-700/70 dark:text-indigo-300/70">
                      {t('orders.noExchangeItemsYet')}
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: Financial Settlement Summary */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#14161d] border border-neutral-200 dark:border-neutral-800 space-y-3.5">
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <span>{t('orders.settlementSummary')}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">
                      {t('orders.returnedTotalValue')}
                    </span>
                    <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                      {formatCurrency(returnedTotal, 'TOMAN', isPersian)}
                    </span>
                  </div>

                  {mode === 'exchange' && (
                    <div className="p-3 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800">
                      <span className="text-[10px] text-neutral-500 block">
                        {t('orders.exchangedTotalValue')}
                      </span>
                      <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(exchangeTotal, 'TOMAN', isPersian)}
                      </span>
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-xl border ${
                      mode === 'return' ? 'sm:col-span-2' : ''
                    } ${
                      netAmount < 0
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/70'
                        : netAmount > 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70'
                        : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/70'
                    }`}
                  >
                    <span className="text-[10px] font-bold block opacity-80">
                      {netAmount < 0
                        ? t('orders.netRefundToCustomer')
                        : netAmount > 0
                        ? t('orders.netCollectFromCustomer')
                        : t('orders.netEvenExchange')}
                    </span>
                    <span
                      className={`font-mono font-black text-base ${
                        netAmount < 0
                          ? 'text-rose-700 dark:text-rose-300'
                          : netAmount > 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {formatCurrency(Math.abs(netAmount), 'TOMAN', isPersian)}
                    </span>
                  </div>
                </div>

                {/* Settlement method & financial account */}
                {netAmount !== 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        {t('orders.settlementMethodLabel')}
                      </label>
                      <select
                        value={settlementMethod}
                        onChange={(e) =>
                          setSettlementMethod(e.target.value as OrderReturnSettlementMethod)
                        }
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {settlementOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {!hasCustomer && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                          {t('orders.storeCreditRequiresCustomer')}
                        </p>
                      )}
                    </div>

                    {isLiquidSettlement && financialAccounts.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                          {t('orders.settlementAccountLabel')}
                        </label>
                        <Select
                          value={financialAccountId}
                          onChange={(e) => setFinancialAccountId(Number(e.target.value))}
                          options={financialAccounts.map((acc) => ({
                            value: acc.id,
                            label: `${acc.name} (${formatCurrency(acc.current_balance || 0, 'TOMAN', isPersian)})`,
                          }))}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('orders.returnNotesPlaceholder')}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                  {t('orders.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={
                    selectedReturnCount === 0 || (mode === 'exchange' && exchangeRows.length === 0)
                  }
                  icon={
                    mode === 'exchange' ? (
                      <ArrowLeftRight className="w-4 h-4" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )
                  }
                >
                  {mode === 'exchange' ? t('orders.submitExchange') : t('orders.submitReturn')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
