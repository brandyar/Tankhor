import React from 'react';
import { Camera } from 'lucide-react';
import { useCameraAvailability } from '../../hooks/useCameraAvailability';
import { useTranslation } from '../../i18n';

interface WebcamScanButtonProps {
  onClick: () => void;
  variant?: 'icon' | 'button';
  size?: 'xs' | 'sm' | 'md';
  label?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}

/**
 * Renders a webcam barcode scanner trigger ONLY when the user's system
 * has at least one camera / webcam (`videoinput`).
 */
export const WebcamScanButton: React.FC<WebcamScanButtonProps> = ({
  onClick,
  variant = 'icon',
  size = 'sm',
  label,
  className = '',
  disabled = false,
  title,
}) => {
  const { hasCamera } = useCameraAvailability();
  const { t } = useTranslation();

  if (!hasCamera) {
    return null;
  }

  const tooltip = title || t('common.scanWithWebcam', 'اسکن بارکد با وب‌کم');

  if (variant === 'button') {
    const sizeClasses =
      size === 'xs'
        ? 'h-7 px-2 text-[11px]'
        : size === 'md'
        ? 'h-10 px-3 text-xs'
        : 'h-8 px-2.5 text-xs';

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={tooltip}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#181a20] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shrink-0 ${sizeClasses} ${className}`}
      >
        <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{label || tooltip}</span>
      </button>
    );
  }

  const iconSizeClasses =
    size === 'xs' ? 'w-6 h-6 rounded-md' : size === 'md' ? 'w-9 h-9 rounded-lg' : 'w-7 h-7 rounded-lg';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center justify-center text-neutral-500 hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none shrink-0 ${iconSizeClasses} ${className}`}
    >
      <Camera className={size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    </button>
  );
};
