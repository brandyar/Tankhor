import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { Button } from '../../components/ui/Button';
import { Building2, X, Plus, AlertCircle } from 'lucide-react';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { createOrganization } = useOrganization();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [currency, setCurrency] = useState('TOMAN');
  const [timezone, setTimezone] = useState('Asia/Tehran');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(t('settings.orgNameRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const generatedSlug = slug.trim()
        ? slug.trim().toLowerCase().replace(/\s+/g, '-')
        : `org-${Date.now().toString(36)}`;

      await createOrganization({
        name: cleanName,
        slug: generatedSlug,
        currency,
        timezone,
        plan: 'free',
        status: 'active',
      });

      setName('');
      setSlug('');
      setCurrency('TOMAN');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="create-org-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        id="create-org-modal-card"
        className="w-full max-w-md bg-white dark:bg-[#13151a] rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 overflow-hidden flex flex-col animate-scale-up"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#181a20]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-blue-600 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{t('settings.createOrgTitle')}</h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{t('settings.createOrgSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Org Name */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('settings.orgName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder={t('settings.orgName')}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent transition-all"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('settings.orgSlug')} <span className="text-neutral-400 dark:text-neutral-500 font-normal">{t('settings.slugOptional')}</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="boutique-slug"
              dir="ltr"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 font-mono placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent transition-all text-start"
            />
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
              {t('settings.slugAutoHelp')}
            </p>
          </div>

          {/* Currency & Timezone Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">{t('settings.orgCurrency')}</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent cursor-pointer"
              >
                <option value="TOMAN" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">{t('settings.currencyToman')}</option>
                <option value="IRR" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">{t('settings.currencyRial')}</option>
                <option value="USD" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">{t('settings.currencyUsd')}</option>
                <option value="EUR" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">{t('settings.currencyEur')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">{t('settings.mainTimezone')}</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent cursor-pointer font-mono text-[11px]"
              >
                <option value="Asia/Tehran" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">Asia/Tehran</option>
                <option value="UTC" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">UTC</option>
                <option value="Asia/Dubai" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">Asia/Dubai</option>
                <option value="Europe/Istanbul" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">Europe/Istanbul</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              icon={<Plus className="w-4 h-4" />}
              className="text-xs font-bold"
            >
              {t('settings.createAndActivateOrg')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
