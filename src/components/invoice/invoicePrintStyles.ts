/**
 * The stylesheet injected into the invoice print window.
 *
 * Moved verbatim out of InvoiceModal.tsx. It is a hand-written subset of the
 * Tailwind utilities used by the invoice sheet, because the print window is a
 * fresh document that does not load the app stylesheet.
 *
 * This is a plain template literal with no interpolation - do not add any.
 */
export const INVOICE_PRINT_STYLES = `    @page { size: auto; margin: 5mm 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      color: #0f172a;
      background: white;
      padding: 4px 8px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11px;
      line-height: 1.4;
    }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    .tracking-tight { letter-spacing: -0.025em; }
    .tracking-wider { letter-spacing: 0.05em; }
    .tracking-widest { letter-spacing: 0.1em; }
    .text-xs { font-size: 10px; line-height: 14px; }
    .text-sm { font-size: 11px; line-height: 16px; }
    .text-base { font-size: 13px; line-height: 18px; }
    .text-xl { font-size: 16px; line-height: 22px; }
    .text-2xl { font-size: 18px; line-height: 24px; }
    .invoice-print-8 { font-size: 8px; }
    .invoice-print-9 { font-size: 8px; }
    .invoice-print-10 { font-size: 9px; }
    .invoice-print-11 { font-size: 10px; line-height: 1.4; }
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .leading-relaxed { line-height: 1.5; }
    .text-slate-400 { color: #94a3b8; }
    .text-slate-500 { color: #64748b; }
    .text-slate-600 { color: #475569; }
    .text-slate-700 { color: #334155; }
    .text-slate-800 { color: #1e293b; }
    .text-slate-900 { color: #0f172a; }
    .text-indigo-600 { color: #4f46e5; }
    .text-emerald-600 { color: #059669; }
    .text-emerald-700 { color: #047857; }
    .text-white { color: white; }
    .text-black { color: black; }
    .bg-white { background-color: white; }
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-slate-100 { background-color: #f1f5f9; }
    .bg-indigo-600 { background-color: #4f46e5; }
    .border-collapse { border-collapse: collapse; }
    .border { border: 1px solid #e2e8f0; }
    .border-t { border-top: 1px solid #e2e8f0; }
    .border-b { border-bottom: 1px solid #e2e8f0; }
    .border-slate-100 { border-color: #f1f5f9; }
    .border-slate-200 { border-color: #e2e8f0; }
    .border-dashed { border-style: dashed; }
    .rounded-lg { border-radius: 6px; }
    .rounded-xl { border-radius: 8px; }
    .overflow-hidden { overflow: hidden; }
    .shrink-0 { flex-shrink: 0; }
    .flex { display: flex; }
    .inline-flex { display: inline-flex; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1 1 0%; }
    .gap-1 { gap: 2px; }
    .gap-1\\.5 { gap: 3px; }
    .gap-2 { gap: 5px; }
    .gap-6 { gap: 10px; }
    .space-y-0\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 1px; }
    .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 2px; }
    .space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 3px; }
    .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 4px; }
    .space-y-2\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 5px; }
    .space-y-8 > :not([hidden]) ~ :not([hidden]) { margin-top: 6px; }
    .w-3 { width: 10px; } .h-3 { height: 10px; }
    .w-4 { width: 14px; } .h-4 { height: 14px; }
    .w-8 { width: 24px; } .h-8 { height: 24px; }
    .w-20 { width: 60px; }
    .w-28 { width: 80px; } .h-28 { height: 80px; }
    .w-40 { width: 130px; }
    .w-48 { width: 140px; }
    .w-64 { width: 210px; }
    .w-full { width: 100%; }
    .p-1\\.5 { padding: 3px; }
    .p-3 { padding: 6px; }
    .p-4 { padding: 8px; }
    .px-4 { padding-left: 8px; padding-right: 8px; }
    .py-3 { padding-top: 4px; padding-bottom: 4px; }
    .py-4 { padding-top: 6px; padding-bottom: 6px; }
    .pb-6 { padding-bottom: 8px; }
    .pt-2 { padding-top: 4px; }
    .pt-4 { padding-top: 6px; }
    .pt-16 { padding-top: 10px; }
    .mb-2 { margin-bottom: 4px; }
    .divide-y > :not([hidden]) ~ :not([hidden]) { border-top: 1px solid #e2e8f0; }
    table { width: 100%; font-size: 10px; text-align: left; border-collapse: collapse; }
    th { padding: 3px 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 9px; color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    td { padding: 3px 8px; }
    tbody tr { border-top: 1px solid #f1f5f9; }
    svg { display: none; }
    .w-2\\.5 { width: 8px; } .h-2\\.5 { height: 8px; }
    img { display: inline-block; }

    /* === SINGLE PRINT MODE (1 invoice = 1 page) === */
    .print-invoice-page {
      page-break-after: always;
      break-after: page;
    }
    .print-invoice-page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .print-invoice-page * {
      page-break-inside: avoid;
    }

    /* === BULK PRINT MODE (2 invoices per page) === */
    .bulk-print-mode .print-invoice-page {
      page-break-after: auto;
      break-after: auto;
      padding: 3px 0;
      margin-bottom: 0;
      font-size: 8px;
      line-height: 1.2;
    }
    .bulk-print-mode .print-invoice-page .space-y-6 > *,
    .bulk-print-mode .print-invoice-page.space-y-6 {
      margin-top: 0;
    }
    /* Make each invoice take ~48% of page height */
    .bulk-print-mode .print-invoice-page {
      max-height: 48%;
      overflow: hidden;
    }
    /* Compact header */
    .bulk-print-mode .print-invoice-page .text-lg {
      font-size: 12px;
      line-height: 16px;
    }
    .bulk-print-mode .print-invoice-page .text-base {
      font-size: 10px;
      line-height: 14px;
    }
    /* Compact spacing */
    .bulk-print-mode .print-invoice-page .p-3 { padding: 3px; }
    .bulk-print-mode .print-invoice-page .pb-4,
    .bulk-print-mode .print-invoice-page .pb-6 { padding-bottom: 3px; }
    .bulk-print-mode .print-invoice-page .pt-3,
    .bulk-print-mode .print-invoice-page .pt-4 { padding-top: 2px; }
    .bulk-print-mode .print-invoice-page .gap-4 { gap: 4px; }
    .bulk-print-mode .print-invoice-page .rounded-xl { border-radius: 4px; }
    .bulk-print-mode .print-invoice-page .rounded-2xl { border-radius: 6px; }
    /* Compact QR code */
    .bulk-print-mode .courier-qr-card { width: 80px; padding: 2px; }
    .bulk-print-mode .courier-qr-card .courier-qr-image { width: 40px; height: 40px; }
    .bulk-print-mode .courier-qr-card .w-20 { width: 40px; }
    .bulk-print-mode .courier-qr-card .h-20 { height: 40px; }
    /* Compact signatures */
    .bulk-print-mode .invoice-signatures { padding-top: 6px; }
    .bulk-print-mode .invoice-signatures .w-32 { width: 80px; }
    /* Hide notes in bulk mode to save space */
    .bulk-print-mode .invoice-notes-area { display: none; }
    /* Separator between 2 invoices on same page */
    .bulk-print-mode .bulk-separator {
      border-top: 1px dashed #94a3b8;
      margin: 4px 0;
      display: block;
    }
    /* Page break after every 2nd invoice */
    .bulk-print-mode .bulk-page-break {
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
    }
    /* Last page break should not force extra blank page */
    .bulk-print-mode .bulk-page-break:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }

    /* Additional Tailwind Utility classes for Print layout */
    .p-6 { padding: 24px; }
    .p-8 { padding: 32px; }
    .pt-10 { padding-top: 40px; }
    .pt-1\\.5 { padding-top: 6px; }
    .pt-3 { padding-top: 12px; }
    .p-2\\.5 { padding: 10px; }
    .w-16 { width: 64px; }
    .w-24 { width: 96px; }
    .h-20 { height: 80px; }
    .p-1 { padding: 4px; }
    .gap-4 { gap: 16px; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }

    @media print {
      .print\:border-0 { border: 0 !important; }
      .print\:p-0 { padding: 0 !important; }
      .print\:rounded-none { border-radius: 0 !important; }
    }`;
