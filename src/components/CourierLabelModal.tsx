import React, { useEffect, useMemo, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { Package, Printer, Ruler, X } from 'lucide-react';

interface CourierLabelOrder {
  id?: number;
  orderId?: string;
  order_id?: string;
  recipientName?: string;
  recipient_name?: string;
  recipientPhone?: string;
  recipient_phone?: string;
  recipientAddress?: string;
  recipient_address?: string;
  amount?: number;
  cod_amount?: number;
  courier_provider?: string;
  courier_order_id?: string;
  courier_tracking_id?: string;
}

interface CourierLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CourierLabelOrder | null;
  orders?: CourierLabelOrder[] | null;
  storeName?: string;
}

type LabelSize = '3x3' | '2x3';

interface LabelAsset {
  barcodeUrl: string;
  qrCodeUrl: string;
}

const LABEL_DIMENSIONS: Record<LabelSize, { width: number; height: number; label: string }> = {
  '3x3': { width: 3, height: 3, label: '3 x 3 in' },
  '2x3': { width: 2, height: 3, label: '2 x 3 in' },
};

function getOrderId(order: CourierLabelOrder): string {
  return String(order.orderId || order.order_id || 'N/A');
}

function getTrackingCode(order: CourierLabelOrder): string {
  return String(order.courier_tracking_id || order.courier_order_id || getOrderId(order));
}

function getTrackingUrl(order: CourierLabelOrder): string {
  return `https://api.buykori.app/api/track/${encodeURIComponent(getTrackingCode(order))}`;
}

function makeBarcodeUrl(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, {
    format: 'CODE128',
    displayValue: true,
    font: 'monospace',
    fontSize: 16,
    height: 54,
    margin: 0,
    textMargin: 2,
    width: 2,
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
}

export function CourierLabelModal({
  isOpen,
  onClose,
  order,
  orders,
  storeName = 'Buykori AdSync Shop',
}: CourierLabelModalProps) {
  const [labelSize, setLabelSize] = useState<LabelSize>('3x3');
  const [parcelWeight, setParcelWeight] = useState('0.5 KG');
  const [assets, setAssets] = useState<Record<string, LabelAsset>>({});

  const ordersList = useMemo(
    () => (orders && orders.length > 0 ? orders : order ? [order] : []),
    [order, orders],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      ordersList.map(async (currentOrder) => {
        const key = getOrderId(currentOrder);
        const trackingCode = getTrackingCode(currentOrder);
        const qrCodeUrl = await QRCode.toDataURL(getTrackingUrl(currentOrder), {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 160,
        });
        return {
          key,
          asset: {
            barcodeUrl: makeBarcodeUrl(trackingCode),
            qrCodeUrl,
          },
        };
      }),
    )
      .then((results) => {
        if (cancelled) return;
        setAssets(
          results.reduce<Record<string, LabelAsset>>((next, result) => {
            next[result.key] = result.asset;
            return next;
          }, {}),
        );
      })
      .catch((error) => console.error('Courier label generation failed', error));

    return () => {
      cancelled = true;
    };
  }, [ordersList]);

  if (!isOpen || ordersList.length === 0) return null;

  const dimensions = LABEL_DIMENSIONS[labelSize];

  const handlePrint = () => {
    const printArea = document.querySelector('.print-courier-label-area');
    if (!printArea) return;

    const printWindow = window.open('', '_blank', 'width=720,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Courier Label Print</title>
  <style>
    @page { size: ${dimensions.width}in ${dimensions.height}in; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; background: #fff; font-family: Arial, sans-serif; }
    .courier-label-sheet {
      width: ${dimensions.width}in;
      height: ${dimensions.height}in;
      padding: ${labelSize === '3x3' ? '0.09in' : '0.06in'};
      overflow: hidden;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .courier-label-sheet:last-child { page-break-after: auto; break-after: auto; }
    .courier-label-header { display: flex; align-items: center; justify-content: space-between; gap: 6px; border-bottom: 1.5px solid #111827; padding-bottom: 4px; }
    .courier-label-brand { font-size: ${labelSize === '3x3' ? '14px' : '11px'}; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .courier-label-provider { font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .courier-label-barcode { width: 100%; height: ${labelSize === '3x3' ? '50px' : '42px'}; object-fit: fill; }
    .courier-label-grid { display: grid; grid-template-columns: ${labelSize === '3x3' ? '68px 1fr' : '54px 1fr'}; gap: 5px; align-items: center; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
    .courier-label-qr { width: ${labelSize === '3x3' ? '66px' : '52px'}; height: ${labelSize === '3x3' ? '66px' : '52px'}; }
    .courier-label-meta { display: grid; grid-template-columns: auto 1fr; gap: 2px 5px; font-size: ${labelSize === '3x3' ? '9px' : '7px'}; }
    .courier-label-meta span:nth-child(odd), .courier-label-row span:first-child { color: #64748b; font-weight: 800; text-transform: uppercase; }
    .courier-label-meta span:nth-child(even) { text-align: right; font-weight: 800; }
    .courier-label-recipient { display: grid; gap: 2px; font-size: ${labelSize === '3x3' ? '10px' : '8px'}; line-height: 1.1; }
    .courier-label-row { display: grid; grid-template-columns: ${labelSize === '3x3' ? '54px' : '42px'} 1fr; gap: 4px; }
    .courier-label-row span:last-child { font-weight: 800; overflow-wrap: anywhere; }
    .courier-label-cod { margin-top: auto; display: flex; align-items: center; justify-content: space-between; border: 1.5px solid #111827; padding: ${labelSize === '3x3' ? '4px 6px' : '3px 4px'}; font-size: ${labelSize === '3x3' ? '10px' : '8px'}; font-weight: 800; }
    .courier-label-cod strong { font-size: ${labelSize === '3x3' ? '15px' : '12px'}; }
    .courier-label-footer { display: flex; justify-content: space-between; gap: 4px; font-size: ${labelSize === '3x3' ? '7px' : '6px'}; color: #64748b; }
  </style>
</head>
<body>${printArea.innerHTML}</body>
</html>`);
    printWindow.document.close();

    const images = Array.from(printWindow.document.querySelectorAll('img'));
    const print = () => {
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 120);
    };

    if (images.length === 0) {
      print();
      return;
    }

    let loaded = 0;
    const markLoaded = () => {
      loaded += 1;
      if (loaded >= images.length) print();
    };
    images.forEach((image) => {
      if (image.complete) markLoaded();
      else {
        image.onload = markLoaded;
        image.onerror = markLoaded;
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="my-8 flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Courier Label Printer {ordersList.length > 1 && `(${ordersList.length} labels)`}
              </h3>
              <p className="text-[10px] text-slate-400">Thermal-printer layout with Code128 barcode and tracking QR.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              {(Object.keys(LABEL_DIMENSIONS) as LabelSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setLabelSize(size)}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    labelSize === size
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {LABEL_DIMENSIONS[size].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              <Printer className="h-3.5 w-3.5" />
              {ordersList.length > 1 ? `Print All Labels (${ordersList.length})` : 'Print Label'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Ruler className="h-4 w-4 text-indigo-500" />
            Parcel weight
          </div>
          <select
            value={parcelWeight}
            onChange={(event) => setParcelWeight(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option>0.5 KG</option>
            <option>1 KG</option>
            <option>2 KG</option>
            <option>3 KG</option>
            <option>5 KG</option>
          </select>
          <p className="text-[10px] text-slate-400">Each selected consignment prints on its own thermal label page.</p>
        </div>

        <div className="max-h-[75vh] overflow-y-auto bg-slate-200 p-6 dark:bg-slate-950">
          <div className="print-courier-label-area mx-auto flex flex-col items-center gap-5">
            {ordersList.map((currentOrder) => {
              const orderId = getOrderId(currentOrder);
              const trackingCode = getTrackingCode(currentOrder);
              const asset = assets[orderId];
              const recipientName = currentOrder.recipientName || currentOrder.recipient_name || 'Customer';
              const recipientPhone = currentOrder.recipientPhone || currentOrder.recipient_phone || '-';
              const recipientAddress = currentOrder.recipientAddress || currentOrder.recipient_address || '-';
              const codAmount = Number(currentOrder.amount ?? currentOrder.cod_amount ?? 0);
              const provider = currentOrder.courier_provider || 'Courier';

              return (
                <div
                  key={`${orderId}-${trackingCode}`}
                  className="courier-label-sheet flex flex-col gap-1 overflow-hidden bg-white p-2 text-slate-900 shadow-lg"
                  style={{ width: `${dimensions.width}in`, height: `${dimensions.height}in` }}
                >
                  <div className="courier-label-header flex items-center justify-between gap-2 border-b-2 border-slate-900 pb-1">
                    <span className="courier-label-brand truncate text-sm font-black">{storeName}</span>
                    <span className="courier-label-provider text-[9px] font-black uppercase">{provider}</span>
                  </div>
                  {asset?.barcodeUrl ? (
                    <img className="courier-label-barcode h-[50px] w-full object-fill" src={asset.barcodeUrl} alt={`Barcode ${trackingCode}`} />
                  ) : (
                    <div className="h-[50px]" />
                  )}
                  <div className="courier-label-grid grid grid-cols-[68px_1fr] items-center gap-1 border-b border-slate-300 pb-1">
                    {asset?.qrCodeUrl ? (
                      <img className="courier-label-qr h-[66px] w-[66px]" src={asset.qrCodeUrl} alt={`QR ${trackingCode}`} />
                    ) : (
                      <div className="h-[66px] w-[66px]" />
                    )}
                    <div className="courier-label-meta grid grid-cols-[auto_1fr] gap-x-1 gap-y-0.5 text-[9px]">
                      <span className="font-black uppercase text-slate-500">Invoice</span><span className="text-right font-black">{orderId}</span>
                      <span className="font-black uppercase text-slate-500">Tracking</span><span className="text-right font-black">{trackingCode}</span>
                      <span className="font-black uppercase text-slate-500">Delivery</span><span className="text-right font-black">Home</span>
                      <span className="font-black uppercase text-slate-500">Weight</span><span className="text-right font-black">{parcelWeight}</span>
                    </div>
                  </div>
                  <div className="courier-label-recipient grid gap-0.5 text-[10px] leading-tight">
                    <div className="courier-label-row grid grid-cols-[54px_1fr] gap-1"><span className="font-black uppercase text-slate-500">Name</span><span className="font-black">{recipientName}</span></div>
                    <div className="courier-label-row grid grid-cols-[54px_1fr] gap-1"><span className="font-black uppercase text-slate-500">Phone</span><span className="font-black">{recipientPhone}</span></div>
                    <div className="courier-label-row grid grid-cols-[54px_1fr] gap-1"><span className="font-black uppercase text-slate-500">Address</span><span className="font-black">{recipientAddress}</span></div>
                  </div>
                  <div className="courier-label-cod mt-auto flex items-center justify-between border-2 border-slate-900 px-1.5 py-1 text-[10px] font-black uppercase">
                    <span>Cash on delivery</span>
                    <strong className="text-[15px]">৳ {codAmount.toLocaleString()}</strong>
                  </div>
                  <div className="courier-label-footer flex justify-between gap-1 text-[7px] text-slate-500">
                    <span>Printed: {new Date().toLocaleString()}</span>
                    <span>Scan QR to track</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
