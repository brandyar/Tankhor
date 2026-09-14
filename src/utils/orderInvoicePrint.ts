import { Order, Organization } from '../types';
import { formatCurrency, formatDate, toPersianDigits } from './formatters';
import { printHtml } from './print';

export interface OrderItemPrintData {
  id?: number;
  productTitle: string;
  sku: string;
  colorName?: string;
  sizeName?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
}

export function generateOrderInvoiceHtml(
  order: Order,
  items: OrderItemPrintData[],
  organization?: Organization | null,
  isPersian: boolean = true,
  format: 'standard' | 'thermal' = 'standard'
): string {
  const orgName = organization?.name || 'تن‌خور (TANKHOR)';
  const orgPhone = (organization as any)?.phone || '';
  const orderNumber = order.order_number || `ORD-${order.id}`;
  const orderDate = formatDate(order.date_created, isPersian);
  const customerName = order.customer_name || (isPersian ? 'مشتری حضوری (عمومی)' : 'Walk-in Customer');
  const warehouseName = (order as any).warehouse_name || (isPersian ? 'انبار مرکزی' : 'Main Warehouse');
  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(order.discount) || 0;
  const tax = Number(order.tax) || 0;
  const total = Number(order.total) || 0;
  const notes = order.notes || (isPersian ? 'از خرید و اعتماد شما سپاسگزاریم.' : 'Thank you for your business.');

  if (format === 'thermal') {
    // 80mm POS Thermal Receipt
    const rowsHtml = items.map((it, idx) => `
      <tr style="border-bottom: 1px dashed #999;">
        <td style="padding: 4px 2px; text-align: right; vertical-align: top;">
          <div style="font-weight: bold; font-size: 11px;">${it.productTitle}</div>
          <div style="font-size: 9px; color: #555; font-family: monospace;">
            SKU: ${it.sku}${it.sizeName ? ` | سایز: ${it.sizeName}` : ''}${it.colorName ? ` | رنگ: ${it.colorName}` : ''}
          </div>
        </td>
        <td style="padding: 4px 2px; text-align: center; vertical-align: top; font-weight: bold; font-size: 11px;">
          ${isPersian ? toPersianDigits(it.quantity) : it.quantity}
        </td>
        <td style="padding: 4px 2px; text-align: left; vertical-align: top; font-weight: bold; font-size: 11px;">
          ${formatCurrency(it.total, 'TOMAN', isPersian)}
        </td>
      </tr>
    `).join('');

    return `
      <div style="width: 78mm; max-width: 78mm; margin: 0 auto; padding: 4mm 2mm; font-family: Vazirmatn, system-ui, sans-serif; direction: rtl; color: #000; font-size: 11px; line-height: 1.4;">
        <div style="text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <h2 style="font-size: 14px; font-weight: 900; margin: 0 0 3px 0;">${orgName}</h2>
          ${orgPhone ? `<div style="font-size: 10px; margin-bottom: 2px;">تلفن: ${toPersianDigits(orgPhone)}</div>` : ''}
          <div style="font-size: 11px; font-weight: bold; margin-top: 4px;">رسید فروشگاهی</div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 4px; font-family: monospace;">
            <span>شماره: ${orderNumber}</span>
            <span>تاریخ: ${orderDate}</span>
          </div>
        </div>

        <div style="margin-bottom: 6px; font-size: 10.5px; border-bottom: 1px dashed #ccc; padding-bottom: 4px;">
          <div><strong>مشتری:</strong> ${customerName}</div>
          <div><strong>خروج از:</strong> ${warehouseName}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <thead>
            <tr style="border-bottom: 1.5px solid #000; font-weight: bold; font-size: 10.5px;">
              <th style="padding: 3px 2px; text-align: right;">شرح کالا</th>
              <th style="padding: 3px 2px; text-align: center; width: 35px;">تعداد</th>
              <th style="padding: 3px 2px; text-align: left;">مبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="border-top: 1.5px dashed #000; padding-top: 6px; font-size: 11px; space-y: 3px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>جمع اقلام:</span>
            <span>${formatCurrency(subtotal, 'TOMAN', isPersian)}</span>
          </div>
          ${discount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #c00;">
            <span>تخفیف:</span>
            <span>- ${formatCurrency(discount, 'TOMAN', isPersian)}</span>
          </div>` : ''}
          ${tax > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>مالیات و عوارض:</span>
            <span>+ ${formatCurrency(tax, 'TOMAN', isPersian)}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1.5px solid #000; padding-top: 4px; margin-top: 4px;">
            <span>مبلغ قابل پرداخت:</span>
            <span>${formatCurrency(total, 'TOMAN', isPersian)}</span>
          </div>
        </div>

        <div style="text-align: center; margin-top: 10px; padding-top: 6px; border-top: 1px dashed #999; font-size: 9.5px; color: #444;">
          ${notes}
        </div>
      </div>
    `;
  }

  // Standard Official A4 / A5 Invoice
  const rowsHtml = items.map((it, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
      <td style="padding: 6px 8px; text-align: center; border-inline-end: 1px solid #e2e8f0; font-family: monospace;">
        ${isPersian ? toPersianDigits(idx + 1) : idx + 1}
      </td>
      <td style="padding: 6px 8px; text-align: right; border-inline-end: 1px solid #e2e8f0;">
        <div style="font-weight: bold; color: #0f172a;">${it.productTitle}</div>
        <div style="font-size: 9.5px; color: #64748b; font-family: monospace; margin-top: 1px;">
          SKU: ${it.sku}${it.sizeName ? ` | سایز: ${it.sizeName}` : ''}${it.colorName ? ` | رنگ: ${it.colorName}` : ''}
        </div>
      </td>
      <td style="padding: 6px 8px; text-align: center; border-inline-end: 1px solid #e2e8f0; font-weight: bold; font-family: monospace;">
        ${isPersian ? toPersianDigits(it.quantity) : it.quantity}
      </td>
      <td style="padding: 6px 8px; text-align: left; border-inline-end: 1px solid #e2e8f0; font-family: monospace;">
        ${formatCurrency(it.unitPrice, 'TOMAN', isPersian)}
      </td>
      <td style="padding: 6px 8px; text-align: left; border-inline-end: 1px solid #e2e8f0; font-family: monospace; color: #dc2626;">
        ${it.discount && it.discount > 0 ? `- ${formatCurrency(it.discount * it.quantity, 'TOMAN', isPersian)}` : (isPersian ? '۰' : '0')}
      </td>
      <td style="padding: 6px 8px; text-align: left; font-weight: bold; font-family: monospace; color: #0f172a;">
        ${formatCurrency(it.total, 'TOMAN', isPersian)}
      </td>
    </tr>
  `).join('');

  return `
    <div style="max-width: 210mm; margin: 0 auto; padding: 10mm 8mm; font-family: Vazirmatn, system-ui, sans-serif; direction: rtl; color: #0f172a; font-size: 12px; line-height: 1.5; background: #fff;">
      <!-- Invoice Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
        <div>
          <h1 style="font-size: 18px; font-weight: 900; margin: 0 0 4px 0; color: #0f172a;">صورتحساب فروش کالا و خدمات</h1>
          <div style="font-size: 13px; font-weight: bold; color: #334155;">${orgName}</div>
          ${orgPhone ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">تلفن تماس: ${toPersianDigits(orgPhone)}</div>` : ''}
        </div>
        <div style="text-align: left; font-size: 11px; space-y: 2px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; background: #f8fafc;">
          <div><strong>شماره فاکتور:</strong> <span style="font-family: monospace; font-weight: bold;">${orderNumber}</span></div>
          <div><strong>تاریخ صدور:</strong> <span style="font-family: monospace;">${orderDate}</span></div>
        </div>
      </div>

      <!-- Parties Information -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; font-size: 11.5px;">
        <div>
          <span style="color: #64748b;">خریدار / مشتری:</span>
          <div style="font-size: 12.5px; font-weight: bold; color: #0f172a; margin-top: 2px;">${customerName}</div>
        </div>
        <div>
          <span style="color: #64748b;">مبدا ارسال / انبار:</span>
          <div style="font-size: 12.5px; font-weight: bold; color: #0f172a; margin-top: 2px;">${warehouseName}</div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 14px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #334155;">
            <th style="padding: 8px 6px; text-align: center; width: 40px; border-inline-end: 1px solid #cbd5e1;">ردیف</th>
            <th style="padding: 8px 10px; text-align: right; border-inline-end: 1px solid #cbd5e1;">شرح کالا و مشخصات</th>
            <th style="padding: 8px 6px; text-align: center; width: 60px; border-inline-end: 1px solid #cbd5e1;">تعداد</th>
            <th style="padding: 8px 8px; text-align: left; width: 110px; border-inline-end: 1px solid #cbd5e1;">مبلغ واحد (تومان)</th>
            <th style="padding: 8px 8px; text-align: left; width: 90px; border-inline-end: 1px solid #cbd5e1;">تخفیف (تومان)</th>
            <th style="padding: 8px 8px; text-align: left; width: 120px;">مبلغ کل (تومان)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Footer Summary & Remarks -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 20px;">
        <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #f8fafc; font-size: 11px; min-height: 75px;">
          <div style="font-weight: bold; color: #334155; margin-bottom: 4px;">توضیحات و شرایط فاکتور:</div>
          <div style="color: #64748b; line-height: 1.5;">${notes}</div>
        </div>

        <div style="width: 260px; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #ffffff; font-size: 11.5px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
            <span>جمع کل اقلام:</span>
            <span style="font-family: monospace; font-weight: bold;">${formatCurrency(subtotal, 'TOMAN', isPersian)}</span>
          </div>
          ${discount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #dc2626;">
            <span>مجموع تخفیفات:</span>
            <span style="font-family: monospace; font-weight: bold;">- ${formatCurrency(discount, 'TOMAN', isPersian)}</span>
          </div>` : ''}
          ${tax > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
            <span>مالیات و ارزش افزوده:</span>
            <span style="font-family: monospace; font-weight: bold;">+ ${formatCurrency(tax, 'TOMAN', isPersian)}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13.5px; border-top: 1.5px solid #0f172a; padding-top: 6px; margin-top: 6px; color: #0f172a;">
            <span>مبلغ قابل پرداخت:</span>
            <span style="font-family: monospace; color: #059669;">${formatCurrency(total, 'TOMAN', isPersian)}</span>
          </div>
        </div>
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #64748b;">
        <div style="text-align: center; width: 140px; border-top: 1px solid #94a3b8; padding-top: 4px;">
          مهر و امضای فروشنده
        </div>
        <div style="text-align: center; width: 140px; border-top: 1px solid #94a3b8; padding-top: 4px;">
          امضای خریدار / تحویل‌گیرنده
        </div>
      </div>
    </div>
  `;
}

export function printOrderInvoice(
  order: Order,
  items: OrderItemPrintData[],
  organization?: Organization | null,
  isPersian: boolean = true,
  format: 'standard' | 'thermal' = 'standard'
): void {
  const html = generateOrderInvoiceHtml(order, items, organization, isPersian, format);
  printHtml(html, {
    title: `فاکتور_${order.order_number || order.id}`,
    extraStyles: `
      @page {
        size: ${format === 'thermal' ? '80mm auto' : 'A4 portrait'};
        margin: ${format === 'thermal' ? '0mm' : '5mm'};
      }
    `,
  });
}
