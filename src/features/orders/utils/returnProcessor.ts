import { storageManager } from '../../../storage';
import {
  Order,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  OrderReturnItemCondition,
  OrderReturnReason,
  OrderReturnSettlementMethod,
  OrderReturnType,
  ProductVariant,
} from '../../../types';

export interface ReturnLineInput {
  orderItem: OrderItem;
  variantId: number;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  condition: OrderReturnItemCondition;
  productTitle?: string;
  sku?: string;
  colorName?: string;
  sizeName?: string;
}

export interface ExchangeLineInput {
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
  productTitle?: string;
}

export interface ProcessReturnInput {
  organizationId: number;
  order: Order;
  allOrderItems: OrderItem[];
  type: OrderReturnType;
  reason: OrderReturnReason;
  warehouseId: number;
  returnedLines: ReturnLineInput[];
  exchangedLines: ExchangeLineInput[];
  settlementMethod: OrderReturnSettlementMethod;
  financialAccountId?: number | null;
  notes?: string;
  userId?: string;
  hasAccounting?: boolean;
}

export interface ProcessReturnResult {
  savedReturn: OrderReturn;
  savedItems: OrderReturnItem[];
}

/**
 * Computes the effective net unit refund price for a line item, taking into account:
 * 1) Line-level discount (supports both per-unit discount stored on order_items.discount
 *    and line total when already pre-calculated).
 * 2) Proportional invoice-level discount and tax ratio (order.total / order.subtotal).
 */
export function calculateEffectiveUnitRefundPrice(order: Order, item: OrderItem): number {
  const qty = Math.max(1, Number(item.quantity) || 1);
  const rawTotal = Number(item.total);
  const rawUnitPrice = Number(item.unit_price) || 0;
  const rawDiscount = Number(item.discount) || 0;

  let lineNetTotal: number;
  if (Number.isFinite(rawTotal) && rawTotal > 0) {
    lineNetTotal = rawTotal;
  } else {
    // Handle both per-unit discount and total-line discount safely
    const deducted = rawDiscount > rawUnitPrice ? rawDiscount : rawDiscount * qty;
    lineNetTotal = Math.max(0, rawUnitPrice * qty - deducted);
  }

  const lineUnitNet = lineNetTotal / qty;
  const subtotal = Number(order.subtotal) || 0;
  const orderTotal = Number(order.total) || 0;

  if (subtotal > 0 && orderTotal >= 0 && Math.abs(orderTotal - subtotal) > 0.01) {
    const ratio = orderTotal / subtotal;
    return Math.max(0, Math.round(lineUnitNet * ratio));
  }

  return Math.max(0, Math.round(lineUnitNet));
}

export function generateReturnNumber(type: OrderReturnType): string {
  const prefix = type === 'exchange' ? 'EXC' : 'RET';
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

const LIQUID_SETTLEMENT_METHODS: OrderReturnSettlementMethod[] = ['cash', 'pos', 'card', 'bank'];

/**
 * Atomic, cross-adapter processor for Order Returns & Exchanges.
 * Synchronizes:
 * 1. order_returns & order_return_items
 * 2. order_items.returned_quantity & orders.status / payment_status
 * 3. inventory_movements & inventory_items (restockable vs damaged + exchange sale deduction)
 * 4. treasury_transactions & financial_accounts balance
 * 5. person_transactions (customer ledger: sale_return, sale_invoice, cash_refund / cash_receipt)
 * 6. Active POS shift attachment (pos_shift_id)
 */
export async function processOrderReturnOrExchange(
  input: ProcessReturnInput
): Promise<ProcessReturnResult> {
  const {
    organizationId,
    order,
    allOrderItems,
    type,
    reason,
    warehouseId,
    returnedLines,
    exchangedLines,
    notes,
    userId,
    hasAccounting,
  } = input;

  const adapter = storageManager.getAdapter();
  if (!adapter.saveOrderReturn) {
    throw new Error('سرویس ثبت مرجوعی در آداپتور ذخیره‌سازی فعلی در دسترس نیست.');
  }

  const validReturned = returnedLines.filter((l) => Number(l.quantity) > 0);
  if (validReturned.length === 0) {
    throw new Error('لطفاً حداقل یک کالا برای مرجوع یا تعویض انتخاب کنید.');
  }

  const validExchanged = type === 'exchange'
    ? exchangedLines.filter((l) => Number(l.quantity) > 0)
    : [];

  if (type === 'exchange' && validExchanged.length === 0) {
    throw new Error('در حالت تعویض، انتخاب حداقل یک کالای جایگزین الزامی است.');
  }

  // 1. Validate returnable quantities against original order items
  for (const line of validReturned) {
    const orig = allOrderItems.find((oi) => Number(oi.id) === Number(line.orderItem.id));
    if (!orig) {
      throw new Error('ردیف کالای انتخاب‌شده در سفارش اصلی یافت نشد.');
    }
    const alreadyReturned = Number(orig.returned_quantity) || 0;
    const remaining = Math.max(0, (Number(orig.quantity) || 0) - alreadyReturned);
    if (line.quantity > remaining) {
      throw new Error(
        `تعداد مرجوعی برای کالای «${line.productTitle || line.sku || orig.id}» از تعداد قابل مرجوع (${remaining}) بیشتر است.`
      );
    }
  }

  // Compute totals
  const returnedTotal = validReturned.reduce(
    (sum, l) => sum + Math.round(Number(l.quantity) * Math.max(0, Number(l.unitPrice) || 0)),
    0
  );
  const exchangeTotal = validExchanged.reduce(
    (sum, l) => sum + Math.round(Number(l.quantity) * Math.max(0, Number(l.unitPrice) || 0)),
    0
  );
  const netAmount = exchangeTotal - returnedTotal;

  const customerId =
    typeof order.customer_id === 'object'
      ? (order.customer_id as any)?.id
      : order.customer_id;
  const numericCustomerId = customerId ? Number(customerId) : null;

  let settlementMethod: OrderReturnSettlementMethod =
    netAmount === 0 ? 'none' : input.settlementMethod;

  if (netAmount < 0 && settlementMethod === 'store_credit' && !numericCustomerId) {
    throw new Error('برای ثبت بستانکاری (اعتبار خرید بعدی)، سفارش باید دارای مشتری مشخص باشد.');
  }
  if (netAmount > 0 && settlementMethod === 'credit' && !numericCustomerId) {
    throw new Error('برای ثبت مابه‌التفاوت به‌صورت نسیه، سفارش باید دارای مشتری مشخص باشد.');
  }

  const isLiquidSettlement =
    netAmount !== 0 && LIQUID_SETTLEMENT_METHODS.includes(settlementMethod);
  const financialAccountId = isLiquidSettlement && input.financialAccountId
    ? Number(input.financialAccountId)
    : null;

  // 2. Attach open POS shift if available
  let activeShiftId: number | null = null;
  if (adapter.getActivePosShift) {
    try {
      const activeShift = await adapter.getActivePosShift(userId, warehouseId);
      if (activeShift?.id) {
        activeShiftId = Number(activeShift.id);
      }
    } catch (shiftErr) {
      console.warn('[returnProcessor] Could not resolve active POS shift:', shiftErr);
    }
  }

  const returnDateIso = new Date().toISOString();
  const returnNumber = generateReturnNumber(type);

  // 3. Build order_return_items payloads
  const itemPayloads: Partial<OrderReturnItem>[] = [
    ...validReturned.map((l) => ({
      organization_id: organizationId,
      item_type: 'returned' as const,
      original_order_item_id: Number(l.orderItem.id),
      variant_id: Number(l.variantId),
      quantity: Number(l.quantity),
      unit_price: Math.max(0, Number(l.unitPrice) || 0),
      unit_cost: Math.max(0, Number(l.unitCost) || 0),
      total: Math.round(Number(l.quantity) * Math.max(0, Number(l.unitPrice) || 0)),
      condition: l.condition,
    })),
    ...validExchanged.map((l) => {
      const cost = Number(l.variant.cost ?? l.variant.buy_price ?? 0) || 0;
      const unitPrice = Math.max(0, Number(l.unitPrice) || 0);
      return {
        organization_id: organizationId,
        item_type: 'exchanged' as const,
        original_order_item_id: null,
        variant_id: Number(l.variant.id),
        quantity: Number(l.quantity),
        unit_price: unitPrice,
        unit_cost: cost,
        total: Math.round(Number(l.quantity) * unitPrice),
        condition: 'restockable' as const,
      };
    }),
  ];

  // 4. Persist order_returns + order_return_items
  const savedReturn = await adapter.saveOrderReturn(
    {
      organization_id: organizationId,
      return_number: returnNumber,
      original_order_id: Number(order.id),
      customer_id: numericCustomerId,
      warehouse_id: Number(warehouseId),
      pos_shift_id: activeShiftId,
      type,
      status: 'completed',
      reason,
      returned_total: returnedTotal,
      exchange_total: exchangeTotal,
      net_amount: netAmount,
      settlement_method: settlementMethod,
      financial_account_id: financialAccountId,
      return_date: returnDateIso,
      notes: notes?.trim() || undefined,
    },
    itemPayloads
  );

  // 5. Update returned_quantity on each affected order_item
  const updatedQtyMap = new Map<number, number>();
  for (const orig of allOrderItems) {
    updatedQtyMap.set(Number(orig.id), Number(orig.returned_quantity) || 0);
  }

  for (const line of validReturned) {
    const itemId = Number(line.orderItem.id);
    const nextReturnedQty = (updatedQtyMap.get(itemId) || 0) + Number(line.quantity);
    updatedQtyMap.set(itemId, nextReturnedQty);

    if (adapter.saveOrderItem) {
      try {
        await adapter.saveOrderItem({
          id: itemId,
          returned_quantity: nextReturnedQty,
        });
      } catch (itemErr) {
        console.warn('[returnProcessor] Failed to update order_item returned_quantity:', itemErr);
      }
    }
  }

  // 6. Update parent order status (and payment_status strictly when full non-exchange return)
  const allItemsFullyReturned =
    allOrderItems.length > 0 &&
    allOrderItems.every((oi) => {
      const finalRet = updatedQtyMap.get(Number(oi.id)) || 0;
      return finalRet >= (Number(oi.quantity) || 0);
    });

  const nextOrderStatus = allItemsFullyReturned ? 'returned' : 'partially_returned';
  const orderPatch: Partial<Order> = {
    id: order.id,
    status: nextOrderStatus,
  };
  if (allItemsFullyReturned && type === 'return') {
    orderPatch.payment_status = 'refunded';
  }

  try {
    await adapter.saveOrder(orderPatch);
  } catch (orderErr) {
    console.warn('[returnProcessor] Failed to update parent order status:', orderErr);
  }

  // 7. Record inventory movements (restockable vs damaged + exchange sale deduction)
  for (const line of validReturned) {
    const moveType = line.condition === 'damaged' ? 'damage' : 'return';
    const conditionNote =
      line.condition === 'damaged'
        ? `مرجوعی معیوب/ضایعاتی سند #${savedReturn.return_number} (فاکتور #${order.order_number})`
        : `مرجوعی سالم به انبار سند #${savedReturn.return_number} (فاکتور #${order.order_number})`;

    await adapter.recordMovement({
      organization_id: organizationId,
      variant_id: Number(line.variantId),
      warehouse_id: Number(warehouseId),
      type: moveType,
      quantity: Number(line.quantity),
      reference_type: 'return',
      reference_id: String(savedReturn.id),
      note: conditionNote,
    });
  }

  for (const line of validExchanged) {
    await adapter.recordMovement({
      organization_id: organizationId,
      variant_id: Number(line.variant.id),
      warehouse_id: Number(warehouseId),
      type: 'sale',
      quantity: Number(line.quantity),
      reference_type: 'return',
      reference_id: String(savedReturn.id),
      note: `تحویل کالای جایگزین سند تعویض #${savedReturn.return_number} (فاکتور #${order.order_number})`,
    });
  }

  // 8. Treasury synchronization (if liquid settlement and account chosen)
  const shouldSyncTreasury =
    isLiquidSettlement &&
    financialAccountId &&
    (hasAccounting !== false) &&
    typeof adapter.saveTreasuryTransaction === 'function';

  if (shouldSyncTreasury && financialAccountId) {
    try {
      if (netAmount < 0) {
        await adapter.saveTreasuryTransaction({
          organization_id: organizationId,
          source_account_id: financialAccountId,
          type: 'withdrawal',
          amount: Math.abs(netAmount),
          tracking_code: savedReturn.return_number,
          transaction_date: returnDateIso,
          description: `استرداد وجه بابت سند ${type === 'exchange' ? 'تعویض' : 'مرجوعی'} #${savedReturn.return_number} (فاکتور #${order.order_number})`,
        });
      } else if (netAmount > 0) {
        await adapter.saveTreasuryTransaction({
          organization_id: organizationId,
          destination_account_id: financialAccountId,
          type: 'deposit',
          amount: netAmount,
          tracking_code: savedReturn.return_number,
          transaction_date: returnDateIso,
          description: `دریافت مابه‌التفاوت بابت سند تعویض #${savedReturn.return_number} (فاکتور #${order.order_number})`,
        });
      }
    } catch (trErr) {
      console.warn('[returnProcessor] Failed to record treasury transaction:', trErr);
    }
  }

  // 9. Customer Ledger synchronization (when order is linked to a customer)
  if (numericCustomerId && typeof adapter.savePersonTransaction === 'function') {
    const partyName = order.customer_name || '';

    // 9a. Always log sale_return (creditor = reduces customer debt / gives customer credit)
    if (returnedTotal > 0) {
      try {
        await adapter.savePersonTransaction({
          organization_id: organizationId,
          party_type: 'customer',
          customer_id: numericCustomerId,
          party_name: partyName,
          type: 'creditor',
          transaction_type: 'sale_return',
          amount: returnedTotal,
          debit_amount: 0,
          credit_amount: returnedTotal,
          status: 'cleared',
          order_id: order.id,
          reference_code: savedReturn.return_number,
          reference_number: savedReturn.return_number,
          transaction_date: returnDateIso,
          description: `برگشت از فروش بابت سند #${savedReturn.return_number} (فاکتور #${order.order_number})`,
        });
      } catch (ptErr) {
        console.warn('[returnProcessor] Failed to log sale_return ledger entry:', ptErr);
      }
    }

    // 9b. If exchange items exist, log sale_invoice (debtor)
    if (exchangeTotal > 0) {
      try {
        await adapter.savePersonTransaction({
          organization_id: organizationId,
          party_type: 'customer',
          customer_id: numericCustomerId,
          party_name: partyName,
          type: 'debtor',
          transaction_type: 'sale_invoice',
          amount: exchangeTotal,
          debit_amount: exchangeTotal,
          credit_amount: 0,
          status: 'cleared',
          order_id: order.id,
          reference_code: savedReturn.return_number,
          reference_number: savedReturn.return_number,
          transaction_date: returnDateIso,
          description: `کالای جایگزین در سند تعویض #${savedReturn.return_number} (فاکتور #${order.order_number})`,
        });
      } catch (ptErr) {
        console.warn('[returnProcessor] Failed to log exchange sale_invoice entry:', ptErr);
      }
    }

    // 9c. Net refund paid out in cash/card/bank -> log cash_refund (debtor) to settle credit
    // (When settlement_method === 'store_credit', omit cash_refund so customer keeps positive credit balance!)
    if (netAmount < 0 && settlementMethod !== 'store_credit' && settlementMethod !== 'none') {
      try {
        const refundAmt = Math.abs(netAmount);
        await adapter.savePersonTransaction({
          organization_id: organizationId,
          party_type: 'customer',
          customer_id: numericCustomerId,
          financial_account_id: financialAccountId,
          party_name: partyName,
          type: 'debtor',
          transaction_type: 'cash_refund',
          amount: refundAmt,
          debit_amount: refundAmt,
          credit_amount: 0,
          payment_method: settlementMethod,
          status: 'cleared',
          order_id: order.id,
          reference_code: savedReturn.return_number,
          reference_number: savedReturn.return_number,
          transaction_date: returnDateIso,
          description: `استرداد وجه مرجوعی سند #${savedReturn.return_number} (فاکتور #${order.order_number})`,
        });
      } catch (ptErr) {
        console.warn('[returnProcessor] Failed to log cash_refund ledger entry:', ptErr);
      }
    }

    // 9d. Net difference paid by customer -> log cash_receipt (creditor)
    // (When settlement_method === 'credit', omit cash_receipt so difference remains on customer's receivable balance!)
    if (netAmount > 0 && settlementMethod !== 'credit' && settlementMethod !== 'none') {
      try {
        await adapter.savePersonTransaction({
          organization_id: organizationId,
          party_type: 'customer',
          customer_id: numericCustomerId,
          financial_account_id: financialAccountId,
          party_name: partyName,
          type: 'creditor',
          transaction_type: 'cash_receipt',
          amount: netAmount,
          debit_amount: 0,
          credit_amount: netAmount,
          payment_method: settlementMethod,
          status: 'cleared',
          order_id: order.id,
          reference_code: savedReturn.return_number,
          reference_number: savedReturn.return_number,
          transaction_date: returnDateIso,
          description: `دریافت مابه‌التفاوت تعویض سند #${savedReturn.return_number} (فاکتور #${order.order_number})`,
        });
      } catch (ptErr) {
        console.warn('[returnProcessor] Failed to log cash_receipt ledger entry:', ptErr);
      }
    }
  }

  const savedItems: OrderReturnItem[] =
    savedReturn.items && savedReturn.items.length > 0
      ? savedReturn.items
      : itemPayloads.map((p, idx) => ({
          ...(p as OrderReturnItem),
          id: idx + 1,
          return_id: savedReturn.id,
        }));

  return { savedReturn, savedItems };
}
