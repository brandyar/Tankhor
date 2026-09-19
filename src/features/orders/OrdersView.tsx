import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import {
  Order,
  OrderItem,
  Customer,
  Warehouse,
  ProductVariant,
  Product,
  OrderStatus,
  PaymentStatus,
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
import { DataTable } from '../../components/ui/DataTable';
import { formatDate, formatCurrency, toPersianDigits } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';
import { printElement } from '../../utils/print';
import { printOrderInvoice, OrderItemPrintData } from '../../utils/orderInvoicePrint';
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  User,
  Printer,
  Receipt,
  FileText,
  Package,
  Building2,
  AlertCircle,
  Tag,
  Trash2,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  RotateCcw,
  CreditCard,
  Wallet,
  ArrowRightLeft,
} from 'lucide-react';
import { exportOrdersToExcel, parseOrdersFromExcel } from '../../utils/excelUtils';

interface OrdersViewProps {
  onNavigateToCreate?: () => void;
}

interface OrderItemDisplay {
  id: number;
  productTitle: string;
  sku: string;
  colorName?: string;
  sizeName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onNavigateToCreate }) => {
  const { t, locale } = useTranslation();
  const { activeOrganization, permissions } = useOrganization();
  const isPersian = locale === 'fa';

  const { hasAccess } = useModuleAccess();
  const hasAccounting = hasAccess('accounting');

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Order Details Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItemDisplay[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<'standard' | 'thermal'>('standard');

  // Payment Settlement State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleOrderTarget, setSettleOrderTarget] = useState<Order | null>(null);
  const [selectedSettleAccountId, setSelectedSettleAccountId] = useState<number>(0);
  const [isSettlingPayment, setIsSettlingPayment] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [orderList, custList, whList, prodList, varList, accountsList] = await Promise.all([
        adapter.getOrders({ organization_id: orgId }),
        adapter.getCustomers({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
        adapter.getProducts({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
        adapter.getFinancialAccounts ? adapter.getFinancialAccounts({ organization_id: orgId }).catch(() => []) : Promise.resolve([]),
      ]);

      const enriched = orderList.map((ord) => {
        const custId = typeof ord.customer_id === 'object' ? (ord.customer_id as any)?.id : ord.customer_id;
        const cust = custList.find((c) => Number(c.id) === Number(custId));
        const whId = typeof ord.warehouse_id === 'object' ? (ord.warehouse_id as any)?.id : ord.warehouse_id;
        const wh = whList.find((w) => Number(w.id) === Number(whId));

        const rawTotal = (ord as any).total ?? (ord as any).total_amount ?? (ord as any).subtotal ?? 0;
        const numericTotal = Number(rawTotal) || 0;

        return {
          ...ord,
          total: numericTotal,
          customer_name: cust ? cust.name : ((ord as any).customer_name || t('orders.generalCustomer')),
          warehouse_name: wh ? wh.name : ((ord as any).warehouse_name || t('orders.defaultWarehouse')),
        };
      });

      setOrders(enriched);
      setCustomers(custList);
      setWarehouses(whList);
      setProducts(prodList);
      setVariants(varList);
      setFinancialAccounts(accountsList || []);
      if (accountsList && accountsList.length > 0) {
        setSelectedSettleAccountId(accountsList[0].id);
      }
    } catch (err) {
      console.error('[OrdersView] Error loading orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  // Handle deleting order with inventory restock if it was previously confirmed/completed
  const handleDeleteOrder = async (ord: Order) => {
    if (!ord.id) return;
    const isConfirmed = await confirmAction(t('orders.confirmDeleteOrderWithNumber', { number: ord.order_number }));
    if (!isConfirmed) return;

    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;

      // Restock inventory items if order had deducted stock (confirmed or completed)
      if (ord.status === 'confirmed' || ord.status === 'completed') {
        const orderItems = await adapter.getOrderItems(ord.id);
        const whId = typeof ord.warehouse_id === 'object' ? (ord.warehouse_id as any)?.id : (ord.warehouse_id || 1);

        for (const it of orderItems) {
          const varId = typeof it.variant_id === 'object' ? (it.variant_id as any)?.id : it.variant_id;
          if (varId && it.quantity > 0) {
            await adapter.recordMovement({
              organization_id: orgId,
              variant_id: Number(varId),
              warehouse_id: Number(whId),
              type: 'return',
              quantity: it.quantity,
              reference_type: 'order',
              reference_id: String(ord.id),
              note: `مرجوعی به انبار بابت حذف فاکتور #${ord.order_number}`,
            });
          }
        }
      }

      await adapter.deleteOrder(ord.id);
      if (selectedOrder?.id === ord.id) {
        setIsDetailModalOpen(false);
        setSelectedOrder(null);
      }
      await loadData();
    } catch (err) {
      console.error('[OrdersView] Error deleting order:', err);
    }
  };

  // Handle changing order status with strict inventory sync
  const handleUpdateOrderStatus = async (ord: Order, newStatus: OrderStatus) => {
    if (!ord.id || ord.status === newStatus) return;

    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const whId = typeof ord.warehouse_id === 'object' ? (ord.warehouse_id as any)?.id : (ord.warehouse_id || 1);
      const wasStockDeducted = ord.status === 'confirmed' || ord.status === 'completed';
      const willDeductStock = newStatus === 'confirmed' || newStatus === 'completed';

      // 1. If transitioning from un-deducted to confirmed/completed -> Deduct inventory
      if (!wasStockDeducted && willDeductStock) {
        const orderItems = await adapter.getOrderItems(ord.id);
        for (const it of orderItems) {
          const varId = typeof it.variant_id === 'object' ? (it.variant_id as any)?.id : it.variant_id;
          if (varId && it.quantity > 0) {
            await adapter.recordMovement({
              organization_id: orgId,
              variant_id: Number(varId),
              warehouse_id: Number(whId),
              type: 'sale',
              quantity: it.quantity,
              reference_type: 'order',
              reference_id: String(ord.id),
              note: `خروج از انبار بابت تایید فاکتور #${ord.order_number}`,
            });
          }
        }
      }
      // 2. If transitioning from confirmed/completed to cancelled/draft -> Return stock to inventory
      else if (wasStockDeducted && !willDeductStock) {
        const orderItems = await adapter.getOrderItems(ord.id);
        for (const it of orderItems) {
          const varId = typeof it.variant_id === 'object' ? (it.variant_id as any)?.id : it.variant_id;
          if (varId && it.quantity > 0) {
            await adapter.recordMovement({
              organization_id: orgId,
              variant_id: Number(varId),
              warehouse_id: Number(whId),
              type: 'return',
              quantity: it.quantity,
              reference_type: 'order',
              reference_id: String(ord.id),
              note: `برگشت به انبار بابت تغییر وضعیت فاکتور #${ord.order_number} به ${newStatus}`,
            });
          }
        }
      }

      // Save updated status
      const updated = await adapter.saveOrder({ id: ord.id, status: newStatus });
      setSelectedOrder((prev) => (prev && prev.id === ord.id ? { ...prev, status: newStatus } : prev));
      await loadData();
    } catch (err) {
      console.error('[OrdersView] Error updating order status:', err);
    }
  };

  // Settle Unpaid / Credit Order with Accounting & Treasury synchronization
  const handleOpenSettleModal = (ord: Order) => {
    setSettleOrderTarget(ord);
    if (financialAccounts.length > 0 && !selectedSettleAccountId) {
      setSelectedSettleAccountId(financialAccounts[0].id);
    }
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettlePayment = async () => {
    if (!settleOrderTarget?.id) return;
    setIsSettlingPayment(true);

    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const orderTotal = Number(settleOrderTarget.total) || 0;
      const custId = typeof settleOrderTarget.customer_id === 'object' ? (settleOrderTarget.customer_id as any)?.id : settleOrderTarget.customer_id;
      const custName = settleOrderTarget.customer_name || t('orders.generalCustomer');

      // 1. Update order payment status
      await adapter.saveOrder({
        id: settleOrderTarget.id,
        payment_status: 'paid',
        notes: `${settleOrderTarget.notes || ''} [تسویه فاکتور در تاریخ ${new Date().toLocaleDateString('fa-IR')}]`.trim(),
      });

      // 2. If accounting module is active, record Treasury Deposit & Customer Ledger Credit
      if (hasAccounting && orgId) {
        const orgNumId = Number(orgId);

        // Treasury deposit to the chosen bank/cashbox
        if (selectedSettleAccountId) {
          try {
            await adapter.saveTreasuryTransaction({
              organization_id: orgNumId,
              destination_account_id: Number(selectedSettleAccountId),
              type: 'deposit',
              amount: orderTotal,
              tracking_code: `SETTLE-${settleOrderTarget.order_number}`,
              description: `تسویه حساب فاکتور #${settleOrderTarget.order_number} (${custName})`,
              transaction_date: new Date().toISOString(),
            });
          } catch (trErr) {
            console.warn('[OrdersView] Error saving treasury settlement:', trErr);
          }
        }

        // Customer Ledger settlement credit
        if (custId) {
          try {
            await adapter.savePersonTransaction({
              organization_id: orgNumId,
              customer_id: Number(custId),
              financial_account_id: selectedSettleAccountId ? Number(selectedSettleAccountId) : undefined,
              party_type: 'customer',
              party_name: custName,
              type: 'creditor',
              transaction_type: 'receipt',
              amount: orderTotal,
              credit_amount: orderTotal,
              status: 'completed',
              reference_number: `SETTLE-${settleOrderTarget.order_number}`,
              order_id: settleOrderTarget.id,
              description: `تسویه و دریافت وجه فاکتور فروش #${settleOrderTarget.order_number}`,
              transaction_date: new Date().toISOString(),
            });
          } catch (ptErr) {
            console.warn('[OrdersView] Error saving person ledger settlement:', ptErr);
          }
        }
      }

      setIsSettleModalOpen(false);
      setSettleOrderTarget(null);
      if (selectedOrder?.id === settleOrderTarget.id) {
        setSelectedOrder((prev) => (prev ? { ...prev, payment_status: 'paid' } : null));
      }
      await loadData();
    } catch (err) {
      console.error('[OrdersView] Error settling payment:', err);
    } finally {
      setIsSettlingPayment(false);
    }
  };

  const handleOpenOrderDetails = async (ord: Order) => {
    setSelectedOrder(ord);
    setIsDetailModalOpen(true);
    setIsLoadingItems(true);

    try {
      const adapter = storageManager.getAdapter();
      const rawItems = await adapter.getOrderItems(ord.id);

      const itemsDisplay: OrderItemDisplay[] = rawItems.map((it) => {
        const varId = typeof it.variant_id === 'object' ? (it.variant_id as any)?.id : it.variant_id;
        const matchedVar = variants.find((v) => Number(v.id) === Number(varId));
        let prodTitle = t('orders.orderedItem');
        let sku = it.variant_sku || matchedVar?.sku || '-';
        let colorName = matchedVar?.color_name;
        let sizeName = matchedVar?.size_name;

        if (matchedVar) {
          const prodId = typeof matchedVar.product_id === 'object' ? (matchedVar.product_id as any)?.id : matchedVar.product_id;
          const matchedProd = products.find((p) => Number(p.id) === Number(prodId));
          if (matchedProd) prodTitle = matchedProd.title;
        }

        return {
          id: it.id,
          productTitle: prodTitle,
          sku,
          colorName,
          sizeName,
          quantity: it.quantity,
          unitPrice: it.unit_price,
          discount: it.discount || 0,
          total: it.total || it.quantity * it.unit_price - (it.discount || 0) * it.quantity,
        };
      });

      setSelectedOrderItems(itemsDisplay);
    } catch (err) {
      console.error('[OrdersView] Error fetching order items:', err);
      setSelectedOrderItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleDirectPrintOrder = async (ord: Order) => {
    setSelectedOrder(ord);
    try {
      const adapter = storageManager.getAdapter();
      const rawItems = await adapter.getOrderItems(ord.id);

      const itemsDisplay: OrderItemDisplay[] = rawItems.map((it) => {
        const varId = typeof it.variant_id === 'object' ? (it.variant_id as any)?.id : it.variant_id;
        const matchedVar = variants.find((v) => Number(v.id) === Number(varId));
        let prodTitle = t('orders.orderedItem');
        let sku = it.variant_sku || matchedVar?.sku || '-';
        let colorName = matchedVar?.color_name;
        let sizeName = matchedVar?.size_name;

        if (matchedVar) {
          const prodId = typeof matchedVar.product_id === 'object' ? (matchedVar.product_id as any)?.id : matchedVar.product_id;
          const matchedProd = products.find((p) => Number(p.id) === Number(prodId));
          if (matchedProd) prodTitle = matchedProd.title;
        }

        return {
          id: it.id,
          productTitle: prodTitle,
          sku,
          colorName,
          sizeName,
          quantity: it.quantity,
          unitPrice: it.unit_price,
          discount: it.discount || 0,
          total: it.total || it.quantity * it.unit_price - (it.discount || 0) * it.quantity,
        };
      });

      setSelectedOrderItems(itemsDisplay);
      printOrderInvoice(ord, itemsDisplay, activeOrganization, isPersian, receiptType);
    } catch (err) {
      console.error('[OrdersView] Error loading order for direct print:', err);
    }
  };

  const triggerPrint = () => {
    if (!selectedOrder) return;
    printOrderInvoice(selectedOrder, selectedOrderItems, activeOrganization, isPersian, receiptType);
  };

  const getOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">{t('orders.statusCompleted')}</Badge>;
      case 'confirmed':
        return <Badge variant="info">{t('orders.statusPending')}</Badge>;
      case 'processing':
        return <Badge variant="warning">{t('orders.statusProcessing')}</Badge>;
      case 'draft':
        return <Badge variant="neutral">{t('orders.statusDraft')}</Badge>;
      case 'cancelled':
        return <Badge variant="danger">{t('orders.statusCancelled')}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">{t('orders.payPaid')}</span>;
      case 'pending':
        return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">{t('orders.payUnpaid')}</span>;
      case 'partially_paid':
        return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">{t('orders.payPartial')}</span>;
      default:
        return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-200">{status}</span>;
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesSearch =
      ord.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (ord.customer_name && ord.customer_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportExcel = () => {
    exportOrdersToExcel(orders);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const res = parseOrdersFromExcel(buffer);
      if (!res.success) {
        alert(res.errors.join('\n') || 'خطا در خواندن فایل اکسل');
        return;
      }

      alert(`فایل اکسل سفارشات با موفقیت بررسی شد. ${res.importedCount} ردیف سفارش شناسایی گردید.`);
    } catch (err: any) {
      alert(`خطا در پردازش فایل اکسل: ${err?.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title={t('orders.title')}
        subtitle={t('orders.subtitle')}
        action={
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500 dark:text-neutral-400" />}
            >
              <span className="hidden sm:inline">ورود اکسل</span>
              <span className="sm:hidden">ورود</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              icon={<FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />}
            >
              <span className="hidden sm:inline">خروجی اکسل</span>
              <span className="sm:hidden">خروجی</span>
            </Button>
            {permissions.canCreateOrders && (
              <Button
                size="sm"
                onClick={onNavigateToCreate}
                icon={<Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              >
                <span>{t('orders.createOrder')}</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Toolbar */}
      <Card className="p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <Input
              placeholder={t('orders.searchProductVariant')}
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
                { value: 'all', label: t('common.all') },
                { value: 'completed', label: t('orders.statusCompleted') },
                { value: 'confirmed', label: t('orders.statusPending') },
                { value: 'draft', label: t('orders.statusDraft') },
                { value: 'cancelled', label: t('orders.statusCancelled') },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Orders Data Table */}
      <Card className="p-0 overflow-hidden">
        <DataTable<Order>
          data={filteredOrders}
          keyExtractor={(ord) => ord.id}
          isLoading={isLoading}
          emptyMessage={t('common.noData')}
          columns={[
            {
              key: 'order_number',
              header: t('orders.orderNumber'),
              render: (ord) => (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs shrink-0">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono font-bold text-slate-900 dark:text-neutral-100 text-xs sm:text-sm">
                      {ord.order_number}
                    </span>
                    <div className="text-[10px] text-slate-400 dark:text-neutral-400 font-mono">
                      {formatDate(ord.date_created, isPersian)}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'customer_name',
              header: t('orders.customer'),
              render: (ord) => (
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-neutral-100 text-xs">
                  <User className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-400" />
                  {ord.customer_name}
                </div>
              ),
            },
            {
              key: 'total',
              header: t('orders.totalAmount'),
              render: (ord) => (
                <div className="font-bold font-mono text-slate-900 dark:text-neutral-100 text-xs">
                  {formatCurrency(ord.total, 'TOMAN', isPersian)}
                </div>
              ),
            },
            {
              key: 'payment_status',
              header: t('orders.paymentStatus'),
              render: (ord) => getPaymentStatusBadge(ord.payment_status),
            },
            {
              key: 'status',
              header: t('orders.orderStatus'),
              render: (ord) => getOrderStatusBadge(ord.status),
            },
          ]}
          actions={(ord) => (
            <div className="flex items-center justify-end gap-2">
              {ord.payment_status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenSettleModal(ord)}
                  icon={<CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  title="تسویه حساب فاکتور نسیه"
                >
                  تسویه
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDirectPrintOrder(ord)}
                icon={<Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                title={t('orders.printInvoice')}
              >
                {t('orders.print')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenOrderDetails(ord)}
                icon={<Eye className="w-3.5 h-3.5" />}
              >
                {t('common.details')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:bg-rose-50"
                onClick={() => handleDeleteOrder(ord)}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                {t('common.delete')}
              </Button>
            </div>
          )}
        />
      </Card>

      {/* Modal: Comprehensive Order Details & Product Items List & Printing */}
      {selectedOrder && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={t('orders.orderDetailsTitle', { number: selectedOrder.order_number })}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs font-sans pt-1">
            {/* Header Meta Info & Status Control */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-[#181a20] rounded-xl border border-slate-200 dark:border-neutral-800">
              <div>
                <span className="text-slate-500 dark:text-neutral-400 text-[10px] block">{t('orders.buyerCustomer')}</span>
                <span className="font-bold text-slate-900 dark:text-neutral-100">{selectedOrder.customer_name}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-neutral-400 text-[10px] block">{t('orders.fulfillmentWarehouse')}</span>
                <span className="font-bold text-slate-900 dark:text-neutral-100">{(selectedOrder as any).warehouse_name || t('orders.defaultWarehouse')}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-neutral-400 text-[10px] block">{t('orders.orderDate')}:</span>
                <span className="font-mono text-slate-800 dark:text-neutral-200">{formatDate(selectedOrder.date_created, isPersian)}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-neutral-400 text-[10px] block">{t('orders.paymentStatus')}:</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {getPaymentStatusBadge(selectedOrder.payment_status)}
                  {selectedOrder.payment_status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleOpenSettleModal(selectedOrder)}
                      className="px-2 py-0.5 rounded text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer"
                    >
                      تسویه
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Inventory Sync Management Bar */}
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-neutral-300 font-medium">وضعیت فعلی سفارش:</span>
                <div>{getOrderStatusBadge(selectedOrder.status)}</div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-slate-500 dark:text-neutral-400 text-[11px] whitespace-nowrap">تغییر وضعیت:</span>
                <Select
                  value={selectedOrder.status}
                  onChange={(e) => handleUpdateOrderStatus(selectedOrder, e.target.value as OrderStatus)}
                  className="text-xs py-1"
                  options={[
                    { value: 'draft', label: 'پیش‌نویس' },
                    { value: 'confirmed', label: 'تأیید شده (کسر از انبار)' },
                    { value: 'completed', label: 'تکمیل شده (کسر از انبار)' },
                    { value: 'cancelled', label: 'لغو شده (برگشت به انبار)' },
                  ]}
                />
              </div>
            </div>

            {/* List of Products / Order Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-1.5 text-xs">
                  <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  {t('orders.orderItemsList', { count: isPersian ? toPersianDigits(selectedOrderItems.length) : selectedOrderItems.length })}
                </h3>
              </div>

              {isLoadingItems ? (
                <div className="p-8 text-center text-slate-500 dark:text-neutral-400 text-xs">{t('orders.loadingOrderItems')}</div>
              ) : selectedOrderItems.length === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-neutral-400 text-xs bg-slate-50 dark:bg-[#181a20] rounded-xl border border-slate-200 dark:border-neutral-800">
                  {t('orders.noOrderItemsFound')}
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-[#181a20] text-slate-700 dark:text-neutral-300 font-bold border-b border-slate-200 dark:border-neutral-800 text-[11px]">
                        <th className="p-2 text-center w-10">{t('orders.rowNumber')}</th>
                        <th className="p-2">{t('orders.itemTitleAndSpecs')}</th>
                        <th className="p-2 text-center">{t('orders.quantity')}</th>
                        <th className="p-2 text-end">{t('orders.unitPrice')}</th>
                        <th className="p-2 text-end">{t('orders.discount')}</th>
                        <th className="p-2 text-end">{t('orders.itemTotal')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-[#13151a]">
                      {selectedOrderItems.map((item, idx) => (
                        <tr key={`ord_item_${item.id || 'temp'}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="p-2 text-center text-slate-400 dark:text-neutral-500 font-mono text-[11px]">
                            {isPersian ? toPersianDigits(idx + 1) : idx + 1}
                          </td>
                          <td className="p-2">
                            <span className="font-bold text-slate-900 dark:text-neutral-100 block leading-tight">{item.productTitle}</span>
                            <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono mt-0.5">
                              SKU: {item.sku}
                              {item.sizeName ? ` | ${t('orders.size')}: ${item.sizeName}` : ''}
                              {item.colorName ? ` | ${t('orders.color')}: ${item.colorName}` : ''}
                            </div>
                          </td>
                          <td className="p-2 text-center font-bold font-mono text-slate-900 dark:text-neutral-100">
                            {isPersian ? toPersianDigits(item.quantity) : item.quantity}
                          </td>
                          <td className="p-2 text-end font-mono text-slate-800 dark:text-neutral-200">
                            {formatCurrency(item.unitPrice, 'TOMAN', isPersian)}
                          </td>
                          <td className="p-2 text-end font-mono text-red-600 dark:text-red-400">
                            {item.discount > 0 ? `- ${formatCurrency(item.discount * item.quantity, 'TOMAN', isPersian)}` : (isPersian ? '۰' : '0')}
                          </td>
                          <td className="p-2 text-end font-bold font-mono text-slate-900 dark:text-neutral-100">
                            {formatCurrency(item.total, 'TOMAN', isPersian)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Financial Overview Box */}
            <div className="p-3 bg-[#171717] text-white rounded-xl space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>{t('orders.subtotal')}:</span>
                <span>{formatCurrency(selectedOrder.subtotal, 'TOMAN', isPersian)}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>{t('orders.totalDiscount')}</span>
                  <span>- {formatCurrency(selectedOrder.discount, 'TOMAN', isPersian)}</span>
                </div>
              )}
              {selectedOrder.tax > 0 && (
                <div className="flex justify-between text-neutral-300">
                  <span>{t('orders.vatIncluded')}:</span>
                  <span>+ {formatCurrency(selectedOrder.tax, 'TOMAN', isPersian)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-white font-bold text-sm pt-2 border-t border-neutral-800">
                <span>{t('orders.payableAmount')}</span>
                <span className="text-emerald-400 text-base">{formatCurrency(selectedOrder.total, 'TOMAN', isPersian)}</span>
              </div>
            </div>

            {/* Print Settings & Format Selector */}
            <div className="p-3 bg-slate-50 dark:bg-[#181a20] border border-slate-200 dark:border-neutral-800 rounded-xl space-y-2">
              <label className="block font-bold text-slate-900 dark:text-neutral-100">{t('orders.selectPrintFormat')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptType('standard')}
                  className={`p-2.5 rounded-lg border text-start transition-all flex items-center gap-2 ${
                    receiptType === 'standard'
                      ? 'bg-slate-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-slate-900 dark:border-neutral-100 shadow-2xs'
                      : 'bg-white dark:bg-[#13151a] text-slate-700 dark:text-neutral-300 border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-bold text-xs block">{t('orders.officialInvoiceFormat')}</span>
                    <span className="text-[10px] opacity-80 block">{t('orders.officialInvoiceDesc')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReceiptType('thermal')}
                  className={`p-2.5 rounded-lg border text-start transition-all flex items-center gap-2 ${
                    receiptType === 'thermal'
                      ? 'bg-slate-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-slate-900 dark:border-neutral-100 shadow-2xs'
                      : 'bg-white dark:bg-[#13151a] text-slate-700 dark:text-neutral-300 border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-xs block">{t('orders.thermalReceiptFormat')}</span>
                    <span className="text-[10px] opacity-80 block">{t('orders.thermalReceiptDesc')}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-neutral-800">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                {t('orders.close')}
              </Button>

              <Button
                variant="primary"
                onClick={triggerPrint}
                icon={<Printer className="w-4 h-4 text-emerald-400" />}
              >
                {t('orders.printOrderInvoice')}
              </Button>
            </div>
          </div>

          {/* Printable Invoice Container (used by printElement / window.print) */}
          <div id="printable-order-invoice" className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-6 print:text-black font-sans z-[9999]">
            {receiptType === 'thermal' ? (
              /* 80mm POS Thermal Receipt */
              <div className="w-[80mm] mx-auto text-xs space-y-3 font-mono leading-tight">
                <div className="text-center border-b border-black pb-2">
                  <h2 className="text-sm font-bold">{activeOrganization?.name || 'TANKHOR'}</h2>
                  <p className="text-[10px]">{t('orders.posReceiptTitle')}</p>
                  <p className="text-[10px] mt-1">{t('orders.orderNumber')}: {selectedOrder.order_number}</p>
                  <p className="text-[10px]">{formatDate(selectedOrder.date_created, isPersian)}</p>
                </div>

                <div className="text-[11px] space-y-0.5">
                  <p>{t('orders.customer')}: {selectedOrder.customer_name || t('orders.generalCustomer')}</p>
                  <p>{t('orders.warehouseExit')}: {(selectedOrder as any).warehouse_name || t('orders.defaultWarehouse')}</p>
                </div>

                <table className="w-full text-start border-y border-black py-1">
                  <thead>
                    <tr className="border-b border-black font-bold">
                      <th className="py-1">{t('orders.itemDescription')}</th>
                      <th className="py-1 text-center">{t('orders.quantity')}</th>
                      <th className="py-1 text-end">{t('orders.itemTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderItems.map((it, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="py-1">
                          <div>{it.productTitle}</div>
                          <div className="text-[9px] text-gray-600">
                            {it.sizeName && `${t('orders.size')}: ${it.sizeName} `}
                            {it.colorName && `${t('orders.color')}: ${it.colorName}`}
                          </div>
                        </td>
                        <td className="py-1 text-center">{isPersian ? toPersianDigits(it.quantity) : it.quantity}</td>
                        <td className="py-1 text-end">{formatCurrency(it.total, 'TOMAN', isPersian)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="space-y-1 text-start text-xs pt-1">
                  <div className="flex justify-between">
                    <span>{t('orders.subtotal')}:</span>
                    <span>{formatCurrency(selectedOrder.subtotal, 'TOMAN', isPersian)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between">
                      <span>{t('orders.discount')}:</span>
                      <span>- {formatCurrency(selectedOrder.discount, 'TOMAN', isPersian)}</span>
                    </div>
                  )}
                  {selectedOrder.tax > 0 && (
                    <div className="flex justify-between">
                      <span>{t('orders.tax')}:</span>
                      <span>+ {formatCurrency(selectedOrder.tax, 'TOMAN', isPersian)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                    <span>{t('orders.payableAmount')}:</span>
                    <span>{formatCurrency(selectedOrder.total, 'TOMAN', isPersian)}</span>
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
                    <h1 className="text-xl font-black">{t('orders.officialSalesInvoice')}</h1>
                    <p className="text-gray-600 text-xs mt-1">{activeOrganization?.name || 'TANKHOR'}</p>
                  </div>
                  <div className="text-start font-mono text-xs space-y-1">
                    <p><strong>{t('orders.orderNumber')}:</strong> {selectedOrder.order_number}</p>
                    <p><strong>{t('orders.orderDate')}:</strong> {formatDate(selectedOrder.date_created, isPersian)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-300 rounded-lg">
                  <div>
                    <p className="font-bold text-gray-700">{t('orders.customer')}:</p>
                    <p className="text-sm font-bold text-black">{selectedOrder.customer_name || t('orders.generalCustomer')}</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-700">{t('orders.warehouseExit')}:</p>
                    <p className="text-sm text-black">{(selectedOrder as any).warehouse_name || t('orders.defaultWarehouse')}</p>
                  </div>
                </div>

                <table className="w-full text-start border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                      <th className="p-2 border-r border-gray-300">{t('orders.rowNumber')}</th>
                      <th className="p-2 border-r border-gray-300">{t('orders.itemTitleAndSpecs')}</th>
                      <th className="p-2 border-r border-gray-300 text-center">{t('orders.quantity')}</th>
                      <th className="p-2 border-r border-gray-300 text-end">{t('orders.unitPrice')} ({t('common.toman')})</th>
                      <th className="p-2 text-end">{t('orders.itemTotal')} ({t('common.toman')})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderItems.map((it, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="p-2 border-r border-gray-300 text-center">{isPersian ? toPersianDigits(idx + 1) : idx + 1}</td>
                        <td className="p-2 border-r border-gray-300">
                          <span className="font-bold">{it.productTitle}</span>
                          <div className="text-[10px] text-gray-500 font-mono">
                            SKU: {it.sku} | {it.sizeName ? `${t('orders.size')}: ${it.sizeName}` : ''} {it.colorName ? `| ${t('orders.color')}: ${it.colorName}` : ''}
                          </div>
                        </td>
                        <td className="p-2 border-r border-gray-300 text-center font-bold font-mono">{isPersian ? toPersianDigits(it.quantity) : it.quantity}</td>
                        <td className="p-2 border-r border-gray-300 text-end font-mono">{formatCurrency(it.unitPrice, 'TOMAN', isPersian)}</td>
                        <td className="p-2 text-end font-bold font-mono">{formatCurrency(it.total, 'TOMAN', isPersian)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-between items-start pt-2">
                  <div className="w-1/2 p-2 border border-gray-200 rounded text-[11px] text-gray-600 space-y-1">
                    <p className="font-bold text-gray-800">{t('orders.invoiceRemarks')}</p>
                    <p>{selectedOrder.notes || t('orders.defaultInvoiceRemarks')}</p>
                  </div>
                  <div className="w-1/2 border border-gray-300 rounded p-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>{t('orders.subtotal')}:</span>
                      <span>{formatCurrency(selectedOrder.subtotal, 'TOMAN', isPersian)}</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>{t('orders.discount')}:</span>
                        <span>- {formatCurrency(selectedOrder.discount, 'TOMAN', isPersian)}</span>
                      </div>
                    )}
                    {selectedOrder.tax > 0 && (
                      <div className="flex justify-between">
                        <span>{t('orders.tax')}:</span>
                        <span>+ {formatCurrency(selectedOrder.tax, 'TOMAN', isPersian)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm pt-2 border-t border-black">
                      <span>{t('orders.payableAmount')}:</span>
                      <span className="text-black">{formatCurrency(selectedOrder.total, 'TOMAN', isPersian)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end pt-8 text-[11px] text-gray-500">
                  <div className="text-center w-36 border-t border-gray-400 pt-1">
                    {t('orders.sellerSignature')}
                  </div>
                  <div className="text-center w-36 border-t border-gray-400 pt-1">
                    {t('orders.buyerSignature')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal: Settle Payment for Order (حسابداری و خزانه) */}
      {settleOrderTarget && (
        <Modal
          isOpen={isSettleModalOpen}
          onClose={() => {
            if (!isSettlingPayment) {
              setIsSettleModalOpen(false);
              setSettleOrderTarget(null);
            }
          }}
          title={`تسویه و دریافت وجه فاکتور #${settleOrderTarget.order_number}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-1 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-[#181a20] rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-neutral-400">طرف حساب (مشتری):</span>
                <span className="font-bold text-slate-900 dark:text-neutral-100">{settleOrderTarget.customer_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-neutral-400">مبلغ قابل تسویه:</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatCurrency(settleOrderTarget.total, 'TOMAN', isPersian)}
                </span>
              </div>
            </div>

            {hasAccounting && financialAccounts.length > 0 && (
              <div className="space-y-1.5">
                <label className="font-medium text-slate-700 dark:text-neutral-300 block">
                  واریز به حساب بانکی / صندوق (خزانه داری):
                </label>
                <Select
                  value={selectedSettleAccountId}
                  onChange={(e) => setSelectedSettleAccountId(Number(e.target.value))}
                  options={financialAccounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.name} (${acc.type === 'bank' ? 'بانک' : acc.type === 'cash' ? 'صندوق' : 'کارتخوان'}) - ${formatCurrency(acc.current_balance || 0, 'TOMAN', isPersian)}`,
                  }))}
                />
                <p className="text-[11px] text-slate-400 dark:text-neutral-500">
                  وجه دریافتی مستقیماً به موجودی این حساب واریز شده و سند معین بستانکار مشتری ثبت می‌گردد.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettleModalOpen(false)}
                disabled={isSettlingPayment}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmSettlePayment}
                isLoading={isSettlingPayment}
                icon={<CheckCircle2 className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                تأیید و ثبت تسویه حساب
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
