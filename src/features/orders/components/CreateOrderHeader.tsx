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
      <div className="bg-white dark:bg-[#13151a] border border-[#ebebeb] dark:border-neutral-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#171717] dark:bg-neutral-800 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#171717] dark:text-neutral-100">{t('orders.posTitle')}</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-bold">
                {t('orders.posOnline')}
              </span>
            </div>
            <p className="text-xs text-[#888888] dark:text-neutral-400 mt-0.5">
              {t('orders.posSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-start sm:justify-end">
          {/* Fullscreen POS Mode Trigger Button */}
          {onToggleFullscreenPos && (
            <Button
              variant="primary"
              size="sm"
              onClick={onToggleFullscreenPos}
              icon={<Maximize2 className="w-3.5 h-3.5 text-emerald-400" />}
              className="bg-neutral-900 hover:bg-black text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 border border-neutral-800 dark:border-neutral-300 font-bold shadow-xs"
              title={t('orders.fullscreenPosHint')}
            >
              <span>{t('orders.fullscreenPos')}</span>
            </Button>
          )}

          {/* POS Shift Management Trigger Button */}
          <Button
            variant={activeShift ? 'primary' : 'outline'}
            size="sm"
            onClick={onOpenShiftModal}
            icon={<Clock className="w-3.5 h-3.5" />}
            className={activeShift ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : ''}
          >
            {activeShift ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>{isPersian ? `شیفت #${activeShift.id}` : `Shift #${activeShift.id}`}</span>
              </span>
            ) : (
              <span>{isPersian ? 'شیفت' : 'Shift'}</span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onPreviewPrint}
            disabled={cartLength === 0}
            icon={<Printer className="w-3.5 h-3.5 text-emerald-600" />}
          >
            <span className="hidden sm:inline">{t('orders.previewPrintInvoice')}</span>
            <span className="sm:hidden">پیش‌نمایش</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenCustomerModal}
            icon={<UserPlus className="w-3.5 h-3.5 text-indigo-600" />}
          >
            <span className="hidden sm:inline">{t('orders.quickCustomer')}</span>
            <span className="sm:hidden">مشتری</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onClearCart}
            disabled={cartLength === 0}
            className="text-red-600 hover:bg-red-50 border-red-200"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            <span className="hidden sm:inline">{t('orders.clearInvoice')}</span>
            <span className="sm:hidden">پاک‌کردن</span>
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
    </>
  );
};
