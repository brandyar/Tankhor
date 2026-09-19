import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { storageManager } from '../../storage';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { PosShift, Warehouse } from '../../types';
import { FinancialAccount } from '../../types/accounting';
import { Modal } from '../ui/Modal';
import { Clock, History, Users, Play, User } from 'lucide-react';

// Subcomponents
import { printZReport } from './pos-shift/PosShiftZReportPrinter';
import { PosShiftStartForm } from './pos-shift/PosShiftStartForm';
import { PosShiftActiveView } from './pos-shift/PosShiftActiveView';
import { PosShiftHistoryTab } from './pos-shift/PosShiftHistoryTab';

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
  const { locale } = useTranslation();
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

  // Selected shift ID to view/manage in current tab (supports multi-cashier inspection)
  const [selectedShiftId, setSelectedShiftId] = useState<number | string | null>(null);

  // Current logged in user membership
  const currentUserMember = useMemo(() => {
    if (!user || !organizationUsers || organizationUsers.length === 0) return null;
    return organizationUsers.find((ou) => {
      const ouUserId = typeof ou.user_id === 'object' ? (ou.user_id as any)?.id : ou.user_id;
      const ouEmail = typeof ou.user_id === 'object' ? (ou.user_id as any)?.email : ou.email;
      if (user?.id && ouUserId && String(ouUserId) === String(user.id)) return true;
      if (
        user?.email &&
        ouEmail &&
        String(ouEmail).toLowerCase() === String(user.email).toLowerCase()
      )
        return true;
      if (
        user?.email &&
        ou.email &&
        String(ou.email).toLowerCase() === String(user.email).toLowerCase()
      )
        return true;
      return false;
    });
  }, [user, organizationUsers]);

  // Distinguish my shift and other cashiers' shifts
  const currentUserId = user?.id;
  const currentUserEmail = user?.email;

  const myOpenShift = useMemo(() => {
    return (
      shiftHistory.find(
        (s) =>
          s.status === 'open' &&
          ((currentUserId && (s.user_id === currentUserId || String(s.user_id) === String(currentUserId))) ||
            (currentUserEmail &&
              (s.user_id === currentUserEmail || (s as any).user_email === currentUserEmail)) ||
            !s.user_id)
      ) ||
      shiftHistory.find((s) => s.status === 'open') ||
      null
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

  const handleStartShift = async (params: {
    warehouseId: number;
    financialAccountId: number | null;
    openingBalance: number;
  }) => {
    const created = await storageManager.savePosShift!({
      organization_id: activeOrganization?.id,
      user_id: user?.id || user?.email || null,
      warehouse_id: params.warehouseId,
      financial_account_id: params.financialAccountId,
      opening_balance: params.openingBalance,
      status: 'open',
      opened_at: new Date().toISOString(),
    });

    await loadShiftData();
    setSelectedShiftId(created.id);
    if (onShiftChanged) onShiftChanged(created);
  };

  const handleCloseShift = async (params: {
    closingBalance: number;
    closingNotes: string;
    isOtherCashierShift: boolean;
  }) => {
    if (!displayedShift) return;

    const auditNote = params.isOtherCashierShift
      ? `${params.closingNotes ? `${params.closingNotes} | ` : ''}[بسته شده توسط مدیر: ${
          user?.first_name || user?.email
        }]`
      : params.closingNotes;

    await storageManager.closePosShift!(displayedShift.id, params.closingBalance, auditNote);
    await loadShiftData();
    setSelectedShiftId(null);
    if (onShiftChanged && displayedShift.id === myOpenShift?.id) {
      onShiftChanged(null);
    }
  };

  const defaultWhId = useMemo(() => {
    const assignedWh = currentUserMember?.warehouse_id;
    return typeof assignedWh === 'object' && assignedWh
      ? (assignedWh as any).id
      : assignedWh || (warehouses && warehouses.length > 0 ? warehouses[0].id : '');
  }, [currentUserMember, warehouses]);

  const defaultAccId = useMemo(() => {
    const assignedAcc = currentUserMember?.financial_account_id;
    const rawId =
      typeof assignedAcc === 'object' && assignedAcc ? (assignedAcc as any).id : assignedAcc;
    return rawId ? Number(rawId) : '';
  }, [currentUserMember]);

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
            {myOpenShift && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
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
            {/* Multi-Cashier Shift Switcher */}
            {allOpenShifts.length > 0 && (
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#14161d] border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 font-medium">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>{isPersian ? 'صندوق‌های فعال هم‌اکنون:' : 'Active Cashboxes:'}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
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
              <PosShiftActiveView
                displayedShift={displayedShift}
                myOpenShift={myOpenShift}
                user={user}
                activeOrganization={activeOrganization}
                hasAccounting={hasAccounting}
                onPrintZReport={(s) => printZReport(s, activeOrganization)}
                onCloseShift={handleCloseShift}
              />
            ) : (
              <PosShiftStartForm
                user={user}
                currentUserMember={currentUserMember}
                warehouses={warehouses}
                financialAccounts={financialAccounts}
                hasAccounting={hasAccounting}
                activeOrganization={activeOrganization}
                initialWarehouseId={defaultWhId}
                initialAccountId={defaultAccId}
                initialOpeningBalance="0"
                onClose={onClose}
                onSubmit={handleStartShift}
              />
            )}
          </div>
        ) : (
          <PosShiftHistoryTab
            shiftHistory={shiftHistory}
            warehouses={warehouses}
            organizationUsers={organizationUsers}
            user={user}
            activeOrganization={activeOrganization}
            onInspectShift={(shiftId) => {
              setSelectedShiftId(shiftId);
              setActiveTab('current');
            }}
            onPrintZReport={(s) => printZReport(s, activeOrganization)}
          />
        )}
      </div>
    </Modal>
  );
};
