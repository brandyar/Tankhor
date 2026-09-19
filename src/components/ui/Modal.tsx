import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | string;
  zIndex?: string | number;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
  zIndex = 100000,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown, true);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      // Only restore overflow if there is no fullscreen terminal active
      const hasFullscreenTerminal = document.querySelector('#fullscreen-pos-terminal');
      if (!hasFullscreenTerminal) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      } else {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let numericZIndex = 100000;
  if (typeof zIndex === 'number') {
    numericZIndex = zIndex;
  } else if (typeof zIndex === 'string') {
    const match = zIndex.match(/\d+/);
    if (match) {
      numericZIndex = parseInt(match[0], 10);
    }
  }

  const getMaxWidthClass = (size?: string) => {
    if (!size) return 'max-w-md';
    if (size.startsWith('max-w-')) return size;
    const map: Record<string, string> = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      '3xl': 'max-w-3xl',
      '4xl': 'max-w-4xl',
      '5xl': 'max-w-5xl',
      full: 'max-w-full',
    };
    return map[size] || 'max-w-md';
  };

  const modalContent = (
    <div
      style={{ zIndex: numericZIndex }}
      className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in tankhor-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full bg-white dark:bg-[#13151a] rounded-t-2xl sm:rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-vercel-lg overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] text-neutral-900 dark:text-neutral-100 ${getMaxWidthClass(maxWidth)}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="sm:hidden w-full flex items-center justify-center pt-2.5 pb-0.5">
          <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-[#fafafa] dark:bg-[#181a20] border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-end gap-2.5 sm:gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
