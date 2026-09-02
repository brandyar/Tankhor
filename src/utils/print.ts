export interface PrintOptions {
  title?: string;
  extraStyles?: string;
}

/**
 * Universal, production-ready print helper.
 * Engineered specifically to work reliably across:
 * 1. Native macOS Tauri (WebKit / WKWebView)
 * 2. Native Windows Tauri (WebView2)
 * 3. Standard Desktop & Mobile Web Browsers
 *
 * Implements a bulletproof multi-tier printing strategy:
 * Tier 1: Dedicated isolated print iframe for WebKit/macOS
 * Tier 2: Dedicated #tankhor-global-print-portal with @media print rules
 * Tier 3: Direct window.print() fallback
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

    // 1. Try iframe method (most reliable for macOS WKWebView & Safari without interrupting main view)
    let printIframe = document.getElementById('tankhor-print-iframe') as HTMLIFrameElement | null;
    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = 'tankhor-print-iframe';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.style.visibility = 'hidden';
      document.body.appendChild(printIframe);
    }

    // 2. Also populate the global portal on main document as Tier 2 fallback
    let portal = document.getElementById('tankhor-global-print-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'tankhor-global-print-portal';
      document.body.appendChild(portal);
    }

    portal.innerHTML = `
      <style>${fullStyles}</style>
      <div class="tankhor-printable-content">
        ${htmlContent}
      </div>
    `;

    // Try printing through the isolated iframe first
    const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
    if (iframeDoc && printIframe.contentWindow) {
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
          <head>
            <meta charset="utf-8">
            <title>${options?.title || 'چاپ تن‌خور'}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css">
            <style>${fullStyles}</style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `);
      iframeDoc.close();

      const iframeWin = printIframe.contentWindow;
      setTimeout(() => {
        try {
          iframeWin.focus();
          iframeWin.print();
        } catch (iframeErr) {
          console.warn('[PrintHelper] Iframe print failed, falling back to window.print():', iframeErr);
          // Fallback to window.print()
          document.body.classList.add('tankhor-printing');
          setTimeout(() => {
            window.print();
            setTimeout(() => {
              document.body.classList.remove('tankhor-printing');
              document.title = originalTitle;
            }, 1000);
          }, 100);
        }
      }, 250);
      return;
    }

    // Direct window.print fallback
    document.body.classList.add('tankhor-printing');
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('[PrintHelper] window.print() failed:', err);
      } finally {
        setTimeout(() => {
          document.body.classList.remove('tankhor-printing');
          document.title = originalTitle;
        }, 1200);
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
