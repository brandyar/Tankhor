import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n';
import { Customer, Warehouse, Category, ProductVariant, Product, PosShift } from '../../../types';
import { FinancialAccount } from '../../../types/accounting';
import { CartLine } from './OrderCartTable';
import { POSPaymentType } from './OrderPaymentSection';
import { ProductImage } from '../../../components/ui/ProductImage';
import { formatCurrency, toPersianDigits, formatDate } from '../../../utils/formatters';
import {
  Minimize2,
  Barcode,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  UserPlus,
  Store,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Calendar,
  Clock,
  Printer,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Percent,
} from 'lucide-react';

interface FullscreenPosTerminalProps {
  onClose: () => void;
  activeShift: PosShift | null;
  onOpenShiftModal: () => void;
  onOpenCustomerModal: () => void;
  customers: Customer[];
  selectedCustomerId: number;
  setSelectedCustomerId: (id: number) => void;
  warehouses: Warehouse[];
  selectedWarehouseId: number;
  setSelectedWarehouseId: (id: number) => void;
  isWarehouseLocked: boolean;
  categories: Category[];
  selectedCategoryId: number | 'all';
  setSelectedCategoryId: (id: number | 'all') => void;
  filteredVariants: ProductVariant[];
  products: Product[];
  getVariantAvailableStock: (variantId: number, warehouseId?: number) => number;
  cart: CartLine[];
  onAddToCart: (variant: ProductVariant) => void;
  onUpdateQty: (variantId: number, qty: number) => void;
  onRemoveLine: (variantId: number) => void;
  onClearCart: () => void;
  barcodeQuery: string;
  setBarcodeQuery: (query: string) => void;
  onBarcodeSubmit: (e: React.FormEvent) => void;
  productSearch: string;
  setProductSearch: (query: string) => void;
  subtotal: number;
  extraDiscount: number;
  setExtraDiscount: (val: number) => void;
  totalDiscount: number;
  hasTax: boolean;
  setHasTax: (val: boolean) => void;
  taxAmount: number;
  grandTotal: number;
  paymentType: POSPaymentType;
  onPaymentTypeChange: (type: POSPaymentType) => void;
  cashReceived: number;
  setCashReceived: (val: number) => void;
  cashChange: number;
  financialAccounts: FinancialAccount[];
  selectedAccountId: number | '';
  setSelectedAccountId: (id: number | '') => void;
  isAccountLocked: boolean;
  hasAccounting: boolean;
  isSaving: boolean;
  onSubmitOrder: (e: React.FormEvent) => void;
  onPreviewPrint: () => void;
  organizationName?: string;
  userName?: string;
  scannerToast: { type: 'success' | 'error'; message: string } | null;
  errorMsg: string | null;
}

export const FullscreenPosTerminal: React.FC<FullscreenPosTerminalProps> = ({
  onClose,
  activeShift,
  onOpenShiftModal,
  onOpenCustomerModal,
  customers,
  selectedCustomerId,
  setSelectedCustomerId,
  warehouses,
  selectedWarehouseId,
  setSelectedWarehouseId,
  isWarehouseLocked,
  categories,
  selectedCategoryId,
  setSelectedCategoryId,
  filteredVariants,
  products,
  getVariantAvailableStock,
  cart,
  onAddToCart,
  onUpdateQty,
  onRemoveLine,
  onClearCart,
  barcodeQuery,
  setBarcodeQuery,
  onBarcodeSubmit,
  productSearch,
  setProductSearch,
  subtotal,
  extraDiscount,
  setExtraDiscount,
  totalDiscount,
  hasTax,
  setHasTax,
  taxAmount,
  grandTotal,
  paymentType,
  onPaymentTypeChange,
  cashReceived,
  setCashReceived,
  cashChange,
  financialAccounts,
  selectedAccountId,
  setSelectedAccountId,
  isAccountLocked,
  hasAccounting,
  isSaving,
  onSubmitOrder,
  onPreviewPrint,
  organizationName = 'تن‌خور',
  userName,
  scannerToast,
  errorMsg,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Live Digital Clock state
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}:${seconds}`;
      setCurrentTime(isPersian ? toPersianDigits(timeStr, true) : timeStr);

      const isoToday = now.toISOString().slice(0, 10);
      setCurrentDateStr(formatDate(isoToday, isPersian));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isPersian]);

  // Handle ESC key to exit fullscreen POS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If a modal dialog is currently open, let the modal handle Esc first
        const hasOpenModal = document.querySelector('.tankhor-modal-backdrop');
        if (hasOpenModal) {
          return;
        }
        e.preventDefault();
        onClose();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !isSaving) {
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          onSubmitOrder(fakeEvent);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onSubmitOrder, cart.length, isSaving]);

  // Lock body & html scroll and prevent background page interaction when Fullscreen POS is open
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.classList.add('pos-fullscreen-active');
    document.documentElement.classList.add('pos-fullscreen-active');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    // Intercept mouse wheel events to prevent bubbling down to underlying page
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // If event happened inside a modal backdrop or dialog, let modal handle it
      if (target.closest('.tankhor-modal-backdrop')) return;
      // If event happened inside a scrollable container in terminal, allow it to scroll
      const scrollable = target.closest('.overflow-y-auto, .overflow-x-auto, .overflow-auto') as HTMLElement | null;
      if (!scrollable) {
        e.preventDefault();
        return;
      }
      // Prevent overscroll chaining to window when scroll limit reached
      const isScrollDown = e.deltaY > 0;
      const isScrollUp = e.deltaY < 0;
      const reachedBottom = Math.abs(scrollable.scrollHeight - scrollable.clientHeight - scrollable.scrollTop) <= 1;
      const reachedTop = scrollable.scrollTop <= 0;
      if ((isScrollDown && reachedBottom) || (isScrollUp && reachedTop)) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.tankhor-modal-backdrop')) return;
      const scrollable = target.closest('.overflow-y-auto, .overflow-x-auto, .overflow-auto');
      if (!scrollable) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.body.classList.remove('pos-fullscreen-active');
      document.documentElement.classList.remove('pos-fullscreen-active');
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Request browser fullscreen when mounting (best-effort)
  useEffect(() => {
    try {
      if (document.documentElement && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {
          // Browser or iframe may restrict full screen - benign fallback to CSS fixed inset-0
        });
      }
    } catch {
      // Ignore fullscreen API restrictions
    }

    return () => {
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      } catch {
        // Ignore
      }
    };
  }, []);

  // Autofocus barcode input
  useEffect(() => {
    const timeout = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timeout);
  }, [cart.length]);

  // Quick Cash Presets
  const quickCashPresets = [
    { label: t('orders.exactAmount'), amount: grandTotal },
    { label: isPersian ? '+ ۵۰,۰۰۰' : '+50K', amount: Math.ceil(grandTotal / 50000) * 50000 },
    { label: isPersian ? '+ ۱۰۰,۰۰۰' : '+100K', amount: Math.ceil(grandTotal / 100000) * 100000 },
    { label: isPersian ? '+ ۵۰۰,۰۰۰' : '+500K', amount: Math.ceil(grandTotal / 500000) * 500000 },
    { label: isPersian ? '+ ۱,۰۰۰,۰۰۰' : '+1M', amount: Math.ceil(grandTotal / 1000000) * 1000000 },
  ];

  const terminalContent = (
    <div
      id="fullscreen-pos-terminal"
      style={{ zIndex: 1000, overscrollBehavior: 'contain' }}
      className="fixed inset-0 z-[1000] bg-[#f8f9fa] dark:bg-[#0a0b0e] text-[#171717] dark:text-neutral-100 flex flex-col overflow-hidden select-none animate-fade-in font-sans w-screen h-screen overscroll-contain"
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      {/* ===================== TOP SPACIOUS BAR ===================== */}
      <header className="bg-white dark:bg-[#111317] border-b border-[#e5e7eb] dark:border-neutral-800/80 px-6 py-3 shrink-0 flex items-center justify-between gap-4 shadow-xs">
        {/* Brand & Terminal Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center shadow-xs font-bold text-lg">
              <Store className="w-5 h-5 text-emerald-400 dark:text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight">{organizationName}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300/50 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t('orders.fullscreenPos')}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-3 mt-0.5">
                {userName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-neutral-400" />
                    <span>{t('orders.cashier')}: <strong>{userName}</strong></span>
                  </span>
                )}
                {activeShift && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                    {isPersian ? `شیفت #${activeShift.id}` : `Shift #${activeShift.id}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Warehouse Selector */}
          <div className="hidden md:flex items-center gap-1.5 bg-[#f4f5f7] dark:bg-[#181a20] px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{t('orders.fulfillmentWarehouse')}</span>
            {isWarehouseLocked || warehouses.length <= 1 ? (
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                {warehouses.find((w) => w.id === selectedWarehouseId)?.name || t('orders.defaultWarehouse')}
              </span>
            ) : (
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none cursor-pointer"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} className="bg-white dark:bg-neutral-900">
                    {w.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Center: Live Digital Clock with Generous Whitespace */}
        <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 rounded-2xl bg-[#fafafa] dark:bg-[#15171c] border border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-medium">{currentDateStr}</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span className="tracking-widest">{currentTime}</span>
          </div>
        </div>

        {/* Right Tools & Exit Icon */}
        <div className="flex items-center gap-2">
          {/* Quick Customer Button */}
          <button
            type="button"
            onClick={onOpenCustomerModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#181a20] text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
            title={t('orders.quickCustomer')}
          >
            <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">{t('orders.quickCustomer')}</span>
          </button>

          {/* Shift Button */}
          <button
            type="button"
            onClick={onOpenShiftModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors shadow-2xs ${
              activeShift
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#181a20] text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">
              {activeShift ? (isPersian ? 'مدیریت شیفت' : 'Shift') : (isPersian ? 'افتتاح شیفت' : 'Open Shift')}
            </span>
          </button>

          {/* Clear Cart */}
          <button
            type="button"
            onClick={onClearCart}
            disabled={cart.length === 0}
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title={t('orders.clearInvoice')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Small Exit Button with Esc Badge */}
          <button
            type="button"
            id="pos-exit-fullscreen-btn"
            onClick={onClose}
            className="flex items-center gap-2 ps-3 pe-2 py-1.5 rounded-xl bg-neutral-900 hover:bg-black text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 text-xs font-bold transition-all shadow-sm hover:scale-[1.02] active:scale-95 ms-2"
            title={t('orders.exitFullscreenPos')}
          >
            <span>{t('orders.exitFullscreenPos')}</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-800 dark:bg-neutral-200 text-neutral-300 dark:text-neutral-700 rounded-md font-bold">
              ESC
            </span>
            <Minimize2 className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-600" />
          </button>
        </div>
      </header>

      {/* ===================== NOTIFICATION TOASTS ===================== */}
      {scannerToast && (
        <div
          className={`mx-8 mt-3 p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-fade-in shadow-xs ${
            scannerToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/60 dark:border-red-800 dark:text-red-200'
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
        <div className="mx-8 mt-3 p-3 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ===================== MAIN 2-COLUMN POS LAYOUT ===================== */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 xl:p-8 overflow-hidden items-stretch">
        {/* ================= LEFT/RIGHT: PRODUCT CATALOG & BARCODE (7 cols) ================= */}
        <section className="lg:col-span-7 flex flex-col space-y-4 overflow-hidden h-full">
          {/* Barcode & Search Station with Generous Negative Space */}
          <div className="bg-white dark:bg-[#121418] border border-[#e5e7eb] dark:border-neutral-800/80 rounded-2xl p-4 shadow-2xs space-y-3 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Barcode Input Box */}
              <form onSubmit={onBarcodeSubmit} className="md:col-span-7 relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  placeholder={t('orders.barcodeScannerActivePlaceholder')}
                  className="w-full ps-10 pe-20 h-12 bg-[#f8f9fa] dark:bg-[#181a20] border-2 border-emerald-500/40 focus:border-emerald-600 focus:bg-white dark:focus:bg-[#13151a] rounded-xl text-xs font-mono text-[#171717] dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none transition-all shadow-inner"
                />
                <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-emerald-600 dark:text-emerald-400">
                  <Barcode className="w-5 h-5" />
                </div>
                <div className="absolute inset-y-0 end-1.5 flex items-center">
                  <button
                    type="submit"
                    className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
                  >
                    {t('orders.quickAdd')}
                  </button>
                </div>
              </form>

              {/* Text Search Box */}
              <div className="md:col-span-5 relative">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={t('orders.searchPlaceholder')}
                  className="w-full ps-9 pe-3 h-12 bg-[#f8f9fa] dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700/80 focus:border-neutral-800 dark:focus:border-neutral-300 focus:bg-white dark:focus:bg-[#13151a] rounded-xl text-xs text-[#171717] dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none transition-all"
                />
                <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-neutral-400">
                  <Search className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Category Filter Pills with Generous Spacing */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pt-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedCategoryId === 'all'
                    ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-sm'
                    : 'bg-[#f4f5f7] dark:bg-[#1a1d24] text-neutral-600 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400'
                }`}
              >
                {t('orders.allCategories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={`pos_cat_${cat.id}`}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    selectedCategoryId === cat.id
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-sm'
                      : 'bg-[#f4f5f7] dark:bg-[#1a1d24] text-neutral-600 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Catalog Grid (Spacious & Clean Cards) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pe-1 overscroll-contain">
            {filteredVariants.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-[#121418] rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 text-neutral-400">
                <Store className="w-10 h-10 mb-2 stroke-1 opacity-50" />
                <p className="text-xs font-medium">{t('orders.noProductsFound')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 pb-4">
                {filteredVariants.map((v) => {
                  const prod = products.find(
                    (p) => p.id === (v.product_id && typeof v.product_id === 'object' ? (v.product_id as any).id : v.product_id)
                  );
                  const stock = getVariantAvailableStock(v.id, selectedWarehouseId);
                  const inCart = cart.find((c) => c.variant.id === v.id);
                  const isOutOfStock = stock <= 0;

                  return (
                    <div
                      key={`pos_grid_v_${v.id}`}
                      onClick={() => {
                        if (isOutOfStock) return;
                        onAddToCart(v);
                      }}
                      className={`p-3.5 bg-white dark:bg-[#121418] border rounded-2xl transition-all duration-150 flex flex-col justify-between space-y-3 relative group select-none shadow-2xs ${
                        isOutOfStock
                          ? 'opacity-60 border-dashed border-red-200 dark:border-red-950/60 bg-red-50/10 cursor-not-allowed'
                          : 'cursor-pointer hover:shadow-md hover:border-neutral-900 dark:hover:border-neutral-300 active:scale-[0.98]'
                      } ${
                        inCart
                          ? 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10'
                          : !isOutOfStock
                          ? 'border-[#e5e7eb] dark:border-neutral-800/80'
                          : ''
                      }`}
                    >
                      {/* In-Cart Counter Pill */}
                      {inCart && (
                        <div className="absolute top-2.5 end-2.5 px-2 py-0.5 bg-emerald-600 text-white rounded-full flex items-center gap-1 text-[11px] font-bold font-mono shadow-xs">
                          <span>×</span>
                          <span>{inCart.quantity}</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        {/* Product Image & Title */}
                        <div className="flex items-center gap-2.5">
                          <ProductImage
                            src={v.image || prod?.main_image}
                            alt={prod?.title}
                            containerClassName="w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700/60"
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-xs text-[#171717] dark:text-neutral-100 line-clamp-2 leading-snug">
                              {prod ? prod.title : t('orders.untitledProduct')}
                            </h3>
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">
                              SKU: {v.sku}
                            </div>
                          </div>
                        </div>

                        {/* Variant Badges */}
                        <div className="flex flex-wrap items-center gap-1">
                          {v.color_name && (
                            <span className="text-[10px] px-2 py-0.5 bg-[#f4f5f7] dark:bg-[#1c1f26] border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-700 dark:text-neutral-300">
                              {v.color_name}
                            </span>
                          )}
                          {v.size_name && (
                            <span className="text-[10px] px-2 py-0.5 bg-[#f4f5f7] dark:bg-[#1c1f26] border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-neutral-100 font-bold">
                              {t('orders.size')}: {v.size_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price & Stock Row */}
                      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                        <div>
                          <div className="font-black text-xs font-mono text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(v.price, 'TOMAN', isPersian)}
                          </div>
                          <div
                            className={`text-[10px] font-mono mt-0.5 ${
                              stock > 5
                                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                : stock > 0
                                ? 'text-amber-700 dark:text-amber-400 font-bold'
                                : 'text-red-600 dark:text-red-400 font-bold'
                            }`}
                          >
                            {stock > 0 ? (
                              <span>{t('orders.stockInCount', { count: isPersian ? toPersianDigits(stock) : stock })}</span>
                            ) : (
                              <span>{t('orders.outOfStockInSelectedWarehouse')}</span>
                            )}
                          </div>
                        </div>

                        <div
                          className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all ${
                            isOutOfStock
                              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200'
                              : 'bg-neutral-50 dark:bg-[#1a1d24] group-hover:bg-neutral-900 dark:group-hover:bg-white text-neutral-700 dark:text-neutral-200 group-hover:text-white dark:group-hover:text-neutral-900 border-neutral-200 dark:border-neutral-700 group-hover:border-neutral-900'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ================= RIGHT/LEFT: DIGITAL CASHIER TERMINAL (5 cols) ================= */}
        <section className="lg:col-span-5 flex flex-col h-full bg-white dark:bg-[#121418] border border-[#e5e7eb] dark:border-neutral-800/80 rounded-3xl p-5 xl:p-6 shadow-md overflow-hidden">
          {/* Customer Selection Row */}
          <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 dark:border-neutral-800/80 gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <User className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-transparent text-neutral-900 dark:text-neutral-100 focus:outline-none cursor-pointer truncate"
                >
                  <option value={0} className="bg-white dark:bg-neutral-900">
                    {t('orders.guestCustomer')}
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-neutral-900">
                      {c.name || `مشتری #${c.id}`} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenCustomerModal}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline shrink-0"
            >
              + {t('orders.quickCustomer')}
            </button>
          </div>

          {/* Cart Items List with Generous Spacing */}
          <div className="flex-1 overflow-y-auto custom-scrollbar py-3 space-y-2.5 my-1 overscroll-contain">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400 space-y-2">
                <ShoppingCart className="w-10 h-10 stroke-1 opacity-40 text-neutral-400" />
                <p className="text-xs font-medium">{t('orders.emptyCartHint')}</p>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {t('orders.enterKeyHint')}
                </span>
              </div>
            ) : (
              cart.map((line) => (
                <div
                  key={`pos_cart_row_${line.variant.id}`}
                  className="p-3 bg-[#f8f9fa] dark:bg-[#171920] border border-neutral-200/70 dark:border-neutral-800 rounded-2xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-[#171717] dark:text-neutral-100 block truncate">
                      {line.productTitle}
                    </span>
                    <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                      {line.variant.size_name ? `${t('orders.size')}: ${line.variant.size_name}` : ''}
                      {line.variant.color_name ? ` · ${line.variant.color_name}` : ''}
                    </div>
                    <div className="font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1">
                      {formatCurrency(line.unitPrice, 'TOMAN', isPersian)}
                    </div>
                  </div>

                  {/* Quantity Stepper Controls (Generous 36px targets) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.variant.id, line.quantity - 1)}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-[#121418] border border-neutral-300 dark:border-neutral-700 font-bold text-neutral-800 dark:text-neutral-200 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all shadow-2xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-black font-mono text-sm text-neutral-900 dark:text-neutral-100">
                      {isPersian ? toPersianDigits(line.quantity) : line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.variant.id, line.quantity + 1)}
                      className="w-8 h-8 rounded-xl bg-white dark:bg-[#121418] border border-neutral-300 dark:border-neutral-700 font-bold text-neutral-800 dark:text-neutral-200 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="text-end shrink-0 ps-2">
                    <div className="font-black font-mono text-xs text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(line.quantity * line.unitPrice, 'TOMAN', isPersian)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveLine(line.variant.id)}
                      className="text-neutral-400 hover:text-red-600 p-1 mt-0.5 inline-block transition-colors"
                      title={t('orders.removeFromCart')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout & Payment Area (Compact & High Contrast) */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 space-y-3 shrink-0">
            {/* Quick Discount & Tax Toggles */}
            <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300 gap-3">
              {/* Extra Discount Input */}
              <div className="flex items-center gap-1.5 flex-1">
                <Percent className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-[11px] text-neutral-500">{t('orders.discount')}:</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={extraDiscount === 0 ? '' : extraDiscount}
                  onChange={(e) => setExtraDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-24 px-2 py-1 bg-[#f4f5f7] dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none"
                />
              </div>

              {/* Tax Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold">
                <input
                  type="checkbox"
                  checked={hasTax}
                  onChange={(e) => setHasTax(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>{isPersian ? 'ارزش افزوده (۹٪)' : 'VAT (9%)'}</span>
              </label>
            </div>

            {/* High-Contrast Grand Total Display (Generous Negative Space) */}
            <div className="bg-[#171717] dark:bg-white text-white dark:text-[#171717] rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs text-neutral-400 dark:text-neutral-500 font-bold block">
                  {t('orders.totalAmount')}
                </span>
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
                  {t('orders.itemsCount', { count: cart.length })}
                </span>
              </div>
              <div className="text-2xl xl:text-3xl font-black font-mono tracking-tight">
                {formatCurrency(grandTotal, 'TOMAN', isPersian)}
              </div>
            </div>

            {/* Payment Method Selector (Tactile Large Buttons) */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onPaymentTypeChange('pos')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  paymentType === 'pos'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-[#f8f9fa] dark:bg-[#181a20] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                }`}
              >
                <CreditCard className="w-4 h-4 mx-auto mb-1" />
                <span className="text-[11px] font-bold block">{isPersian ? 'کارتخوان' : 'POS'}</span>
              </button>

              <button
                type="button"
                onClick={() => onPaymentTypeChange('cash')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  paymentType === 'cash'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-[#f8f9fa] dark:bg-[#181a20] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                }`}
              >
                <Banknote className="w-4 h-4 mx-auto mb-1" />
                <span className="text-[11px] font-bold block">{isPersian ? 'نقدی' : 'Cash'}</span>
              </button>

              <button
                type="button"
                onClick={() => onPaymentTypeChange('card_to_card')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  paymentType === 'card_to_card'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-[#f8f9fa] dark:bg-[#181a20] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4 mx-auto mb-1" />
                <span className="text-[11px] font-bold block">{isPersian ? 'کارت به کارت' : 'Transfer'}</span>
              </button>

              <button
                type="button"
                onClick={() => onPaymentTypeChange('credit')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  paymentType === 'credit'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-[#f8f9fa] dark:bg-[#181a20] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                }`}
              >
                <Sparkles className="w-4 h-4 mx-auto mb-1" />
                <span className="text-[11px] font-bold block">{isPersian ? 'نسیه / اعتباری' : 'Credit'}</span>
              </button>
            </div>

            {/* Target Financial Account / Cashbox Selector */}
            {hasAccounting && financialAccounts.length > 0 && paymentType !== 'credit' && (
              <div className="flex items-center gap-2 text-xs bg-[#f8f9fa] dark:bg-[#181a20] p-2 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-500 shrink-0">{t('orders.settlementAccount')}</span>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                  disabled={isAccountLocked}
                  className="bg-transparent font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none flex-1 truncate"
                >
                  {financialAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id} className="bg-white dark:bg-neutral-900">
                      {acc.name} ({acc.type === 'cashbox' ? t('orders.cashbox') : t('orders.bankOrPos')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Cash Calculator (When Cash payment is active) */}
            {paymentType === 'cash' && (
              <div className="p-3 bg-[#f8f9fa] dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 font-medium">{t('orders.cashReceivedLabel')}</span>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={cashReceived === 0 ? '' : cashReceived}
                    onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                    placeholder={String(grandTotal)}
                    className="w-32 px-2.5 py-1 bg-white dark:bg-[#121418] border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-mono font-bold text-end focus:outline-none text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1">
                  {quickCashPresets.map((preset, pIdx) => (
                    <button
                      key={`cash_preset_${pIdx}`}
                      type="button"
                      onClick={() => setCashReceived(preset.amount)}
                      className="px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-[#121418] border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500 rounded-md text-neutral-700 dark:text-neutral-300 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Change Due (باقی‌مانده) */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-neutral-800/80 text-xs">
                  <span className="font-bold text-neutral-700 dark:text-neutral-300">{t('orders.cashChangeDue')}</span>
                  <span
                    className={`font-black font-mono text-sm ${
                      cashChange > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : cashChange < 0
                        ? 'text-red-500'
                        : 'text-neutral-500'
                    }`}
                  >
                    {formatCurrency(Math.max(0, cashChange), 'TOMAN', isPersian)}
                  </span>
                </div>
              </div>
            )}

            {/* Big Primary Checkout Button */}
            <button
              type="button"
              id="pos-submit-order-btn"
              onClick={onSubmitOrder}
              disabled={cart.length === 0 || isSaving}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:pointer-events-none"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('orders.statusProcessing')}...</span>
                </div>
              ) : (
                <>
                  <Printer className="w-5 h-5" />
                  <span>{t('orders.checkoutAction')}</span>
                  <span className="text-xs font-mono font-normal opacity-80 border-s border-white/20 ps-3">
                    F9
                  </span>
                </>
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );

  return createPortal(terminalContent, document.body);
};
