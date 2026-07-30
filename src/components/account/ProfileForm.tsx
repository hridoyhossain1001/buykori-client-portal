import React from 'react';
import { Check, LockKeyhole, UserRound } from 'lucide-react';
import type { UserProfile } from '../../types';

interface ProfileFormProps {
  profile: UserProfile;
  profName: string;
  setProfName: (v: string) => void;
  profNotifEmail: string;
  setProfNotifEmail: (v: string) => void;
  profUpdating: boolean;
  submitProfileSave: (e: React.FormEvent) => Promise<boolean>;
}

export function ProfileForm({
  profile,
  profName,
  setProfName,
  profNotifEmail,
  setProfNotifEmail,
  profUpdating,
  submitProfileSave,
}: ProfileFormProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><UserRound className="h-4 w-4" /></span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Profile</h3>
          <p className="mt-0.5 text-xs text-slate-500">Your account details and where we send alerts.</p>
        </div>
      </div>

      <form onSubmit={submitProfileSave}>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="account-display-name" className="block text-xs font-semibold text-slate-400  uppercase mb-1">Display Name</label>
              <input
                id="account-display-name"
                type="text"
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="account-profile-email" className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                Sign-in Email
                {profile.emailVerified !== false && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold normal-case text-emerald-700"><Check className="h-3 w-3" /> Verified</span>}
              </label>
              <div className="relative">
                <input
                  id="account-profile-email"
                  type="email"
                  value={profile.email}
                  readOnly
                  aria-readonly="true"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 pr-9 text-xs text-slate-500"
                />
                <LockKeyhole className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Contact support to change your sign-in email.</p>
            </div>
          </div>

          <div>
            <label htmlFor="account-notification-email" className="block text-xs font-semibold text-slate-400  uppercase mb-1">Notification Email</label>
            <input
              id="account-notification-email"
              type="email"
              value={profNotifEmail}
              onChange={(e) => setProfNotifEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-[11px] text-slate-400">Order alerts, weekly reports and billing receipts are sent here.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-400">Account details update immediately after saving.</p>
          <button
            type="submit"
            disabled={profUpdating}
            className="min-h-10 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            {profUpdating ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProfileForm;
