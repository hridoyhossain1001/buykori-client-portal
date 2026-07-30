// Presentational badge helpers shared by the pending and shipped order panels.

export function getStatusBadge(status: string) {
  const s = String(status || 'pending').toLowerCase();
  if (s === 'booking_queued' || s === 'booking_processing') {
    return (
      <span className="inline-flex min-w-[86px] justify-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">
        {s === 'booking_processing' ? 'Booking Now' : 'Booking Queued'}
      </span>
    );
  }
  if (s === 'booking_failed') {
    return (
      <span className="inline-flex min-w-[86px] justify-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
        Booking Failed
      </span>
    );
  }
  if (s === 'delivered' || s === 'completed') {
    return (
      <span className="inline-flex min-w-[86px] justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
        Delivered
      </span>
    );
  }
  if (s === 'returned' || s === 'partial_returned') {
    return (
      <span className="inline-flex min-w-[86px] justify-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
        Returned
      </span>
    );
  }
  if (s === 'cancelled') {
    return (
      <span className="inline-flex min-w-[86px] justify-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-700">
        Cancelled
      </span>
    );
  }
  if (s === 'in_transit' || s === 'picked_up' || s === 'shipped') {
    return (
      <span className="inline-flex min-w-[86px] justify-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
        In Transit
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-[86px] justify-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
      Pending
    </span>
  );
}

export function getCapiStatusBadge(sent: boolean) {
  return sent ? (
    <span className="inline-flex min-w-[86px] justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
      Synced
    </span>
  ) : (
    <span className="inline-flex min-w-[86px] justify-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-500">
      Waiting
    </span>
  );
}

const STEADFAST_TRACKING = 'https://portal.packzy.com/tracking/';
const REDX_TRACKING = 'https://redx.com.bd/track-delivery/?trackingId=';
const PATHAO_TRACKING = 'https://pathao.com/courier/tracking?tracking_id=';

export function getCourierTrackingUrl(provider: string, trackingId: string) {
  const id = encodeURIComponent(trackingId);
  if (provider === 'steadfast') return STEADFAST_TRACKING + id;
  if (provider === 'redx') return REDX_TRACKING + id;
  if (provider === 'pathao') return PATHAO_TRACKING + id;
  return '';
}
