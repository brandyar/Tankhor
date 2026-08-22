import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Lock, Mail, ShieldCheck, Eye, EyeOff, AlertCircle, Shirt, User as UserIcon } from 'lucide-react';

interface LoginViewProps {
  onSuccess?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const {
    login,
    register,
    loginError,
    isLoading,
    isCloudAuthenticated,
    user,
    logout,
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
      const ok = await login(email, password);
      if (ok && onSuccess) {
        onSuccess();
      }
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
      const ok = await register(firstName, lastName, email, password);
      if (ok && onSuccess) {
        onSuccess();
      }
    }
  };

  const activeError = formValidationError || loginError;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-900 text-white shadow-md">
            <Shirt className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight">پلتفرم مدیریت پوشاک تن‌خور</h1>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
            سامانه مدیریت پوشاک، راهنمای سایز اختصاصی و انبارداری
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5">
          {/* Current status if authenticated */}
          {user ? (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200/80 space-y-3 text-start">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  حساب کاربری فعال است
                </span>
                <span className="text-[10px] font-mono bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                  {isCloudAuthenticated ? 'ابری متصل' : 'کاربر فعال'}
                </span>
              </div>
              <div className="text-xs text-neutral-700 space-y-1 font-mono">
                <p>کاربر: <strong className="text-neutral-900">{user.first_name} {user.last_name}</strong></p>
                <p>ایمیل: <strong className="text-neutral-900">{user.email}</strong></p>
                <p>نقش: <strong className="text-neutral-900">{typeof user.role === 'object' ? user.role?.name : user.role || 'کاربر سیستم'}</strong></p>
              </div>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout()}
                  className="w-full justify-center text-xs font-bold text-red-600 hover:bg-red-50 border-red-200"
                >
                  خروج از حساب
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab selector */}
              <div className="flex rounded-xl bg-neutral-100 p-1 border border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setFormValidationError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
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
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'register'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  ثبت‌نام کاربر جدید
                </button>
              </div>

              {activeError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200/90 text-red-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">خطا در احراز هویت</p>
                    <p className="text-[11px] text-red-600 mt-0.5 leading-relaxed">{activeError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-start">
                {/* Extra Fields for Registration */}
                {activeTab === 'register' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">
                        نام <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-neutral-400">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="نام..."
                          className="w-full ps-9 pe-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
                        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
                    <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-neutral-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ایمیل حساب کاربری..."
                      className="w-full ps-9 pe-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    کلمه عبور <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-neutral-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="رمز عبور..."
                      className="w-full ps-9 pe-10 py-2.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 end-0 pe-3 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field for Register */}
                {activeTab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      تکرار کلمه عبور <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-neutral-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="تکرار رمز عبور..."
                        className="w-full ps-9 pe-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full justify-center py-2.5 text-xs font-bold"
                    disabled={isLoading}
                  >
                    {isLoading
                      ? 'در حال پردازش...'
                      : activeTab === 'login'
                      ? 'ورود به سامانه'
                      : 'ثبت‌نام و ورود به سامانه'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] font-mono text-neutral-400">
          TANKHOR Platform · All Rights Reserved
        </p>
      </div>
    </div>
  );
};
