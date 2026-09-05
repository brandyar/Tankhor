import React, { useState, useEffect } from 'react';
import { mediaManager } from '../../utils/mediaManager';
import { Shirt, Image as ImageIcon } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  fallbackText?: string;
  className?: string;
  containerClassName?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt = 'Product',
  fallbackText,
  className = 'w-full h-full object-cover',
  containerClassName = 'w-10 h-10 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200/80 dark:border-neutral-700/80',
}) => {
  const [displayUrl, setDisplayUrl] = useState<string>(() => mediaManager.getDisplayUrlSync(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    if (src) {
      const syncUrl = mediaManager.getDisplayUrlSync(src);
      if (syncUrl) setDisplayUrl(syncUrl);

      mediaManager.getDisplayUrl(src).then((url) => {
        if (isMounted && url) {
          setDisplayUrl(url);
        }
      });
    } else {
      setDisplayUrl('');
    }

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (!src || hasError || !displayUrl) {
    return (
      <div className={containerClassName}>
        {fallbackText ? (
          <span className="font-bold text-xs text-neutral-700 dark:text-neutral-300 uppercase">
            {fallbackText.slice(0, 2)}
          </span>
        ) : (
          <Shirt className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
        )}
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <img
        src={displayUrl}
        alt={alt}
        className={className}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
};
