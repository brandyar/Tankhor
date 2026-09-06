export interface PrintOptions {
  title?: string;
  extraStyles?: string;
}

/**
 * Universal, production-ready print helper.
 * Engineered specifically to work reliably across:
 * 1. Native macOS Tauri (WebKit / WKWebView)
 * 2. Native Windows Tauri (WebView2)
 * 3. Standard Desktop & Mobile Web Browsers (Chrome, Safari, Firefox, Edge)
 *
 * It utilizes a dedicated #tankhor-global-print-portal on document.body,
 * coupled with .tankhor-printing state and @media print CSS rules, ensuring
 * that barcodes, receipts, and invoices are rendered with zero layout cuts.
 */
export function printHtml(htmlContent: string, options?: PrintOptions): void {
  try {
    const originalTitle = document.title;
    if (options?.title) {
      document.title = options.title;
    }

    const fullStyles = `
      @page {
        size: auto;
        margin: 0mm;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        direction: rtl !important;
        font-family: Vazirmatn, system-ui, -apple-system, sans-serif !important;
      }
      ${options?.extraStyles || ''}
    `;

    // 1. Ensure the global print portal exists on document.body
    let portal = document.getElementById('tankhor-global-print-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'tankhor-global-print-portal';
      document.body.appendChild(portal);
    }

    // 2. Inject printable content and scoped styles into portal
    portal.innerHTML = `
      <style>${fullStyles}</style>
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
      if (options?.title) {
        document.title = originalTitle;
      }
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    // 4. Allow browser layout & font engine to settle before invoking native print
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (err) {
          console.error('[PrintHelper] window.print() failed:', err);
        } finally {
          // Safety cleanup fallback if 'afterprint' event isn't triggered by WebKit
          setTimeout(cleanup, 2000);
        }
      }, 80);
    });
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

  // Extract innerHTML ensuring SVG barcodes, SVGs, tables, and inputs are accurately rendered
  printHtml(el.innerHTML, options);
}
