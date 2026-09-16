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
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PosShiftModal } from '../../components/modals/PosShiftModal';
import { formatDate, formatCurrency, toPersianDigits } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';
import { printElement } from '../../utils/print';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  User,
  Building2,
  Tag,
  CreditCard,
  AlertCircle,
  Package,
  Barcode,
  Printer,
  Receipt,
  RotateCcw,
  DollarSign,
  X,
  FileText,
  Sparkles,
  Clock,
  Lock,
  Unlock,
  Phone,
  UserPlus,
  Check,
  Percent,
  Wallet,
} from 'lucide-react';

interface CartLine {
  variant: ProductVariant;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  discount: number; // Discount per item unit
}

type POSPaymentType = 'pos' | 'cash' | 'card_to_card' | 'credit';

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
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('completed');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
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
  const [taxPercent, setTaxPercent] = useState<number>(9); // Standard 9% VAT in Iran
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  const [cashReceived, setCashReceived] = useState<number>(0);

  // Saving & Post-Order States
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSavedOrder, setLastSavedOrder] = useState<{
    order: Order;
    customerName: string;
    warehouseName: string;
    items: CartLine[];
  } | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<'standard' | 'thermal'>('standard');

  // Quick Customer Modal
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

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
    const prod = products.find((p) => p.id === (typeof variant.product_id === 'object' ? variant.product_id.id : variant.product_id));
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
      const prod = products.find((p) => p.id === (typeof matched.product_id === 'object' ? matched.product_id.id : matched.product_id));
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

  const handleUpdateLineDiscount = (variantId: number, discountAmount: number) => {
    setCart(
      cart.map((c) =>
        c.variant.id === variantId ? { ...c, discount: Math.max(0, discountAmount) } : c
      )
    );
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

  // Quick Customer Creation
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    setIsSavingCustomer(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const created = await adapter.saveCustomer({
        organization_id: orgId,
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
        status: 'active',
      });

      setCustomers([created, ...customers]);
      setSelectedCustomerId(created.id);
      setIsAddCustomerModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      showToast('success', t('orders.customerCreatedSuccess', { name: created.name }));
    } catch (err) {
      console.error('[CreateOrderView] Error creating quick customer:', err);
    } finally {
      setIsSavingCustomer(false);
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

      // If accounting module is active, record treasury and customer ledger transactions
      if (hasAccounting && activeOrganization?.id) {
        const orgNumId = Number(activeOrganization.id);
        const isCashOrElectronic = paymentType === 'cash' || paymentType === 'pos' || paymentType === 'card_to_card';

        // 1. If paid via cash, pos terminal, or bank card, deposit to treasury account
        if (isCashOrElectronic && selectedAccountId) {
          try {
            await adapter.saveTreasuryTransaction({
              organization_id: orgNumId,
              destination_account_id: Number(selectedAccountId),
              type: 'deposit',
              amount: grandTotal,
              tracking_code: `ORD-${orderNumber}`,
              description: `دریافت وجه فاکتور فروش #${orderNumber} (${customerName !== t('orders.generalCustomer') ? customerName : 'مشتری حضوری'})`,
              transaction_date: new Date().toISOString(),
            });
          } catch (trErr) {
            console.warn('[CreateOrderView] Could not record treasury transaction for order:', trErr);
          }
        }

        // 2. Keep Customer Ledger (معین اشخاص) synchronized
        if (selectedCustomerId) {
          try {
            if (paymentType === 'credit') {
              // Credit sale: customer is debtor with pending payment status
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
              // Fully paid sale: record invoice debit and receipt credit for comprehensive audit trail
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
    const prod = products.find((p) => p.id === (typeof v.product_id === 'object' ? v.product_id.id : v.product_id));
    if (!prod) return false;

    // Filter by category
    if (selectedCategoryId !== 'all') {
      const prodCatId = typeof prod.category_id === 'object' ? prod.category_id?.id : prod.category_id;
      if (prodCatId !== selectedCategoryId) return false;
    }

    // Search query
    const title = prod.title.toLowerCase();
    const sku = (v.sku || '').toLowerCase();
    const barcode = (v.barcode || '').toLowerCase();
    const color = (v.color_name || '').toLowerCase();
    const size = (v.size_name || '').toLowerCase();
    const q = productSearch.toLowerCase().trim();

    if (!q) return true;
    return title.includes(q) || sku.includes(q) || barcode.includes(q) || color.includes(q) || size.includes(q);
  });

  const triggerPrint = () => {
    printElement('printable-create-order-invoice', { title: `${t('orders.printInvoice')}_${lastSavedOrder?.order.order_number || 'draft'}` });
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Printable Area for Invoices (Hidden on screen, active on Ctrl+P) */}
      {lastSavedOrder && (
        <div id="printable-create-order-invoice" className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-6 print:text-black font-sans z-[9999]">
          {receiptType === 'thermal' ? (
            /* 80mm POS Thermal Receipt */
            <div className="w-[80mm] mx-auto text-xs space-y-3 font-mono leading-tight">
              <div className="text-center border-b border-black pb-2">
                <h2 className="text-sm font-bold">{activeOrganization?.name || 'TANKHOR'}</h2>
                <p className="text-[10px]">{t('orders.posReceiptTitle')}</p>
                <p className="text-[10px] mt-1">{t('orders.orderNumber')}: {lastSavedOrder.order.order_number}</p>
                <p className="text-[10px]">{formatDate(lastSavedOrder.order.date_created, isPersian)}</p>
              </div>

              <div className="text-[11px] space-y-0.5">
                <p>{t('orders.customer')}: {lastSavedOrder.customerName}</p>
                <p>{t('orders.fulfillmentWarehouse')}: {lastSavedOrder.warehouseName}</p>
              </div>

              <table className="w-full text-right border-y border-black py-1">
                <thead>
                  <tr className="border-b border-black font-bold">
                    <th className="py-1">{t('orders.itemTitleAndSpecs')}</th>
                    <th className="py-1 text-center">{t('orders.quantity')}</th>
                    <th className="py-1 text-left">{t('orders.itemTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSavedOrder.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1">
                        <div>{it.productTitle}</div>
                        <div className="text-[9px] text-gray-600">
                          {it.variant.size_name && `${t('orders.size')}: ${it.variant.size_name} `}
                          {it.variant.color_name && `${t('orders.color')}: ${it.variant.color_name}`}
                        </div>
                      </td>
                      <td className="py-1 text-center">{isPersian ? it.quantity : it.quantity}</td>
                      <td className="py-1 text-left">{formatCurrency(it.quantity * it.unitPrice, 'TOMAN', isPersian)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-left text-xs pt-1">
                <div className="flex justify-between">
                  <span>{t('orders.subtotal')}:</span>
                  <span>{formatCurrency(lastSavedOrder.order.subtotal, 'TOMAN', isPersian)}</span>
                </div>
                {lastSavedOrder.order.discount > 0 && (
                  <div className="flex justify-between">
                    <span>{t('orders.discount')}:</span>
                    <span>- {formatCurrency(lastSavedOrder.order.discount, 'TOMAN', isPersian)}</span>
                  </div>
                )}
                {lastSavedOrder.order.tax > 0 && (
                  <div className="flex justify-between">
                    <span>{t('orders.tax')}:</span>
                    <span>+ {formatCurrency(lastSavedOrder.order.tax, 'TOMAN', isPersian)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                  <span>{t('orders.payableAmount')}</span>
                  <span>{formatCurrency(lastSavedOrder.order.total, 'TOMAN', isPersian)}</span>
                </div>
              </div>

              <div className="text-center text-[9px] pt-4 border-t border-black">
                {t('orders.thankYouForPurchase')}
              </div>
            </div>
          ) : (
            /* Standard A4 / A5 Official Sales Invoice */
            <div className="max-w-2xl mx-auto space-y-4 text-xs font-sans">
              <div className="flex justify-between items-center border-b-2 border-black pb-3">
                <div>
                  <h1 className="text-xl font-black">{t('orders.invoiceTitle')}</h1>
                  <p className="text-gray-600 text-xs mt-1">{activeOrganization?.name || 'TANKHOR'}</p>
                </div>
                <div className="text-left font-mono text-xs space-y-1">
                  <p><strong>{t('orders.orderNumber')}:</strong> {lastSavedOrder.order.order_number}</p>
                  <p><strong>{t('orders.orderDate')}:</strong> {formatDate(lastSavedOrder.order.date_created, isPersian)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-300 rounded-lg">
                <div>
                  <p className="font-bold text-gray-700">{t('orders.buyerCustomer')}</p>
                  <p className="text-sm font-bold text-black">{lastSavedOrder.customerName}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-700">{t('orders.fulfillmentWarehouse')}</p>
                  <p className="text-sm text-black">{lastSavedOrder.warehouseName}</p>
                </div>
              </div>

              <table className="w-full text-right border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="p-2 border-r border-gray-300">{t('orders.rowNumber')}</th>
                    <th className="p-2 border-r border-gray-300">{t('orders.itemTitleAndSpecs')}</th>
                    <th className="p-2 border-r border-gray-300 text-center">{t('orders.quantity')}</th>
                    <th className="p-2 border-r border-gray-300 text-left">{t('orders.unitPrice')}</th>
                    <th className="p-2 text-left">{t('orders.itemTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSavedOrder.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="p-2 border-r border-gray-300 text-center">{idx + 1}</td>
                      <td className="p-2 border-r border-gray-300">
                        <span className="font-bold">{it.productTitle}</span>
                        <div className="text-[10px] text-gray-500 font-mono">
                          SKU: {it.variant.sku} | {it.variant.size_name ? `${t('orders.size')}: ${it.variant.size_name}` : ''} {it.variant.color_name ? `| ${t('orders.color')}: ${it.variant.color_name}` : ''}
                        </div>
                      </td>
                      <td className="p-2 border-r border-gray-300 text-center font-bold font-mono">{it.quantity}</td>
                      <td className="p-2 border-r border-gray-300 text-left font-mono">{formatCurrency(it.unitPrice, 'TOMAN', isPersian)}</td>
                      <td className="p-2 text-left font-bold font-mono">{formatCurrency(it.quantity * it.unitPrice, 'TOMAN', isPersian)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-start pt-2">
                <div className="w-1/2 p-2 border border-gray-200 rounded text-[11px] text-gray-600 space-y-1">
                  <p className="font-bold text-gray-800">{t('orders.invoiceRemarks')}</p>
                  <p>{lastSavedOrder.order.notes || t('orders.defaultInvoiceRemarks')}</p>
                </div>
                <div className="w-2/5 space-y-1 text-left font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>{t('orders.subtotal')}:</span>
                    <span>{formatCurrency(lastSavedOrder.order.subtotal, 'TOMAN', isPersian)}</span>
                  </div>
                  {lastSavedOrder.order.discount > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200 text-red-600">
                      <span>{t('orders.totalDiscount')}</span>
                      <span>- {formatCurrency(lastSavedOrder.order.discount, 'TOMAN', isPersian)}</span>
                    </div>
                  )}
                  {lastSavedOrder.order.tax > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span>{t('orders.vatIncluded')}:</span>
                      <span>+ {formatCurrency(lastSavedOrder.order.tax, 'TOMAN', isPersian)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 font-bold text-sm border-t-2 border-black text-black">
                    <span>{t('orders.payableAmount')}</span>
                    <span>{formatCurrency(lastSavedOrder.order.total, 'TOMAN', isPersian)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 text-center pt-8 border-t border-gray-300 text-xs">
                <div>{t('orders.sellerSignature')}</div>
                <div>{t('orders.buyerSignature')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* POS Top Header & Action Controls */}
      <div className="bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-800 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#171717] dark:bg-neutral-800 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Receipt className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#171717] dark:text-neutral-100">{t('orders.posTitle')}</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-bold">
                {t('orders.posOnline')}
              </span>
            </div>
            <p className="text-xs text-[#888888] dark:text-neutral-400 mt-0.5">
              {t('orders.posSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* POS Shift Management Trigger Button */}
          <Button
            variant={activeShift ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setIsShiftModalOpen(true)}
            icon={<Clock className="w-3.5 h-3.5" />}
            className={activeShift ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : ''}
          >
            {activeShift ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>{isPersian ? `شیفت باز #${activeShift.id}` : `Open Shift #${activeShift.id}`}</span>
              </span>
            ) : (
              <span>{isPersian ? 'افتتاح شیفت صندوق' : 'Open POS Shift'}</span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewPrint}
            disabled={cart.length === 0}
            icon={<Printer className="w-3.5 h-3.5 text-emerald-600" />}
          >
            {t('orders.previewPrintInvoice')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddCustomerModalOpen(true)}
            icon={<UserPlus className="w-3.5 h-3.5 text-indigo-600" />}
          >
            {t('orders.quickCustomer')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCart}
            disabled={cart.length === 0}
            className="text-red-600 hover:bg-red-50 border-red-200"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {t('orders.clearInvoice')}
          </Button>
        </div>
      </div>

      {/* Scanner Toast Notification */}
      {scannerToast && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
            scannerToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {scannerToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{scannerToast.message}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main POS Interface Split (7 Columns Catalog | 5 Columns Invoice Terminal) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Barcode Scanner, Filters & Product Catalog (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Quick Barcode Scanner Bar */}
          <form onSubmit={handleBarcodeSubmit} className="bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-800 rounded-xl p-3 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#171717] dark:text-neutral-100">
              <span className="flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {t('orders.scanBarcodeOrSku')}
              </span>
              <span className="text-[10px] text-[#888888] dark:text-neutral-400 font-mono">{t('orders.enterKeyHint')}</span>
            </div>

            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                placeholder={t('orders.barcodeScannerActivePlaceholder')}
                className="w-full ps-9 pe-24 py-2 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 focus:border-[#171717] dark:focus:border-neutral-400 focus:bg-white dark:focus:bg-[#13151a] rounded-lg text-xs font-mono text-[#171717] dark:text-neutral-100 placeholder:text-[#a1a1a1] dark:placeholder:text-neutral-500 focus:outline-none transition-all shadow-inner"
              />
              <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-[#888888] dark:text-neutral-400">
                <Barcode className="w-4 h-4" />
              </div>
              <div className="absolute inset-y-0 end-1.5 flex items-center">
                <Button type="submit" variant="primary" size="sm" className="h-7 text-[11px] px-3 font-bold">
                  {t('orders.quickAdd')}
                </Button>
              </div>
            </div>
          </form>

          {/* Catalog Filter Bar */}
          <div className="bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-800 rounded-xl p-3 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="w-full sm:w-64">
                <Input
                  placeholder={t('orders.searchPlaceholder')}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  icon={<Search className="w-3.5 h-3.5" />}
                />
              </div>

              <div className="text-xs font-mono text-[#888888] dark:text-neutral-400">
                {t('orders.availableItemsCount', { count: filteredVariants.length })}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                    : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
                }`}
              >
                {t('orders.allCategories')}
              </button>
              {categories.map((cat, idx) => (
                <button
                  key={`ord_cat_${cat.id}_${idx}`}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                    selectedCategoryId === cat.id
                      ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                      : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog Items Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar p-1">
            {isLoading ? (
              <div className="col-span-3 p-12 text-center text-[#888888] dark:text-neutral-400 text-xs">{t('orders.loadingCatalog')}</div>
            ) : filteredVariants.length === 0 ? (
              <div className="col-span-3 p-12 text-center text-[#888888] dark:text-neutral-400 text-xs bg-white dark:bg-[#13151a] rounded-xl border border-[#ebebeb] dark:border-neutral-800">
                {t('orders.noProductsFound')}
              </div>
            ) : (
              filteredVariants.map((v, vIdx) => {
                const prod = products.find((p) => p.id === (typeof v.product_id === 'object' ? v.product_id.id : v.product_id));
                const stock = getVariantAvailableStock(v.id, selectedWarehouseId);
                const inCart = cart.find((c) => c.variant.id === v.id);
                const isOutOfStock = stock <= 0;

                return (
                  <div
                    key={`ord_var_${v.id}_${vIdx}`}
                    onClick={() => {
                      if (isOutOfStock) {
                        showToast('error', t('orders.outOfStockInSelectedWarehouse'));
                        return;
                      }
                      handleAddToCart(v);
                    }}
                    className={`p-3 bg-white dark:bg-[#13151a] border rounded-xl transition-all duration-150 flex flex-col justify-between space-y-2 relative group ${
                      isOutOfStock
                        ? 'opacity-65 border-dashed border-red-200 dark:border-red-950/60 bg-red-50/10 cursor-not-allowed'
                        : 'cursor-pointer hover:shadow-md'
                    } ${
                      inCart
                        ? 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20'
                        : !isOutOfStock
                        ? 'border-[#ebebeb] dark:border-neutral-800 hover:border-[#171717] dark:hover:border-neutral-500'
                        : ''
                    }`}
                  >
                    {inCart && (
                      <div className="absolute top-2 end-2 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono shadow-2xs">
                        {inCart.quantity}
                      </div>
                    )}

                    <div>
                      <div className="font-bold text-[#171717] dark:text-neutral-100 text-xs leading-snug group-hover:text-black dark:group-hover:text-white line-clamp-2">
                        {prod ? prod.title : t('orders.untitledProduct')}
                      </div>

                      {/* Variant Specs Badge */}
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {v.color_name && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded text-[#4d4d4d] dark:text-neutral-300">
                            {v.color_name}
                          </span>
                        )}
                        {v.size_name && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded text-[#171717] dark:text-neutral-100 font-bold">
                            {t('orders.size')}: {v.size_name}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-[#888888] dark:text-neutral-400 font-mono mt-1">
                        SKU: {v.sku}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#ebebeb] dark:border-neutral-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#171717] dark:text-neutral-100 text-xs font-mono">
                          {formatCurrency(v.price, 'TOMAN', isPersian)}
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 ${
                          stock > 5
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : stock > 0
                            ? 'text-amber-700 dark:text-amber-400 font-bold'
                            : 'text-red-600 dark:text-red-400 font-bold'
                        }`}>
                          {stock > 0 ? (
                            <span>{t('orders.stockInCount', { count: isPersian ? toPersianDigits(stock) : stock })}</span>
                          ) : (
                            <span className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              {t('orders.outOfStockInSelectedWarehouse')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                        isOutOfStock
                          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700'
                          : 'bg-[#fafafa] dark:bg-[#181a20] group-hover:bg-[#171717] dark:group-hover:bg-neutral-100 group-hover:text-white dark:group-hover:text-neutral-900 text-[#171717] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 group-hover:border-[#171717]'
                      }`}>
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Digital Receipt & POS Checkout Terminal (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleSubmitOrder} className="bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
            {/* Invoice Terminal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb] dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-bold text-[#171717] dark:text-neutral-100 text-sm">{t('orders.invoiceItems')}</h2>
              </div>
              <Badge variant="neutral">{t('orders.itemsCount', { count: cart.length })}</Badge>
            </div>

            {/* Customer & Warehouse Selection */}
            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#171717] dark:text-neutral-200">
                    {t('orders.invoiceCustomer')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId(0)}
                    className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                  >
                    {t('orders.selectGeneralCustomer')}
                  </button>
                </div>
                <Select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                  options={[
                    { value: 0, label: t('orders.generalCustomer') },
                    ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.phone || '-'})` })),
                  ]}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#171717] dark:text-neutral-200">
                    {t('orders.deliveryWarehouse')}
                  </label>
                  {isWarehouseLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                      <Lock className="w-2.5 h-2.5" />
                      <span>{isPersian ? 'انبار اختصاصی شما' : 'Locked Branch'}</span>
                    </span>
                  )}
                </div>
                <Select
                  value={selectedWarehouseId}
                  disabled={isWarehouseLocked}
                  onChange={(e) => {
                    const newWhId = Number(e.target.value);
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
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code || w.id})` }))}
                />
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar border-y border-[#ebebeb] dark:border-neutral-800 py-3">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-[#888888] dark:text-neutral-400 text-xs space-y-2">
                  <Package className="w-8 h-8 text-[#a1a1a1] dark:text-neutral-500 mx-auto stroke-1" />
                  <p>{t('orders.emptyCartHint')}</p>
                </div>
              ) : (
                cart.map((line, lIdx) => (
                  <div
                    key={`ord_cart_${line.variant.id}_${lIdx}`}
                    className="p-2.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-[#171717] dark:text-neutral-100 block leading-tight">{line.productTitle}</span>
                        <div className="text-[10px] text-[#888888] dark:text-neutral-400 font-mono mt-0.5">
                          SKU: {line.variant.sku}
                          {line.variant.size_name ? ` | ${t('orders.size')}: ${line.variant.size_name}` : ''}
                          {line.variant.color_name ? ` | ${t('orders.color')}: ${line.variant.color_name}` : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.variant.id)}
                        className="text-[#888888] dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 p-1 transition-colors"
                        title={t('orders.removeFromCart')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#ebebeb]/60 dark:border-neutral-700/60">
                      {/* Quantity Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(line.variant.id, line.quantity - 1)}
                          className="w-6 h-6 rounded bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-700 font-bold text-[#171717] dark:text-neutral-100 flex items-center justify-center hover:bg-[#ebebeb] dark:hover:bg-neutral-800 transition-all"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleUpdateQty(line.variant.id, parseInt(e.target.value) || 1)}
                          className="w-9 text-center font-bold font-mono text-[#171717] dark:text-neutral-100 bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-700 rounded py-0.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(line.variant.id, line.quantity + 1)}
                          className="w-6 h-6 rounded bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-700 font-bold text-[#171717] dark:text-neutral-100 flex items-center justify-center hover:bg-[#ebebeb] dark:hover:bg-neutral-800 transition-all"
                        >
                          +
                        </button>
                      </div>

                      {/* Line Discount & Total */}
                      <div className="text-end">
                        <div className="font-bold font-mono text-[#171717] dark:text-neutral-100">
                          {formatCurrency(line.quantity * line.unitPrice - line.discount * line.quantity, 'TOMAN', isPersian)}
                        </div>
                        <div className="text-[10px] text-[#888888] dark:text-neutral-400 font-mono">
                          {formatCurrency(line.unitPrice, 'TOMAN', isPersian)} × {line.quantity}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Discounts & Tax Adjustments */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#4d4d4d] dark:text-neutral-300 mb-1">
                  {t('orders.specialDiscount')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={extraDiscount || ''}
                  onChange={(e) => setExtraDiscount(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded-lg text-xs font-mono text-[#171717] dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-[#171717] dark:focus:ring-neutral-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-[#4d4d4d] dark:text-neutral-300">
                    {t('orders.vatRate')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setHasTax(!hasTax)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-all ${
                      hasTax ? 'bg-emerald-600 text-white' : 'bg-[#ebebeb] dark:bg-neutral-800 text-[#4d4d4d] dark:text-neutral-300'
                    }`}
                  >
                    {hasTax ? t('orders.active') : t('orders.inactive')}
                  </button>
                </div>
                <div className="px-2.5 py-1.5 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-700 rounded-lg text-xs font-mono text-[#888888] dark:text-neutral-400">
                  {hasTax ? `${formatCurrency(taxAmount, 'TOMAN', isPersian)}` : t('orders.noTax')}
                </div>
              </div>
            </div>

            {/* Payment Method Selector Cards */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-[#171717] dark:text-neutral-200">{t('orders.paymentMethodPos')}</label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePaymentTypeChange('pos')}
                  className={`py-2 px-1 rounded-xl border text-center transition-all ${
                    paymentType === 'pos'
                      ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                      : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-[10px] font-bold block">{t('orders.posTerminal')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePaymentTypeChange('cash')}
                  className={`py-2 px-1 rounded-xl border text-center transition-all ${
                    paymentType === 'cash'
                      ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                      : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
                  }`}
                >
                  <DollarSign className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-[10px] font-bold block">{t('orders.cash')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePaymentTypeChange('card_to_card')}
                  className={`py-2 px-1 rounded-xl border text-center transition-all ${
                    paymentType === 'card_to_card'
                      ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                      : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
                  }`}
                >
                  <Tag className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-[10px] font-bold block">{t('orders.cardToCard')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePaymentTypeChange('credit')}
                  className={`py-2 px-1 rounded-xl border text-center transition-all ${
                    paymentType === 'credit'
                      ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                      : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
                  }`}
                >
                  <User className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-[10px] font-bold block">{t('orders.storeCredit')}</span>
                </button>
              </div>
            </div>

            {/* Financial Account / Cashbox Selector (When Accounting Module is Active) */}
            {hasAccounting && paymentType !== 'credit' && (
              <div className="p-3 bg-neutral-50 dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-neutral-800 dark:text-neutral-200">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('orders.settlementAccount') || 'واریز به حساب / صندوق تسویه:'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAccountLocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        <Lock className="w-2.5 h-2.5" />
                        <span>{isPersian ? 'صندوق اختصاصی شما' : 'Locked Cashbox'}</span>
                      </span>
                    )}
                    {selectedAccountId && (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                        {(() => {
                          const acc = financialAccounts.find((a) => a.id === selectedAccountId);
                          return acc && acc.current_balance !== undefined
                            ? `موجودی: ${formatCurrency(acc.current_balance, 'TOMAN', isPersian)}`
                            : '';
                        })()}
                      </span>
                    )}
                  </div>
                </div>

                {financialAccounts.length === 0 ? (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                    <span>هنوز حساب مالی یا صندوق نقدی در ماژول حسابداری تعریف نشده است.</span>
                    <button
                      type="button"
                      onClick={() => loadFinancialAccounts()}
                      className="px-2 py-1 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded text-[10px] font-bold hover:bg-amber-300"
                    >
                      بروزرسانی
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedAccountId ? String(selectedAccountId) : ''}
                      disabled={isAccountLocked}
                      onChange={(e) => {
                        if (isAccountLocked) return;
                        const val = e.target.value ? Number(e.target.value) : '';
                        setSelectedAccountId(val);
                        if (val && activeOrganization?.id) {
                          localStorage.setItem(
                            `tankhor_pos_account_${activeOrganization.id}_${user?.id || 'default'}`,
                            String(val)
                          );
                        }
                      }}
                      className={`w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-xs font-medium text-neutral-900 dark:text-neutral-100 focus:ring-1 focus:ring-emerald-500 ${
                        isAccountLocked ? 'opacity-80 cursor-not-allowed bg-neutral-100 dark:bg-neutral-800/80 border-amber-300 dark:border-amber-700' : ''
                      }`}
                    >
                      {/* 1. Accounts linked to selected warehouse */}
                      {(() => {
                        const linkedAccs = financialAccounts.filter((acc) => {
                          const aWhId = typeof acc.warehouse_id === 'object' && acc.warehouse_id ? (acc.warehouse_id as any).id : acc.warehouse_id;
                          return Number(aWhId) === Number(selectedWarehouseId);
                        });
                        const otherAccs = financialAccounts.filter((acc) => {
                          const aWhId = typeof acc.warehouse_id === 'object' && acc.warehouse_id ? (acc.warehouse_id as any).id : acc.warehouse_id;
                          return Number(aWhId) !== Number(selectedWarehouseId);
                        });

                        const selectedWhObj = warehouses.find((w) => w.id === selectedWarehouseId);

                        return (
                          <>
                            {linkedAccs.length > 0 && (
                              <optgroup label={`⭐ متصل به انبار انتخابی (${selectedWhObj?.name || 'این انبار'})`}>
                                {linkedAccs.map((acc) => (
                                  <option key={acc.id} value={String(acc.id)}>
                                    {acc.type === 'cashbox' ? '💵' : '💳'} {acc.name} {acc.bank_name ? `(${acc.bank_name})` : ''} - پیش‌فرض انبار
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {otherAccs.length > 0 && (
                              <optgroup label={linkedAccs.length > 0 ? 'سایر صندوق‌ها و حساب‌های مالی' : 'تمامی صندوق‌ها و حساب‌های بانکی'}>
                                {otherAccs.map((acc) => {
                                  const accWh = acc.warehouse_name || (typeof acc.warehouse_id === 'object' && acc.warehouse_id ? (acc.warehouse_id as any).name : null);
                                  return (
                                    <option key={acc.id} value={String(acc.id)}>
                                      {acc.type === 'cashbox' ? '💵' : '💳'} {acc.name} {acc.bank_name ? `(${acc.bank_name})` : ''} {accWh ? `[انبار: ${accWh}]` : ''} {acc.is_default ? '(پیش‌فرض عمومی)' : ''}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                          </>
                        );
                      })()}
                    </select>

                    {/* Indicator if current selection matches warehouse */}
                    {(() => {
                      const selAcc = financialAccounts.find((a) => a.id === selectedAccountId);
                      if (!selAcc) return null;
                      const aWhId = typeof selAcc.warehouse_id === 'object' && selAcc.warehouse_id ? (selAcc.warehouse_id as any).id : selAcc.warehouse_id;
                      const isLinkedToCurrentWh = Number(aWhId) === Number(selectedWarehouseId);

                      return (
                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                          <span className="text-neutral-500 dark:text-neutral-400">
                            نوع حساب: <strong className="text-neutral-700 dark:text-neutral-300">{selAcc.type === 'cashbox' ? 'صندوق نقدی' : selAcc.type === 'pos' ? 'کارتخوان (POS)' : 'حساب بانکی'}</strong>
                          </span>
                          {isLinkedToCurrentWh ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full font-bold">
                              ✓ متصل به انبار انتخابی
                            </span>
                          ) : aWhId ? (
                            <span className="text-[10px] text-neutral-400">
                              (متصل به انبار دیگر)
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* Cash Return Calculator (If Cash Selected) */}
            {paymentType === 'cash' && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-900">{t('orders.cashReceived')}</span>
                  <input
                    type="number"
                    value={cashReceived || ''}
                    onChange={(e) => setCashReceived(Number(e.target.value))}
                    placeholder={t('orders.cashReceivedPlaceholder')}
                    className="w-32 px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-mono font-bold text-emerald-900 text-end"
                  />
                </div>

                <div className="flex justify-between items-center text-xs border-t border-emerald-200/60 pt-2 font-bold">
                  <span className="text-emerald-800">{t('orders.cashChange')}</span>
                  <span className="font-mono text-emerald-900 text-sm">
                    {formatCurrency(cashChange, 'TOMAN', isPersian)}
                  </span>
                </div>
              </div>
            )}

            {/* Financial Totals Summary (Dark Ink Vercel Theme) */}
            <div className="p-4 bg-[#171717] text-white rounded-xl space-y-2 text-xs shadow-md">
              <div className="flex justify-between text-neutral-400">
                <span>{t('orders.subtotal')}:</span>
                <span className="font-mono">{formatCurrency(subtotal, 'TOMAN', isPersian)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>{t('orders.totalDiscount')}</span>
                  <span className="font-mono">- {formatCurrency(totalDiscount, 'TOMAN', isPersian)}</span>
                </div>
              )}

              {hasTax && (
                <div className="flex justify-between text-neutral-300">
                  <span>{t('orders.vatIncluded')}:</span>
                  <span className="font-mono">+ {formatCurrency(taxAmount, 'TOMAN', isPersian)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-white font-bold text-base pt-2 border-t border-neutral-800">
                <span>{t('orders.payableAmount')}</span>
                <span className="font-mono text-emerald-400 text-lg">
                  {formatCurrency(grandTotal, 'TOMAN', isPersian)}
                </span>
              </div>
            </div>

            {/* Order Action Buttons */}
            <div className="space-y-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full py-3 text-sm font-bold justify-center"
                isLoading={isSaving}
                disabled={cart.length === 0}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              >
                {t('orders.submitOrderAndFinalize')}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewPrint}
                disabled={cart.length === 0}
                className="w-full py-2.5 text-xs text-neutral-300 border-neutral-700 hover:bg-neutral-800 hover:text-white justify-center"
                icon={<Printer className="w-3.5 h-3.5 text-emerald-400" />}
              >
                {t('orders.previewAndPrint')}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal: Quick Customer Creation */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        title={t('orders.newCustomerTitle')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-[#171717] dark:text-neutral-200 mb-1">
              {t('orders.customerNameLabel')} <span className="text-red-500">*</span>
            </label>
            <Input
              required
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder={t('orders.customerNamePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#171717] dark:text-neutral-200 mb-1">
              {t('orders.customerPhoneLabel')}
            </label>
            <Input
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder={t('orders.customerPhonePlaceholder')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#ebebeb] dark:border-neutral-800">
            <Button variant="outline" type="button" onClick={() => setIsAddCustomerModalOpen(false)}>
              {t('orders.cancel')}
            </Button>

            <Button variant="primary" type="submit" isLoading={isSavingCustomer}>
              {t('orders.saveAndSelectCustomer')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Post Order Receipt & Print Options */}
      {lastSavedOrder && (
        <Modal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          title={t('orders.orderSuccessTitle', { number: lastSavedOrder.order.order_number })}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs font-sans pt-1">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-sm">{t('orders.orderSuccessSubtitle')}</p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">{t('orders.stockUpdatedSubtitle')}</p>
                </div>
              </div>
            </div>

            {/* Receipt Format Switcher */}
            <div className="space-y-2">
              <label className="block font-bold text-[#171717] dark:text-neutral-200">{t('orders.selectPrintFormat')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptType('standard')}
                  className={`p-3 rounded-xl border text-start transition-all ${
                    receiptType === 'standard'
                      ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                      : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
                  }`}
                >
                  <FileText className="w-5 h-5 mb-1 text-indigo-400" />
                  <span className="font-bold text-xs block">{t('orders.officialInvoiceFormat')}</span>
                  <span className="text-[10px] opacity-80 block mt-0.5">{t('orders.officialInvoiceDesc')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReceiptType('thermal')}
                  className={`p-3 rounded-xl border text-start transition-all ${
                    receiptType === 'thermal'
                      ? 'bg-[#171717] dark:bg-neutral-100 text-white dark:text-neutral-900 border-[#171717] dark:border-neutral-100 shadow-xs'
                      : 'bg-[#fafafa] dark:bg-[#181a20] text-[#4d4d4d] dark:text-neutral-300 border-[#ebebeb] dark:border-neutral-700 hover:border-[#a1a1a1]'
                  }`}
                >
                  <Receipt className="w-5 h-5 mb-1 text-emerald-400" />
                  <span className="font-bold text-xs block">{t('orders.thermalReceiptFormat')}</span>
                  <span className="text-[10px] opacity-80 block mt-0.5">{t('orders.thermalReceiptDesc')}</span>
                </button>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="p-3 bg-[#fafafa] dark:bg-[#181a20] border border-[#ebebeb] dark:border-neutral-800 rounded-xl space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#888888] dark:text-neutral-400">{t('orders.orderNumber')}:</span>
                <span className="font-bold text-[#171717] dark:text-neutral-100">{lastSavedOrder.order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888888] dark:text-neutral-400">{t('orders.customer')}:</span>
                <span className="text-[#171717] dark:text-neutral-100">{lastSavedOrder.customerName}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-[#ebebeb] dark:border-neutral-800">
                <span className="text-[#171717] dark:text-neutral-100">{t('orders.totalAmount')}:</span>
                <span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(lastSavedOrder.order.total, 'TOMAN', isPersian)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#ebebeb] dark:border-neutral-800">
              <Button variant="outline" onClick={() => setIsReceiptModalOpen(false)}>
                {t('orders.closeAndNextOrder')}
              </Button>

              <Button variant="primary" onClick={triggerPrint} icon={<Printer className="w-4 h-4" />}>
                {t('orders.printReceipt')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* POS Shift Management Modal */}
      <PosShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        onShiftChanged={(newShift) => setActiveShift(newShift)}
      />
    </div>
  );
};
