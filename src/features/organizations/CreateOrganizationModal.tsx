import React, { useState } from 'react';
import { useOrganization } from '../../context/OrganizationContext';
import { Button } from '../../components/ui/Button';
import { Building2, X, Plus, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

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
      setError('وارد کردن نام سازمان الزامی است.');
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
      setError(err?.message || 'خطا در ایجاد سازمان جدید. لطفاً مجدداً تلاش کنید.');
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
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200/90 overflow-hidden flex flex-col animate-scale-up"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">ایجاد سازمان / فروشگاه جدید</h2>
              <p className="text-[11px] text-neutral-500">تعریف یک فضای کاری مستقل برای مدیریت محصولات و انبار</p>
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
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Org Name */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              نام سازمان یا فروشگاه <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  // Auto suggest simple transliterated or ascii slug
                }
              }}
              placeholder="مثال: شعبه مرکزی تن‌خور، پوشاک آسمان..."
              className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              شناسه یکتا (Slug) <span className="text-neutral-400 font-normal">(اختیاری)</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="مثال: boutique-shikpooshan"
              dir="ltr"
              className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 font-mono placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all text-start"
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              در صورت خالی بودن، شناسه یکتا به صورت خودکار ایجاد می‌گردد.
            </p>
          </div>

          {/* Currency & Timezone Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">واحد پول اصلی</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent cursor-pointer"
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
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent cursor-pointer font-mono text-[11px]"
              >
                <option value="Asia/Tehran">Asia/Tehran (تهران)</option>
                <option value="UTC">UTC (جهانی)</option>
                <option value="Asia/Dubai">Asia/Dubai (دبی)</option>
                <option value="Europe/Istanbul">Europe/Istanbul (استانبول)</option>
              </select>
            </div>
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
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              icon={<Plus className="w-4 h-4" />}
              className="text-xs font-bold"
            >
              ایجاد و فعال‌سازی سازمان
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
