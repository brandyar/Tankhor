import React, { useState, useEffect } from 'react';
import { Organization } from '../../types';
import { useOrganization } from '../../context/OrganizationContext';
import { Button } from '../../components/ui/Button';
import { Building2, X, Save, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

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
  const { updateActiveOrganization, isOwner } = useOrganization();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [currency, setCurrency] = useState('TOMAN');
  const [timezone, setTimezone] = useState('Asia/Tehran');
  const [status, setStatus] = useState<string>('active');
  const [plan, setPlan] = useState<string>('free');
  const [logo, setLogo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      setSlug(organization.slug || '');
      setCurrency(organization.currency || 'TOMAN');
      setTimezone(organization.timezone || 'Asia/Tehran');
      setStatus(organization.status || 'active');
      setPlan(organization.plan || 'free');
      setLogo(organization.logo || '');
      setError(null);
      setSuccessMsg(null);
    }
  }, [organization, isOpen]);

  if (!isOpen || !organization) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setError('شما دسترسی لازم برای ویرایش اطلاعات این سازمان را ندارید (فقط مالک سازمان مجاز است).');
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      setError('وارد کردن نام سازمان الزامی است.');
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
        status: status as any,
        plan: plan as any,
        logo: logo.trim() || null,
      });

      setSuccessMsg('اطلاعات سازمان با موفقیت به‌روزرسانی شد.');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'خطا در ذخیره تغییرات سازمان.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="edit-org-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        id="edit-org-modal-card"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200/90 overflow-hidden flex flex-col animate-scale-up"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">ویرایش مشخصات سازمان</h2>
              <p className="text-[11px] text-neutral-500">شناسه سازمان: #{organization.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isOwner && (
            <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>ویرایش مشخصات سازمان منحصراً توسط مالک (Owner) سازمان امکان‌پذیر است.</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Org Name & Slug Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                نام سازمان یا فروشگاه <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isOwner || isSubmitting}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="نام سازمان..."
                className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                شناسه یکتا (Slug)
              </label>
              <input
                type="text"
                disabled={!isOwner || isSubmitting}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="slug-name"
                dir="ltr"
                className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed transition-all text-start"
              />
            </div>
          </div>

          {/* Currency & Timezone Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">واحد پول اصلی</label>
              <select
                disabled={!isOwner || isSubmitting}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="TOMAN">تومان (TOMAN)</option>
                <option value="IRR">ریال (IRR)</option>
                <option value="USD">دلار (USD)</option>
                <option value="EUR">یورو (EUR)</option>
                <option value="AED">درهم (AED)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">منطقه زمانی</label>
              <select
                disabled={!isOwner || isSubmitting}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="Asia/Tehran">Asia/Tehran (تهران)</option>
                <option value="UTC">UTC (جهانی)</option>
                <option value="Asia/Dubai">Asia/Dubai (دبی)</option>
                <option value="Europe/Istanbul">Europe/Istanbul (استانبول)</option>
              </select>
            </div>
          </div>

          {/* Plan & Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">نوع اشتراک (Plan)</label>
              <select
                disabled={!isOwner || isSubmitting}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="free">رایگان (Free)</option>
                <option value="pro">حرفه‌ای (Pro)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">وضعیت سازمان</label>
              <select
                disabled={!isOwner || isSubmitting}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="active">فعال (Active)</option>
                <option value="draft">پیش‌نویس (Draft)</option>
                <option value="archived">بایگانی شده (Archived)</option>
              </select>
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              آدرس لوگو یا نشان تجاری <span className="text-neutral-400 font-normal">(اختیاری)</span>
            </label>
            <input
              type="text"
              disabled={!isOwner || isSubmitting}
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://example.com/logo.png"
              dir="ltr"
              className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 font-mono placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed transition-all text-start"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              انصراف
            </Button>
            {isOwner && (
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                icon={<Save className="w-4 h-4" />}
                className="text-xs font-bold bg-blue-600 hover:bg-blue-700"
              >
                ذخیره تغییرات سازمان
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
