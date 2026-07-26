import React from 'react';
import { Sparkles, XCircle, CheckCircle, Info } from 'lucide-react';
import { Suggestion } from '../types';

interface SuggestionsViewProps {
  suggestions: Suggestion[];
  optScore: number;
  aiReviewing: boolean;
  handleAiReview: () => Promise<void>;
  toggleResolveSuggestion: (id: string, isNowResolved: boolean) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
}

export function SuggestionsView({
  suggestions,
  optScore,
  aiReviewing,
  handleAiReview,
  toggleResolveSuggestion,
  dismissSuggestion
}: SuggestionsViewProps) {
  const uniqueSuggestions = Array.from(
    suggestions.reduce((map, suggestion) => {
      const key = [
        suggestion.platform || 'global',
        suggestion.title,
        suggestion.explanation,
        suggestion.fixAction,
      ].map(value => String(value || '').trim().toLowerCase()).join('|') || suggestion.id;
      if (!map.has(key)) {
        map.set(key, suggestion);
      }
      return map;
    }, new Map<string, Suggestion>()).values()
  );
  const unresolvedSuggestions = uniqueSuggestions.filter(s => !s.resolved);
  const allHealthy = unresolvedSuggestions.length === 0;
  const healthChecks = [
    { name: 'Meta CAPI', state: 'Connected' },
    { name: 'TikTok Events', state: 'Active' },
    { name: 'GA4 route', state: 'Checked' },
  ];

  return (
    <div className="space-y-2 md:space-y-6">
      
      {/* Top tracking health optimization header */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5 shadow-inner md:flex-row md:items-center md:gap-6 md:p-6">
        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-white text-indigo-600 md:h-8 md:w-8">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-900 md:text-base">Tracking Health Check</h2>
            <p className="max-w-2xl text-[10px] leading-snug text-slate-500 md:text-xs md:leading-normal">
              We check your tracking setup and suggest improvements. Fix the issues below to get better results from your ads.
            </p>
          </div>
        </div>

        {/* Optimization score badge widget */}
        <div className="w-full shrink-0 md:w-56">
          <span className="block text-[9px] font-bold uppercase leading-none tracking-widest text-slate-500 md:text-xs">Tracking Score</span>
          <div className="mt-0.5 flex items-end justify-between gap-3">
            <span className="font-mono text-4xl font-extrabold leading-none text-slate-800">{optScore}<span className="text-xl">%</span></span>
            <span className={`mb-0.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-bold ${
              allHealthy
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
              {allHealthy && <CheckCircle className="h-3 w-3" />}
              {allHealthy ? 'All checks passed' : `${unresolvedSuggestions.length} need attention`}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-sky-500" style={{ width: `${optScore}%` }} />
          </div>
        </div>
      </div>

      {/* Live Diagnostics scan trigger CTA */}
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center md:p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 md:h-10 md:w-10 md:border md:border-indigo-200 md:bg-indigo-100">
            <Sparkles className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800  text-xs uppercase tracking-wider">Check My Setup</h3>
            <p className="text-[10px] leading-snug text-slate-400 md:text-xs">Scan your tracking setup for problems and get clear fix suggestions.</p>
          </div>
        </div>

        <button
          disabled={aiReviewing}
          onClick={handleAiReview}
          className="flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-indigo-400 sm:w-auto md:min-h-10 md:text-xs"
        >
          {aiReviewing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Check My Setup</span>
            </>
          )}
        </button>
      </div>

      {/* Suggestions lists */}
      <div className="space-y-2 md:space-y-4">
        {unresolvedSuggestions.length === 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start gap-2.5 p-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 md:text-sm">Excellent! All checklist resolved</h3>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-400 md:text-xs">Your tracking setup looks healthy across Meta, TikTok, and GA4.</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {healthChecks.map((item) => (
                <div key={item.name} className="flex min-h-9 items-center justify-between gap-4 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle className="h-3 w-3" />
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700 md:text-xs">{item.name}</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 md:text-[10px]">{item.state}</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 text-[9px] leading-relaxed text-slate-400 md:text-xs">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <p>This result uses the latest data on this page. Check again after changing Settings or updating the WordPress plugin.</p>
            </div>
          </div>
        )}

        {/* Suggestions cards mapping */}
        <div className="grid grid-cols-1 gap-4">
          {uniqueSuggestions.map((s) => (
            <div 
              key={s.id} 
              className={`rounded-xl border bg-white  p-5 shadow-sm space-y-4 transition-all ${
                s.resolved ? 'border-green-200/50  opacity-60' : 
                s.severity === 'Critical' ? 'border-l-4 border-l-rose-500 border-slate-200 ' :
                s.severity === 'Warning' ? 'border-l-4 border-l-amber-500 border-slate-200 ' :
                'border-l-4 border-l-indigo-400 border-slate-200 '
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      s.severity === 'Critical' ? 'bg-rose-50 text-rose-700 border border-rose-200   ' : 
                      s.severity === 'Warning' ? 'bg-amber-50 text-amber-700 border border-amber-200   ' : 
                      'bg-indigo-50 text-indigo-700 border border-indigo-200   '
                    }`}>
                      {s.severity}
                    </span>
                    {s.platform && (
                      <span className="text-xs text-slate-400  font-mono font-semibold">{s.platform} module</span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-800  text-sm mt-1.5">{s.title}</h3>
                </div>

                <div className="flex gap-1">
                  <button 
                    onClick={() => toggleResolveSuggestion(s.id, !s.resolved)}
                    className={`min-h-10 cursor-pointer rounded border px-2.5 py-1 text-xs font-semibold ${
                      s.resolved 
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100   ' 
                        : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100   '
                    }`}
                  >
                    {s.resolved ? '✓ Resolved' : 'Mark Fixed'}
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => dismissSuggestion(s.id)}
                    className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    aria-label={`Dismiss ${s.title}`}
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500  leading-relaxed max-w-4xl">{s.explanation}</p>

              <div className="p-3 bg-slate-50  border border-slate-200  rounded text-xs text-slate-600 ">
                <span className="font-bold text-xs text-indigo-700  uppercase tracking-wider block mb-1">How to fix</span>
                <p className="whitespace-pre-line leading-relaxed">{s.fixAction}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
