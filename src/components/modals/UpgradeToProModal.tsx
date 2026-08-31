import React, { useState } from 'react';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Button } from '../ui/Button';
import {
  Sparkles,
  Cloud,
  CheckCircle2,
  X,
  Zap,
  ShieldCheck,
  Users,
  Smartphone,
  Server,
  ArrowRight,
  Monitor,
} from 'lucide-react';

interface UpgradeToProModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const UpgradeToProModal: React.FC<UpgradeToProModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeOrganization, updateActiveOrganization, isOwner } = useOrganization();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstantUpgrade = async () => {
    if (!activeOrganization) return;
    setIsUpgrading(true);
    setError(null);
    try {
      await updateActiveOrganization({
        plan: 'pro',
      });
      // Enable cloud sync automatically upon upgrade
      storageManager.setMode('cloud_synced');
      setSuccess(true);
      setTimeout(() => {
        setIsUpgrading(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'خطا در ارتقای پلن به Pro. لطفاً مجدداً تلاش کنید.');
      setIsUpgrading(false);
    }
  };

  return (
    <div
      id="upgrade-pro-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUpgrading) onClose();
      }}
    >
      <div
        id="upgrade-pro-modal-card"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col animate-scale-up"
      >
        {/* Header Ribbon */}
        <div className="relative bg-gradient-to-r from-neutral-900 via-neutral-800 to-blue-900 text-white p-6 pb-7">
          <button
            onClick={onClose}
            disabled={isUpgrading}
            className="absolute top-4 end-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-neutral-950 flex items-center justify-center font-black shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold tracking-wide uppercase text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              ویژه نسخه حرفه‌ای (Pro)
            </span>
          </div>

          <h2 className="text-lg font-black tracking-tight text-white mt-1">
            فعال‌سازی همگام‌سازی ابری و دسترسی چندکاربره
          </h2>
          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
            امکان اتصال به سرور ابری و همگام‌سازی اطلاعات بین شعب، منحصراً در پلن <strong className="text-white">Pro</strong> در دسترس است.
          </p>
        </div>

        {/* Pro Benefits List */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>سازمان شما با موفقیت به پلن Pro ارتقا یافت و همگام‌سازی ابری فعال شد!</span>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-900 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span>امکانات و مزایای پلن حرفه‌ای تن‌خور:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200/70">
                <Cloud className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-neutral-900">همگام‌سازی آنی ابری</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">همگام شدن محصولات و فاکتورها بین تمام شعب</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200/70">
                <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-neutral-900">دسترسی نامحدود وب</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">استفاده از طریق مرورگر، موبایل و تبلت</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200/70">
                <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-neutral-900">کاربران نامحدود</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">تعریف انباردار، صندوق‌دار و مدیر با دسترسی مجزا</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200/70">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-neutral-900">پشتیبان‌گیری ابری</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">پشتیبان‌گیری خودکار روزانه روی سرور امن</p>
                </div>
              </div>
            </div>
          </div>

          {/* Offline reminder */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-700 shrink-0" />
              <div className="text-xs text-blue-900">
                <span className="font-bold">استفاده آفلاین رایگان در دسکتاپ:</span>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  پلن رایگان (Free) روی نسخه دسکتاپ تن‌خور با پایگاه داده پرسرعت SQLite همیشه رایگان است.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUpgrading}
              className="text-xs"
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleInstantUpgrade}
              isLoading={isUpgrading}
              icon={<Sparkles className="w-4 h-4 text-amber-300" />}
              className="text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md cursor-pointer"
            >
              ارتقا آنی به پلن Pro
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
