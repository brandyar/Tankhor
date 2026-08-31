import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { registerConfirmHandler } from '../../utils/confirm';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  resolve: (value: boolean) => void;
}

export const ConfirmModalHost: React.FC = () => {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    registerConfirmHandler((message: string, title?: string) => {
      return new Promise<boolean>((resolve) => {
        setState({
          isOpen: true,
          title: title || 'تایید حذف',
          message,
          resolve,
        });
      });
    });
  }, []);

  if (!state || !state.isOpen) return null;

  const handleConfirm = () => {
    state.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state.resolve(false);
    setState(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {state.title}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {state.message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors cursor-pointer shadow-sm"
          >
            <Trash2 className="h-4 w-4" />
            تایید و حذف
          </button>
        </div>
      </div>
    </div>
  );
};
