import { Loader2, ShieldAlert } from 'lucide-react';

interface ConnectionErrorBannerProps {
  message: string;
  onRetry: () => void;
}

/** Full-width banner shown when the console bootstrap request fails. */
export function ConnectionErrorBanner({ message, onRetry }: ConnectionErrorBannerProps) {
  return (
    <div className="m-4 md:m-8 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-start gap-3">
      <ShieldAlert className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
      <div>
        <h4 className="font-bold">Connection Error</h4>
        <p className="text-xs mt-1 text-rose-700">{message}</p>
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/** Shimmer placeholder rendered while the first console payload loads. */
export function ConsoleSkeleton() {
  return (
    <div className="bk-console-page flex-1 space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="h-4 bg-slate-100 rounded w-1/2" />
            <div className="h-8 bg-slate-200 rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 animate-pulse">
        <div className="lg:col-span-2 h-72 rounded-xl border border-slate-200 bg-white p-6" />
        <div className="lg:col-span-1 h-72 rounded-xl border border-slate-200 bg-white p-6" />
      </div>
      <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
    </div>
  );
}

/** Suspense fallback for lazily loaded workspace views. */
export function PageSuspenseFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-sm text-slate-400 font-medium">Loading...</span>
      </div>
    </div>
  );
}
