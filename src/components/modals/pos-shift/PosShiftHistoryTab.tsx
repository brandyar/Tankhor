import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n';
import { PosShift, Warehouse, Organization, OrganizationUser } from '../../../types';
import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import {
  User,
  Building2,
  Wallet,
  Clock,
  Search,
  Eye,
  Printer,
} from 'lucide-react';

interface PosShiftHistoryTabProps {
  shiftHistory: PosShift[];
  warehouses: Warehouse[];
  organizationUsers: OrganizationUser[];
  user: any;
  activeOrganization: Organization | null;
  onInspectShift: (shiftId: number | string) => void;
  onPrintZReport: (shift: PosShift) => void;
}

export const PosShiftHistoryTab: React.FC<PosShiftHistoryTabProps> = ({
  shiftHistory,
  warehouses,
  organizationUsers,
  user,
  activeOrganization,
  onInspectShift,
  onPrintZReport,
}) => {
  const { locale } = useTranslation();
  const isPersian = locale === 'fa';

  const [historyFilterCashier, setHistoryFilterCashier] = useState<string>('all');
  const [historyFilterWarehouse, setHistoryFilterWarehouse] = useState<string>('all');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  const currentUserId = user?.id;
  const currentUserEmail = user?.email;

  // Distinct Cashiers from Shift History & Org Users for filter
  const cashierFilterOptions = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    if (user?.id) {
      list.push({
        id: user.id,
        name: isPersian
          ? `شیفت‌های من (${user.first_name || user.email})`
          : `My Shifts (${user.first_name || user.email})`,
      });
      seen.add(user.id);
      if (user.email) seen.add(user.email);
    }

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

  // Filtered Shifts
  const filteredHistoryShifts = useMemo(() => {
    return shiftHistory.filter((shift) => {
      if (historyFilterStatus !== 'all' && shift.status !== historyFilterStatus) {
        return false;
      }
      if (historyFilterWarehouse !== 'all') {
        const sWhId =
          typeof shift.warehouse_id === 'object'
            ? (shift.warehouse_id as any)?.id
            : shift.warehouse_id;
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
  }, [
    shiftHistory,
    historyFilterStatus,
    historyFilterWarehouse,
    historyFilterCashier,
    historySearchQuery,
    user,
  ]);

  // Aggregated Stats
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
          {isPersian
            ? 'هیچ شیفتی مطابق فیلترهای انتخابی یافت نشد.'
            : 'No shifts match the filters.'}
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
              (currentUserEmail &&
                (shift.user_id === currentUserEmail || shift.user_email === currentUserEmail));

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
                        onClick={() => onInspectShift(shift.id)}
                        icon={<Eye className="w-3.5 h-3.5 text-indigo-500" />}
                      >
                        {isPersian ? 'مشاهده زنده' : 'Inspect'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPrintZReport(shift)}
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
  );
};
