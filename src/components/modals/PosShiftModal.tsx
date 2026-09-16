import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager } from '../../storage';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import {
  PosShift,
  Warehouse,
  Order,
  OrganizationUser,
} from '../../types';
import { FinancialAccount } from '../../types/accounting';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatDate, toPersianDigits } from '../../utils/formatters';
import { printHtml } from '../../utils/print';
import {
  Clock,
  DollarSign,
  Building2,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  History,
  Play,
  StopCircle,
  Printer,
  User,
  Users,
  ShoppingBag,
  CreditCard,
  Banknote,
  ArrowUpDown,
  Lock,
  Search,
  Filter,
  Eye,
  Info,
} from 'lucide-react';

interface PosShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftChanged?: (activeShift: PosShift | null) => void;
}

export const PosShiftModal: React.FC<PosShiftModalProps> = ({
  isOpen,
  onClose,
  onShiftChanged,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';
  const { activeOrganization, organizationUsers } = useOrganization();
  const { user } = useAuth();
  const { hasAccess } = useModuleAccess();
  const hasAccounting = hasAccess('accounting');

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [isLoading, setIsLoading] = useState(true);
  const [shiftHistory, setShiftHistory] = useState<PosShift[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected shift ID to view/manage in current tab (supports multi-cashier inspection)
  const [selectedShiftId, setSelectedShiftId] = useState<number | string | null>(null);

  // Open Shift Form States
  const [openWarehouseId, setOpenWarehouseId] = useState<number | ''>('');
  const [openAccountId, setOpenAccountId] = useState<number | ''>('');
  const [openingBalance, setOpeningBalance] = useState<string>('0');

  // Close Shift Form States
  const [closingBalance, setClosingBalance] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');

  // History Tab Filters
  const [historyFilterCashier, setHistoryFilterCashier] = useState<string>('all');
  const [historyFilterWarehouse, setHistoryFilterWarehouse] = useState<string>('all');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Current logged in user membership
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

  const isManagerOrOwner = useMemo(() => {
    if (!currentUserMember) return true;
    return currentUserMember.role === 'owner' || currentUserMember.role === 'manager';
  }, [currentUserMember]);

  // Distinguish my shift and other cashiers' shifts
  const currentUserId = user?.id;
  const currentUserEmail = user?.email;

  const myOpenShift = useMemo(() => {
    return (
      shiftHistory.find(
        (s) =>
          s.status === 'open' &&
          ((currentUserId && s.user_id === currentUserId) ||
            (currentUserEmail && (s.user_id === currentUserEmail || (s as any).user_email === currentUserEmail)))
      ) || null
    );
  }, [shiftHistory, currentUserId, currentUserEmail]);

  const allOpenShifts = useMemo(() => {
    return shiftHistory.filter((s) => s.status === 'open');
  }, [shiftHistory]);

  const otherOpenShifts = useMemo(() => {
    return allOpenShifts.filter((s) => s.id !== myOpenShift?.id);
  }, [allOpenShifts, myOpenShift]);

  // The active shift currently displayed in the "Current Shift" tab
  const displayedShift = useMemo(() => {
    if (selectedShiftId) {
      const match = shiftHistory.find((s) => String(s.id) === String(selectedShiftId));
      if (match) return match;
    }
    return myOpenShift;
  }, [selectedShiftId, shiftHistory, myOpenShift]);

  const loadShiftData = async () => {
    setIsLoading(true);
    try {
      const [whList, shifts] = await Promise.all([
        storageManager.getWarehouses(),
        storageManager.getPosShifts ? storageManager.getPosShifts() : Promise.resolve([]),
      ]);

      setWarehouses(whList || []);
      setShiftHistory(shifts || []);

      if (hasAccounting && storageManager.getFinancialAccounts) {
        const accs = await storageManager.getFinancialAccounts();
        setFinancialAccounts(accs || []);
      }

      // Pre-fill open shift defaults based on user assignment
      const assignedWh = currentUserMember?.warehouse_id;
      const defaultWhId =
        typeof assignedWh === 'object' && assignedWh
          ? (assignedWh as any).id
          : assignedWh || (whList && whList.length > 0 ? whList[0].id : '');
      setOpenWarehouseId(defaultWhId || '');

      const assignedAcc = currentUserMember?.financial_account_id;
      const rawAssignedAccId = typeof assignedAcc === 'object' && assignedAcc
        ? (assignedAcc as any).id
        : assignedAcc;
      setOpenAccountId(rawAssignedAccId ? Number(rawAssignedAccId) : '');
      setOpeningBalance('0');
      setClosingBalance('');
      setClosingNotes('');
    } catch (err) {
      console.error('Failed to load shift data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadShiftData();
    }
  }, [isOpen]);

  // When myOpenShift changes, notify parent POS view
  useEffect(() => {
    if (onShiftChanged) {
      onShiftChanged(myOpenShift);
    }
  }, [myOpenShift?.id, myOpenShift?.status]);

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openWarehouseId) {
      alert(isPersian ? 'لطفاً انبار یا شعبه صندوق را انتخاب کنید.' : 'Please select warehouse.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanOpening = parseFloat(openingBalance.replace(/,/g, '')) || 0;
      const created = await storageManager.savePosShift!({
        organization_id: activeOrganization?.id,
        user_id: user?.id || user?.email || null,
        warehouse_id: Number(openWarehouseId),
        financial_account_id: openAccountId ? Number(openAccountId) : null,
        opening_balance: cleanOpening,
        status: 'open',
        opened_at: new Date().toISOString(),
      });

      await loadShiftData();
      setSelectedShiftId(created.id);
      if (onShiftChanged) onShiftChanged(created);
    } catch (err: any) {
      alert(isPersian ? `خطا در باز کردن شیفت: ${err.message}` : `Error opening shift: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayedShift) return;

    if (closingBalance.trim() === '') {
      alert(isPersian ? 'لطفاً موجودی نقد شمارش شده پایان شیفت را وارد کنید.' : 'Please enter counted cash balance.');
      return;
    }

    const cleanClosing = parseFloat(closingBalance.replace(/,/g, '')) || 0;
    const isOtherCashierShift = displayedShift.id !== myOpenShift?.id;
    const confirmMsg = isPersian
      ? `آیا از بستن شیفت صندوق #${displayedShift.id} (${displayedShift.user_name || displayedShift.user_email || 'صندوق‌دار'})${isOtherCashierShift ? ' به عنوان مدیر' : ''} با موجودی شمارش شده ${formatCurrency(cleanClosing, activeOrganization?.currency || 'TOMAN')} اطمینان دارید؟`
      : `Are you sure you want to close shift #${displayedShift.id} with counted balance of ${formatCurrency(cleanClosing, activeOrganization?.currency || 'TOMAN')}?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const auditNote = isOtherCashierShift
        ? `${closingNotes ? `${closingNotes} | ` : ''}[بسته شده توسط مدیر: ${user?.first_name || user?.email}]`
        : closingNotes;

      await storageManager.closePosShift!(displayedShift.id, cleanClosing, auditNote);
      await loadShiftData();
      setSelectedShiftId(null);
      if (onShiftChanged) {
        // If closed current user's shift, reset active shift in parent
        if (displayedShift.id === myOpenShift?.id) {
          onShiftChanged(null);
        }
      }
    } catch (err: any) {
      alert(isPersian ? `خطا در بستن شیفت: ${err.message}` : `Error closing shift: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const expectedCash = useMemo(() => {
    if (!displayedShift) return 0;
    const opening = Number(displayedShift.opening_balance) || 0;
    const cashSales = Number(displayedShift.total_cash_amount) || 0;
    return opening + cashSales;
  }, [displayedShift]);

  const countedCash = parseFloat(closingBalance.replace(/,/g, '')) || 0;
  const cashDiscrepancy = countedCash - expectedCash;

  const handlePrintZReport = (shift: PosShift) => {
    const opening = Number(shift.opening_balance) || 0;
    const closing = Number(shift.closing_balance) || 0;
    const cashSales = Number(shift.total_cash_amount) || 0;
    const posSales = Number(shift.total_pos_amount) || 0;
    const cardSales = Number(shift.total_card_amount) || 0;
    const creditSales = Number(shift.total_credit_amount) || 0;
    const totalSales = Number(shift.total_sales_amount) || 0;
    const expected = opening + cashSales;
    const diff = closing - expected;
    const curr = activeOrganization?.currency || 'TOMAN';

    const html = `
      <div style="font-family: 'Vazirmatn', Tahoma, sans-serif; direction: rtl; padding: 20px; max-width: 420px; margin: 0 auto; color: #111; line-height: 1.6; font-size: 13px;">
        <div style="text-align: center; border-bottom: 2px dashed #444; padding-bottom: 12px; margin-bottom: 12px;">
          <h2 style="margin: 0 0 4px; font-size: 18px; font-weight: 800;">${activeOrganization?.name || 'فروشگاه'}</h2>
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

  // Distinct Cashiers from Shift History & Org Users for filter
  const cashierFilterOptions = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    // Current user first
    if (user?.id) {
      list.push({
        id: user.id,
        name: isPersian ? `شیفت‌های من (${user.first_name || user.email})` : `My Shifts (${user.first_name || user.email})`,
      });
      seen.add(user.id);
      if (user.email) seen.add(user.email);
    }

    // From org members
    if (organizationUsers) {
      for (const ou of organizationUsers) {
        const uid = ou.user_id || ou.email;
        if (uid && !seen.has(uid)) {
          seen.add(uid);
          list.push({
            id: uid,
            name: `${ou.first_name || ''} ${ou.last_name || ''}`.trim() || ou.email || uid,
          });
        }
      }
    }

    // From shift history
    for (const sh of shiftHistory) {
      const uid = sh.user_id || sh.user_email;
      if (uid && !seen.has(uid)) {
        seen.add(uid);
        list.push({
          id: uid,
          name: sh.user_name || sh.user_email || `کاربر #${uid}`,
        });
      }
    }

    return list;
  }, [user, organizationUsers, shiftHistory, isPersian]);

  // Filtered Shifts in History Tab
  const filteredHistoryShifts = useMemo(() => {
    return shiftHistory.filter((shift) => {
      if (historyFilterStatus !== 'all' && shift.status !== historyFilterStatus) {
        return false;
      }
      if (historyFilterWarehouse !== 'all') {
        const sWhId = typeof shift.warehouse_id === 'object' ? (shift.warehouse_id as any)?.id : shift.warehouse_id;
        if (String(sWhId) !== String(historyFilterWarehouse)) return false;
      }
      if (historyFilterCashier !== 'all') {
        const uMatch =
          shift.user_id === historyFilterCashier ||
          shift.user_email === historyFilterCashier ||
          (user?.email && historyFilterCashier === user.id && shift.user_email === user.email);
        if (!uMatch) return false;
      }
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const matchId = String(shift.id).includes(q);
        const matchUser = (shift.user_name || shift.user_email || '').toLowerCase().includes(q);
        const matchWh = (shift.warehouse_name || '').toLowerCase().includes(q);
        const matchNotes = (shift.notes || '').toLowerCase().includes(q);
        if (!matchId && !matchUser && !matchWh && !matchNotes) return false;
      }
      return true;
    });
  }, [shiftHistory, historyFilterStatus, historyFilterWarehouse, historyFilterCashier, historySearchQuery, user]);

  // Aggregated Stats for Filtered History
  const historyStats = useMemo(() => {
    let totalSales = 0;
    let totalCash = 0;
    let totalPos = 0;
    let totalDiff = 0;

    for (const s of filteredHistoryShifts) {
      totalSales += Number(s.total_sales_amount) || 0;
      totalCash += Number(s.total_cash_amount) || 0;
      totalPos += Number(s.total_pos_amount) || 0;

      if (s.status === 'closed') {
        const opening = Number(s.opening_balance) || 0;
        const closing = Number(s.closing_balance) || 0;
        const cashS = Number(s.total_cash_amount) || 0;
        totalDiff += closing - (opening + cashS);
      }
    }

    return {
      count: filteredHistoryShifts.length,
      totalSales,
      totalCash,
      totalPos,
      totalDiff,
    };
  }, [filteredHistoryShifts]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isPersian ? 'مدیریت شیفت‌های صندوق فروش (POS Shift)' : 'POS Shift Management'}
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'current'
                ? 'bg-white dark:bg-[#181a20] text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{isPersian ? 'شیفت فعال و جاری' : 'Active Shift'}</span>
            {myOpenShift && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
            {otherOpenShifts.length > 0 && !myOpenShift && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
                {otherOpenShifts.length} {isPersian ? 'همکار' : 'others'}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white dark:bg-[#181a20] text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{isPersian ? 'تاریخچه شیفت‌های گذشته' : 'Shift History'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-mono">
              {shiftHistory.length}
            </span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-neutral-400">
            {isPersian ? 'در حال بارگذاری اطلاعات شیفت...' : 'Loading shift data...'}
          </div>
        ) : activeTab === 'current' ? (
          <div className="space-y-4">
            {/* Multi-Cashier Shift Switcher for Managers / Multi-Register Stores */}
            {allOpenShifts.length > 0 && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#14161d] border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 font-medium">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>{isPersian ? 'صندوق‌های فعال هم‌اکنون:' : 'Active Cashboxes:'}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* My Shift Option */}
                  {myOpenShift ? (
                    <button
                      type="button"
                      onClick={() => setSelectedShiftId(myOpenShift.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        displayedShift?.id === myOpenShift.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                      <span>{isPersian ? 'شیفت من' : 'My Shift'}</span>
                      <span className="font-mono text-[10px]">#{myOpenShift.id}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedShiftId(null)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        !displayedShift
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-500'
                      }`}
                    >
                      <Play className="w-3 h-3" />
                      <span>{isPersian ? 'شروع شیفت جدید برای من' : 'Start My Shift'}</span>
                    </button>
                  )}

                  {/* Other Open Shifts (Visible for Managers & Multi-cashier inspection) */}
                  {otherOpenShifts.map((os) => (
                    <button
                      key={os.id}
                      type="button"
                      onClick={() => setSelectedShiftId(os.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        displayedShift?.id === os.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-500'
                      }`}
                    >
                      <User className="w-3 h-3" />
                      <span>{os.user_name || os.user_email || `کاربر #${os.user_id}`}</span>
                      <span className="font-mono text-[10px]">#{os.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {displayedShift ? (
              /* Active Open Shift View */
              <div className="space-y-4">
                {/* Header Status Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/20 border border-emerald-500/30 dark:border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                          {isPersian ? `شیفت باز #${displayedShift.id}` : `Open Shift #${displayedShift.id}`}
                        </h4>
                        <Badge variant="success">
                          {isPersian ? 'درحال ثبت فروش' : 'Active'}
                        </Badge>
                        {displayedShift.id !== myOpenShift?.id && (
                          <Badge variant="neutral">
                            {isPersian ? 'شیفت همکار (مشاهده مدیریتی)' : 'Colleague Shift'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {isPersian ? 'شروع شده در:' : 'Opened at:'}{' '}
                        <span className="font-mono">{formatDate(displayedShift.opened_at || '')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintZReport(displayedShift)}
                      icon={<Printer className="w-3.5 h-3.5" />}
                    >
                      {isPersian ? 'پیش‌نمایش گزارش ژورنال' : 'Preview Z-Report'}
                    </Button>
                  </div>
                </div>

                {/* Notice when manager is inspecting another cashier's shift */}
                {displayedShift.id !== myOpenShift?.id && (
                  <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div className="leading-relaxed">
                      <span className="font-bold">
                        {isPersian ? 'توجه مدیریتی:' : 'Management Note:'}
                      </span>{' '}
                      {isPersian
                        ? `شما در حال بررسی عملکرد زنده شیفت صندوق‌دار «${displayedShift.user_name || displayedShift.user_email}» هستید. فروش‌های جدید شما در صورت افتتاح شیفت اختصاصی در شیفت خودتان ثبت خواهند شد.`
                        : `Viewing live metrics for cashier ${displayedShift.user_name || displayedShift.user_email}.`}
                    </div>
                  </div>
                )}

                {/* Shift Assigned Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mb-1">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isPersian ? 'صندوق‌دار متصل به این شیفت' : 'Cashier'}</span>
                    </div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                      {displayedShift.user_name || displayedShift.user_email || (user?.email || 'کاربر سیستم')}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-purple-500" />
                      <span>{isPersian ? 'انبار / شعبه' : 'Warehouse'}</span>
                    </div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                      {displayedShift.warehouse_name || (isPersian ? 'همه انبارها' : 'All Warehouses')}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800">
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mb-1">
                      <Wallet className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isPersian ? 'صندوق / حساب مالی' : 'Cashbox / Account'}</span>
                    </div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                      {displayedShift.account_name ||
                        (hasAccounting
                          ? isPersian
                            ? 'پیش‌فرض سیستم'
                            : 'Default'
                          : isPersian
                          ? 'غیرفعال (بدون ماژول)'
                          : 'Disabled')}
                    </div>
                  </div>
                </div>

                {/* Real-time Sales Summary Grid */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#14161d] border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-indigo-500" />
                      <span>{isPersian ? 'عملکرد فروش زنده در طول این شیفت' : 'Live Sales Breakdown'}</span>
                    </h5>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-bold">
                      {displayedShift.total_orders_count || 0} {isPersian ? 'سفارش ثبت شده' : 'Orders'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-0.5">
                        {isPersian ? 'موجودی اولیه (نقد)' : 'Opening Balance'}
                      </span>
                      <span className="text-xs font-black text-neutral-900 dark:text-neutral-100 font-mono">
                        {formatCurrency(Number(displayedShift.opening_balance) || 0, activeOrganization?.currency || 'TOMAN')}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mb-0.5 flex items-center gap-1">
                        <Banknote className="w-3 h-3" />
                        <span>{isPersian ? 'فروش نقدی' : 'Cash Sales'}</span>
                      </span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCurrency(Number(displayedShift.total_cash_amount) || 0, activeOrganization?.currency || 'TOMAN')}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 block mb-0.5 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        <span>{isPersian ? 'فروش کارتخوان (POS)' : 'POS Sales'}</span>
                      </span>
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
                        {formatCurrency(Number(displayedShift.total_pos_amount) || 0, activeOrganization?.currency || 'TOMAN')}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 block mb-0.5 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        <span>{isPersian ? 'مجموع کل فروش' : 'Total Sales'}</span>
                      </span>
                      <span className="text-xs font-black text-purple-600 dark:text-purple-400 font-mono">
                        {formatCurrency(Number(displayedShift.total_sales_amount) || 0, activeOrganization?.currency || 'TOMAN')}
                      </span>
                    </div>
                  </div>

                  {/* Expected Cash in drawer */}
                  <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        {isPersian ? 'موجودی نقد مورد انتظار در کشوی صندوق:' : 'Expected Cash in Drawer:'}
                      </span>
                    </div>
                    <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 font-mono">
                      {formatCurrency(expectedCash, activeOrganization?.currency || 'TOMAN')}
                    </span>
                  </div>
                </div>

                {/* Close Shift Form */}
                <form
                  onSubmit={handleCloseShift}
                  className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-[#14161d] border border-neutral-200 dark:border-neutral-800 space-y-3"
                >
                  <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <StopCircle className="w-4 h-4 text-rose-500" />
                    <span>{isPersian ? 'شمارش پایان شیفت و بستن نهایی' : 'Close Shift & Cash Balancing'}</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                        {isPersian ? 'موجودی نقد شمرده شده پایان شیفت *' : 'Counted Physical Cash *'}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={closingBalance}
                          onChange={(e) => setClosingBalance(e.target.value)}
                          placeholder="0"
                          className="w-full ps-3 pe-12 py-2 text-xs bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-neutral-900 dark:text-neutral-100 font-mono tracking-wider transition-all"
                          required
                        />
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 font-bold">
                          {activeOrganization?.currency === 'IRR' ? 'ریال' : 'تومان'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                        {isPersian ? 'توضیحات و یادداشت پایانی (اختیاری)' : 'Closing Notes (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        placeholder={isPersian ? 'علت مغایرت، تحویل به صندوق‌دار بعد و...' : 'Shift handover notes...'}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100 transition-all"
                      />
                    </div>
                  </div>

                  {/* Discrepancy indicator */}
                  {closingBalance.trim() !== '' && (
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        cashDiscrepancy === 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                          : cashDiscrepancy < 0
                          ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                          : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {cashDiscrepancy === 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        <span className="font-bold">
                          {cashDiscrepancy === 0
                            ? isPersian
                              ? 'تراز صندوق دقیق و بدون مغایرت است.'
                              : 'Cashbox is perfectly balanced.'
                            : cashDiscrepancy < 0
                            ? isPersian
                              ? 'هشدار کسری نقد در صندوق:'
                              : 'Cash Shortage Warning:'
                            : isPersian
                            ? 'مازاد نقد در صندوق:'
                            : 'Cash Surplus:'}
                        </span>
                      </div>

                      <span className="font-mono font-black text-sm">
                        {cashDiscrepancy === 0
                          ? '0'
                          : formatCurrency(Math.abs(cashDiscrepancy), activeOrganization?.currency || 'TOMAN')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="danger"
                      type="submit"
                      isLoading={isSubmitting}
                      icon={<StopCircle className="w-4 h-4" />}
                    >
                      {displayedShift.id !== myOpenShift?.id
                        ? isPersian
                          ? 'بستن شیفت صندوق‌دار (مدیر)'
                          : 'Close Colleague Shift'
                        : isPersian
                        ? 'ثبت و بستن نهایی شیفت'
                        : 'Close & Finalize Shift'}
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              /* Open New Shift Form */
              <form onSubmit={handleStartShift} className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/50 flex items-start gap-3">
                  <Play className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                    <p className="font-bold mb-1">
                      {isPersian ? 'شروع شیفت جدید صندوق و ثبت سفارش' : 'Start New POS Shift'}
                    </p>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      {isPersian
                        ? 'با افتتاح شیفت، فروش‌ها، دریافت‌های نقدی و کارتی صندوق شما با موجودی اولیه تفکیک شده و در پایان شیفت گزارش مغایرت و Z-Report تولید می‌شود.'
                        : 'Opening a shift isolates cash and POS transactions for clear end-of-day balancing and Z-Reports.'}
                    </p>
                  </div>
                </div>

                {/* Cashier Identity Badge */}
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-500" />
                    <span className="text-neutral-500 dark:text-neutral-400">{isPersian ? 'صندوق‌دار متصل:' : 'Logged-in Cashier:'}</span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}
                    </span>
                  </div>
                  <Badge variant="neutral">
                    {currentUserMember?.role === 'owner'
                      ? 'مدیر ارشد'
                      : currentUserMember?.role === 'manager'
                      ? 'مدیر شعبه'
                      : 'صندوق‌دار'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        {isPersian ? 'انبار / شعبه فروشگاه *' : 'Warehouse / Store Branch *'}
                      </label>
                      {currentUserMember?.can_change_warehouse === false && currentUserMember?.warehouse_id && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          <Lock className="w-2.5 h-2.5" />
                          <span>{isPersian ? 'قفل بر اساس دسترسی کاربر' : 'Locked Branch'}</span>
                        </span>
                      )}
                    </div>
                    <Select
                      value={String(openWarehouseId)}
                      onChange={(e) => setOpenWarehouseId(Number(e.target.value) || '')}
                      options={warehouses.map((w) => ({
                        value: String(w.id),
                        label: `${w.name} ${w.is_default ? (isPersian ? '(پیش‌فرض)' : '(Default)') : ''}`,
                      }))}
                      disabled={currentUserMember?.can_change_warehouse === false && Boolean(currentUserMember?.warehouse_id)}
                      required
                    />
                  </div>

                  {hasAccounting ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          {isPersian ? 'صندوق نقدی / دستگاه پوز اختصاصی' : 'Dedicated Cashbox / POS Account'}
                        </label>
                        {currentUserMember?.financial_account_id && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            currentUserMember.can_change_warehouse === false || currentUserMember.role === 'sales'
                              ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                              : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                          }`}>
                            {currentUserMember.can_change_warehouse === false || currentUserMember.role === 'sales' ? (
                              <Lock className="w-2.5 h-2.5" />
                            ) : (
                              <Wallet className="w-2.5 h-2.5" />
                            )}
                            <span>
                              {currentUserMember.can_change_warehouse === false || currentUserMember.role === 'sales'
                                ? (isPersian ? 'صندوق قفل‌شده شما' : 'Locked Cashbox')
                                : (isPersian ? 'صندوق پیش‌فرض شما' : 'Assigned Cashbox')}
                            </span>
                          </span>
                        )}
                      </div>
                      <Select
                        value={String(openAccountId)}
                        onChange={(e) => setOpenAccountId(Number(e.target.value) || '')}
                        disabled={Boolean(
                          currentUserMember?.financial_account_id &&
                          (currentUserMember.can_change_warehouse === false || currentUserMember.role === 'sales')
                        )}
                        options={[
                          { value: '', label: isPersian ? 'انتخاب خودکار بر اساس تراکنش' : 'Auto match per transaction' },
                          ...financialAccounts.map((a) => ({
                            value: String(a.id),
                            label: `${a.name} (${a.type === 'cashbox' ? 'صندوق' : a.type === 'pos' ? 'پوز' : 'بانک'})`,
                          })),
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 text-xs text-neutral-500">
                      <Lock className="w-4 h-4 text-neutral-400" />
                      <span>{isPersian ? 'صندوق‌های پیشرفته در ماژول حسابداری فعال می‌شوند.' : 'Advanced cashbox requires Accounting module.'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                    {isPersian ? 'موجودی اولیه پول نقد در کشوی صندوق (تنخواه/پول خرد)' : 'Opening Cash in Drawer'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      placeholder="0"
                      className="w-full ps-3 pe-12 py-2 text-xs bg-neutral-50 dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100 font-mono tracking-wider transition-all"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 font-bold">
                      {activeOrganization?.currency === 'IRR' ? 'ریال' : 'تومان'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <Button variant="outline" type="button" onClick={onClose}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" type="submit" isLoading={isSubmitting} icon={<Play className="w-4 h-4" />}>
                    {isPersian ? 'افتتاح و شروع شیفت' : 'Start POS Shift'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* Shift History Tab with Cashier, Warehouse & Status Isolation Filters */
          <div className="space-y-3">
            {/* Filter Bar */}
            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-[#14161d] border border-neutral-200 dark:border-neutral-800 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                {/* Cashier Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                    {isPersian ? 'فیلتر صندوق‌دار / کاربر:' : 'Filter Cashier:'}
                  </label>
                  <Select
                    value={historyFilterCashier}
                    onChange={(e) => setHistoryFilterCashier(e.target.value)}
                    options={[
                      { value: 'all', label: isPersian ? 'همه صندوق‌داران' : 'All Cashiers' },
                      ...cashierFilterOptions.map((c) => ({
                        value: c.id,
                        label: c.name,
                      })),
                    ]}
                  />
                </div>

                {/* Warehouse Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                    {isPersian ? 'شعبه / انبار:' : 'Warehouse:'}
                  </label>
                  <Select
                    value={historyFilterWarehouse}
                    onChange={(e) => setHistoryFilterWarehouse(e.target.value)}
                    options={[
                      { value: 'all', label: isPersian ? 'همه انبارها' : 'All Warehouses' },
                      ...warehouses.map((w) => ({
                        value: String(w.id),
                        label: w.name,
                      })),
                    ]}
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                    {isPersian ? 'وضعیت شیفت:' : 'Status:'}
                  </label>
                  <Select
                    value={historyFilterStatus}
                    onChange={(e) => setHistoryFilterStatus(e.target.value)}
                    options={[
                      { value: 'all', label: isPersian ? 'همه وضعیت‌ها' : 'All Statuses' },
                      { value: 'open', label: isPersian ? 'درحال اجرا (باز)' : 'Active (Open)' },
                      { value: 'closed', label: isPersian ? 'بسته شده' : 'Closed' },
                    ]}
                  />
                </div>

                {/* Search query */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                    {isPersian ? 'جستجو در شیفت‌ها:' : 'Search:'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      placeholder={isPersian ? 'شناسه شیفت، نام...' : 'Shift ID, name...'}
                      className="w-full ps-8 pe-2 py-2 text-xs bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100 transition-all"
                    />
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Aggregated Quick Metrics for Filtered Result */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800 text-xs">
                <div className="p-2 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-0.5">
                    {isPersian ? 'تعداد شیفت‌ها' : 'Shifts Count'}
                  </span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                    {historyStats.count} {isPersian ? 'شیفت' : ''}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mb-0.5">
                    {isPersian ? 'کل فروش نقدی' : 'Total Cash Sales'}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(historyStats.totalCash, activeOrganization?.currency || 'TOMAN')}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 block mb-0.5">
                    {isPersian ? 'کل فروش پوز (POS)' : 'Total POS Sales'}
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                    {formatCurrency(historyStats.totalPos, activeOrganization?.currency || 'TOMAN')}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-white dark:bg-[#181a20] border border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 block mb-0.5">
                    {isPersian ? 'مجموع کل فروش' : 'Total Revenue'}
                  </span>
                  <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                    {formatCurrency(historyStats.totalSales, activeOrganization?.currency || 'TOMAN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Filtered Shifts List */}
            {filteredHistoryShifts.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-400">
                {isPersian ? 'هیچ شیفتی مطابق فیلترهای انتخابی یافت نشد.' : 'No shifts match the filters.'}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pe-1">
                {filteredHistoryShifts.map((shift) => {
                  const opening = Number(shift.opening_balance) || 0;
                  const closing = Number(shift.closing_balance) || 0;
                  const cashSales = Number(shift.total_cash_amount) || 0;
                  const expected = opening + cashSales;
                  const diff = closing - expected;
                  const isMyShift =
                    (currentUserId && shift.user_id === currentUserId) ||
                    (currentUserEmail && (shift.user_id === currentUserEmail || shift.user_email === currentUserEmail));

                  return (
                    <div
                      key={shift.id}
                      className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#14161d] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 font-mono">
                            #{shift.id}
                          </span>
                          <Badge variant={shift.status === 'open' ? 'success' : 'neutral'}>
                            {shift.status === 'open'
                              ? isPersian
                                ? 'درحال اجرا'
                                : 'Open'
                              : isPersian
                              ? 'بسته شده'
                              : 'Closed'}
                          </Badge>
                          {isMyShift && (
                            <Badge variant="primary">
                              {isPersian ? 'شیفت من' : 'My Shift'}
                            </Badge>
                          )}
                          <span className="text-[11px] text-neutral-600 dark:text-neutral-300 font-medium flex items-center gap-1">
                            <User className="w-3 h-3 text-neutral-400" />
                            {shift.user_name || shift.user_email || 'کاربر'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            {formatDate(shift.opened_at || '')}
                          </span>
                          {shift.warehouse_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-purple-400" />
                              {shift.warehouse_name}
                            </span>
                          )}
                          {shift.account_name && (
                            <span className="flex items-center gap-1">
                              <Wallet className="w-3 h-3 text-amber-400" />
                              {shift.account_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-start sm:text-end">
                          <div className="text-[10px] text-neutral-400">
                            {isPersian ? 'مجموع فروش:' : 'Total Sales:'}
                          </div>
                          <div className="text-xs font-black text-neutral-900 dark:text-neutral-100 font-mono">
                            {formatCurrency(
                              Number(shift.total_sales_amount) || 0,
                              activeOrganization?.currency || 'TOMAN'
                            )}
                          </div>
                          {shift.status === 'closed' && (
                            <div
                              className={`text-[10px] font-bold ${
                                diff === 0
                                  ? 'text-emerald-600'
                                  : diff < 0
                                  ? 'text-red-600'
                                  : 'text-blue-600'
                              }`}
                            >
                              {diff === 0
                                ? isPersian
                                  ? 'تراز'
                                  : 'Balanced'
                                : diff < 0
                                ? `${isPersian ? 'کسری:' : 'Short:'} ${formatCurrency(
                                    Math.abs(diff),
                                    activeOrganization?.currency || 'TOMAN'
                                  )}`
                                : `${isPersian ? 'مازاد:' : 'Surplus:'} ${formatCurrency(
                                    diff,
                                    activeOrganization?.currency || 'TOMAN'
                                  )}`}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {shift.status === 'open' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedShiftId(shift.id);
                                setActiveTab('current');
                              }}
                              icon={<Eye className="w-3.5 h-3.5 text-indigo-500" />}
                            >
                              {isPersian ? 'مشاهده زنده' : 'Inspect'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintZReport(shift)}
                            icon={<Printer className="w-3.5 h-3.5" />}
                          >
                            {isPersian ? 'چاپ ژورنال' : 'Print'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
