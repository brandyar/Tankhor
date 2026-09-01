import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
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
} from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatCurrency } from '../../utils/formatters';
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
  Phone,
  UserPlus,
  Check,
  Percent,
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
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Core Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Selections
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('completed');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [paymentType, setPaymentType] = useState<POSPaymentType>('pos');
  const [orderNotes, setOrderNotes] = useState('');

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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [custList, whList, catList, varList, prodList] = await Promise.all([
        adapter.getCustomers({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
        adapter.getCategories({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
        adapter.getProducts({ organization_id: orgId }),
      ]);

      setCustomers(custList);
      setWarehouses(whList);
      setCategories(catList);
      setVariants(varList);
      setProducts(prodList);

      if (whList.length > 0) setSelectedWarehouseId(whList[0].id);
    } catch (err) {
      console.error('[CreateOrderView] Error loading order form data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  // Focus barcode input on load
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isLoading]);

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
      handleAddToCart(matched);
      const prod = products.find((p) => p.id === (typeof matched.product_id === 'object' ? matched.product_id.id : matched.product_id));
      const title = prod ? prod.title : 'کالای تن‌خور';
      showToast('success', `کالای «${title}» به فاکتور اضافه شد.`);
      setBarcodeQuery('');
    } else {
      showToast('error', `کالایی با بارکد یا کد SKU «${barcodeQuery}» یافت نشد.`);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setScannerToast({ type, message });
    setTimeout(() => {
      setScannerToast(null);
    }, 3000);
  };

  // Add Variant to Cart
  const handleAddToCart = (variant: ProductVariant) => {
    const prod = products.find((p) => p.id === (typeof variant.product_id === 'object' ? variant.product_id.id : variant.product_id));
    const title = prod ? prod.title : 'کالای تن‌خور';
    const price = variant.price || 0;

    const existingIdx = cart.findIndex((c) => c.variant.id === variant.id);
    if (existingIdx !== -1) {
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

  const handleUpdateQty = (variantId: number, qty: number) => {
    if (qty <= 0) {
      handleRemoveLine(variantId);
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
    if (await confirmAction('آیا از پاک کردن کامل سبد خرید و فاکتور جاری اطمینان دارید؟')) {
      setCart([]);
      setExtraDiscount(0);
      setOrderNotes('');
      setCashReceived(0);
    }
  };

  const handlePreviewPrint = () => {
    if (cart.length === 0) return;
    const selectedCust = customers.find((c) => c.id === selectedCustomerId);
    const customerName = selectedCust ? selectedCust.name : 'مشتری عمومی (کافه‌فروش)';
    const selectedWh = warehouses.find((w) => w.id === selectedWarehouseId);
    const warehouseName = selectedWh ? selectedWh.name : 'انبار اصلی';

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
      showToast('success', `مشتری «${created.name}» ایجاد و انتخاب گردید.`);
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
      setErrorMsg('فاکتور خالی است. لطفاً حداقل یک کالا انتخاب یا اسکن نمایید.');
      return;
    }
    if (!selectedWarehouseId) {
      setErrorMsg('لطفاً انبار خروج کالا را انتخاب کنید.');
      return;
    }

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      const selectedCust = customers.find((c) => c.id === selectedCustomerId);
      const customerName = selectedCust ? selectedCust.name : 'مشتری عمومی (کافه‌فروش)';

      const selectedWh = warehouses.find((w) => w.id === selectedWarehouseId);
      const warehouseName = selectedWh ? selectedWh.name : 'انبار اصلی';

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
        notes: `[روش پرداخت: ${
          paymentType === 'pos'
            ? 'کارتخوان'
            : paymentType === 'cash'
            ? 'وجه نقد'
            : paymentType === 'card_to_card'
            ? 'کارت به کارت'
            : 'نسیه / حساب مشتری'
        }] ${orderNotes}`.trim(),
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
            note: `فروش صندوق POS سفارش #${orderNumber}`,
          });
        }
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
      setErrorMsg('خطا در ثبت و نهایی‌سازی سفارش POS.');
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
    printElement('printable-create-order-invoice', { title: `فاکتور_${lastSavedOrder?.order.order_number || 'جدید'}` });
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
                <h2 className="text-sm font-bold">پلتفرم مدیریت پوشاک تن‌خور</h2>
                <p className="text-[10px]">رسید فروش صندوق POS</p>
                <p className="text-[10px] mt-1">شماره: {lastSavedOrder.order.order_number}</p>
                <p className="text-[10px]">{formatDate(lastSavedOrder.order.date_created, isPersian)}</p>
              </div>

              <div className="text-[11px] space-y-0.5">
                <p>مشتری: {lastSavedOrder.customerName}</p>
                <p>انبار: {lastSavedOrder.warehouseName}</p>
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
                  {lastSavedOrder.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1">
                        <div>{it.productTitle}</div>
                        <div className="text-[9px] text-gray-600">
                          {it.variant.size_name && `سایز: ${it.variant.size_name} `}
                          {it.variant.color_name && `رنگ: ${it.variant.color_name}`}
                        </div>
                      </td>
                      <td className="py-1 text-center">{it.quantity}</td>
                      <td className="py-1 text-left">{formatCurrency(it.quantity * it.unitPrice, 'TOMAN', isPersian)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-left text-xs pt-1">
                <div className="flex justify-between">
                  <span>جمع اقلام:</span>
                  <span>{formatCurrency(lastSavedOrder.order.subtotal, 'TOMAN', isPersian)}</span>
                </div>
                {lastSavedOrder.order.discount > 0 && (
                  <div className="flex justify-between">
                    <span>تخفیف:</span>
                    <span>- {formatCurrency(lastSavedOrder.order.discount, 'TOMAN', isPersian)}</span>
                  </div>
                )}
                {lastSavedOrder.order.tax > 0 && (
                  <div className="flex justify-between">
                    <span>مالیات:</span>
                    <span>+ {formatCurrency(lastSavedOrder.order.tax, 'TOMAN', isPersian)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                  <span>قابل پرداخت:</span>
                  <span>{formatCurrency(lastSavedOrder.order.total, 'TOMAN', isPersian)}</span>
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
                  <p><strong>شماره فاکتور:</strong> {lastSavedOrder.order.order_number}</p>
                  <p><strong>تاریخ:</strong> {formatDate(lastSavedOrder.order.date_created, isPersian)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-300 rounded-lg">
                <div>
                  <p className="font-bold text-gray-700">خریدار:</p>
                  <p className="text-sm font-bold text-black">{lastSavedOrder.customerName}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-700">انبار خروج کالا:</p>
                  <p className="text-sm text-black">{lastSavedOrder.warehouseName}</p>
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
                  {lastSavedOrder.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="p-2 border-r border-gray-300 text-center">{idx + 1}</td>
                      <td className="p-2 border-r border-gray-300">
                        <span className="font-bold">{it.productTitle}</span>
                        <div className="text-[10px] text-gray-500 font-mono">
                          SKU: {it.variant.sku} | {it.variant.size_name ? `سایز: ${it.variant.size_name}` : ''} {it.variant.color_name ? `| رنگ: ${it.variant.color_name}` : ''}
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
                  <p className="font-bold text-gray-800">توضیحات فاکتور:</p>
                  <p>{lastSavedOrder.order.notes || 'سفارش نهایی شده در صندوق POS تن‌خور.'}</p>
                </div>
                <div className="w-2/5 space-y-1 text-left font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>جمع کل اقلام:</span>
                    <span>{formatCurrency(lastSavedOrder.order.subtotal, 'TOMAN', isPersian)}</span>
                  </div>
                  {lastSavedOrder.order.discount > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200 text-red-600">
                      <span>مجموع تخفیف:</span>
                      <span>- {formatCurrency(lastSavedOrder.order.discount, 'TOMAN', isPersian)}</span>
                    </div>
                  )}
                  {lastSavedOrder.order.tax > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span>مالیات بر ارزش افزوده:</span>
                      <span>+ {formatCurrency(lastSavedOrder.order.tax, 'TOMAN', isPersian)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 font-bold text-sm border-t-2 border-black text-black">
                    <span>مبلغ قابل پرداخت:</span>
                    <span>{formatCurrency(lastSavedOrder.order.total, 'TOMAN', isPersian)}</span>
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

      {/* POS Top Header & Action Controls */}
      <div className="bg-white border border-[#ebebeb] rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#171717] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Receipt className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#171717]">پایانه فروش و صدور فاکتور (TANKHOR POS)</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                فعال و متصل
              </span>
            </div>
            <p className="text-xs text-[#888888] mt-0.5">
              صدور سریع فاکتور خرید، اسکن بارکد، ثبت شیوه پرداخت و بروزرسانی آنی موجودی انبار
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewPrint}
            disabled={cart.length === 0}
            icon={<Printer className="w-3.5 h-3.5 text-emerald-600" />}
          >
            پیش‌نمایش / چاپ فاکتور
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddCustomerModalOpen(true)}
            icon={<UserPlus className="w-3.5 h-3.5 text-indigo-600" />}
          >
            تعریف مشتری سریع
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCart}
            disabled={cart.length === 0}
            className="text-red-600 hover:bg-red-50 border-red-200"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            پاک کردن فاکتور
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
          <form onSubmit={handleBarcodeSubmit} className="bg-white border border-[#ebebeb] rounded-xl p-3 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#171717]">
              <span className="flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-emerald-600" />
                اسکن بارکد یا ورود سریع SKU کالا:
              </span>
              <span className="text-[10px] text-[#888888] font-mono">[کلید Enter جهت ثبت]</span>
            </div>

            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                placeholder="بارکدخوان فعال است... بارکد کالا را اسکن کنید یا کد SKU بنویسید"
                className="w-full ps-9 pe-24 py-2 bg-[#fafafa] border border-[#ebebeb] focus:border-[#171717] focus:bg-white rounded-lg text-xs font-mono text-[#171717] focus:outline-none transition-all shadow-inner"
              />
              <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-[#888888]">
                <Barcode className="w-4 h-4" />
              </div>
              <div className="absolute inset-y-0 end-1.5 flex items-center">
                <Button type="submit" variant="primary" size="sm" className="h-7 text-[11px] px-3 font-bold">
                  افزودن سریع
                </Button>
              </div>
            </div>
          </form>

          {/* Catalog Filter Bar */}
          <div className="bg-white border border-[#ebebeb] rounded-xl p-3 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="w-full sm:w-64">
                <Input
                  placeholder="جستجو کالا، کد یا مشخصه..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  icon={<Search className="w-3.5 h-3.5" />}
                />
              </div>

              <div className="text-xs font-mono text-[#888888]">
                موجودی کالاها: <strong className="text-[#171717]">{filteredVariants.length} قلم</strong>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#171717] text-white shadow-xs'
                    : 'bg-[#fafafa] text-[#4d4d4d] border border-[#ebebeb] hover:border-[#a1a1a1]'
                }`}
              >
                همه دسته‌ها
              </button>
              {categories.map((cat, idx) => (
                <button
                  key={`ord_cat_${cat.id}_${idx}`}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                    selectedCategoryId === cat.id
                      ? 'bg-[#171717] text-white shadow-xs'
                      : 'bg-[#fafafa] text-[#4d4d4d] border border-[#ebebeb] hover:border-[#a1a1a1]'
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
              <div className="col-span-3 p-12 text-center text-[#888888] text-xs">در حال بارگذاری کاتالوگ محصولات...</div>
            ) : filteredVariants.length === 0 ? (
              <div className="col-span-3 p-12 text-center text-[#888888] text-xs bg-white rounded-xl border border-[#ebebeb]">
                هیچ کالایی با این مشخصات یافت نشد.
              </div>
            ) : (
              filteredVariants.map((v, vIdx) => {
                const prod = products.find((p) => p.id === (typeof v.product_id === 'object' ? v.product_id.id : v.product_id));
                const stock = v.stock_quantity ?? 0;
                const inCart = cart.find((c) => c.variant.id === v.id);

                return (
                  <div
                    key={`ord_var_${v.id}_${vIdx}`}
                    onClick={() => handleAddToCart(v)}
                    className={`p-3 bg-white border rounded-xl cursor-pointer transition-all duration-150 flex flex-col justify-between space-y-2 relative group hover:shadow-md ${
                      inCart
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                        : 'border-[#ebebeb] hover:border-[#171717]'
                    }`}
                  >
                    {inCart && (
                      <div className="absolute top-2 end-2 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold font-mono shadow-2xs">
                        {inCart.quantity}
                      </div>
                    )}

                    <div>
                      <div className="font-bold text-[#171717] text-xs leading-snug group-hover:text-black line-clamp-2">
                        {prod ? prod.title : 'محصول تن‌خور'}
                      </div>

                      {/* Variant Specs Badge */}
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {v.color_name && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#fafafa] border border-[#ebebeb] rounded text-[#4d4d4d]">
                            {v.color_name}
                          </span>
                        )}
                        {v.size_name && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#fafafa] border border-[#ebebeb] rounded text-[#171717] font-bold">
                            سایز: {v.size_name}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-[#888888] font-mono mt-1">
                        SKU: {v.sku}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#ebebeb] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#171717] text-xs font-mono">
                          {formatCurrency(v.price, 'TOMAN', isPersian)}
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 ${stock > 5 ? 'text-emerald-700' : stock > 0 ? 'text-amber-700' : 'text-red-600 font-bold'}`}>
                          {stock > 0 ? `موجودی: ${stock} عدد` : 'اتمام موجودی'}
                        </div>
                      </div>

                      <div className="w-7 h-7 rounded-lg bg-[#fafafa] group-hover:bg-[#171717] group-hover:text-white text-[#171717] border border-[#ebebeb] group-hover:border-[#171717] flex items-center justify-center transition-all">
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
          <form onSubmit={handleSubmitOrder} className="bg-white border border-[#ebebeb] rounded-2xl p-4 shadow-sm space-y-4">
            {/* Invoice Terminal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-[#171717] text-sm">اقلام فاکتور فروش</h2>
              </div>
              <Badge variant="neutral">{cart.length} کالا</Badge>
            </div>

            {/* Customer & Warehouse Selection */}
            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#171717]">
                    مشتری فاکتور
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId(0)}
                    className="text-[10px] text-emerald-700 font-bold hover:underline"
                  >
                    + انتخاب مشتری عمومی
                  </button>
                </div>
                <Select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                  options={[
                    { value: 0, label: 'مشتری عمومی (کافه‌فروش)' },
                    ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.phone || 'بدون شماره'})` })),
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171717] mb-1">
                  انبار تحویل کالا
                </label>
                <Select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code || 'کد انبار'})` }))}
                />
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar border-y border-[#ebebeb] py-3">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-[#888888] text-xs space-y-2">
                  <Package className="w-8 h-8 text-[#a1a1a1] mx-auto stroke-1" />
                  <p>فاکتور خالی است. کالاها را اسکن کنید یا از کاتالوگ انتخاب نمایید.</p>
                </div>
              ) : (
                cart.map((line, lIdx) => (
                  <div
                    key={`ord_cart_${line.variant.id}_${lIdx}`}
                    className="p-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-[#171717] block leading-tight">{line.productTitle}</span>
                        <div className="text-[10px] text-[#888888] font-mono mt-0.5">
                          SKU: {line.variant.sku}
                          {line.variant.size_name ? ` | سایز: ${line.variant.size_name}` : ''}
                          {line.variant.color_name ? ` | رنگ: ${line.variant.color_name}` : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.variant.id)}
                        className="text-[#888888] hover:text-red-600 p-1 transition-colors"
                        title="حذف از فاکتور"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#ebebeb]/60">
                      {/* Quantity Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(line.variant.id, line.quantity - 1)}
                          className="w-6 h-6 rounded bg-white border border-[#ebebeb] font-bold text-[#171717] flex items-center justify-center hover:bg-[#ebebeb] transition-all"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleUpdateQty(line.variant.id, parseInt(e.target.value) || 1)}
                          className="w-9 text-center font-bold font-mono text-[#171717] bg-white border border-[#ebebeb] rounded py-0.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(line.variant.id, line.quantity + 1)}
                          className="w-6 h-6 rounded bg-white border border-[#ebebeb] font-bold text-[#171717] flex items-center justify-center hover:bg-[#ebebeb] transition-all"
                        >
                          +
                        </button>
                      </div>

                      {/* Line Discount & Total */}
                      <div className="text-end">
                        <div className="font-bold font-mono text-[#171717]">
                          {formatCurrency(line.quantity * line.unitPrice - line.discount * line.quantity, 'TOMAN', isPersian)}
                        </div>
                        <div className="text-[10px] text-[#888888] font-mono">
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
                <label className="block text-[11px] font-bold text-[#4d4d4d] mb-1">
                  تخفیف ویژه فاکتور (تومان)
                </label>
                <input
                  type="number"
                  min="0"
                  value={extraDiscount || ''}
                  onChange={(e) => setExtraDiscount(Math.max(0, Number(e.target.value)))}
                  placeholder="۰"
                  className="w-full px-2.5 py-1.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-xs font-mono text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#171717]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-[#4d4d4d]">
                    ارزش افزوده (٪۹)
                  </label>
                  <button
                    type="button"
                    onClick={() => setHasTax(!hasTax)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-all ${
                      hasTax ? 'bg-emerald-600 text-white' : 'bg-[#ebebeb] text-[#4d4d4d]'
                    }`}
                  >
                    {hasTax ? 'فعال' : 'غیرفعال'}
                  </button>
                </div>
                <div className="px-2.5 py-1.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-xs font-mono text-[#888888]">
                  {hasTax ? `${formatCurrency(taxAmount, 'TOMAN', isPersian)}` : 'بدون مالیات'}
                </div>
              </div>
            </div>

            {/* Payment Method Selector Cards */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-[#171717]">روش پرداخت POS:</label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentType('pos')}
                  className={`py-2 px-1 rounded-xl border text-center transition-all ${
                    paymentType === 'pos'
                      ? 'bg-[#171717] text-white border-[#171717] shadow-xs'
                      : 'bg-[#fafafa] text-[#4d4d4d] border-[#ebebeb] hover:border-[#a1a1a1]'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-[10px] font-bold block">کارتخوان</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('cash')}
                  className={`py-2 px-1 rounded-xl border text-center transition-all ${
                    paymentType === 'cash'
                      ? 'bg-[#171717] text-white border-[#171717] shadow-xs'
                      : 'bg-[#fafafa] text-[#4d4d4d] border-[#ebebeb] hover:border-[#a1a1a1]'
                  }`}
                >
                  <DollarSign className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-[10px] font-bold block">وجه نقد</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('card_to_card')}
                  className={`py-2 px-1 rounded-xl border text-center transition-all ${
                    paymentType === 'card_to_card'
                      ? 'bg-[#171717] text-white border-[#171717] shadow-xs'
                      : 'bg-[#fafafa] text-[#4d4d4d] border-[#ebebeb] hover:border-[#a1a1a1]'
                  }`}
                >
                  <Tag className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-[10px] font-bold block">کارت‌به‌کارت</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('credit')}
                  className={`py-2 px-1 rounded-xl border text-center transition-all ${
                    paymentType === 'credit'
                      ? 'bg-[#171717] text-white border-[#171717] shadow-xs'
                      : 'bg-[#fafafa] text-[#4d4d4d] border-[#ebebeb] hover:border-[#a1a1a1]'
                  }`}
                >
                  <User className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-[10px] font-bold block">نسیه/اعتبار</span>
                </button>
              </div>
            </div>

            {/* Cash Return Calculator (If Cash Selected) */}
            {paymentType === 'cash' && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-900">مبلغ دریافتی نقد از مشتری:</span>
                  <input
                    type="number"
                    value={cashReceived || ''}
                    onChange={(e) => setCashReceived(Number(e.target.value))}
                    placeholder="مبلغ دریافتی..."
                    className="w-32 px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-mono font-bold text-emerald-900 text-end"
                  />
                </div>

                <div className="flex justify-between items-center text-xs border-t border-emerald-200/60 pt-2 font-bold">
                  <span className="text-emerald-800">باقی‌مانده / عودتی به مشتری:</span>
                  <span className="font-mono text-emerald-900 text-sm">
                    {formatCurrency(cashChange, 'TOMAN', isPersian)}
                  </span>
                </div>
              </div>
            )}

            {/* Financial Totals Summary (Dark Ink Vercel Theme) */}
            <div className="p-4 bg-[#171717] text-white rounded-xl space-y-2 text-xs shadow-md">
              <div className="flex justify-between text-neutral-400">
                <span>جمع کل اقلام:</span>
                <span className="font-mono">{formatCurrency(subtotal, 'TOMAN', isPersian)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>مجموع تخفیف‌ها:</span>
                  <span className="font-mono">- {formatCurrency(totalDiscount, 'TOMAN', isPersian)}</span>
                </div>
              )}

              {hasTax && (
                <div className="flex justify-between text-neutral-300">
                  <span>مالیات بر ارزش افزوده (٪۹):</span>
                  <span className="font-mono">+ {formatCurrency(taxAmount, 'TOMAN', isPersian)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-white font-bold text-base pt-2 border-t border-neutral-800">
                <span>مبلغ قابل پرداخت:</span>
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
                ثبت فاکتور و نهایی‌سازی فروش POS
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewPrint}
                disabled={cart.length === 0}
                className="w-full py-2.5 text-xs text-neutral-300 border-neutral-700 hover:bg-neutral-800 hover:text-white justify-center"
                icon={<Printer className="w-3.5 h-3.5 text-emerald-400" />}
              >
                پیش‌نمایش و چاپ قبل از ثبت
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal: Quick Customer Creation */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        title="تعریف مشتری جدید"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-[#171717] mb-1">
              نام و نام خانوادگی مشتری <span className="text-red-500">*</span>
            </label>
            <Input
              required
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="مثال: علی محمدی"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#171717] mb-1">
              شماره همراه / تلفن
            </label>
            <Input
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#ebebeb]">
            <Button variant="outline" type="button" onClick={() => setIsAddCustomerModalOpen(false)}>
              انصراف
            </Button>

            <Button variant="primary" type="submit" isLoading={isSavingCustomer}>
              ذخیره و انتخاب مشتری
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Post Order Receipt & Print Options */}
      {lastSavedOrder && (
        <Modal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          title={`فاکتور سفارش #${lastSavedOrder.order.order_number} با موفقیت ثبت شد`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs font-sans pt-1">
            <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-sm">فروش با موفقیت در سیستم ثبت گردید</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">موجودی انبار به‌صورت خودکار بروزرسانی شد.</p>
                </div>
              </div>
            </div>

            {/* Receipt Format Switcher */}
            <div className="space-y-2">
              <label className="block font-bold text-[#171717]">انتخاب قالب چاپ فاکتور:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptType('standard')}
                  className={`p-3 rounded-xl border text-start transition-all ${
                    receiptType === 'standard'
                      ? 'bg-[#171717] text-white border-[#171717] shadow-xs'
                      : 'bg-[#fafafa] text-[#4d4d4d] border-[#ebebeb] hover:border-[#a1a1a1]'
                  }`}
                >
                  <FileText className="w-5 h-5 mb-1 text-indigo-400" />
                  <span className="font-bold text-xs block">فاکتور رسمی A4 / A5</span>
                  <span className="text-[10px] opacity-80 block mt-0.5">مناسب ارائه به خریدار و بایگانی</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReceiptType('thermal')}
                  className={`p-3 rounded-xl border text-start transition-all ${
                    receiptType === 'thermal'
                      ? 'bg-[#171717] text-white border-[#171717] shadow-xs'
                      : 'bg-[#fafafa] text-[#4d4d4d] border-[#ebebeb] hover:border-[#a1a1a1]'
                  }`}
                >
                  <Receipt className="w-5 h-5 mb-1 text-emerald-400" />
                  <span className="font-bold text-xs block">رسید حرارتی POS (80mm)</span>
                  <span className="text-[10px] opacity-80 block mt-0.5">مناسب پرینترهای حرارتی فیش پرینتر</span>
                </button>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="p-3 bg-[#fafafa] border border-[#ebebeb] rounded-xl space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#888888]">شماره سفارش:</span>
                <span className="font-bold text-[#171717]">{lastSavedOrder.order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888888]">مشتری:</span>
                <span className="text-[#171717]">{lastSavedOrder.customerName}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-[#ebebeb]">
                <span className="text-[#171717]">مبلغ فاکتور:</span>
                <span className="text-emerald-700">{formatCurrency(lastSavedOrder.order.total, 'TOMAN', isPersian)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#ebebeb]">
              <Button variant="outline" onClick={() => setIsReceiptModalOpen(false)}>
                بستن و ثبت سفارش بعدی
              </Button>

              <Button variant="primary" onClick={triggerPrint} icon={<Printer className="w-4 h-4" />}>
                چاپ فاکتور
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
