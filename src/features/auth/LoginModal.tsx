import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Lock, Mail, ShieldCheck, Eye, EyeOff, AlertCircle, User as UserIcon } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    closeLoginModal,
    login,
    register,
    loginError,
    isLoading,
    isCloudAuthenticated,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    if (activeTab === 'login') {
      if (!email || !password) return;
      await login(email, password);
    } else {
      if (!firstName || !lastName || !email || !password) {
        setFormValidationError('لطفاً تمامی فیلدهای الزامی را تکمیل کنید.');
        return;
      }
      if (password.length < 6) {
        setFormValidationError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
        return;
      }
      if (password !== confirmPassword) {
        setFormValidationError('کلمه عبور و تکرار آن یکسان نیستند.');
        return;
      }
      await register(firstName, lastName, email, password);
    }
  };

  if (!isLoginModalOpen) return null;

  const activeError = formValidationError || loginError;

  return (
    <Modal
      isOpen={isLoginModalOpen}
      onClose={closeLoginModal}
      title={activeTab === 'login' ? 'ورود به حساب کاربری' : 'ثبت‌نام کاربر جدید'}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-neutral-900 pt-1">
        {/* Top Feature Banner */}
        <div className="p-3 bg-neutral-900 text-white rounded-xl flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-white shrink-0 border border-neutral-700/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-xs">سامانه احراز هویت تن‌خور</p>
              <p className="text-[10px] text-neutral-400 font-mono">TANKHOR Authentication</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            {isCloudAuthenticated ? 'متصل' : 'آماده کاربر'}
          </span>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex rounded-xl bg-neutral-100 p-1 border border-neutral-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setFormValidationError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'login'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            ورود به حساب
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setFormValidationError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'register'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            ثبت‌نام کاربر جدید
          </button>
        </div>

        {/* Error Alert */}
        {activeError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200/90 text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">خطا در عملیات</p>
              <p className="text-[11px] text-red-600 mt-0.5 leading-relaxed">{activeError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Extra Fields for Registration */}
          {activeTab === 'register' && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  نام <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-neutral-400">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="نام..."
                    className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  نام خانوادگی <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="نام خانوادگی..."
                  className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              پست الکترونیک (ایمیل) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-neutral-400">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="آدرس ایمیل کاربر..."
                className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              رمز عبور <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-neutral-400">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="کلمه عبور اختصاصی..."
                className="w-full ps-8 pe-9 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password for Register */}
          {activeTab === 'register' && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                تکرار رمز عبور <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="تکرار رمز عبور..."
                  className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-2 text-xs font-bold"
              disabled={isLoading}
            >
              {isLoading
                ? 'در حال پردازش...'
                : activeTab === 'login'
                ? 'ورود به حساب کاربری'
                : 'ثبت‌نام و ایجاد حساب کاربری'}
            </Button>
          </div>
        </form>

        {/* Footer info */}
        <div className="text-center pt-2 border-t border-neutral-100">
          <p className="text-[10px] font-mono text-neutral-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>احراز هویت و ثبت‌نام امن سامانه مدیریت پوشاک تن‌خور</span>
          </p>
        </div>
      </div>
    </Modal>
  );
};
