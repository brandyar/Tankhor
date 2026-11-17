import { useEffect, useRef } from 'react';

/**
 * Subscribes a view to silent SWR background cache updates.
 * When background revalidation detects fresh data from the server for any of the
 * specified collections, `onRevalidate` runs cleanly without showing a spinner.
 */
export function useSwrRefresh(collections: string[], onRevalidate: () => void): void {
  const callbackRef = useRef(onRevalidate);
  callbackRef.current = onRevalidate;

  const collectionsKey = collections.join(',');

  useEffect(() => {
    const watched = new Set(collectionsKey.split(',').filter(Boolean));
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ endpoint?: string; collection?: string }>).detail;
      const col = detail?.collection;
      if (col && watched.has(col)) {
        // Coalesce bursts of background updates (e.g., multiple lookups finishing together) into 1 re-render
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          callbackRef.current();
        }, 60);
      }
    };

    window.addEventListener('tankhor:swr-updated', handler);
    return () => {
      window.removeEventListener('tankhor:swr-updated', handler);
      if (timer) clearTimeout(timer);
    };
  }, [collectionsKey]);
}
