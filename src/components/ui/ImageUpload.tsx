import React, { useRef, useState, useEffect } from 'react';
import { Upload, X, Loader2, Sparkles, HardDrive, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { mediaManager } from '../../utils/mediaManager';
import { isTauriEnvironment } from '../../storage';
import { useTranslation } from '../../i18n';

interface ImageUploadProps {
  label?: string;
  subtitle?: string;
  value?: string;
  onChange: (urlOrId: string) => void;
  helperText?: string;
  className?: string;
  productId?: number;
  mode?: 'full' | 'compact' | 'mini' | 'avatar';
  maxSizeInMB?: number;
  disabled?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  label,
  subtitle,
  value,
  onChange,
  helperText,
  className = '',
  productId,
  mode = 'full',
  maxSizeInMB,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const effectiveLabel = label !== undefined ? label : t('common.imageProduct');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedDisplayUrl, setResolvedDisplayUrl] = useState<string>('');
  const [compressionInfo, setCompressionInfo] = useState<{ origSize: number; compSize: number } | null>(null);

  const effectiveMaxMB = maxSizeInMB !== undefined && maxSizeInMB > 0 ? maxSizeInMB : (mode === 'avatar' ? 5 : 20);

  const safeValue = typeof value === 'string'
    ? value
    : (value && typeof value === 'object' && (value as any).id)
      ? String((value as any).id)
      : '';

  useEffect(() => {
    let isMounted = true;
    if (safeValue) {
      // First try sync cache
      const syncUrl = mediaManager.getDisplayUrlSync(safeValue);
      if (syncUrl) setResolvedDisplayUrl(syncUrl);

      // Resolve async (for Tauri FS local blobs or cloud URLs)
      mediaManager.getDisplayUrl(safeValue).then((url) => {
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
  }, [safeValue]);

  const handleFileChange = async (file: File) => {
    if (!file) return;

    const validMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];
    const hasValidExt = /\.(png|jpe?g|webp|svg|gif)$/i.test(file.name);

    if (!file.type.startsWith('image/') && !validMimes.includes(file.type) && !hasValidExt) {
      setError(t('common.imageFileTypeError', 'لطفاً یک فایل تصویری معتبر (PNG, JPG, WEBP, SVG) انتخاب کنید.'));
      return;
    }

    const maxBytes = effectiveMaxMB * 1024 * 1024;
    if (file.size > maxBytes) {
      const formattedLimit = t('common.imageFileSizeErrorCustom', { size: effectiveMaxMB });
      setError(formattedLimit || `حجم فایل تصویر نباید بیش از ${effectiveMaxMB} مگابایت باشد.`);
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
      setError(`${t('common.imageProcessingError')}: ${err?.message || err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
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
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // AVATAR / LOGO MODE: Dedicated horizontal card with prominent preview, clear title, actions & limits
  if (mode === 'avatar') {
    return (
      <div className={`p-4 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#15171e] transition-all ${className}`}>
        {effectiveLabel && (
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-neutral-200/60 dark:border-neutral-800">
            <div className="space-y-0.5">
              <label className="block text-xs font-bold text-neutral-900 dark:text-neutral-100">
                {effectiveLabel}
              </label>
              {subtitle && (
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            {isTauriEnvironment() && (
              <span className="text-[10px] text-neutral-400 flex items-center gap-1 font-mono shrink-0">
                <HardDrive className="w-3 h-3 text-emerald-500" />
                AppData/media
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Logo / Avatar Preview Container */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
            className={`relative group w-20 h-20 rounded-2xl border-2 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer transition-all shadow-xs ${
              dragActive
                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 scale-105'
                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1a1d26] hover:border-blue-400 dark:hover:border-blue-500'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            title={t('common.clickOrDragImage')}
          >
            {resolvedDisplayUrl ? (
              <img
                src={resolvedDisplayUrl}
                alt="Logo Preview"
                className="w-full h-full object-contain p-1.5"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500">
                <ImageIcon className="w-7 h-7 stroke-1" />
                <span className="text-[9px] mt-0.5 font-medium">{t('settings.orgLogoLabel', 'لوگو')}</span>
              </div>
            )}

            {isUploading && (
              <div className="absolute inset-0 bg-neutral-900/75 flex items-center justify-center text-white backdrop-blur-xs">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              </div>
            )}

            {!isUploading && !disabled && (
              <div className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Upload className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Action Buttons & Description */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={disabled || isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white rounded-xl transition-colors cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{resolvedDisplayUrl ? t('settings.orgLogoChange', 'تغییر لوگو') : t('common.clickOrDragImage', 'بارگذاری لوگو')}</span>
              </button>

              {resolvedDisplayUrl && (
                <button
                  type="button"
                  disabled={disabled || isUploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                    setResolvedDisplayUrl('');
                    setCompressionInfo(null);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t('settings.orgLogoRemove', 'حذف لوگو')}</span>
                </button>
              )}
            </div>

            {/* Format & Size Constraint Text */}
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 space-y-1">
              {helperText ? (
                <p>{helperText}</p>
              ) : (
                <p>فرمت‌های مجاز: PNG، JPG، WEBP یا SVG (حداکثر حجم: {effectiveMaxMB} مگابایت)</p>
              )}
              {compressionInfo && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                  <Sparkles className="w-3 h-3" />
                  {t('common.autoCompression')}: {formatFileSize(compressionInfo.origSize)} ⟵ {formatFileSize(compressionInfo.compSize)}
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1.5 rounded-xl animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
        />
      </div>
    );
  }

  // MINI & COMPACT MODE
  if (mode === 'compact' || mode === 'mini') {
    // If a label is explicitly passed to compact mode, render with label and error
    const renderContent = (
      <div className={`relative inline-flex items-center shrink-0 ${mode === 'mini' ? className : ''}`}>
        {resolvedDisplayUrl ? (
          <div className="relative group w-9 h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shadow-2xs">
            <img
              src={resolvedDisplayUrl}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {isUploading ? (
              <div className="absolute inset-0 bg-neutral-900/60 flex items-center justify-center text-white">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-neutral-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 bg-white/90 text-neutral-800 rounded hover:bg-white transition-colors cursor-pointer"
                  title={t('common.changeImage')}
                >
                  <Upload className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                    setResolvedDisplayUrl('');
                    setError(null);
                  }}
                  className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors cursor-pointer"
                  title={t('common.deleteImage')}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-neutral-50 dark:bg-neutral-900/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('common.addImageToVariant')}
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
        />
      </div>
    );

    // If used without label (like table rows), return inline
    if (mode === 'mini' || !label) {
      return renderContent;
    }

    // Compact with label
    return (
      <div className={`space-y-1.5 ${className}`}>
        {effectiveLabel && (
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {effectiveLabel}
            </label>
            <span className="text-[10px] text-neutral-400">حداکثر {effectiveMaxMB}MB</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          {renderContent}
          <div className="flex-1 min-w-0">
            {helperText && <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{helperText}</p>}
            {error && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // FULL DROPZONE MODE
  return (
    <div className={`space-y-1.5 ${className}`}>
      {effectiveLabel && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">{effectiveLabel}</label>
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
              {t('common.autoCompression')}: {formatFileSize(compressionInfo.origSize)} ⟵ {formatFileSize(compressionInfo.compSize)}
            </div>
          )}

          <div className="absolute inset-0 bg-neutral-900/75 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-xs">
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-neutral-800 text-xs font-bold rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {t('common.changeImage')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange('');
                setResolvedDisplayUrl('');
                setCompressionInfo(null);
                setError(null);
              }}
              className="p-1.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title={t('common.deleteImage')}
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
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          } ${
            dragActive
              ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]'
              : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/40 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 hover:border-neutral-400'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center py-2 text-blue-600 dark:text-blue-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs font-medium">{t('common.optimizingAndSaving')}</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200 mb-1">
                {t('common.clickOrDragImage')}
              </p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                {t('common.autoConvertWebp')} (حداکثر {effectiveMaxMB}MB)
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
      />

      {error && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {helperText && !error && <p className="text-[11px] text-neutral-500">{helperText}</p>}
    </div>
  );
};

