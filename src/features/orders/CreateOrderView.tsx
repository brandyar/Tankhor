import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager } from '../../storage';
import {
  ProductVariant,
  Product,
  Customer,
  Warehouse,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Category,
  InventoryItem,
  PosShift,
} from '../../types';
import { FinancialAccount } from '../../types/accounting';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { PosShiftModal } from '../../components/modals/PosShiftModal';
import { confirmAction } from '../../utils/confirm';
import { toPersianDigits } from '../../utils/formatters';

// Sub-components
import { CreateOrderHeader } from './components/CreateOrderHeader';
import { OrderQuickProductGrid } from './components/OrderQuickProductGrid';
import { OrderCartTable, CartLine } from './components/OrderCartTable';
import { OrderPaymentSection, POSPaymentType } from './components/OrderPaymentSection';
import { OrderReceiptModal, SavedOrderData } from './components/OrderReceiptModal';
import { QuickCustomerModal } from './components/QuickCustomerModal';

export const CreateOrderView: React.FC<{ onOrderCreated?: () => void }> = ({ onOrderCreated }) => {
  const { t, locale } = useTranslation();
  const { activeOrganization, organizationUsers } = useOrganization();
  const { user } = useAuth();
  const isPersian = locale === 'fa';

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // User membership & branch lock resolution
  const currentUserMember = useMemo(() => {
    if (!user || !organizationUsers || organizationUsers.length === 0) return null;
    return organizationUsers.find((ou) => {
      const ouUserId = typeof ou.user_id === 'object' ? (ou.user_id as any)?.id : ou.user_id;
      const ouEmail = typeof ou.user_id === 'object' ? (ou.user_id as any)?.email : ou.email;
      if (user?.id && ouUserId && String(ouUserId) === String(user.id)) return true;
      if (user?.email && ouEmail && String(ouEmail).toLowerCase() === String(user.email).toLowerCase()) return true;
      if (user?.email && ou.email && String(ou.email).toLowerCase() === String(user.email).toLowerCase()) return true;
      return false;
    });
  }, [user, organizationUsers]);

  const isWarehouseLocked = Boolean(
    currentUserMember &&
    currentUserMember.can_change_warehouse === false &&
    currentUserMember.warehouse_id
  );

  const isAccountLocked = Boolean(
    currentUserMember &&
    currentUserMember.financial_account_id &&
    (currentUserMember.can_change_warehouse === false || currentUserMember.role === 'sales')
  );

  // POS Shift State
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Core Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Selections
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [orderStatus] = useState<OrderStatus>('completed');
  const [paymentStatus] = useState<PaymentStatus>('paid');
  const [paymentType, setPaymentType] = useState<POSPaymentType>('pos');
  const [orderNotes, setOrderNotes] = useState('');

  // Accounting Module Integration
  const { hasAccess } = useModuleAccess();
  const hasAccounting = hasAccess('accounting');
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');

  const resolveDefaultAccount = (
    accList: FinancialAccount[],
    pType: POSPaymentType,
    targetWhId?: number
  ): number | '' => {
    if (!accList || accList.length === 0) return '';

    // 0. User Dedicated Assigned Cashbox / POS account (Top Priority)
    if (currentUserMember?.financial_account_id) {
      const rawUserAccId = typeof currentUserMember.financial_account_id === 'object' && currentUserMember.financial_account_id
        ? (currentUserMember.financial_account_id as any).id
        : currentUserMember.financial_account_id;
      const userMatch = accList.find((a) => a.id === Number(rawUserAccId));
      if (userMatch) return userMatch.id;
    }

    const currentWhId = targetWhId !== undefined ? targetWhId : selectedWarehouseId;

    // 1. Check if there's an account matching the payment type and explicitly assigned to current warehouse
    if (currentWhId) {
      if (pType === 'cash') {
        const whCashMatch = accList.find((a) => {
          const aWhId = typeof a.warehouse_id === 'object' && a.warehouse_id ? (a.warehouse_id as any).id : a.warehouse_id;
          return (a.type === 'cashbox' || a.type === 'petty_cash') && Number(aWhId) === Number(currentWhId);
        });
        if (whCashMatch) return whCashMatch.id;
      } else if (pType === 'pos') {
        const whPosMatch = accList.find((a) => {
          const aWhId = typeof a.warehouse_id === 'object' && a.warehouse_id ? (a.warehouse_id as any).id : a.warehouse_id;
          return (a.type === 'pos' || a.type === 'bank' || a.pos_terminal_id) && Number(aWhId) === Number(currentWhId);
        });
        if (whPosMatch) return whPosMatch.id;
      } else if (pType === 'card_to_card') {
        const whBankMatch = accList.find((a) => {
          const aWhId = typeof a.warehouse_id === 'object' && a.warehouse_id ? (a.warehouse_id as any).id : a.warehouse_id;
          return (a.type === 'bank' || a.type === 'pos') && Number(aWhId) === Number(currentWhId);
        });
        if (whBankMatch) return whBankMatch.id;
      }
    }

    // 2. Second priority: Check if user has previously selected a preferred cashbox/account for this org
    if (typeof window !== 'undefined' && activeOrganization?.id) {
      const storedKey = `tankhor_pos_account_${activeOrganization.id}_${user?.id || 'default'}`;
      const storedId = localStorage.getItem(storedKey);
      if (storedId) {
        const found = accList.find((a) => String(a.id) === storedId);
        if (found) return found.id;
      }
    }

    // 3. Fallback: Type-based default match
    if (pType === 'cash') {
      const match =
        accList.find((a) => (a.type === 'cashbox' || a.type === 'petty_cash') && a.is_default) ||
        accList.find((a) => a.type === 'cashbox' || a.type === 'petty_cash') ||
        accList.find((a) => a.is_default) ||
        accList[0];
      return match ? match.id : '';
    } else if (pType === 'pos') {
      const match =
        accList.find((a) => (a.pos_terminal_id || a.type === 'pos') && a.is_default) ||
        accList.find((a) => a.pos_terminal_id || a.type === 'pos') ||
        accList.find((a) => a.type === 'bank' && a.is_default) ||
        accList.find((a) => a.type === 'bank') ||
        accList[0];
      return match ? match.id : '';
    } else if (pType === 'card_to_card') {
      const match =
        accList.find((a) => a.type === 'bank' && a.is_default) ||
        accList.find((a) => a.type === 'bank') ||
        accList[0];
      return match ? match.id : '';
    }
    return accList[0]?.id || '';
  };

  const loadFinancialAccounts = useCallback(async (forcedWhId?: number) => {
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id ? Number(activeOrganization.id) : undefined;
      
      let accs: FinancialAccount[] = [];
      if (orgId) {
        accs = await adapter.getFinancialAccounts({ organization_id: orgId });
      }
      
      // Fallback: if empty, query without filter
      if (!accs || accs.length === 0) {
        accs = await adapter.getFinancialAccounts();
      }

      // Filter out only explicitly archived or inactive accounts
      const activeAccs = (accs || []).filter((a) => a.status !== 'archived' && a.status !== 'inactive');
      setFinancialAccounts(activeAccs);

      const targetWh = forcedWhId !== undefined ? forcedWhId : selectedWarehouseId;
      setSelectedAccountId((prev) => {
        if (prev && activeAccs.some((a) => a.id === prev)) {
          return prev;
        }
        return resolveDefaultAccount(activeAccs, paymentType, targetWh);
      });
    } catch (fErr) {
      console.warn('[CreateOrderView] Could not load financial accounts:', fErr);
    }
  }, [activeOrganization?.id, paymentType, selectedWarehouseId]);

  const handlePaymentTypeChange = (newType: POSPaymentType) => {
    setPaymentType(newType);
    if (financialAccounts.length > 0) {
      const defAccId = resolveDefaultAccount(financialAccounts, newType, selectedWarehouseId);
      setSelectedAccountId(defAccId);
    }
  };

  // Cart & Scanner
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [scannerToast, setScannerToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Financial Calculations
  const [hasTax, setHasTax] = useState<boolean>(false);
  const taxPercent = 9; // Standard 9% VAT in Iran
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  const [cashReceived, setCashReceived] = useState<number>(0);

  // Saving & Post-Order States
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSavedOrder, setLastSavedOrder] = useState<SavedOrderData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<'standard' | 'thermal'>('standard');

  // Quick Customer Modal
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);

  // Stock Calculation Helper for Selected Warehouse
  const getVariantAvailableStock = (variantId: number, warehouseId = selectedWarehouseId): number => {
    if (!warehouseId) return 0;
    const item = inventoryItems.find((inv) => {
      const vId = typeof inv.variant_id === 'object' ? (inv.variant_id as any)?.id : inv.variant_id;
      const wId = typeof inv.warehouse_id === 'object' ? (inv.warehouse_id as any)?.id : inv.warehouse_id;
      return Number(vId) === Number(variantId) && Number(wId) === Number(warehouseId);
    });
    if (!item) return 0;
    const total = Number(item.quantity) || 0;
    const reserved = Number(item.reserved_quantity) || 0;
    const damaged = Number(item.damaged_quantity) || 0;
    return Math.max(0, total - reserved - damaged);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [custList, whList, catList, varList, prodList, invList] = await Promise.all([
        adapter.getCustomers({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
        adapter.getCategories({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
        adapter.getProducts({ organization_id: orgId }),
        adapter.getInventoryItems({ organization_id: orgId }),
      ]);

      setCustomers(custList);
      setWarehouses(whList);
      setCategories(catList);
      setVariants(varList);
      setProducts(prodList);
      setInventoryItems(invList || []);

      let activeWhId = selectedWarehouseId;
      if (currentUserMember?.warehouse_id) {
        const rawAssignedWh = typeof currentUserMember.warehouse_id === 'object' && currentUserMember.warehouse_id
          ? (currentUserMember.warehouse_id as any).id
          : currentUserMember.warehouse_id;
        if (whList.some((w) => w.id === Number(rawAssignedWh))) {
          activeWhId = Number(rawAssignedWh);
        }
      } else if (whList.length > 0) {
        activeWhId = activeWhId && whList.some((w) => w.id === activeWhId) ? activeWhId : whList[0].id;
      }
      setSelectedWarehouseId(activeWhId);

      // Load active POS shift for current cashier & selected branch
      const activeUserId = user?.id || user?.email;
      if (storageManager.getActivePosShift) {
        const openShift = await storageManager.getActivePosShift(activeUserId, activeWhId);
        setActiveShift(openShift || null);
      }

      // Load Financial Accounts for Settlement
      await loadFinancialAccounts(activeWhId);
    } catch (err) {
      console.error('[CreateOrderView] Error loading order form data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization?.id, hasAccounting]);

  // Re-check active POS shift when selected warehouse changes
  useEffect(() => {
    const checkWarehouseShift = async () => {
      const activeUserId = user?.id || user?.email;
      if (storageManager.getActivePosShift && selectedWarehouseId) {
        try {
          const shift = await storageManager.getActivePosShift(activeUserId, selectedWarehouseId);
          setActiveShift(shift || null);
        } catch {
          // ignore
        }
      }
    };
    if (selectedWarehouseId) {
      checkWarehouseShift();
    }
  }, [selectedWarehouseId, user?.id, user?.email]);

  // Reactive synchronization when user's assigned warehouse or cashbox is resolved
  useEffect(() => {
    if (currentUserMember?.warehouse_id) {
      const rawAssignedWh = typeof currentUserMember.warehouse_id === 'object' && currentUserMember.warehouse_id
        ? (currentUserMember.warehouse_id as any).id
        : currentUserMember.warehouse_id;
      const numWh = Number(rawAssignedWh);
      if (numWh && (isWarehouseLocked || !selectedWarehouseId)) {
        setSelectedWarehouseId(numWh);
      }
    }
  }, [currentUserMember, isWarehouseLocked]);

  useEffect(() => {
    if (currentUserMember?.financial_account_id) {
      const rawAssignedAcc = typeof currentUserMember.financial_account_id === 'object' && currentUserMember.financial_account_id
        ? (currentUserMember.financial_account_id as any).id
        : currentUserMember.financial_account_id;
      const numAcc = Number(rawAssignedAcc);
      if (numAcc && (isAccountLocked || !selectedAccountId)) {
        setSelectedAccountId(numAcc);
      }
    }
  }, [currentUserMember, isAccountLocked]);

  // Re-evaluate account when warehouse, accounts, or user membership change
  useEffect(() => {
    if (financialAccounts.length > 0) {
      const bestAccId = resolveDefaultAccount(financialAccounts, paymentType, selectedWarehouseId);
      if (bestAccId) {
        setSelectedAccountId(bestAccId);
      }
    }
  }, [selectedWarehouseId, financialAccounts.length, paymentType, currentUserMember]);

  // Focus barcode input on load
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isLoading]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setScannerToast({ type, message });
    setTimeout(() => {
      setScannerToast(null);
    }, 3000);
  };

  // Add Variant to Cart with warehouse stock validation
  const handleAddToCart = (variant: ProductVariant) => {
    const prod = products.find((p) => p.id === (variant.product_id && typeof variant.product_id === 'object' ? (variant.product_id as any).id : variant.product_id));
    const title = prod ? prod.title : t('orders.untitledProduct');
    const price = variant.price || 0;

    const available = getVariantAvailableStock(variant.id, selectedWarehouseId);
    if (available <= 0) {
      showToast('error', t('orders.outOfStockInSelectedWarehouse'));
      return;
    }

    const existingIdx = cart.findIndex((c) => c.variant.id === variant.id);
    if (existingIdx !== -1) {
      const currentQty = cart[existingIdx].quantity;
      if (currentQty + 1 > available) {
        showToast('error', t('orders.maxStockReached', { max: available }));
        return;
      }
      const updated = [...cart];
      updated[existingIdx].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          variant,
          productTitle: title,
          quantity: 1,
          unitPrice: price,
          discount: 0,
        },
      ]);
    }
  };

  // Handle Barcode Scan / Quick SKU Enter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;

    const query = barcodeQuery.trim().toLowerCase();
    const matched = variants.find((v) => {
      const sku = (v.sku || '').toLowerCase();
      const barcode = (v.barcode || '').toLowerCase();
      return sku === query || barcode === query;
    });

    if (matched) {
      const available = getVariantAvailableStock(matched.id, selectedWarehouseId);
      if (available <= 0) {
        showToast('error', t('orders.outOfStockInSelectedWarehouse'));
        return;
      }
      handleAddToCart(matched);
      const prod = products.find((p) => p.id === (matched.product_id && typeof matched.product_id === 'object' ? (matched.product_id as any).id : matched.product_id));
      const title = prod ? prod.title : t('orders.untitledProduct');
      showToast('success', t('orders.itemAddedToCart', { title }));
      setBarcodeQuery('');
    } else {
      showToast('error', t('orders.itemNotFoundWithBarcode', { barcode: barcodeQuery }));
    }
  };

  const handleUpdateQty = (variantId: number, qty: number) => {
    if (qty <= 0) {
      handleRemoveLine(variantId);
      return;
    }
    const available = getVariantAvailableStock(variantId, selectedWarehouseId);
    if (qty > available) {
      showToast('error', t('orders.maxStockReached', { max: available }));
      setCart(cart.map((c) => (c.variant.id === variantId ? { ...c, quantity: available } : c)));
      return;
    }
    setCart(cart.map((c) => (c.variant.id === variantId ? { ...c, quantity: qty } : c)));
  };

  const handleRemoveLine = (variantId: number) => {
    setCart(cart.filter((c) => c.variant.id !== variantId));
  };

  const handleClearCart = async () => {
    if (cart.length === 0) return;
    if (await confirmAction(t('orders.confirmClearCart'))) {
      setCart([]);
      setExtraDiscount(0);
      setOrderNotes('');
      setCashReceived(0);
    }
  };

  // Cart Financial Calculations
  const subtotal = cart.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
  const itemsDiscount = cart.reduce((sum, c) => sum + c.quantity * c.discount, 0);
  const totalDiscount = itemsDiscount + extraDiscount;
  const taxableSubtotal = Math.max(0, subtotal - totalDiscount);
  const taxAmount = hasTax ? (taxableSubtotal * taxPercent) / 100 : 0;
  const grandTotal = Math.max(0, taxableSubtotal + taxAmount);
  const cashChange = Math.max(0, cashReceived - grandTotal);

  const handlePreviewPrint = () => {
    if (cart.length === 0) return;
    const selectedCust = customers.find((c) => c.id === selectedCustomerId);
    const customerName = selectedCust ? selectedCust.name : t('orders.generalCustomer');
    const selectedWh = warehouses.find((w) => w.id === selectedWarehouseId);
    const warehouseName = selectedWh ? selectedWh.name : t('orders.defaultWarehouse');

    setLastSavedOrder({
      order: {
        id: 0,
        organization_id: activeOrganization?.id || 1,
        warehouse_id: selectedWarehouseId,
        order_number: `ORD-DRAFT`,
        status: orderStatus,
        payment_status: paymentStatus,
        currency: 'TOMAN',
        subtotal,
        discount: totalDiscount,
        tax: taxAmount,
        total: grandTotal,
        notes: orderNotes,
        date_created: new Date().toISOString(),
      },
      customerName,
      warehouseName,
      items: [...cart],
    });
    setIsReceiptModalOpen(true);
  };

  // Submit Order
  const handleSubmitOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg(t('orders.emptyCartError'));
      return;
    }
    if (!selectedWarehouseId) {
      setErrorMsg(t('orders.selectWarehouseError'));
      return;
    }

    // Strict validation: Ensure all cart items have enough stock in selected warehouse
    for (const item of cart) {
      const available = getVariantAvailableStock(item.variant.id, selectedWarehouseId);
      if (item.quantity > available) {
        setErrorMsg(
          t('orders.insufficientStockNotice', {
            title: item.productTitle,
            available: isPersian ? toPersianDigits(available) : available,
            requested: isPersian ? toPersianDigits(item.quantity) : item.quantity,
          }) || `موجودی کالای «${item.productTitle}» در انبار انتخابی کافی نیست (موجودی: ${available}، درخواستی: ${item.quantity}).`
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      const selectedCust = customers.find((c) => c.id === selectedCustomerId);
      const customerName = selectedCust ? selectedCust.name : t('orders.generalCustomer');

      const selectedWh = warehouses.find((w) => w.id === selectedWarehouseId);
      const warehouseName = selectedWh ? selectedWh.name : t('orders.defaultWarehouse');

      // Determine payment status according to method
      let actualPaymentStatus: PaymentStatus = paymentStatus;
      if (paymentType === 'credit') {
        actualPaymentStatus = 'pending';
      } else if (paymentType === 'cash' || paymentType === 'pos' || paymentType === 'card_to_card') {
        actualPaymentStatus = 'paid';
      }

      const orderData: Partial<Order> = {
        organization_id: orgId,
        customer_id: selectedCustomerId || undefined,
        warehouse_id: selectedWarehouseId,
        order_number: orderNumber,
        status: orderStatus,
        payment_status: actualPaymentStatus,
        currency: 'TOMAN',
        subtotal,
        discount: totalDiscount,
        tax: taxAmount,
        total: grandTotal,
        payment_method: paymentType,
        user_created: user?.id,
        pos_shift_id: activeShift?.id || undefined,
        notes: `[${t('orders.paymentMethod')}: ${
          paymentType === 'pos'
            ? t('orders.posTerminal')
            : paymentType === 'cash'
            ? t('orders.cash')
            : paymentType === 'card_to_card'
            ? t('orders.cardToCard')
            : t('orders.storeCredit')
        }]${activeShift ? ` [${isPersian ? `شیفت #${activeShift.id}` : `Shift #${activeShift.id}`}]` : ''} ${orderNotes}`.trim(),
      };

      const orderItems: Partial<OrderItem>[] = cart.map((c) => ({
        organization_id: orgId,
        variant_id: c.variant.id,
        quantity: c.quantity,
        unit_price: c.unitPrice,
        discount: c.discount,
        total: c.quantity * c.unitPrice - c.discount * c.quantity,
      }));

      const savedOrder = await adapter.saveOrder(orderData, orderItems);

      // Record inventory SALE movement to decrease stock for completed/confirmed
      if (orderStatus === 'confirmed' || orderStatus === 'completed') {
        for (const item of cart) {
          await adapter.recordMovement({
            organization_id: orgId,
            variant_id: item.variant.id,
            warehouse_id: selectedWarehouseId,
            type: 'sale',
            quantity: item.quantity,
            reference_type: 'order',
            reference_id: String(savedOrder.id),
            note: `POS #${orderNumber}`,
          });
        }
      }

      // Triangle Synchronization: Always record treasury and customer ledger transactions
      const orgNumId = activeOrganization?.id ? Number(activeOrganization.id) : 1;
      const isCashOrElectronic = paymentType === 'cash' || paymentType === 'pos' || paymentType === 'card_to_card';

      // 1. If paid via cash, pos terminal, or bank card, deposit to treasury account
      if (isCashOrElectronic) {
        try {
          let targetAccId: number | undefined = selectedAccountId ? Number(selectedAccountId) : undefined;
          const accs = await adapter.getFinancialAccounts({ organization_id: orgNumId });
          if (!targetAccId) {
            const resolved = resolveDefaultAccount(accs || [], paymentType, selectedWarehouseId);
            if (resolved) {
              targetAccId = Number(resolved);
            } else if (accs && accs.length > 0) {
              targetAccId = accs[0].id;
            }
          }

          if (targetAccId) {
            await adapter.saveTreasuryTransaction({
              organization_id: orgNumId,
              destination_account_id: Number(targetAccId),
              type: 'deposit',
              amount: grandTotal,
              tracking_code: `ORD-${orderNumber}`,
              description: `دریافت وجه فاکتور فروش #${orderNumber} (${customerName !== t('orders.generalCustomer') ? customerName : 'مشتری حضوری'})`,
              transaction_date: new Date().toISOString(),
            });
          }
        } catch (trErr) {
          console.warn('[CreateOrderView] Could not record treasury transaction for order:', trErr);
        }
      }

      // 2. Keep Customer Ledger (معین اشخاص) synchronized
      if (selectedCustomerId) {
        try {
          if (paymentType === 'credit') {
            await adapter.savePersonTransaction({
              organization_id: orgNumId,
              customer_id: selectedCustomerId,
              party_type: 'customer',
              party_name: customerName,
              type: 'debtor',
              transaction_type: 'sale_invoice',
              amount: grandTotal,
              debit_amount: grandTotal,
              status: 'pending',
              reference_number: orderNumber,
              order_id: savedOrder.id,
              description: `فاکتور فروش نسیه #${orderNumber}`,
              transaction_date: new Date().toISOString(),
            });
          } else if (isCashOrElectronic) {
            await adapter.savePersonTransaction({
              organization_id: orgNumId,
              customer_id: selectedCustomerId,
              financial_account_id: selectedAccountId ? Number(selectedAccountId) : undefined,
              party_type: 'customer',
              party_name: customerName,
              type: 'debtor',
              transaction_type: 'sale_invoice',
              amount: grandTotal,
              debit_amount: grandTotal,
              status: 'completed',
              reference_number: orderNumber,
              order_id: savedOrder.id,
              description: `فاکتور فروش #${orderNumber} (تسویه نقدی/کارتخوان)`,
              transaction_date: new Date().toISOString(),
            });

            await adapter.savePersonTransaction({
              organization_id: orgNumId,
              customer_id: selectedCustomerId,
              financial_account_id: selectedAccountId ? Number(selectedAccountId) : undefined,
              party_type: 'customer',
              party_name: customerName,
              type: 'creditor',
              transaction_type: 'receipt',
              amount: grandTotal,
              credit_amount: grandTotal,
              status: 'completed',
              reference_number: `REC-${orderNumber}`,
              order_id: savedOrder.id,
              description: `دریافت وجه فاکتور فروش #${orderNumber}`,
              transaction_date: new Date().toISOString(),
            });
          }
        } catch (ptErr) {
          console.warn('[CreateOrderView] Could not record person transactions for order:', ptErr);
        }
      }

      // Auto-reconcile with accounting module
      try {
        if (adapter.reconcileOrdersWithTreasury) {
          await adapter.reconcileOrdersWithTreasury(orgNumId);
        }
      } catch (recErr) {
        console.warn('[CreateOrderView] Auto-reconcile warning:', recErr);
      }

      // Refresh inventory items to update stock in UI immediately
      try {
        const refreshedInv = await adapter.getInventoryItems({ organization_id: orgId });
        setInventoryItems(refreshedInv || []);
      } catch (invErr) {
        console.warn('[CreateOrderView] Could not refresh inventory items:', invErr);
      }

      setLastSavedOrder({
        order: savedOrder,
        customerName,
        warehouseName,
        items: [...cart],
      });

      setIsReceiptModalOpen(true);
      setCart([]);
      setOrderNotes('');
      setExtraDiscount(0);
      setCashReceived(0);

      if (onOrderCreated) onOrderCreated();
    } catch (err) {
      console.error('[CreateOrderView] Error saving POS order:', err);
      setErrorMsg(t('orders.orderSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  // Filter Catalog Variants
  const filteredVariants = variants.filter((v) => {
    const prod = products.find((p) => p.id === (v.product_id && typeof v.product_id === 'object' ? (v.product_id as any).id : v.product_id));
    if (!prod) return false;

    if (selectedCategoryId !== 'all') {
      const prodCatId = typeof prod.category_id === 'object' ? prod.category_id?.id : prod.category_id;
      if (prodCatId !== selectedCategoryId) return false;
    }

    const title = prod.title.toLowerCase();
    const sku = (v.sku || '').toLowerCase();
    const barcode = (v.barcode || '').toLowerCase();
    const color = (v.color_name || '').toLowerCase();
    const size = (v.size_name || '').toLowerCase();
    const q = productSearch.toLowerCase().trim();

    if (!q) return true;
    return title.includes(q) || sku.includes(q) || barcode.includes(q) || color.includes(q) || size.includes(q);
  });

  return (
    <div className="space-y-5 font-sans">
      {/* Top Action Header Bar */}
      <CreateOrderHeader
        activeShift={activeShift}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        onPreviewPrint={handlePreviewPrint}
        onOpenCustomerModal={() => setIsAddCustomerModalOpen(true)}
        onClearCart={handleClearCart}
        cartLength={cart.length}
        scannerToast={scannerToast}
        errorMsg={errorMsg}
      />

      {/* Main POS Interface Split (7 Columns Catalog | 5 Columns Invoice Terminal) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Product Catalog & Barcode Scanner (7 cols) */}
        <OrderQuickProductGrid
          barcodeInputRef={barcodeInputRef}
          barcodeQuery={barcodeQuery}
          setBarcodeQuery={setBarcodeQuery}
          onBarcodeSubmit={handleBarcodeSubmit}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          setSelectedCategoryId={setSelectedCategoryId}
          filteredVariants={filteredVariants}
          products={products}
          selectedWarehouseId={selectedWarehouseId}
          getVariantAvailableStock={getVariantAvailableStock}
          cart={cart}
          onAddToCart={handleAddToCart}
          isLoading={isLoading}
        />

        {/* Right Side: Digital Receipt & POS Checkout Terminal (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleSubmitOrder} className="bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
            <OrderCartTable
              cart={cart}
              onUpdateQty={handleUpdateQty}
              onRemoveLine={handleRemoveLine}
              extraDiscount={extraDiscount}
              setExtraDiscount={setExtraDiscount}
              hasTax={hasTax}
              setHasTax={setHasTax}
              taxAmount={taxAmount}
            />

            <OrderPaymentSection
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              setSelectedCustomerId={setSelectedCustomerId}
              warehouses={warehouses}
              selectedWarehouseId={selectedWarehouseId}
              onWarehouseChange={(newWhId) => {
                setSelectedWarehouseId(newWhId);
                if (cart.length > 0) {
                  const exceeding = cart.filter((c) => c.quantity > getVariantAvailableStock(c.variant.id, newWhId));
                  if (exceeding.length > 0) {
                    showToast(
                      'error',
                      `توجه: موجودی ${exceeding.length} قلم از کالاهای سبد خرید در انبار انتخابی کافی نیست.`
                    );
                  }
                }
              }}
              isWarehouseLocked={isWarehouseLocked}
              paymentType={paymentType}
              onPaymentTypeChange={handlePaymentTypeChange}
              hasAccounting={hasAccounting}
              financialAccounts={financialAccounts}
              selectedAccountId={selectedAccountId}
              setSelectedAccountId={setSelectedAccountId}
              isAccountLocked={isAccountLocked}
              onRefreshAccounts={() => loadFinancialAccounts()}
              cashReceived={cashReceived}
              setCashReceived={setCashReceived}
              cashChange={cashChange}
              subtotal={subtotal}
              totalDiscount={totalDiscount}
              hasTax={hasTax}
              taxAmount={taxAmount}
              grandTotal={grandTotal}
              isSaving={isSaving}
              cartLength={cart.length}
              onPreviewPrint={handlePreviewPrint}
              activeOrgId={activeOrganization?.id}
              userId={user?.id}
            />
          </form>
        </div>
      </div>

      {/* Quick Customer Creation Modal */}
      <QuickCustomerModal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        organizationId={activeOrganization?.id ? Number(activeOrganization.id) : 1}
        onCustomerCreated={(newCust) => {
          setCustomers([newCust, ...customers]);
          setSelectedCustomerId(newCust.id);
        }}
        showToast={showToast}
      />

      {/* Post-Order Receipt & Print Modal */}
      <OrderReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        lastSavedOrder={lastSavedOrder}
        receiptType={receiptType}
        setReceiptType={setReceiptType}
        organizationName={activeOrganization?.name}
      />

      {/* POS Shift Management Modal */}
      <PosShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        onShiftChanged={(newShift) => setActiveShift(newShift)}
      />
    </div>
  );
};
