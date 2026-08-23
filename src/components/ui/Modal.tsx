import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div
        className={`w-full bg-white rounded-xl border border-neutral-200/80 shadow-vercel-lg overflow-hidden flex flex-col max-h-[90vh] ${getMaxWidthClass(maxWidth)}`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-neutral-900 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3.5 bg-[#fafafa] border-t border-neutral-100 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
