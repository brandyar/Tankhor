import React, { useRef, useState, useEffect } from 'react';
import { Upload, X, Loader2, Sparkles, HardDrive, CheckCircle2 } from 'lucide-react';
import { mediaManager } from '../../utils/mediaManager';
import { isTauriEnvironment } from '../../storage';

interface ImageUploadProps {
  label?: string;
  value?: string;
  onChange: (urlOrId: string) => void;
  helperText?: string;
  className?: string;
  productId?: number;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  label = 'تصویر محصول',
  value,
  onChange,
  helperText,
  className = '',
  productId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedDisplayUrl, setResolvedDisplayUrl] = useState<string>('');
  const [compressionInfo, setCompressionInfo] = useState<{ origSize: number; compSize: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (value) {
      // First try sync cache
      const syncUrl = mediaManager.getDisplayUrlSync(value);
      if (syncUrl) setResolvedDisplayUrl(syncUrl);

      // Resolve async (for Tauri FS local blobs or cloud URLs)
      mediaManager.getDisplayUrl(value).then((url) => {
        if (isMounted && url) {
          setResolvedDisplayUrl(url);
        }
      });
    } else {
      setResolvedDisplayUrl('');
      setCompressionInfo(null);
    }
    return () => {
      isMounted = false;
    };
  }, [value]);

  const handleFileChange = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('لطفاً یک فایل تصویری (PNG, JPG, WEBP) انتخاب کنید.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('حجم فایل تصویر نباید بیش از ۲۰ مگابایت باشد.');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const res = await mediaManager.saveImage(file, { productId });
      setResolvedDisplayUrl(res.displayUrl);
      setCompressionInfo({
        origSize: res.compressed.originalSize,
        compSize: res.compressed.compressedSize,
      });
      onChange(res.mediaId);
    } catch (err: any) {
      console.error('[ImageUpload] Error saving/compressing image:', err);
      setError(`خطا در پردازش تصویر: ${err?.message || err}`);
    } finally {
      setIsUploading(false);
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">{label}</label>
          {isTauriEnvironment() && (
            <span className="text-[10px] text-neutral-400 flex items-center gap-1 font-mono">
              <HardDrive className="w-3 h-3 text-emerald-500" />
              AppData/media
            </span>
          )}
        </div>
      )}

      {resolvedDisplayUrl ? (
        <div className="relative group rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-neutral-50 dark:bg-neutral-900/80 flex flex-col items-center justify-center p-3 min-h-36 max-h-52">
          <img
            src={resolvedDisplayUrl}
            alt="Preview"
            className="max-h-36 w-auto object-contain rounded-xl shadow-xs"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />

          {compressionInfo && (
            <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
              <Sparkles className="w-3 h-3" />
              فشرده‌سازی خودکار: {formatFileSize(compressionInfo.origSize)} ⟵ {formatFileSize(compressionInfo.compSize)}
            </div>
          )}

          <div className="absolute inset-0 bg-neutral-900/75 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-xs">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-neutral-800 text-xs font-bold rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer shadow-xs"
            >
              تغییر تصویر
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setResolvedDisplayUrl('');
                setCompressionInfo(null);
              }}
              className="p-1.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors cursor-pointer shadow-xs"
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
              <span className="text-xs font-medium">در حال بهینه‌سازی و ذخیره‌سازی محلی...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200 mb-1">
                برای انتخاب تصویر کلیک کنید یا فایل را اینجا رها کنید
              </p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                فشرده‌سازی خودکار و تبدیل هوشمند به فرمت پرسرعت WebP
              </p>
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

      {error && <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-neutral-500">{helperText}</p>}
    </div>
  );
};
