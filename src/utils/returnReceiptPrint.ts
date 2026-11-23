import {
  OrderReturn,
  OrderReturnItem,
  OrderReturnReason,
  OrderReturnSettlementMethod,
  Organization,
} from '../types';
import { formatCurrency, formatDate, toPersianDigits } from './formatters';
import { printHtml } from './print';
import { mediaManager } from './mediaManager';

export interface ReturnReceiptPrintParams {
  orderReturn: OrderReturn;
  items: OrderReturnItem[];
  organization?: Organization | null;
  format?: 'a4' | 'thermal';
  isPersian?: boolean;
}

function escapeHtml(value: unknown): string {
  const str = value == null ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getReasonLabel(reason?: OrderReturnReason, isPersian: boolean = true): string {
  const mapFa: Record<OrderReturnReason, string> = {
    size_mismatch: 'عدم تطابق سایز / تن‌خور',
    color_mismatch: 'عدم تطابق رنگ / مدل',
    defective: 'ایراد فنی / زدگی / معیوب',
    wrong_item: 'ارسال اشتباه کالا',
    customer_changed_mind: 'انصراف مشتری',
    other: 'سایر موارد',
  };
  const mapEn: Record<OrderReturnReason, string> = {
    size_mismatch: 'Size / Fit Mismatch',
    color_mismatch: 'Color / Style Mismatch',
    defective: 'Defective / Damaged',
    wrong_item: 'Wrong Item Sent',
    customer_changed_mind: 'Customer Changed Mind',
    other: 'Other',
  };
  if (!reason) return isPersian ? '—' : '—';
  return (isPersian ? mapFa[reason] : mapEn[reason]) || escapeHtml(reason);
}

function getSettlementLabel(method?: OrderReturnSettlementMethod, isPersian: boolean = true): string {
  const mapFa: Record<OrderReturnSettlementMethod, string> = {
    cash: 'وجه نقد (صندوق)',
    pos: 'کارتخوان (POS)',
    card: 'کارت‌به‌کارت',
    bank: 'انتقال بانکی',
    store_credit: 'بستانکاری / اعتبار خرید بعدی',
    credit: 'نسیه / ثبت در حساب مشتری',
    none: 'بدون جابجایی وجه (سر‌به‌سر)',
  };
  const mapEn: Record<OrderReturnSettlementMethod, string> = {
    cash: 'Cash',
    pos: 'POS Terminal',
    card: 'Card Transfer',
    bank: 'Bank Transfer',
    store_credit: 'Store Credit',
    credit: 'Customer Account (Credit)',
    none: 'Even Exchange (No Payment)',
  };
  if (!method) return isPersian ? '—' : '—';
  return (isPersian ? mapFa[method] : mapEn[method]) || escapeHtml(method);
}

function renderItemRowThermal(item: OrderReturnItem, isPersian: boolean): string {
  const title = escapeHtml(item.product_title || (isPersian ? 'کالا' : 'Item'));
  const sku = escapeHtml(item.sku || '-');
  const size = item.size_name ? ` | ${isPersian ? 'سایز' : 'Size'}: ${escapeHtml(item.size_name)}` : '';
  const color = item.color_name ? ` | ${isPersian ? 'رنگ' : 'Color'}: ${escapeHtml(item.color_name)}` : '';
  const condTag =
    item.item_type === 'returned' && item.condition === 'damaged'
      ? ` <span style="color:#b91c1c;font-weight:bold;">[${isPersian ? 'معیوب' : 'Damaged'}]</span>`
      : '';
  const qty = isPersian ? toPersianDigits(item.quantity) : String(item.quantity);

  return `
    <tr style="border-bottom: 1px dashed #aaa;">
      <td style="padding: 4px 2px; text-align: right; vertical-align: top;">
        <div style="font-weight: bold; font-size: 10.5px;">${title}${condTag}</div>
        <div style="font-size: 8.5px; color: #555; font-family: monospace;">SKU: ${sku}${size}${color}</div>
      </td>
      <td style="padding: 4px 2px; text-align: center; vertical-align: top; font-weight: bold; font-size: 10.5px;">${qty}</td>
      <td style="padding: 4px 2px; text-align: left; vertical-align: top; font-weight: bold; font-size: 10.5px;">${formatCurrency(item.total, 'TOMAN', isPersian)}</td>
    </tr>
  `;
}

function renderItemRowA4(item: OrderReturnItem, idx: number, isPersian: boolean): string {
  const title = escapeHtml(item.product_title || (isPersian ? 'کالا' : 'Item'));
  const sku = escapeHtml(item.sku || '-');
  const size = item.size_name ? ` | ${isPersian ? 'سایز' : 'Size'}: ${escapeHtml(item.size_name)}` : '';
  const color = item.color_name ? ` | ${isPersian ? 'رنگ' : 'Color'}: ${escapeHtml(item.color_name)}` : '';
  const condBadge =
    item.item_type === 'returned'
      ? item.condition === 'damaged'
        ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#fee2e2;color:#991b1b;font-size:9px;font-weight:bold;margin-inline-start:4px;">${isPersian ? 'معیوب / ضایعاتی' : 'Damaged'}</span>`
        : `<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#dcfce7;color:#166534;font-size:9px;font-weight:bold;margin-inline-start:4px;">${isPersian ? 'سالم' : 'Restockable'}</span>`
      : '';

  return `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
      <td style="padding: 6px 8px; text-align: center; border-inline-end: 1px solid #e2e8f0; font-family: monospace;">
        ${isPersian ? toPersianDigits(idx + 1) : idx + 1}
      </td>
      <td style="padding: 6px 8px; text-align: right; border-inline-end: 1px solid #e2e8f0;">
        <div style="font-weight: bold; color: #0f172a;">${title}${condBadge}</div>
        <div style="font-size: 9.5px; color: #64748b; font-family: monospace; margin-top: 1px;">
          SKU: ${sku}${size}${color}
        </div>
      </td>
      <td style="padding: 6px 8px; text-align: center; border-inline-end: 1px solid #e2e8f0; font-weight: bold; font-family: monospace;">
        ${isPersian ? toPersianDigits(item.quantity) : item.quantity}
      </td>
      <td style="padding: 6px 8px; text-align: left; border-inline-end: 1px solid #e2e8f0; font-family: monospace;">
        ${formatCurrency(item.unit_price, 'TOMAN', isPersian)}
      </td>
      <td style="padding: 6px 8px; text-align: left; font-weight: bold; font-family: monospace; color: #0f172a;">
        ${formatCurrency(item.total, 'TOMAN', isPersian)}
      </td>
    </tr>
  `;
}

export async function printReturnReceipt({
  orderReturn,
  items,
  organization,
  format = 'a4',
  isPersian = true,
}: ReturnReceiptPrintParams): Promise<void> {
  let resolvedLogoUrl = '';
  if (organization?.logo) {
    try {
      resolvedLogoUrl = await mediaManager.getDisplayUrl(organization.logo);
    } catch {
      resolvedLogoUrl = mediaManager.getDisplayUrlSync(organization.logo);
    }
  }

  let resolvedSignatureUrl = '';
  if (organization?.signature) {
    try {
      resolvedSignatureUrl = await mediaManager.getDisplayUrl(organization.signature);
    } catch {
      resolvedSignatureUrl = mediaManager.getDisplayUrlSync(organization.signature);
    }
  }

  const orgName = escapeHtml(organization?.name || 'تن‌خور (TANKHOR)');
  const orgPhone = escapeHtml(organization?.phone || '');
  const orgMobile = escapeHtml(organization?.mobile || '');
  const orgAddress = escapeHtml(organization?.address || '');

  const returnNumber = escapeHtml(orderReturn.return_number || `RET-${orderReturn.id}`);
  const origOrderNum = escapeHtml(
    orderReturn.original_order_number ||
      (typeof orderReturn.original_order_id === 'object'
        ? (orderReturn.original_order_id as any)?.order_number
        : `#${orderReturn.original_order_id}`)
  );
  const dateStr = escapeHtml(formatDate(orderReturn.return_date || orderReturn.date_created, isPersian));
  const customerName = escapeHtml(
    orderReturn.customer_name || (isPersian ? 'مشتری حضوری (عمومی)' : 'Walk-in Customer')
  );
  const warehouseName = escapeHtml(
    orderReturn.warehouse_name || (isPersian ? 'انبار مرکزی' : 'Main Warehouse')
  );
  const reasonLabel = escapeHtml(getReasonLabel(orderReturn.reason, isPersian));
  const settlementLabel = escapeHtml(getSettlementLabel(orderReturn.settlement_method, isPersian));
  const notesHtml = escapeHtml(orderReturn.notes || '');

  const returnedItems = items.filter((i) => i.item_type === 'returned');
  const exchangedItems = items.filter((i) => i.item_type === 'exchanged');

  const returnedTotal = Number(orderReturn.returned_total) || 0;
  const exchangeTotal = Number(orderReturn.exchange_total) || 0;
  const netAmount = Number(orderReturn.net_amount) || 0;
  const isExchange = orderReturn.type === 'exchange';

  const docTitle = isExchange
    ? isPersian
      ? 'رسید تعویض کالا'
      : 'Exchange Receipt'
    : isPersian
    ? 'رسید مرجوعی و برگشت از فروش'
    : 'Sales Return Credit Note';

  const netLabel =
    netAmount < 0
      ? isPersian
        ? 'مبلغ قابل استرداد به مشتری:'
        : 'Refund Due to Customer:'
      : netAmount > 0
      ? isPersian
        ? 'مابه‌التفاوت دریافتی از مشتری:'
        : 'Difference Paid by Customer:'
      : isPersian
      ? 'مابه‌التفاوت نهایی (سر‌به‌سر):'
      : 'Net Difference (Even):';

  let html = '';

  if (format === 'thermal') {
    html = `
      <div style="width: 78mm; max-width: 78mm; margin: 0 auto; padding: 4mm 2mm; font-family: Vazirmatn, system-ui, sans-serif; direction: rtl; color: #000; font-size: 11px; line-height: 1.4;">
        <div style="text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          ${resolvedLogoUrl ? `<div style="margin-bottom: 4px;"><img src="${escapeHtml(resolvedLogoUrl)}" alt="Logo" style="max-height: 36px; max-width: 96px; object-fit: contain; margin: 0 auto;" /></div>` : ''}
          <h2 style="font-size: 13.5px; font-weight: 900; margin: 0 0 2px 0;">${orgName}</h2>
          ${(orgPhone || orgMobile) ? `<div style="font-size: 9px; color: #222;">${orgPhone ? `تلفن: ${toPersianDigits(orgPhone)}` : ''}${orgPhone && orgMobile ? ' - ' : ''}${orgMobile ? `همراه: ${toPersianDigits(orgMobile)}` : ''}</div>` : ''}
          <div style="font-size: 11.5px; font-weight: 800; margin-top: 4px; background: #000; color: #fff; padding: 2px 6px; border-radius: 3px; display: inline-block;">${docTitle}</div>
          <div style="display: flex; justify-content: space-between; font-size: 9.5px; margin-top: 5px; font-family: monospace;">
            <span>سند: ${returnNumber}</span>
            <span>${dateStr}</span>
          </div>
          <div style="font-size: 9.5px; font-family: monospace; margin-top: 2px;">فاکتور مرجع: ${origOrderNum}</div>
        </div>

        <div style="margin-bottom: 6px; font-size: 10px; border-bottom: 1px dashed #bbb; padding-bottom: 4px;">
          <div><strong>مشتری:</strong> ${customerName}</div>
          <div><strong>انبار / شعبه:</strong> ${warehouseName}</div>
          <div><strong>علت:</strong> ${reasonLabel}</div>
        </div>

        <div style="font-weight: 800; font-size: 10.5px; margin: 5px 0 3px 0;">اقلام مرجوع شده:</div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
          <thead>
            <tr style="border-bottom: 1px solid #000; font-size: 9.5px;">
              <th style="padding: 2px; text-align: right;">کالا</th>
              <th style="padding: 2px; text-align: center; width: 30px;">تعداد</th>
              <th style="padding: 2px; text-align: left;">مبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${returnedItems.map((i) => renderItemRowThermal(i, isPersian)).join('')}
          </tbody>
        </table>

        ${
          exchangedItems.length > 0
            ? `
          <div style="font-weight: 800; font-size: 10.5px; margin: 6px 0 3px 0;">اقلام جایگزین (تحویلی به مشتری):</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
            <thead>
              <tr style="border-bottom: 1px solid #000; font-size: 9.5px;">
                <th style="padding: 2px; text-align: right;">کالا</th>
                <th style="padding: 2px; text-align: center; width: 30px;">تعداد</th>
                <th style="padding: 2px; text-align: left;">مبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${exchangedItems.map((i) => renderItemRowThermal(i, isPersian)).join('')}
            </tbody>
          </table>
        `
            : ''
        }

        <div style="border-top: 1.5px dashed #000; padding-top: 6px; font-size: 10.5px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>ارزش اقلام مرجوعی:</span>
            <span style="font-family: monospace;">${formatCurrency(returnedTotal, 'TOMAN', isPersian)}</span>
          </div>
          ${
            isExchange
              ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>ارزش اقلام جایگزین:</span>
              <span style="font-family: monospace;">${formatCurrency(exchangeTotal, 'TOMAN', isPersian)}</span>
            </div>`
              : ''
          }
          <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 12px; border-top: 1.5px solid #000; padding-top: 4px; margin-top: 4px;">
            <span>${netLabel}</span>
            <span style="font-family: monospace;">${formatCurrency(Math.abs(netAmount), 'TOMAN', isPersian)}</span>
          </div>
          <div style="font-size: 9.5px; margin-top: 4px; color: #333;">
            <strong>روش تسویه:</strong> ${settlementLabel}
          </div>
        </div>

        ${notesHtml ? `<div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #bbb; font-size: 9.5px; color: #444;">یادداشت: ${notesHtml}</div>` : ''}

        ${
          resolvedSignatureUrl
            ? `
          <div style="text-align: center; margin-top: 8px; border-top: 1px dashed #bbb; padding-top: 5px;">
            <img src="${escapeHtml(resolvedSignatureUrl)}" alt="مهر و امضا" style="max-height: 44px; max-width: 110px; object-fit: contain; margin: 0 auto; filter: grayscale(100%) contrast(150%);" />
          </div>`
            : ''
        }

        <div style="text-align: center; margin-top: 8px; padding-top: 5px; border-top: 1px dashed #999; font-size: 9px; color: #555;">
          امضای تحویل‌گیرنده: ........................
        </div>
      </div>
    `;
  } else {
    html = `
      <div style="max-width: 210mm; margin: 0 auto; padding: 10mm 8mm; font-family: Vazirmatn, system-ui, sans-serif; direction: rtl; color: #0f172a; font-size: 12px; line-height: 1.5; background: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${
              resolvedLogoUrl
                ? `<div style="width: 66px; height: 66px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 4px; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden;"><img src="${escapeHtml(resolvedLogoUrl)}" alt="Logo" style="max-height: 58px; max-width: 58px; object-fit: contain;" /></div>`
                : ''
            }
            <div>
              <h1 style="font-size: 18px; font-weight: 900; margin: 0 0 4px 0; color: #0f172a;">${docTitle}</h1>
              <div style="font-size: 13px; font-weight: bold; color: #1e293b;">${orgName}</div>
              ${
                orgPhone || orgMobile
                  ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${orgPhone ? `تلفن: <strong>${toPersianDigits(orgPhone)}</strong>` : ''}${orgPhone && orgMobile ? ' | ' : ''}${orgMobile ? `همراه: <strong>${toPersianDigits(orgMobile)}</strong>` : ''}</div>`
                  : ''
              }
              ${orgAddress ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px; max-width: 480px;">نشانی: ${orgAddress}</div>` : ''}
            </div>
          </div>

          <div style="text-align: left; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc;">
            <div><strong>شماره سند:</strong> <span style="font-family: monospace; font-weight: bold;">${returnNumber}</span></div>
            <div><strong>فاکتور مرجع:</strong> <span style="font-family: monospace; font-weight: bold;">${origOrderNum}</span></div>
            <div><strong>تاریخ ثبت:</strong> <span style="font-family: monospace;">${dateStr}</span></div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; font-size: 11px;">
          <div>
            <span style="color: #64748b;">مشتری:</span>
            <div style="font-weight: bold; color: #0f172a; margin-top: 2px;">${customerName}</div>
          </div>
          <div>
            <span style="color: #64748b;">انبار / شعبه پذیرش:</span>
            <div style="font-weight: bold; color: #0f172a; margin-top: 2px;">${warehouseName}</div>
          </div>
          <div>
            <span style="color: #64748b;">علت مرجوعی / تعویض:</span>
            <div style="font-weight: bold; color: #0f172a; margin-top: 2px;">${reasonLabel}</div>
          </div>
        </div>

        <div style="font-weight: 800; font-size: 12px; color: #991b1b; margin-bottom: 6px;">۱. اقلام مرجوع شده (بازگشتی از مشتری)</div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 14px;">
          <thead>
            <tr style="background: #fef2f2; border-bottom: 1.5px solid #fecaca; font-weight: bold; font-size: 11px; color: #7f1d1d;">
              <th style="padding: 7px 6px; text-align: center; width: 40px; border-inline-end: 1px solid #fecaca;">ردیف</th>
              <th style="padding: 7px 10px; text-align: right; border-inline-end: 1px solid #fecaca;">شرح کالا، مشخصات و وضعیت سلامت</th>
              <th style="padding: 7px 6px; text-align: center; width: 60px; border-inline-end: 1px solid #fecaca;">تعداد</th>
              <th style="padding: 7px 8px; text-align: left; width: 115px; border-inline-end: 1px solid #fecaca;">مبلغ واحد (تومان)</th>
              <th style="padding: 7px 8px; text-align: left; width: 125px;">مبلغ کل (تومان)</th>
            </tr>
          </thead>
          <tbody>
            ${returnedItems.map((i, idx) => renderItemRowA4(i, idx, isPersian)).join('')}
          </tbody>
        </table>

        ${
          exchangedItems.length > 0
            ? `
          <div style="font-weight: 800; font-size: 12px; color: #065f46; margin-bottom: 6px;">۲. اقلام جایگزین (تحویل داده شده به مشتری)</div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 14px;">
            <thead>
              <tr style="background: #ecfdf5; border-bottom: 1.5px solid #a7f3d0; font-weight: bold; font-size: 11px; color: #064e3b;">
                <th style="padding: 7px 6px; text-align: center; width: 40px; border-inline-end: 1px solid #a7f3d0;">ردیف</th>
                <th style="padding: 7px 10px; text-align: right; border-inline-end: 1px solid #a7f3d0;">شرح کالا و مشخصات</th>
                <th style="padding: 7px 6px; text-align: center; width: 60px; border-inline-end: 1px solid #a7f3d0;">تعداد</th>
                <th style="padding: 7px 8px; text-align: left; width: 115px; border-inline-end: 1px solid #a7f3d0;">مبلغ واحد (تومان)</th>
                <th style="padding: 7px 8px; text-align: left; width: 125px;">مبلغ کل (تومان)</th>
              </tr>
            </thead>
            <tbody>
              ${exchangedItems.map((i, idx) => renderItemRowA4(i, idx, isPersian)).join('')}
            </tbody>
          </table>
        `
            : ''
        }

        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 20px;">
          <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #f8fafc; font-size: 11px; min-height: 80px;">
            <div style="font-weight: bold; color: #334155; margin-bottom: 4px;">روش تسویه و توضیحات:</div>
            <div style="color: #0f172a; font-weight: bold; margin-bottom: 4px;">${settlementLabel}</div>
            ${notesHtml ? `<div style="color: #64748b;">${notesHtml}</div>` : ''}
          </div>

          <div style="width: 280px; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #fff; font-size: 11.5px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
              <span>مجموع ارزش اقلام مرجوعی:</span>
              <span style="font-family: monospace; font-weight: bold;">${formatCurrency(returnedTotal, 'TOMAN', isPersian)}</span>
            </div>
            ${
              isExchange
                ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
                <span>مجموع ارزش اقلام جایگزین:</span>
                <span style="font-family: monospace; font-weight: bold;">${formatCurrency(exchangeTotal, 'TOMAN', isPersian)}</span>
              </div>`
                : ''
            }
            <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1.5px solid #0f172a; padding-top: 6px; margin-top: 6px; color: ${netAmount < 0 ? '#b91c1c' : netAmount > 0 ? '#059669' : '#0f172a'};">
              <span>${netLabel}</span>
              <span style="font-family: monospace;">${formatCurrency(Math.abs(netAmount), 'TOMAN', isPersian)}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #475569;">
          <div style="text-align: center; width: 180px; display: flex; flex-direction: column; align-items: center;">
            ${
              resolvedSignatureUrl
                ? `<div style="min-height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;"><img src="${escapeHtml(resolvedSignatureUrl)}" alt="مهر و امضای فروشگاه" style="max-height: 70px; max-width: 165px; object-fit: contain;" /></div>`
                : `<div style="height: 50px;"></div>`
            }
            <div style="width: 100%; border-top: 1.5px solid #94a3b8; padding-top: 5px; font-weight: bold; color: #1e293b;">مهر و امضای فروشگاه</div>
          </div>

          <div style="text-align: center; width: 180px; display: flex; flex-direction: column; align-items: center;">
            <div style="height: 50px;"></div>
            <div style="width: 100%; border-top: 1.5px solid #94a3b8; padding-top: 5px; font-weight: bold; color: #1e293b;">امضای مشتری / تحویل‌گیرنده</div>
          </div>
        </div>
      </div>
    `;
  }

  printHtml(html, {
    title: `${isExchange ? 'تعویض' : 'مرجوعی'}_${orderReturn.return_number || orderReturn.id}`,
    extraStyles: `
      @page {
        size: ${format === 'thermal' ? '80mm auto' : 'A4 portrait'};
        margin: ${format === 'thermal' ? '0mm' : '5mm'};
      }
    `,
  });
}
