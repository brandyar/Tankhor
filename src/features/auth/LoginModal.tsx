import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
  Lock,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  User as UserIcon,
  Building2,
  Boxes,
  Warehouse,
  ChevronRight,
  ChevronLeft,
  Coins,
  Sparkles,
} from 'lucide-react';

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
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);

  // Step 1: User Account Credentials
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Organization & Initial Tenant Seed
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [currency, setCurrency] = useState('TOMAN');
  const [initialCategoryName, setInitialCategoryName] = useState('پوشاک و لباس زنانه/مردانه');
  const [initialWarehouseName, setInitialWarehouseName] = useState('انبار مرکزی فروشگاه');

  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setFormValidationError('لطفاً تمامی فیلدهای الزامی مشخصات فردی را تکمیل کنید.');
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

    // Auto-generate suggested organization name if not set
    if (!orgName) {
      setOrgName(`فروشگاه ${firstName.trim()} ${lastName.trim()}`);
    }
    setRegisterStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    if (activeTab === 'login') {
      if (!email || !password) return;
      await login(email, password);
    } else {
      if (!orgName.trim()) {
        setFormValidationError('لطفاً نام سازمان / فروشگاه خود را وارد کنید.');
        return;
      }
      await register({
        firstName,
        lastName,
        email,
        pass: password,
        orgName: orgName.trim(),
        orgSlug: orgSlug.trim() || undefined,
        currency,
        initialCategoryName: initialCategoryName.trim(),
        initialWarehouseName: initialWarehouseName.trim(),
      });
    }
  };

  if (!isLoginModalOpen) return null;

  const activeError = formValidationError || loginError;

  return (
    <Modal
      isOpen={isLoginModalOpen}
      onClose={closeLoginModal}
      title={
        activeTab === 'login'
          ? 'ورود به حساب کاربری'
          : registerStep === 1
          ? 'ثبت‌نام (مرحله ۱ از ۲: اطلاعات حساب)'
          : 'راه‌اندازی فروشگاه (مرحله ۲ از ۲: مشخصات سازمان)'
      }
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-neutral-900 pt-1">
        {/* Top Feature Banner */}
        <div className="p-3 bg-neutral-900 text-white rounded-xl flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-white shrink-0 border border-neutral-700/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-xs">سامانه امنیتی و چندمستأجری تن‌خور</p>
              <p className="text-[10px] text-neutral-400 font-mono">Multi-Tenant Cloud Gateway</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            {isCloudAuthenticated ? 'متصل' : 'آماده فعال‌سازی'}
          </span>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex rounded-xl bg-neutral-100 p-1 border border-neutral-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setRegisterStep(1);
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
              setRegisterStep(1);
              setFormValidationError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'register'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            ثبت‌نام و افتتاح فروشگاه
          </button>
        </div>

        {/* Step Indicator when Registering */}
        {activeTab === 'register' && (
          <div className="flex items-center justify-between bg-neutral-50 p-2 rounded-xl border border-neutral-200 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  registerStep === 1
                    ? 'bg-neutral-900 text-white'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                ۱
              </span>
              <span className={registerStep === 1 ? 'font-bold text-neutral-900' : 'text-neutral-500'}>
                حساب کاربری
              </span>
            </div>
            <div className="w-10 h-[1px] bg-neutral-300" />
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  registerStep === 2
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                ۲
              </span>
              <span className={registerStep === 2 ? 'font-bold text-neutral-900' : 'text-neutral-500'}>
                اطلاعات سازمان و انبار اولیه
              </span>
            </div>
          </div>
        )}

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

        {/* LOGIN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleSubmit} className="space-y-3">
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
                  placeholder="آدرس ایمیل..."
                  className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>

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
                  placeholder="کلمه عبور..."
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

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center py-2 text-xs font-bold"
                disabled={isLoading}
              >
                {isLoading ? 'در حال ورود به سامانه...' : 'ورود به پنل مدیریت'}
              </Button>
            </div>
          </form>
        )}

        {/* REGISTER FORM - STEP 1 (Credentials) */}
        {activeTab === 'register' && registerStep === 1 && (
          <form onSubmit={handleNextStep} className="space-y-3">
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
                  placeholder="آدرس ایمیل..."
                  className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
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
                    placeholder="حداقل ۶ کاراکتر"
                    className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>

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
                    placeholder="تکرار رمز عبور"
                    className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center py-2 text-xs font-bold flex items-center gap-2"
              >
                <span>مرحله بعد: تنظیم مشخصات سازمان</span>
                <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              </Button>
            </div>
          </form>
        )}

        {/* REGISTER FORM - STEP 2 (Organization & Starter Items) */}
        {activeTab === 'register' && registerStep === 2 && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 text-xs">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>تنظیمات اولیه مستأجر (Organization Setup)</span>
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                با ثبت این اطلاعات، سازمان اختصاصی شما همراه با اولین دسته‌بندی و انبار مرکزی برای آغاز به کار ساخته خواهد شد.
              </p>
            </div>

            {/* Organization Name */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                نام برند / سازمان / فروشگاه <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-neutral-400">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="مثال: بوتیک تن‌پوش شیراز"
                  className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>

            {/* Slug & Currency */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  شناسه انگلیسی (Slug)
                </label>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  placeholder="مثال: tanpoosh-boutique"
                  className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  واحد پولی پیش‌فرض
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-neutral-400">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 cursor-pointer"
                  >
                    <option value="TOMAN">تومان (TOMAN)</option>
                    <option value="IRR">ریال (IRR)</option>
                    <option value="USD">دلار (USD)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Starter Items */}
            <div className="border-t border-neutral-200/80 pt-2.5 space-y-2.5">
              <p className="text-[11px] font-bold text-neutral-600">اقلام اولیه برای شروع سریع:</p>
              
              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                  عنوان دسته‌بندی اولیه محصولات:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-neutral-400">
                    <Boxes className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={initialCategoryName}
                    onChange={(e) => setInitialCategoryName(e.target.value)}
                    placeholder="نام دسته‌بندی اولیه..."
                    className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                  عنوان انبار پیش‌فرض:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-neutral-400">
                    <Warehouse className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={initialWarehouseName}
                    onChange={(e) => setInitialWarehouseName(e.target.value)}
                    placeholder="نام انبار..."
                    className="w-full ps-8 pe-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Step 2 Form Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegisterStep(1)}
                className="py-2 text-xs"
              >
                بازگشت
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1 justify-center py-2 text-xs font-bold"
                disabled={isLoading}
              >
                {isLoading ? 'در حال ساخت سازمان و آماده‌سازی پنل...' : 'تکمیل ثبت‌نام و ورود به پنل'}
              </Button>
            </div>
          </form>
        )}

        {/* Footer info */}
        <div className="text-center pt-2 border-t border-neutral-100">
          <p className="text-[10px] font-mono text-neutral-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>تفکیک ایزوله داده‌ها در سطح سازمان (Multi-Tenant Architecture)</span>
          </p>
        </div>
      </div>
    </Modal>
  );
};
