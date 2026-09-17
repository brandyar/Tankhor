import { PosShift, Organization } from '../../../types';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { printHtml } from '../../../utils/print';

export const printZReport = (shift: PosShift, organization: Organization | null) => {
  const opening = Number(shift.opening_balance) || 0;
  const closing = Number(shift.closing_balance) || 0;
  const cashSales = Number(shift.total_cash_amount) || 0;
  const posSales = Number(shift.total_pos_amount) || 0;
  const cardSales = Number(shift.total_card_amount) || 0;
  const creditSales = Number(shift.total_credit_amount) || 0;
  const totalSales = Number(shift.total_sales_amount) || 0;
  const expected = opening + cashSales;
  const diff = closing - expected;
  const curr = organization?.currency || 'TOMAN';

  const html = `
    <div style="font-family: 'Vazirmatn', Tahoma, sans-serif; direction: rtl; padding: 20px; max-width: 420px; margin: 0 auto; color: #111; line-height: 1.6; font-size: 13px;">
      <div style="text-align: center; border-bottom: 2px dashed #444; padding-bottom: 12px; margin-bottom: 12px;">
        <h2 style="margin: 0 0 4px; font-size: 18px; font-weight: 800;">${organization?.name || 'فروشگاه'}</h2>
        <div style="font-size: 14px; font-weight: bold; margin-top: 4px; color: #222;">گزارش ژورنال پایان شیفت (Z-Report)</div>
        <div style="font-size: 11px; color: #666; margin-top: 4px;">شناسه شیفت: #${shift.id} | وضعیت: ${shift.status === 'open' ? 'درحال اجرا (باز)' : 'بسته شده'}</div>
      </div>

      <table style="width: 100%; font-size: 12px; margin-bottom: 12px; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #555;">صندوق‌دار / کاربر:</td>
          <td style="padding: 4px 0; text-align: left; font-weight: bold;">${shift.user_name || shift.user_email || 'کاربر سیستم'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">انبار / شعبه:</td>
          <td style="padding: 4px 0; text-align: left; font-weight: bold;">${shift.warehouse_name || 'همه انبارها'}</td>
        </tr>
        ${shift.account_name ? `<tr><td style="padding: 4px 0; color: #555;">صندوق / حساب:</td><td style="padding: 4px 0; text-align: left; font-weight: bold;">${shift.account_name}</td></tr>` : ''}
        <tr>
          <td style="padding: 4px 0; color: #555;">زمان افتتاح شیفت:</td>
          <td style="padding: 4px 0; text-align: left; font-family: monospace;">${formatDate(shift.opened_at || '')}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">زمان بستن شیفت:</td>
          <td style="padding: 4px 0; text-align: left; font-family: monospace;">${shift.closed_at ? formatDate(shift.closed_at) : 'شیفت هنوز باز است'}</td>
        </tr>
      </table>

      <div style="border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 10px 0; margin-bottom: 12px;">
        <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">خلاصه فروش‌های شیفت:</div>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr>
            <td style="padding: 3px 0;">تعداد کل فاکتورها:</td>
            <td style="padding: 3px 0; text-align: left; font-weight: bold;">${shift.total_orders_count || 0} عدد</td>
          </tr>
          <tr>
            <td style="padding: 3px 0;">فروش نقدی:</td>
            <td style="padding: 3px 0; text-align: left; font-weight: bold;">${formatCurrency(cashSales, curr)}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0;">فروش کارتخوان (POS):</td>
            <td style="padding: 3px 0; text-align: left; font-weight: bold;">${formatCurrency(posSales, curr)}</td>
          </tr>
          ${cardSales > 0 ? `<tr><td style="padding: 3px 0;">فروش کارت‌به‌کارت:</td><td style="padding: 3px 0; text-align: left; font-weight: bold;">${formatCurrency(cardSales, curr)}</td></tr>` : ''}
          ${creditSales > 0 ? `<tr><td style="padding: 3px 0;">فروش نسیه / اعتباری:</td><td style="padding: 3px 0; text-align: left; font-weight: bold;">${formatCurrency(creditSales, curr)}</td></tr>` : ''}
          <tr style="border-top: 1px dashed #aaa;">
            <td style="padding: 6px 0; font-weight: 800; font-size: 13px;">مجموع کل فروش:</td>
            <td style="padding: 6px 0; text-align: left; font-weight: 800; font-size: 14px;">${formatCurrency(totalSales, curr)}</td>
          </tr>
        </table>
      </div>

      <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #e9ecef;">
        <div style="font-weight: bold; margin-bottom: 6px; font-size: 13px;">وضعیت تراز نقدی صندوق:</div>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr>
            <td style="padding: 3px 0;">موجودی اولیه (افتتاحیه):</td>
            <td style="padding: 3px 0; text-align: left;">${formatCurrency(opening, curr)}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0;">فروش نقدی ورودی:</td>
            <td style="padding: 3px 0; text-align: left;">+ ${formatCurrency(cashSales, curr)}</td>
          </tr>
          <tr style="border-top: 1px solid #ccc;">
            <td style="padding: 4px 0; font-weight: bold;">موجودی نقد مورد انتظار:</td>
            <td style="padding: 4px 0; text-align: left; font-weight: bold;">${formatCurrency(expected, curr)}</td>
          </tr>
          ${shift.status === 'closed' ? `
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">موجودی شمارش شده نهایی:</td>
            <td style="padding: 4px 0; text-align: left; font-weight: bold;">${formatCurrency(closing, curr)}</td>
          </tr>
          <tr style="border-top: 1px solid #ccc; color: ${diff === 0 ? '#15803d' : diff < 0 ? '#b91c1c' : '#0369a1'};">
            <td style="padding: 4px 0; font-weight: 800;">مغایرت صندوق:</td>
            <td style="padding: 4px 0; text-align: left; font-weight: 800;">
              ${diff === 0 ? 'تراز دقیق (بدون مغایرت)' : diff < 0 ? `کسری نقد: ${formatCurrency(Math.abs(diff), curr)}` : `مازاد نقد: +${formatCurrency(diff, curr)}`}
            </td>
          </tr>
          ` : ''}
        </table>
      </div>

      <div style="margin-top: 25px; padding-top: 10px; border-top: 1px dashed #888; text-align: center; font-size: 11px; color: #777;">
        <div>امضای صندوق‌دار ............................... امضای مدیر فروشگاه ...............................</div>
        <div style="margin-top: 8px;">تن‌خور | سیستم یکپارچه مدیریت فروش و انبار</div>
      </div>
    </div>
  `;

  printHtml(html);
};
