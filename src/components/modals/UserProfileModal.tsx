import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ImageUpload } from '../ui/ImageUpload';
import {
  User,
  Key,
  Shield,
  CheckCircle2,
  AlertCircle,
  Mail,
  Briefcase,
  Lock,
  Eye,
  EyeOff,
  Cloud,
  HardDrive,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { t, isPersian } = useTranslation();
  const { user, isCloudAuthenticated, updateUserProfile } = useAuth();
  const { userRole } = useOrganization();

  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  // Security / Password Fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Status State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setTitle(user.title || '');
      setAvatar(user.avatar || null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setActiveTab('profile');
    }
  }, [isOpen, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (activeTab === 'security') {
      if (!newPassword || newPassword.length < 6) {
        setErrorMsg(t('auth.passTooShort', 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.'));
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg(t('auth.passwordsDoNotMatch', 'رمز عبور جدید با تکرار آن یکسان نیست.'));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'profile') {
        const res = await updateUserProfile({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          title: title.trim(),
          avatar: avatar || undefined,
        });

        if (res.success) {
          setSuccessMsg(t('auth.profileUpdatedSuccess', 'مشخصات حساب با موفقیت ذخیره شد.'));
          setTimeout(() => {
            setSuccessMsg(null);
          }, 4000);
        } else {
          setErrorMsg(res.error || t('common.unknownError', 'خطا در بروزرسانی مشخصات'));
        }
      } else {
        // Changing Password
        const res = await updateUserProfile({
          password: newPassword,
          current_password: currentPassword || undefined,
        });

        if (res.success) {
          setSuccessMsg(t('auth.passwordChangedSuccess', 'رمز عبور با موفقیت تغییر کرد.'));
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setTimeout(() => {
            setSuccessMsg(null);
          }, 4000);
        } else {
          setErrorMsg(res.error || t('common.unknownError', 'خطا در تغییر رمز عبور'));
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t('common.unknownError', 'خطا در انجام عملیات'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-neutral-100">
          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>{t('auth.userProfileTitle', 'پروفایل و مشخصات کاربر')}</span>
        </div>
      }
      maxWidth="lg"
      zIndex="z-[100002]"
    >
      <div className="space-y-4">
        {/* User Hero Identity Card */}
        <div className="flex items-center justify-between gap-3.5 p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
              {avatar ? (
                <img src={avatar} alt="User Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.first_name ? user.first_name[0] : 'T'
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                {user?.first_name || ''} {user?.last_name || ''}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate dir-ltr text-start">
                {user?.email || '-'}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant={isCloudAuthenticated ? 'info' : 'neutral'}>
              {isCloudAuthenticated ? (
                <span className="flex items-center gap-1">
                  <Cloud className="w-3 h-3" />
                  <span>{t('common.cloudSynced', 'حساب آنلاین')}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span>{t('common.localOffline', 'آفلاین')}</span>
                </span>
              )}
            </Badge>
            {userRole && (
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                نقش: <strong className="text-neutral-800 dark:text-neutral-200">{userRole}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t('auth.tabProfileInfo', 'اطلاعات فردی')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('security');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{t('auth.tabSecurityPass', 'تغییر رمز عبور')}</span>
          </button>
        </div>

        {/* Notification Alerts */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
          {activeTab === 'profile' ? (
            /* TAB 1: Profile Info */
            <div className="space-y-3.5 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t('auth.firstName', 'نام')}
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="مثال: علی"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t('auth.lastName', 'نام خانوادگی')}
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="مثال: محمدی"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t('auth.jobTitle', 'سمت یا عنوان شغلی')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="مدیر فروشگاه، حسابدار، انباردار..."
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 ps-9"
                    />
                    <Briefcase className="w-4 h-4 text-neutral-400 absolute start-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t('auth.email', 'پست الکترونیکی')}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-500 dark:text-neutral-400 font-mono ps-9 cursor-not-allowed"
                    />
                    <Mail className="w-4 h-4 text-neutral-400 absolute start-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Avatar Image Upload */}
              <div>
                <ImageUpload
                  mode="avatar"
                  label={t('auth.avatarLabel', 'تصویر نمایه / آواتار')}
                  subtitle={t('auth.avatarSubtitle', 'تصویر شخصی شما در نوار بالایی و بخش مدیریت اعضا نمایش داده می‌شود.')}
                  value={avatar}
                  onChange={(val) => setAvatar(val)}
                  helperText={t('auth.avatarHelper', 'فرمت‌های PNG، JPG، WEBP (حداکثر حجم: ۲ مگابایت)')}
                  maxSizeInMB={2}
                />
              </div>
            </div>
          ) : (
            /* TAB 2: Security & Password */
            <div className="space-y-3.5 animate-fade-in">
              {isCloudAuthenticated && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t('auth.currentPassword', 'رمز عبور فعلی')}
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 ps-9 pe-9"
                    />
                    <Lock className="w-4 h-4 text-neutral-400 absolute start-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute end-3 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t('auth.newPassword', 'رمز عبور جدید')}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="حداقل ۶ کاراکتر"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 ps-9 pe-9"
                    />
                    <Key className="w-4 h-4 text-neutral-400 absolute start-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute end-3 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t('auth.confirmNewPassword', 'تکرار رمز عبور جدید')}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 ps-9"
                    />
                    <Key className="w-4 h-4 text-neutral-400 absolute start-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1">
                <p className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  <span>{t('auth.passwordHintTitle', 'نکات امنیتی رمز عبور:')}</span>
                </p>
                <p>• حداقل از ۶ کاراکتر شامل حروف و اعداد استفاده کنید.</p>
                <p>• رمز عبور در پایگاه داده سرور ابری به‌صورت هش رمزنگاری شده ذخیره می‌گردد.</p>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              {t('common.cancel', 'انصراف')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
            >
              {isSubmitting ? t('common.saving', 'در حال ذخیره...') : t('common.saveChanges', 'ذخیره تغییرات')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
