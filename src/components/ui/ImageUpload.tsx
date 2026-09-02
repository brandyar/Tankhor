import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { directusClient } from '../../api/directus';
import { storageManager } from '../../storage';

interface ImageUploadProps {
  label?: string;
  value?: string;
  onChange: (urlOrId: string) => void;
  helperText?: string;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  label = 'تصویر محصول',
  value,
  onChange,
  helperText,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPreviewUrl = (val?: string) => {
    if (!val) return '';
    return directusClient.getAssetUrl(val);
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('لطفاً یک فایل تصویری (PNG, JPG, WEBP) انتخاب کنید.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('حجم فایل تصویر نباید بیش از ۱۰ مگابایت باشد.');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const adapter = storageManager.getAdapter();

      if (adapter.mode === 'cloud_synced') {
        // Try Directus upload
        const result = await directusClient.uploadFile(file);
        if (result && result.id) {
          onChange(result.id);
          setIsUploading(false);
          return;
        }
      }

      // Fallback or Local Offline mode: Convert to Base64 Data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onChange(base64);
        setIsUploading(false);
      };
      reader.onerror = () => {
        setError('خطا در خواندن فایل تصویر.');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.warn('[ImageUpload] Cloud upload fallback to base64:', err);
      // Fallback to base64 reader if cloud upload fails
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onChange(base64);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const previewUrl = getPreviewUrl(value);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">{label}</label>}

      {previewUrl ? (
        <div className="relative group rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-neutral-50 dark:bg-neutral-900/80 flex items-center justify-center p-2 min-h-36 max-h-48">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-40 w-auto object-contain rounded-xl"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-neutral-900/70 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-xs">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-neutral-800 text-xs font-bold rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer shadow-xs"
            >
              تغییر تصویر
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors cursor-pointer shadow-xs"
              title="حذف تصویر"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
            dragActive
              ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]'
              : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/40 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 hover:border-neutral-400'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center py-2 text-blue-600 dark:text-blue-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs font-medium">در حال بارگذاری و پردازش تصویر...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200 mb-1">
                برای انتخاب تصویر کلیک کنید یا فایل را اینجا رها کنید
              </p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">فرمت‌های مجاز: PNG, JPG, WEBP (حداکثر ۱۰ مگابایت)</p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
      />

      {error && <p className="text-[11px] font-medium text-red-600 mt-1">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-slate-500">{helperText}</p>}
    </div>
  );
};
