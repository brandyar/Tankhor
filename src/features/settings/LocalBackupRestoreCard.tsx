import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { BackupManager, InspectionResult, BackupCollectionKey } from '../../storage/backupManager';
import { toPersianDigits, formatDate } from '../../utils/formatters';
import {
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Package,
  Layers,
  ShoppingBag,
  Warehouse,
  Ruler,
  Users,
  HardDriveDownload,
  HardDriveUpload,
  Info,
} from 'lucide-react';

export const LocalBackupRestoreCard: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization, refreshOrganizations } = useOrganization();

  // Local storage statistics
  const [stats, setStats] = useState<Record<string, number>>({});
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('tankhor_last_backup_at');
  });

  // Modal & Notification states
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);

  // File Inspection & Restore Modal
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [inspectedData, setInspectedData] = useState<InspectionResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');

  // Clear data confirm modal
  const [clearConfirmModalOpen, setClearConfirmModalOpen] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = () => {
    const s = BackupManager.getLocalStats(activeOrganization?.id);
    setStats(s);
  };

  useEffect(() => {
    loadStats();
    const handleDataRestored = () => {
      loadStats();
    };
    window.addEventListener('tankhor_data_restored', handleDataRestored);
    return () => {
      window.removeEventListener('tankhor_data_restored', handleDataRestored);
    };
  }, [activeOrganization?.id]);

  // Handle Full JSON Backup Export
  const handleExportBackup = () => {
    setIsExporting(true);
    try {
      BackupManager.exportBackupFile(activeOrganization);
      const now = new Date().toISOString();
      localStorage.setItem(`tankhor_last_backup_${activeOrganization?.id || 'default'}`, now);
      setLastBackupTime(now);
      setFeedback({
        type: 'success',
        message: `فایل پشتیبان سازمان "${activeOrganization?.name || 'فعلی'}" با موفقیت دانلود شد. این فایل را در مکانی امن نگهداری کنید.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `خطا در تهیه فایل پشتیبان: ${err.message}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle CSV Spreadsheet Exports
  const handleExportCsv = (collection: BackupCollectionKey, label: string) => {
    try {
      BackupManager.exportToCsv(collection, activeOrganization?.id);
      setFeedback({
        type: 'success',
        message: `خروجی اکسل ${label} با موفقیت دانلود شد.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `خطا در دانلود خروجی اکسل: ${err.message}`,
      });
    }
  };

  // Handle File Input Change (Upload Backup)
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = BackupManager.inspectBackupFile(content);
      if (!result.valid) {
        setFeedback({
          type: 'error',
          message: result.error || 'فایل نامعتبر است.',
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setInspectedData(result);
      setInspectionModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Confirm and Execute Restore
  const handleExecuteRestore = async () => {
    if (!inspectedData || !inspectedData.data) return;
    setIsRestoring(true);
    try {
      const res = await BackupManager.restoreBackup(inspectedData.data, restoreMode, activeOrganization?.id);
      if (res.success) {
        setInspectionModalOpen(false);
        setInspectedData(null);
        await refreshOrganizations();
        setFeedback({
          type: 'success',
          message: `اطلاعات با موفقیت بازیابی شد (${toPersianDigits(res.restoredCount)} رکورد بازگردانی شد).`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'خطا در بازیابی اطلاعات',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `خطا در بازگردانی داده‌ها: ${err.message}`,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Seed Demo Data
  const handleSeedDemo = async () => {
    setIsSeedingDemo(true);
    try {
      const res = await BackupManager.seedFashionDemoData(activeOrganization?.id || 1);
      if (res.success) {
        await refreshOrganizations();
        setFeedback({
          type: 'success',
          message: res.message,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `خطا: ${err.message}`,
      });
    } finally {
      setIsSeedingDemo(false);
    }
  };

  // Handle Clear Local Data
  const handleClearData = async () => {
    try {
      const res = await BackupManager.clearLocalData(true, activeOrganization?.id);
      if (res.success) {
        setClearConfirmModalOpen(false);
        await refreshOrganizations();
        setFeedback({
          type: 'success',
          message: res.message,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `خطا در پاکسازی: ${err.message}`,
      });
    }
  };

  const totalProducts = (stats.products || 0);
  const totalVariants = (stats.product_variants || 0);
  const totalOrders = (stats.orders || 0);
  const totalWarehouses = (stats.warehouses || 0);
  const totalSizeGuides = (stats.size_guide_templates || 0);
  const totalCustomers = (stats.customers || 0);

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-xs font-medium animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {feedback.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
          {feedback.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p>{feedback.message}</p>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-neutral-400 hover:text-neutral-600 text-xs px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Backup & Restore Card */}
      <Card
        title="پشتیبان‌گیری و بازیابی پایگاه داده محلی"
        subtitle="حفاظت از اطلاعات کسب‌وکار، انتقال به سایر سیستم‌ها و بازیابی فوری بدون وابستگی به اینترنت"
      >
        <div className="space-y-6">
          {/* Current Local Database Metrics */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                آمار رکوردهای ذخیره شده در سیستم محلی
              </span>
              {lastBackupTime && (
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                  آخرین نسخه پشتیبان: {formatDate(lastBackupTime, true)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/60 rounded-xl">
                <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px]">
                  <Package className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                  محصولات
                </div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {toPersianDigits(totalProducts)}
                </div>
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/60 rounded-xl">
                <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px]">
                  <Layers className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                  تنوع کالاها
                </div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {toPersianDigits(totalVariants)}
                </div>
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/60 rounded-xl">
                <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px]">
                  <ShoppingBag className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                  فاکتورها
                </div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {toPersianDigits(totalOrders)}
                </div>
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/60 rounded-xl">
                <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px]">
                  <Warehouse className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                  انبارها
                </div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {toPersianDigits(totalWarehouses)}
                </div>
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/60 rounded-xl">
                <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px]">
                  <Ruler className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                  راهنمای سایز
                </div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {toPersianDigits(totalSizeGuides)}
                </div>
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/60 rounded-xl">
                <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px]">
                  <Users className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                  مشتریان
                </div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {toPersianDigits(totalCustomers)}
                </div>
              </div>
            </div>
          </div>

          {/* Action Boxes: Export vs Restore */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* Box 1: Export Backup */}
            <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#14161d] flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    <HardDriveDownload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">تهیه فایل پشتیبان (Backup)</h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">خروجی کامل از تمام بخش‌ها در یک فایل با فرمت JSON</p>
                  </div>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mt-2">
                  با فشردن دکمه زیر، یک فایل جامع شامل تمام اطلاعات محصولات، موجودی، فاکتورها و قالب‌های سایز دانلود می‌شود. می‌توانید این فایل را روی فلش‌مموری، سیستم دیگر یا فضای ابری شخصی خود ذخیره کنید.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <Button
                  variant="primary"
                  onClick={handleExportBackup}
                  isLoading={isExporting}
                  icon={<Download className="w-4 h-4" />}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold text-xs py-2.5"
                >
                  دانلود فایل پشتیبان کامل دیتابیس (JSON)
                </Button>

                {/* Quick CSV Exports */}
                <div className="flex items-center gap-2 pt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span className="shrink-0">خروجی اکسل سریع:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleExportCsv('products', 'محصولات')}
                      className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 font-medium text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      محصولات
                    </button>
                    <button
                      onClick={() => handleExportCsv('orders', 'فاکتورها')}
                      className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 font-medium text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      فاکتورها
                    </button>
                    <button
                      onClick={() => handleExportCsv('inventory_items', 'موجودی انبار')}
                      className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 font-medium text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      موجودی
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 2: Restore Backup */}
            <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#14161d] flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                    <HardDriveUpload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">بازیابی اطلاعات (Restore)</h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">بارگذاری فایل پشتیبان قبلی روی این سیستم یا مرورگر</p>
                  </div>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mt-2">
                  اگر ویندوز سیستم خود را تعویض کرده‌اید، کش مرورگر پاک شده یا می‌خواهید اطلاعات خود را از سیستم دیگری منتقل کنید، فایل پشتیبان (JSON) را بارگذاری نمایید.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  className="w-full font-bold text-xs py-2.5 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  انتخاب و بارگذاری فایل پشتیبان (JSON)
                </Button>
              </div>
            </div>
          </div>

          {/* Section 3: Demo Data & Initial Factory Reset */}
          <div className="pt-4 border-t border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                داده‌های آماده تستی و مدیریت شروع به کار
              </h5>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                جهت آشنایی و بررسی محیط نرم‌افزار یا پاکسازی کامل و شروع کار با داده‌های تمیز
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedDemo}
                isLoading={isSeedingDemo}
                icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                className="text-xs font-medium hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300"
              >
                بارگذاری نمونه اطلاعات پوشاک
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearConfirmModalOpen(true)}
                icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                className="text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
              >
                پاکسازی داده‌های محلی
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Restore Inspection & Confirmation Modal */}
      <Modal
        isOpen={inspectionModalOpen}
        onClose={() => {
          setInspectionModalOpen(false);
          setInspectedData(null);
        }}
        title="بررسی و تأیید بازیابی فایل پشتیبان"
        maxWidth="xl"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 text-xs">
            <FileJson className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <p className="font-bold">فایل پشتیبان تن‌خور با موفقیت خوانده و اعتبارسنجی شد.</p>
              <p className="text-neutral-600 text-[11px] mt-0.5">
                تاریخ ایجاد فایل: {inspectedData?.metadata?.exported_at_jalali || '-'}
                {inspectedData?.metadata?.organization?.name && ` | سازمان: ${inspectedData.metadata.organization.name}`}
              </p>
            </div>
          </div>

          <div>
            <h5 className="text-xs font-bold text-neutral-800 mb-2">محتوای موجود در این فایل پشتیبان:</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/80 flex justify-between items-center">
                <span className="text-neutral-500">کالاها:</span>
                <span className="font-bold font-mono text-neutral-900">
                  {toPersianDigits(inspectedData?.collections?.products || 0)}
                </span>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/80 flex justify-between items-center">
                <span className="text-neutral-500">تنوع کالاها:</span>
                <span className="font-bold font-mono text-neutral-900">
                  {toPersianDigits(inspectedData?.collections?.product_variants || 0)}
                </span>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/80 flex justify-between items-center">
                <span className="text-neutral-500">فاکتورها:</span>
                <span className="font-bold font-mono text-neutral-900">
                  {toPersianDigits(inspectedData?.collections?.orders || 0)}
                </span>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/80 flex justify-between items-center">
                <span className="text-neutral-500">انبارها:</span>
                <span className="font-bold font-mono text-neutral-900">
                  {toPersianDigits(inspectedData?.collections?.warehouses || 0)}
                </span>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/80 flex justify-between items-center">
                <span className="text-neutral-500">موجودی اقلام:</span>
                <span className="font-bold font-mono text-neutral-900">
                  {toPersianDigits(inspectedData?.collections?.inventory_items || 0)}
                </span>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/80 flex justify-between items-center">
                <span className="text-neutral-500">راهنماهای سایز:</span>
                <span className="font-bold font-mono text-neutral-900">
                  {toPersianDigits(inspectedData?.collections?.size_guide_templates || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-neutral-100">
            <label className="text-xs font-bold text-neutral-800 block">روش بازیابی را انتخاب کنید:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setRestoreMode('replace')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  restoreMode === 'replace'
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-neutral-900">جایگزینی کامل (Replace)</span>
                  {restoreMode === 'replace' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  داده‌های محلی فعلی پاک شده و محتوای فایل جایگزین آنها می‌شود (توصیه شده برای تعویض سیستم).
                </p>
              </div>

              <div
                onClick={() => setRestoreMode('merge')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  restoreMode === 'merge'
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-neutral-900">ادغام اطلاعات (Merge)</span>
                  {restoreMode === 'merge' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  رکوردهای جدید اضافه شده و رکوردهای موجود با شناسه یکسان به‌روزرسانی می‌گردند.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInspectionModalOpen(false);
                setInspectedData(null);
              }}
            >
              انصراف
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteRestore}
              isLoading={isRestoring}
              icon={<CheckCircle2 className="w-4 h-4" />}
              className="bg-blue-600 hover:bg-blue-700 font-bold"
            >
              تأیید و اجرای بازیابی
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear Database Confirm Modal */}
      <Modal
        isOpen={clearConfirmModalOpen}
        onClose={() => setClearConfirmModalOpen(false)}
        title="تأیید پاکسازی پایگاه داده محلی"
        maxWidth="md"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">هشدار: این عمل تمام اطلاعات محلی شما را حذف می‌کند!</p>
              <p className="text-neutral-600 text-[11px] mt-1 leading-relaxed">
                تمام کالاها، تنوع‌ها، فاکتورها، انبارها و جداول سایز ثبت‌شده در این مرورگر پاک خواهند شد. قبل از این کار حتماً یک نسخه پشتیبان دانلود نمایید.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearConfirmModalOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearData}
              icon={<Trash2 className="w-4 h-4" />}
              className="font-bold"
            >
              بله، تمام اطلاعات محلی پاک شود
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
