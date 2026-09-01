export interface PrintOptions {
  title?: string;
  extraStyles?: string;
}

/**
 * Robust print helper that works seamlessly across Web browsers,
 * Windows Tauri desktop, and macOS Tauri (WKWebView).
 * It renders the target HTML into a dedicated hidden iframe,
 * ensuring styles, fonts, and layout are perfectly preserved without
 * interference from open modals or UI overlays.
 */
export function printHtml(htmlContent: string, options?: PrintOptions): void {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.style.zIndex = '-9999';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      console.warn('[PrintHelper] Cannot access iframe document, falling back to window.print()');
      window.print();
      return;
    }

    // Collect all stylesheet links and style tags from current document
    let stylesHtml = '';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((styleEl) => {
      stylesHtml += styleEl.outerHTML + '\n';
    });

    if (options?.extraStyles) {
      stylesHtml += `<style>${options.extraStyles}</style>\n`;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8">
        <title>${options?.title || 'تن‌خور - نسخه چاپ'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        ${stylesHtml}
        <style>
          @page {
            size: auto;
            margin: 0mm;
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
          body {
            margin: 0 !important;
            padding: 8px !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Vazirmatn', system-ui, -apple-system, sans-serif !important;
            direction: rtl !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .hidden, .print-only, #tankhor-print-container, #printable-order-invoice, #printable-create-order-invoice {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div id="tankhor-print-root">
          ${htmlContent}
        </div>
      </body>
      </html>
    `);
    doc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('[PrintHelper] Error triggering print in iframe:', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1200);
      }
    };

    // Give iframe styles & fonts a short moment to settle
    setTimeout(doPrint, 300);
  } catch (err) {
    console.error('[PrintHelper] Direct print error:', err);
    window.print();
  }
}

export function printElement(elementOrId: HTMLElement | string, options?: PrintOptions): void {
  const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!el) {
    console.warn('[PrintHelper] Element not found:', elementOrId);
    window.print();
    return;
  }
  printHtml(el.innerHTML, options);
}
