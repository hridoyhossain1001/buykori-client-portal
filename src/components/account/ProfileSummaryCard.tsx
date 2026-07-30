import { Check } from 'lucide-react';
import type { UserProfile } from '../../types';

interface ProfileSummaryCardProps {
  profile: UserProfile;
  usagePercent: number;
}

export function ProfileSummaryCard({ profile, usagePercent }: ProfileSummaryCardProps) {
  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-black uppercase text-white shadow-md shadow-indigo-200">
          {(profile.name || profile.email || 'A').trim().charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-slate-900">{profile.name || 'Your account'}</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><Check className="h-3 w-3" /> Active</span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{profile.email}</p>
        </div>
      </div>
      <div className="border-t border-slate-200 pt-3 lg:min-w-36 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current plan</p>
        <p className="mt-1 text-sm font-bold text-slate-900">{profile.plan}</p>
        <p className="mt-1 text-[11px] text-slate-400">Renews {profile.renewalDate || 'not scheduled'}</p>
      </div>
      <div className="border-t border-slate-200 pt-3 lg:min-w-52 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly usage</p>
          <span className="text-[10px] font-bold text-indigo-600">{usagePercent.toFixed(2)}%</span>
        </div>
        <p className="mt-1 text-sm font-bold text-slate-900">{profile.eventsUsed.toLocaleString()} / {profile.eventsQuota.toLocaleString()}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${usagePercent}%` }} /></div>
      </div>
    </section>
  );
}

export default ProfileSummaryCard;
