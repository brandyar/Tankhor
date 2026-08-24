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
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { formatDate, formatCurrency } from '../../utils/formatters';
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
} from 'lucide-react';

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
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Order Details Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItemDisplay[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<'standard' | 'thermal'>('standard');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [orderList, custList, whList, prodList, varList] = await Promise.all([
        adapter.getOrders({ organization_id: orgId }),
        adapter.getCustomers({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
        adapter.getProducts({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
      ]);

      const enriched = orderList.map((ord) => {
        const custId = typeof ord.customer_id === 'object' ? ord.customer_id.id : ord.customer_id;
        const cust = custList.find((c) => c.id === custId);
        const whId = typeof ord.warehouse_id === 'object' ? ord.warehouse_id.id : ord.warehouse_id;
        const wh = whList.find((w) => w.id === whId);

        return {
          ...ord,
          customer_name: cust ? cust.name : 'مشتری عمومی (کافه‌فروش)',
          warehouse_name: wh ? wh.name : 'انبار اصلی',
        };
      });

      setOrders(enriched);
      setCustomers(custList);
      setWarehouses(whList);
      setProducts(prodList);
      setVariants(varList);
    } catch (err) {
      console.error('[OrdersView] Error loading orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const handleOpenOrderDetails = async (ord: Order) => {
    setSelectedOrder(ord);
    setIsDetailModalOpen(true);
    setIsLoadingItems(true);

    try {
      const adapter = storageManager.getAdapter();
      const rawItems = await adapter.getOrderItems(ord.id);

      const itemsDisplay: OrderItemDisplay[] = rawItems.map((it) => {
        const varId = typeof it.variant_id === 'object' ? it.variant_id.id : it.variant_id;
        const matchedVar = variants.find((v) => v.id === varId);
        let prodTitle = 'کالای سفارش داده شده';
        let sku = it.variant_sku || matchedVar?.sku || '-';
        let colorName = matchedVar?.color_name;
        let sizeName = matchedVar?.size_name;

        if (matchedVar) {
          const prodId = typeof matchedVar.product_id === 'object' ? matchedVar.product_id.id : matchedVar.product_id;
          const matchedProd = products.find((p) => p.id === prodId);
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

  const triggerPrint = () => {
    window.print();
  };

  const getOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">تکمیل شده</Badge>;
      case 'confirmed':
        return <Badge variant="primary">تایید شده</Badge>;
      case 'processing':
        return <Badge variant="warning">در حال پردازش</Badge>;
      case 'draft':
        return <Badge variant="neutral">پیش‌نویس</Badge>;
      case 'cancelled':
        return <Badge variant="error">لغو شده</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">پرداخت شده</span>;
      case 'pending':
        return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800">در انتظار پرداخت</span>;
      case 'partially_paid':
        return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">پرداخت جزئی</span>;
      default:
        return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesSearch =
      ord.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (ord.customer_name && ord.customer_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Printable Invoice Section for Print Trigger */}
      {selectedOrder && (
        <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-6 print:text-black font-sans z-[9999]">
          {receiptType === 'thermal' ? (
            /* POS 80mm Thermal Receipt */
            <div className="w-[80mm] mx-auto text-xs space-y-3 font-mono leading-tight">
              <div className="text-center border-b border-black pb-2">
                <h2 className="text-sm font-bold">پلتفرم مدیریت پوشاک تن‌خور</h2>
                <p className="text-[10px]">رسید فروش صندوق POS</p>
                <p className="text-[10px] mt-1">شماره فاکتور: {selectedOrder.order_number}</p>
                <p className="text-[10px]">{formatDate(selectedOrder.date_created, isPersian)}</p>
              </div>

              <div className="text-[11px] space-y-0.5">
                <p>مشتری: {selectedOrder.customer_name}</p>
                <p>انبار: {selectedOrder.warehouse_name || 'انبار اصلی'}</p>
              </div>

              <table className="w-full text-right border-y border-black py-1">
                <thead>
                  <tr className="border-b border-black font-bold">
                    <th className="py-1">شرح کالا</th>
                    <th className="py-1 text-center">تعداد</th>
                    <th className="py-1 text-left">مبلغ کل</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrderItems.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1">
                        <div>{it.productTitle}</div>
                        <div className="text-[9px] text-gray-600">
                          {it.sizeName && `سایز: ${it.sizeName} `}
                          {it.colorName && `رنگ: ${it.colorName}`}
                        </div>
                      </td>
                      <td className="py-1 text-center">{it.quantity}</td>
                      <td className="py-1 text-left">{formatCurrency(it.total, 'TOMAN', isPersian)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-left text-xs pt-1">
                <div className="flex justify-between">
                  <span>جمع اقلام:</span>
                  <span>{formatCurrency(selectedOrder.subtotal, 'TOMAN', isPersian)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between">
                    <span>تخفیف:</span>
                    <span>- {formatCurrency(selectedOrder.discount, 'TOMAN', isPersian)}</span>
                  </div>
                )}
                {selectedOrder.tax > 0 && (
                  <div className="flex justify-between">
                    <span>مالیات:</span>
                    <span>+ {formatCurrency(selectedOrder.tax, 'TOMAN', isPersian)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                  <span>قابل پرداخت:</span>
                  <span>{formatCurrency(selectedOrder.total, 'TOMAN', isPersian)}</span>
                </div>
              </div>

              <div className="text-center text-[9px] pt-4 border-t border-black">
                با تشکر از خرید شما · تن‌خور TANKHOR
              </div>
            </div>
          ) : (
            /* Standard A4 / A5 Official Sales Invoice */
            <div className="max-w-2xl mx-auto space-y-4 text-xs font-sans">
              <div className="flex justify-between items-center border-b-2 border-black pb-3">
                <div>
                  <h1 className="text-xl font-black">فاکتور رسمی فروش کالا</h1>
                  <p className="text-gray-600 text-xs mt-1">پوشاک، کفش و اکسسوری تن‌خور (TANKHOR)</p>
                </div>
                <div className="text-left font-mono text-xs space-y-1">
                  <p><strong>شماره فاکتور:</strong> {selectedOrder.order_number}</p>
                  <p><strong>تاریخ ثبت:</strong> {formatDate(selectedOrder.date_created, isPersian)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-300 rounded-lg">
                <div>
                  <p className="font-bold text-gray-700">خریدار:</p>
                  <p className="text-sm font-bold text-black">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-700">انبار تحویل کالا:</p>
                  <p className="text-sm text-black">{selectedOrder.warehouse_name || 'انبار اصلی'}</p>
                </div>
              </div>

              <table className="w-full text-right border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="p-2 border-r border-gray-300">ردیف</th>
                    <th className="p-2 border-r border-gray-300">نام کالا و مشخصات فنی</th>
                    <th className="p-2 border-r border-gray-300 text-center">تعداد</th>
                    <th className="p-2 border-r border-gray-300 text-left">قیمت واحد (تومان)</th>
                    <th className="p-2 text-left">جمع کل (تومان)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrderItems.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="p-2 border-r border-gray-300 text-center">{idx + 1}</td>
                      <td className="p-2 border-r border-gray-300">
                        <span className="font-bold">{it.productTitle}</span>
                        <div className="text-[10px] text-gray-500 font-mono">
                          SKU: {it.sku} {it.sizeName ? `| سایز: ${it.sizeName}` : ''} {it.colorName ? `| رنگ: ${it.colorName}` : ''}
                        </div>
                      </td>
                      <td className="p-2 border-r border-gray-300 text-center font-bold font-mono">{it.quantity}</td>
                      <td className="p-2 border-r border-gray-300 text-left font-mono">{formatCurrency(it.unitPrice, 'TOMAN', isPersian)}</td>
                      <td className="p-2 text-left font-bold font-mono">{formatCurrency(it.total, 'TOMAN', isPersian)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-start pt-2">
                <div className="w-1/2 p-2 border border-gray-200 rounded text-[11px] text-gray-600 space-y-1">
                  <p className="font-bold text-gray-800">توضیحات فاکتور:</p>
                  <p>{selectedOrder.notes || 'سفارش ثبت‌شده در سامانه تن‌خور.'}</p>
                </div>
                <div className="w-2/5 space-y-1 text-left font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>جمع کل اقلام:</span>
                    <span>{formatCurrency(selectedOrder.subtotal, 'TOMAN', isPersian)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200 text-red-600">
                      <span>مجموع تخفیف:</span>
                      <span>- {formatCurrency(selectedOrder.discount, 'TOMAN', isPersian)}</span>
                    </div>
                  )}
                  {selectedOrder.tax > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span>مالیات بر ارزش افزوده:</span>
                      <span>+ {formatCurrency(selectedOrder.tax, 'TOMAN', isPersian)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 font-bold text-sm border-t-2 border-black text-black">
                    <span>مبلغ قابل پرداخت:</span>
                    <span>{formatCurrency(selectedOrder.total, 'TOMAN', isPersian)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 text-center pt-8 border-t border-gray-300 text-xs">
                <div>مهر و امضای فروشنده</div>
                <div>امضای خریدار</div>
              </div>
            </div>
          )}
        </div>
      )}

      <PageHeader
        title="مدیریت سفارشات فروش (Sales Orders)"
        subtitle="فهرست کلیه سفارش‌های ثبت‌شده، لیست محصولات هر فاکتور و صدور/چاپ فاکتور"
        action={
          <Button
            onClick={onNavigateToCreate}
            icon={<Plus className="w-4 h-4" />}
          >
            ثبت سفارش جدید POS
          </Button>
        }
      />

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <Input
              placeholder="جستجو شماره سفارش یا نام مشتری..."
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
                { value: 'all', label: 'همه وضعیت‌ها' },
                { value: 'completed', label: 'تکمیل شده' },
                { value: 'confirmed', label: 'تایید شده' },
                { value: 'draft', label: 'پیش‌نویس' },
                { value: 'cancelled', label: 'لغو شده' },
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
          emptyMessage="هیچ سفارشی یافت نشد."
          columns={[
            {
              key: 'order_number',
              header: 'شماره سفارش',
              render: (ord) => (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-mono font-bold text-xs shrink-0">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
                      {ord.order_number}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatDate(ord.date_created, isPersian)}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'customer_name',
              header: 'نام مشتری',
              render: (ord) => (
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {ord.customer_name}
                </div>
              ),
            },
            {
              key: 'total',
              header: 'مبلغ کل فاکتور',
              render: (ord) => (
                <div className="font-bold font-mono text-slate-900 text-xs">
                  {formatCurrency(ord.total, 'TOMAN', isPersian)}
                </div>
              ),
            },
            {
              key: 'payment_status',
              header: 'وضعیت پرداخت',
              render: (ord) => getPaymentStatusBadge(ord.payment_status),
            },
            {
              key: 'status',
              header: 'وضعیت سفارش',
              render: (ord) => getOrderStatusBadge(ord.status),
            },
          ]}
          actions={(ord) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenOrderDetails(ord)}
                icon={<Eye className="w-3.5 h-3.5" />}
              >
                جزییات و چاپ فاکتور
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
          title={`جزییات و فاکتور سفارش ${selectedOrder.order_number}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs font-sans pt-1">
            {/* Header Meta Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 text-[10px] block">خریدار / مشتری:</span>
                <span className="font-bold text-slate-900">{selectedOrder.customer_name}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">انبار تحویل:</span>
                <span className="font-bold text-slate-900">{selectedOrder.warehouse_name || 'انبار اصلی'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">تاریخ ثبت:</span>
                <span className="font-mono text-slate-800">{formatDate(selectedOrder.date_created, isPersian)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">وضعیت سفارش:</span>
                <div className="mt-0.5">{getOrderStatusBadge(selectedOrder.status)}</div>
              </div>
            </div>

            {/* List of Products / Order Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Package className="w-4 h-4 text-indigo-600" />
                  لیست محصولات و اقلام فاکتور ({selectedOrderItems.length} قلم):
                </h3>
              </div>

              {isLoadingItems ? (
                <div className="p-8 text-center text-slate-500 text-xs">در حال دریافت لیست اقلام فاکتور...</div>
              ) : selectedOrderItems.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
                  اقلام کالای این فاکتور ثبت نشده یا دریافت نگردید.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <th className="p-2 text-center w-10">#</th>
                        <th className="p-2">عنوان محصول و مشخصات</th>
                        <th className="p-2 text-center">تعداد</th>
                        <th className="p-2 text-left">قیمت واحد</th>
                        <th className="p-2 text-left">تخفیف</th>
                        <th className="p-2 text-left">جمع کل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedOrderItems.map((item, idx) => (
                        <tr key={`ord_item_${item.id || 'temp'}_${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="p-2">
                            <span className="font-bold text-slate-900 block leading-tight">{item.productTitle}</span>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              SKU: {item.sku}
                              {item.sizeName ? ` | سایز: ${item.sizeName}` : ''}
                              {item.colorName ? ` | رنگ: ${item.colorName}` : ''}
                            </div>
                          </td>
                          <td className="p-2 text-center font-bold font-mono text-slate-900">{item.quantity}</td>
                          <td className="p-2 text-left font-mono text-slate-800">
                            {formatCurrency(item.unitPrice, 'TOMAN', isPersian)}
                          </td>
                          <td className="p-2 text-left font-mono text-red-600">
                            {item.discount > 0 ? `- ${formatCurrency(item.discount * item.quantity, 'TOMAN', isPersian)}` : '۰'}
                          </td>
                          <td className="p-2 text-left font-bold font-mono text-slate-900">
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
                <span>جمع کل اقلام:</span>
                <span>{formatCurrency(selectedOrder.subtotal, 'TOMAN', isPersian)}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>مجموع تخفیف‌ها:</span>
                  <span>- {formatCurrency(selectedOrder.discount, 'TOMAN', isPersian)}</span>
                </div>
              )}
              {selectedOrder.tax > 0 && (
                <div className="flex justify-between text-neutral-300">
                  <span>مالیات بر ارزش افزوده:</span>
                  <span>+ {formatCurrency(selectedOrder.tax, 'TOMAN', isPersian)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-white font-bold text-sm pt-2 border-t border-neutral-800">
                <span>مبلغ قابل پرداخت:</span>
                <span className="text-emerald-400 text-base">{formatCurrency(selectedOrder.total, 'TOMAN', isPersian)}</span>
              </div>
            </div>

            {/* Print Settings & Format Selector */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block font-bold text-slate-900">قالب چاپ فاکتور:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptType('standard')}
                  className={`p-2.5 rounded-lg border text-start transition-all flex items-center gap-2 ${
                    receiptType === 'standard'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-bold text-xs block">فاکتور رسمی A4 / A5</span>
                    <span className="text-[10px] opacity-80 block">مناسب مشتری و بایگانی</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReceiptType('thermal')}
                  className={`p-2.5 rounded-lg border text-start transition-all flex items-center gap-2 ${
                    receiptType === 'thermal'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-xs block">رسید حرارتی POS (80mm)</span>
                    <span className="text-[10px] opacity-80 block">پرینتر حرارتی صندوق</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                بستن
              </Button>

              <Button
                variant="primary"
                onClick={triggerPrint}
                icon={<Printer className="w-4 h-4 text-emerald-400" />}
              >
                چاپ فاکتور سفارش
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
