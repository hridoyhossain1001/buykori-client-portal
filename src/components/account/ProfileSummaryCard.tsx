import { Check } from 'lucide-react';
import type { UserProfile } from '../../types';

interface ProfileSummaryCardProps {
  profile: UserProfile;
  usagePercent: number;
}

export function ProfileSummaryCard({ profile, usagePercent }: ProfileSummaryCardProps) {
  const meterWidth = Math.min(100, Math.max(0, usagePercent));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-black uppercase text-white shadow-md shadow-indigo-200">
          {(profile.name || profile.email || 'A').trim().charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current plan</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-base font-bold leading-tight text-slate-900">{profile.plan}</h2>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><Check className="h-3 w-3" /> Active</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Renews {profile.renewalDate || 'not scheduled'}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly usage</p>
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-indigo-600">{usagePercent.toFixed(2)}%</span>
        </div>
        <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{profile.eventsUsed.toLocaleString()} / {profile.eventsQuota.toLocaleString()} events</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${meterWidth}%` }} /></div>
      </div>
    </section>
  );
}

export default ProfileSummaryCard;
