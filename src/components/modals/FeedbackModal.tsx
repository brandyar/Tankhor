import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  Sparkles,
  Bug,
  Palette,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { storageManager } from '../../storage';
import { APP_VERSION } from '../../utils/version';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'feature' | 'bug' | 'ux' | 'other';

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const typeCategories: Array<{
    type: FeedbackType;
    label: string;
    icon: React.ElementType;
    prefix: string;
  }> = [
    {
      type: 'feature',
      label: t('common.feedbackTypeFeature'),
      icon: Sparkles,
      prefix: '[پیشنهاد قابلیت]',
    },
    {
      type: 'bug',
      label: t('common.feedbackTypeBug'),
      icon: Bug,
      prefix: '[گزارش خطا]',
    },
    {
      type: 'ux',
      label: t('common.feedbackTypeUX'),
      icon: Palette,
      prefix: '[تجربه کاربری]',
    },
    {
      type: 'other',
      label: t('common.feedbackTypeOther'),
      icon: HelpCircle,
      prefix: '[بازخورد عمومی]',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject || !trimmedMessage) {
      setError(t('common.feedbackValidation'));
      return;
    }

    try {
      setIsSubmitting(true);
      const activeCategory = typeCategories.find((c) => c.type === feedbackType);
      const formattedSubject = activeCategory
        ? `${activeCategory.prefix} ${trimmedSubject}`
        : trimmedSubject;

      await storageManager.submitFeedback({
        subject: formattedSubject,
        message: `${trimmedMessage}\n\n---\n[اطلاعات سیستم: نسخه ${APP_VERSION} | کاربر: ${user?.email || user?.first_name || 'کاربر سیستم'}]`,
        user_id: user?.id || null,
        status: 'unread',
      });

      setIsSuccess(true);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      console.error('Failed to submit feedback:', err);
      setError(err?.message || t('common.errorOccurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('common.feedbackTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('common.feedbackSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('common.feedbackSuccessTitle')}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                {t('common.feedbackSuccessDesc')}
              </p>
            </div>
            <div className="pt-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Category selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                نوع بازخورد:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {typeCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = feedbackType === cat.type;
                  return (
                    <button
                      key={cat.type}
                      type="button"
                      onClick={() => setFeedbackType(cat.type)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('common.feedbackSubject')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('common.feedbackSubjectPlaceholder')}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                maxLength={150}
                required
              />
            </div>

            {/* Message textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('common.feedbackMessage')} <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('common.feedbackMessagePlaceholder')}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all resize-none"
                required
              />
            </div>

            {/* System Info Info-Box */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100/60 dark:bg-slate-800/40 rounded-xl text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>نسخه فعلی تن‌خور: <strong className="font-mono text-slate-700 dark:text-slate-300">v{APP_VERSION}</strong></span>
              </div>
              {user?.email && (
                <span className="truncate max-w-[200px]" title={user.email}>
                  ارسال با حساب: <span className="font-mono">{user.email}</span>
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-indigo-500/20"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('common.feedbackSubmitting')}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{t('common.feedbackSubmit')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
