import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { Organization } from '../../types';
import { useOrganization } from '../../context/OrganizationContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { Save, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface EditOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization | null;
  onSuccess?: () => void;
}

export const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({
  isOpen,
  onClose,
  organization,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { updateActiveOrganization, isOwner } = useOrganization();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [currency, setCurrency] = useState('TOMAN');
  const [timezone, setTimezone] = useState('Asia/Tehran');
  const [logo, setLogo] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      setSlug(organization.slug || '');
      setCurrency(organization.currency || 'TOMAN');
      setTimezone(organization.timezone || 'Asia/Tehran');
      setLogo(organization.logo || '');
      setPhone(organization.phone || '');
      setMobile(organization.mobile || '');
      setAddress(organization.address || '');
      setError(null);
      setSuccessMsg(null);
    }
  }, [organization, isOpen]);

  if (!isOpen || !organization) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setError(t('settings.ownerOnlyEdit'));
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      setError(t('settings.orgNameRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await updateActiveOrganization({
        name: cleanName,
        slug: slug.trim() || organization.slug,
        currency,
        timezone,
        status: organization.status,
        plan: organization.plan,
        logo: logo ? logo.trim() : null,
        phone: phone ? phone.trim() : null,
        mobile: mobile ? mobile.trim() : null,
        address: address ? address.trim() : null,
      });

      setSuccessMsg(t('settings.editOrgSuccess'));
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 700);
    } catch (err: any) {
      setError(err?.message || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.editOrgTitle')}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {!isOwner && (
          <div className="flex items-center gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-xs rounded-xl">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{t('settings.ownerOnlyEdit')}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Org Name & Slug Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('settings.orgName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!isOwner || isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.orgName')}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent disabled:bg-neutral-100 dark:disabled:bg-neutral-900/60 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:cursor-not-allowed transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('settings.orgSlug')}
            </label>
            <input
              type="text"
              disabled={!isOwner || isSubmitting}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug-name"
              dir="ltr"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent disabled:bg-neutral-100 dark:disabled:bg-neutral-900/60 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:cursor-not-allowed transition-all text-start"
            />
          </div>
        </div>

        {/* Currency & Timezone Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">{t('settings.orgCurrency')}</label>
            <select
              disabled={!isOwner || isSubmitting}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent disabled:bg-neutral-100 dark:disabled:bg-neutral-900/60 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:cursor-not-allowed cursor-pointer"
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
              disabled={!isOwner || isSubmitting}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent disabled:bg-neutral-100 dark:disabled:bg-neutral-900/60 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value="Asia/Tehran" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">Asia/Tehran</option>
              <option value="UTC" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">UTC</option>
              <option value="Asia/Dubai" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">Asia/Dubai</option>
              <option value="Europe/Istanbul" className="bg-white dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100">Europe/Istanbul</option>
            </select>
          </div>
        </div>

        {/* Official Organization Logo Upload */}
        <div>
          <ImageUpload
            mode="avatar"
            label={t('settings.orgLogoLabel', 'لوگوی رسمی سازمان و فروشگاه')}
            subtitle={t('settings.orgLogoSubtitle', 'این لوگو در سربرگ فاکتورهای فروش، چاپ فیش حرارتی، برچسب بارکد و نوار نرم‌افزار نمایش داده می‌شود.')}
            value={logo}
            onChange={(val) => setLogo(val)}
            helperText={t('settings.orgLogoHelper', 'فرمت‌های مجاز: PNG، JPG، WEBP یا SVG (حداکثر حجم فایل: ۵ مگابایت)')}
            maxSizeInMB={5}
            disabled={!isOwner || isSubmitting}
          />
        </div>

        {/* Contact Numbers (Phone & Mobile) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('settings.orgPhone', 'تلفن ثابت سازمان')}
            </label>
            <input
              type="text"
              disabled={!isOwner || isSubmitting}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="۰۲۱-۸۸۸۸۸۸۸۸"
              dir="ltr"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent disabled:bg-neutral-100 dark:disabled:bg-neutral-900/60 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:cursor-not-allowed transition-all text-start"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('settings.orgMobile', 'شماره همراه سازمان')}
            </label>
            <input
              type="text"
              disabled={!isOwner || isSubmitting}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              dir="ltr"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent disabled:bg-neutral-100 dark:disabled:bg-neutral-900/60 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:cursor-not-allowed transition-all text-start"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
            {t('settings.orgAddress', 'نشانی و آدرس سازمان')}
          </label>
          <textarea
            rows={2}
            disabled={!isOwner || isSubmitting}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('settings.orgAddressPlaceholder', 'استان، شهر، خیابان، پلاک، واحد (در سربرگ فاکتور نمایش داده می‌شود)')}
            className="w-full px-3.5 py-2 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-400 focus:border-transparent disabled:bg-neutral-100 dark:disabled:bg-neutral-900/60 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:cursor-not-allowed transition-all resize-none"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            {t('common.cancel')}
          </Button>
          {isOwner && (
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              icon={<Save className="w-4 h-4" />}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700"
            >
              {t('settings.saveOrgChanges')}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
};
