export interface PrintOptions {
  title?: string;
  extraStyles?: string;
}

/**
 * Universal, high-precision print helper.
 * Uses a dynamic isolated hidden iframe to guarantee exact, lossless printing
 * across native macOS Tauri (WKWebView), Windows Tauri (WebView2), and all Web Browsers.
 */
export function printHtml(htmlContent: string, options?: PrintOptions): void {
  try {
    const originalTitle = document.title;
    const printTitle = options?.title || originalTitle;

    // Collect all existing page styles & links (Tailwind, fonts, custom CSS)
    let pageStyles = '';
    const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
    styleNodes.forEach((node) => {
      pageStyles += node.outerHTML;
    });

    const customStyles = `
      @page {
        size: auto;
        margin: 0mm;
      }
      * {
        box-sizing: border-box !important;
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
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
      }
      .no-print {
        display: none !important;
      }
      .print-only {
        display: block !important;
      }
      .hidden {
        display: block !important;
      }
      ${options?.extraStyles || ''}
    `;

    // Create a hidden printing iframe
    const existingIframe = document.getElementById('tankhor-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'tankhor-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      console.warn('[PrintHelper] Iframe doc unavailable, falling back to window.print()');
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8">
        <title>${printTitle}</title>
        ${pageStyles}
        <style>${customStyles}</style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `);
    doc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('[PrintHelper] Iframe print exception:', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    };

    // Give browser brief window to compute layout & load styles/fonts
    setTimeout(doPrint, 120);
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

  printHtml(el.innerHTML, options);
}
