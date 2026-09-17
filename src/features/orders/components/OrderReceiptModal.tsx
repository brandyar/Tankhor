import React from 'react';
import { useTranslation } from '../../../i18n';
import { Order, OrderItem, ProductVariant } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { formatDate, formatCurrency } from '../../../utils/formatters';
import { printElement } from '../../../utils/print';
import { CheckCircle2, FileText, Receipt, Printer } from 'lucide-react';

export interface SavedOrderData {
  order: Order;
  customerName: string;
  warehouseName: string;
  items: {
    variant: ProductVariant;
    productTitle: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }[];
}

interface OrderReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastSavedOrder: SavedOrderData | null;
  receiptType: 'standard' | 'thermal';
  setReceiptType: (type: 'standard' | 'thermal') => void;
  organizationName?: string;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  isOpen,
  onClose,
  lastSavedOrder,
  receiptType,
  setReceiptType,
  organizationName,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  if (!lastSavedOrder) return null;

  const triggerPrint = () => {
    printElement('printable-create-order-invoice', {
      title: `${t('orders.printInvoice')}_${lastSavedOrder?.order.order_number || 'draft'}`,
    });
  };

  return (
    <>
      {/* Printable Area for Invoices (Hidden on screen, active on Print) */}
      <div id="printable-create-order-invoice" className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-6 print:text-black font-sans z-[9999]">
        {receiptType === 'thermal' ? (
          /* 80mm POS Thermal Receipt */
          <div className="w-[80mm] mx-auto text-xs space-y-3 font-mono leading-tight">
            <div className="text-center border-b border-black pb-2">
              <h2 className="text-sm font-bold">{organizationName || 'TANKHOR'}</h2>
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
                    <td className="py-1 text-center">{it.quantity}</td>
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
                <p className="text-gray-600 text-xs mt-1">{organizationName || 'TANKHOR'}</p>
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

      {/* Modal: Post Order Receipt & Print Options */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
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
            <Button variant="outline" onClick={onClose}>
              {t('orders.closeAndNextOrder')}
            </Button>

            <Button variant="primary" onClick={triggerPrint} icon={<Printer className="w-4 h-4" />}>
              {t('orders.printReceipt')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
