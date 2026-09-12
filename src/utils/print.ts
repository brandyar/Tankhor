export interface PrintOptions {
  title?: string;
  extraStyles?: string;
}

/**
 * Universal, high-precision print engine.
 * Specifically engineered to work flawlessly across macOS Tauri (WKWebView),
 * Windows Tauri (WebView2), Linux, and all modern Web Browsers.
 * 
 * Uses a dynamic top-level print portal directly on the main window DOM with
 * strict @media print CSS isolation. This completely avoids the WKWebView limitation
 * where subframe/iframe printing (iframe.contentWindow.print()) is silently ignored on macOS.
 */
export function printHtml(htmlContent: string, options?: PrintOptions): void {
  try {
    const originalTitle = document.title;
    if (options?.title) {
      document.title = options.title;
    }

    // 1. Remove any previous print portal & styles if still present
    const oldPortal = document.getElementById('tankhor-active-print-portal');
    if (oldPortal) {
      oldPortal.remove();
    }
    const oldStyle = document.getElementById('tankhor-active-print-style');
    if (oldStyle) {
      oldStyle.remove();
    }

    // 2. Create the dedicated top-level Print Portal directly inside document.body
    const portal = document.createElement('div');
    portal.id = 'tankhor-active-print-portal';
    portal.dir = 'rtl';
    portal.lang = 'fa';
    portal.innerHTML = htmlContent;

    // 3. Create and inject high-priority Print CSS rules
    const styleEl = document.createElement('style');
    styleEl.id = 'tankhor-active-print-style';
    styleEl.innerHTML = `
      @media screen {
        #tankhor-active-print-portal {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          left: -99999px !important;
          top: -99999px !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      }

      @media print {
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
          min-height: 100% !important;
          height: auto !important;
          overflow: visible !important;
        }

        /* Hide all root UI elements (sidebar, header, content containers, modals) except our print portal */
        body > *:not(#tankhor-active-print-portal) {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          opacity: 0 !important;
        }

        /* Display our active print portal prominently */
        #tankhor-active-print-portal {
          display: block !important;
          visibility: visible !important;
          position: relative !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          z-index: 2147483647 !important;
          overflow: visible !important;
          opacity: 1 !important;
        }

        /* Ensure all nested elements inside the portal are visible and correctly styled */
        #tankhor-active-print-portal .no-print {
          display: none !important;
        }

        #tankhor-active-print-portal .print-only,
        #tankhor-active-print-portal .print\\:block,
        #tankhor-active-print-portal [class*="print-label-item"],
        #tankhor-active-print-portal [class*="tpl-"] {
          display: block !important;
          visibility: visible !important;
        }

        #tankhor-active-print-portal .hidden {
          display: block !important;
          visibility: visible !important;
        }

        /* Label printing styles */
        #tankhor-active-print-portal .print-label-item {
          box-sizing: border-box !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          background: #ffffff !important;
          color: #000000 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          text-align: center !important;
          overflow: hidden !important;
        }

        #tankhor-active-print-portal .tpl-thermal_50x30 {
          width: 50mm !important;
          height: 30mm !important;
          padding: 2mm !important;
          page-break-after: always !important;
          break-after: page !important;
        }

        #tankhor-active-print-portal .tpl-thermal_40x25 {
          width: 40mm !important;
          height: 25mm !important;
          padding: 1.5mm !important;
          page-break-after: always !important;
          break-after: page !important;
        }

        #tankhor-active-print-portal .tpl-hangtag_60x40 {
          width: 60mm !important;
          height: 40mm !important;
          padding: 2.5mm !important;
          page-break-after: always !important;
          break-after: page !important;
        }

        #tankhor-active-print-portal .a4-grid-24 {
          display: grid !important;
          grid-template-columns: repeat(3, 70mm) !important;
          grid-auto-rows: 37mm !important;
          gap: 0mm !important;
          padding: 5mm !important;
        }

        #tankhor-active-print-portal .a4-grid-40 {
          display: grid !important;
          grid-template-columns: repeat(4, 52.5mm) !important;
          grid-auto-rows: 29.7mm !important;
          gap: 0mm !important;
          padding: 5mm !important;
        }

        ${options?.extraStyles || ''}
      }
    `;

    document.head.appendChild(styleEl);
    document.body.appendChild(portal);

    // 4. Cleanup function after printing completes
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      document.title = originalTitle;
      if (portal.parentNode) {
        portal.parentNode.removeChild(portal);
      }
      if (styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    // Fallback cleanup after 2 minutes
    setTimeout(cleanup, 120000);

    // 5. Trigger window.print() after a brief tick to ensure DOM & SVG elements are fully computed
    setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (printErr) {
        console.error('[PrintHelper] window.print() failed:', printErr);
        cleanup();
      }
    }, 60);

  } catch (err) {
    console.error('[PrintHelper] Error initiating print:', err);
    try {
      window.print();
    } catch {}
  }
}

/**
 * High-precision helper to print a DOM element by id or element reference.
 */
export function printElement(elementOrId: HTMLElement | string, options?: PrintOptions): void {
  const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!el) {
    console.warn('[PrintHelper] Element not found for print:', elementOrId);
    try {
      window.print();
    } catch {}
    return;
  }

  printHtml(el.innerHTML, options);
}
