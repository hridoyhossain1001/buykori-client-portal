import { clonePrintMarkup } from '../../lib/print';
import { INVOICE_PRINT_STYLES } from './invoicePrintStyles';

/*
 * The font URLs are assembled with plain concatenation rather than written
 * inside a template literal. Keep it that way.
 */
const FONTS_ORIGIN = 'https://' + 'fonts.googleapis.com';
const FONT_STYLESHEET_HREF =
  FONTS_ORIGIN +
  '/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap';

function buildPrintDocument(printContent: string): string {
  return (
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>Invoice Print</title>\n' +
    '  <link rel="preconnect" href="' +
    FONTS_ORIGIN +
    '">\n' +
    '  <link href="' +
    FONT_STYLESHEET_HREF +
    '" rel="stylesheet">\n' +
    '  <style>\n' +
    INVOICE_PRINT_STYLES +
    '\n  </style>\n' +
    '</head>\n' +
    '<body>' +
    printContent +
    '</body>\n' +
    '</html>'
  );
}

/**
 * Clones the rendered invoice sheet into a new window, waits for the QR code
 * images to decode, then prints and closes it.
 *
 * Falls back to printing the current document if the popup is blocked.
 */
export function printInvoiceArea(): void {
  const printContent = clonePrintMarkup('.print-invoice-area');
  if (!printContent) return;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    // Popup blocked fallback
    window.print();
    return;
  }

  printWindow.document.write(buildPrintDocument(printContent));
  printWindow.document.close();

  // Wait for QR code images (data URLs) to be ready, then print
  const images = printWindow.document.querySelectorAll('img');
  let loadCount = 0;
  const totalImages = images.length;

  const tryPrint = () => {
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 100);
  };

  if (totalImages === 0) {
    tryPrint();
  } else {
    images.forEach((img) => {
      if (img.complete) {
        loadCount++;
        if (loadCount >= totalImages) tryPrint();
      } else {
        img.onload = () => { loadCount++; if (loadCount >= totalImages) tryPrint(); };
        img.onerror = () => { loadCount++; if (loadCount >= totalImages) tryPrint(); };
      }
    });
  }
}
