import React from 'react';
import { useTranslation } from '../../../i18n';
import { PosShift } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Receipt, Clock, Printer, UserPlus, RotateCcw, CheckCircle2, AlertCircle, Maximize2 } from 'lucide-react';

interface CreateOrderHeaderProps {
  activeShift: PosShift | null;
  onOpenShiftModal: () => void;
  onPreviewPrint: () => void;
  onOpenCustomerModal: () => void;
  onClearCart: () => void;
  cartLength: number;
  scannerToast: { type: 'success' | 'error'; message: string } | null;
  errorMsg: string | null;
  onToggleFullscreenPos?: () => void;
}

export const CreateOrderHeader: React.FC<CreateOrderHeaderProps> = ({
  activeShift,
  onOpenShiftModal,
  onPreviewPrint,
  onOpenCustomerModal,
  onClearCart,
  cartLength,
  scannerToast,
  errorMsg,
  onToggleFullscreenPos,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  return (
    <>
      <div className="bg-white dark:bg-[#13151a] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-2.5 sm:p-4 shadow-2xs flex items-center justify-between gap-2 sm:gap-4">
        {/* Title and Badge */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#171717] dark:bg-neutral-800 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs sm:text-base font-bold text-[#171717] dark:text-neutral-100 truncate">
                {t('orders.posTitle')}
              </h1>
              <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-bold">
                {t('orders.posOnline')}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 truncate hidden sm:block mt-0.5">
              {t('orders.posSubtitle')}
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Fullscreen POS Mode Trigger Button - Strictly Desktop Only */}
          {onToggleFullscreenPos && (
            <div className="hidden md:block">
              <Button
                variant="primary"
                size="sm"
                onClick={onToggleFullscreenPos}
                icon={<Maximize2 className="w-3.5 h-3.5 text-emerald-400" />}
                className="bg-neutral-900 hover:bg-black text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 border border-neutral-800 dark:border-neutral-300 font-bold shadow-xs text-xs px-2.5 sm:px-3 h-8 sm:h-9"
                title={t('orders.fullscreenPosHint')}
              >
                <span>{t('orders.fullscreenPos')}</span>
              </Button>
            </div>
          )}

          {/* POS Shift Management Trigger Button */}
          <Button
            variant={activeShift ? 'primary' : 'outline'}
            size="sm"
            onClick={onOpenShiftModal}
            icon={<Clock className="w-3.5 h-3.5" />}
            className={`text-xs px-2.5 sm:px-3 h-8 sm:h-9 ${
              activeShift ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : ''
            }`}
            title={isPersian ? (activeShift ? `شیفت فعال #${activeShift.id}` : 'مدیریت شیفت کاری') : 'POS Shift'}
          >
            {activeShift ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="hidden sm:inline">{isPersian ? `شیفت #${activeShift.id}` : `Shift #${activeShift.id}`}</span>
                <span className="sm:hidden font-mono text-[11px]">#{activeShift.id}</span>
              </span>
            ) : (
              <span>{isPersian ? 'شیفت' : 'Shift'}</span>
            )}
          </Button>

          {/* Quick Customer Button - Icon Only on Mobile, Icon + Text on Desktop */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenCustomerModal}
            icon={<UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
            className="text-xs px-2 sm:px-3 h-8 sm:h-9"
            title={t('orders.quickCustomer')}
          >
            <span className="hidden sm:inline">{t('orders.quickCustomer')}</span>
          </Button>

          {/* Preview Print Button - Desktop Only */}
          <div className="hidden sm:block">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviewPrint}
              disabled={cartLength === 0}
              icon={<Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              className="text-xs px-2 sm:px-3 h-8 sm:h-9"
            >
              <span>{t('orders.previewPrintInvoice')}</span>
            </Button>
          </div>

          {/* Clear Cart Button - Desktop Only */}
          {cartLength > 0 && (
            <div className="hidden lg:block">
              <Button
                variant="outline"
                size="sm"
                onClick={onClearCart}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/60 text-xs px-2 sm:px-2.5 h-8 sm:h-9"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                title={t('orders.clearInvoice')}
              >
                <span>{t('orders.clearInvoice')}</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Scanner Toast Notification */}
      {scannerToast && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
            scannerToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
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
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </>
  );
};
