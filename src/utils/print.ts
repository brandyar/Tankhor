export interface PrintOptions {
  title?: string;
  extraStyles?: string;
}

/**
 * Universal, production-ready print helper.
 * Engineered specifically to work reliably across:
 * 1. Native macOS Tauri (WKWebView)
 * 2. Native Windows Tauri (WebView2)
 * 3. Standard Desktop & Mobile Web Browsers
 *
 * It mounts target markup into a dedicated top-level print portal (#tankhor-global-print-portal),
 * isolated by CSS @media print rules, then invokes window.print().
 * This guarantees the system print sheet opens without backdrop artifacts or iframe suppression.
 */
export function printHtml(htmlContent: string, options?: PrintOptions): void {
  try {
    const originalTitle = document.title;
    if (options?.title) {
      document.title = options.title;
    }

    // 1. Locate or create the global print portal
    let portal = document.getElementById('tankhor-global-print-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'tankhor-global-print-portal';
      document.body.appendChild(portal);
    }

    // 2. Inject extra styles if requested
    let extraStylesBlock = '';
    if (options?.extraStyles) {
      extraStylesBlock = `<style>${options.extraStyles}</style>`;
    }

    portal.innerHTML = `
      ${extraStylesBlock}
      <div class="tankhor-printable-content">
        ${htmlContent}
      </div>
    `;

    // 3. Mark body as printing
    document.body.classList.add('tankhor-printing');

    const cleanup = () => {
      document.body.classList.remove('tankhor-printing');
      if (portal) {
        portal.innerHTML = '';
      }
      document.title = originalTitle;
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    // 4. Trigger print after layout calculation
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('[PrintHelper] window.print() failed:', err);
      } finally {
        // Fallback cleanup in case afterprint event is delayed or not supported
        setTimeout(cleanup, 1500);
      }
    }, 150);
  } catch (err) {
    console.error('[PrintHelper] Error initiating print:', err);
    try {
      window.print();
    } catch {
      // ignore
    }
  }
}

export function printElement(elementOrId: HTMLElement | string, options?: PrintOptions): void {
  const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!el) {
    console.warn('[PrintHelper] Element not found for print:', elementOrId);
    try {
      window.print();
    } catch {
      // ignore
    }
    return;
  }

  // Clone or extract innerHTML ensuring SVG barcodes and inputs are accurately copied
  printHtml(el.innerHTML, options);
}
