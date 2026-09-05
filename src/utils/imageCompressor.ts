/**
 * TANKHOR (تن‌خور) - Client-side Image Optimization Engine
 * Compresses, resizes, and converts images to WebP/JPEG before local saving or cloud upload.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default 0.82)
  targetFormat?: 'image/webp' | 'image/jpeg';
}

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  format: string;
}

/**
 * Compresses an image File or Blob using HTML5 Canvas.
 * Automatically keeps aspect ratio and limits maximum dimensions (default: 1200x1200).
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    targetFormat = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while constraining to maxWidth and maxHeight
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context is not supported in this environment.'));
          return;
        }

        // Fill background with white for transparent images when converting to JPEG
        if (targetFormat === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try preferred format (WebP), fallback to JPEG if browser doesn't support WebP export
        let exportFormat = targetFormat;
        let dataUrl = canvas.toDataURL(exportFormat, quality);

        if (!dataUrl.startsWith(`data:${exportFormat}`)) {
          exportFormat = 'image/jpeg';
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create Blob from compressed canvas.'));
              return;
            }

            resolve({
              blob,
              dataUrl,
              originalSize: fileOrBlob.size,
              compressedSize: blob.size,
              width,
              height,
              format: exportFormat,
            });
          },
          exportFormat,
          quality
        );
      };

      img.onerror = (imgErr) => {
        reject(new Error('Failed to load image for compression: ' + String(imgErr)));
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = (readErr) => {
      reject(new Error('Failed to read image file: ' + String(readErr)));
    };

    reader.readAsDataURL(fileOrBlob);
  });
}
