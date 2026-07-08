import React from 'react';
import { RotateCcw } from 'lucide-react';
import { UserProfile } from '../types';

interface AccountViewProps {
  profile: UserProfile;
  profName: string;
  setProfName: (v: string) => void;
  profEmail: string;
  setProfEmail: (v: string) => void;
  profNotifEmail: string;
  setProfNotifEmail: (v: string) => void;
  profUpdating: boolean;
  submitProfileSave: (e: React.FormEvent) => Promise<void>;
  passCurrent: string;
  setPassCurrent: (v: string) => void;
  passNew: string;
  setPassNew: (v: string) => void;
  passConfirm: string;
  setPassConfirm: (v: string) => void;
  submitPasswordUpdate: () => Promise<void>;
  submitPasswordResetEmail: () => Promise<void>;
  confirmRevokeText: string;
  setConfirmRevokeText: (v: string) => void;
  confirmDeleteText: string;
  setConfirmDeleteText: (v: string) => void;
  handleTokenRevoke: () => Promise<void>;
  handleDeleteAccountRequest: () => void;
  handleDemoReset: () => Promise<void>;
  showToast: (msg: string, isErr?: boolean) => void;
}

export function AccountView({
  profile,
  profName,
  setProfName,
  profEmail,
  setProfEmail,
  profNotifEmail,
  setProfNotifEmail,
  profUpdating,
  submitProfileSave,
  passCurrent,
  setPassCurrent,
  passNew,
  setPassNew,
  passConfirm,
  setPassConfirm,
  submitPasswordUpdate,
  submitPasswordResetEmail,
  confirmRevokeText,
  setConfirmRevokeText,
  confirmDeleteText,
  setConfirmDeleteText,
  handleTokenRevoke,
  handleDeleteAccountRequest,
  handleDemoReset,
  showToast
}: AccountViewProps) {
  const currentPlanLower = String(profile.plan || '').toLowerCase();
  const isFreeOrTrial = currentPlanLower.includes('free') || currentPlanLower.includes('trial');
  const isGrowth = currentPlanLower.includes('growth');
  const isScale = currentPlanLower.includes('scale');
  const isAgency = currentPlanLower.includes('agency');
  const planFeatures = profile.planFeatures?.length ? profile.planFeatures : [
    {
      key: 'whatsapp_alerts',
      label: 'WhatsApp order alerts',
      description: 'Purchase and recovery notifications can be sent to the store owner by WhatsApp.',
      included: !!profile.growthFeaturesEnabled,
      minimumPlan: 'Growth',
    },
    {
      key: 'incomplete_checkout_recovery',
      label: 'Incomplete checkout recovery',
      description: 'Abandoned checkout leads can be reviewed, contacted, and recovered from the portal.',
      included: !!profile.growthFeaturesEnabled,
      minimumPlan: 'Growth',
    },
  ];
  
  const isDemo = window.location.hostname.includes('localhost') || 
                 window.location.hostname.includes('127.0.0.1');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Edit forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Account detail profile save */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-4 ">Edit Profile</h3>
          
          <form onSubmit={submitProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Display Name</label>
                <input 
                  type="text" 
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Profile Email</label>
                <input 
                  type="email" 
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Notification Email</label>
              <input 
                type="email" 
                value={profNotifEmail}
                onChange={(e) => setProfNotifEmail(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded"
              />
            </div>


            <div className="pt-2 text-right">
              <button 
                type="submit"
                disabled={profUpdating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                {profUpdating ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Password modifier */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-4 ">Change Password</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Current Password</label>
                <input 
                  type="password" 
                  value={passCurrent} 
                  placeholder="**************"
                  onChange={(e) => setPassCurrent(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">New Password</label>
                <input 
                  type="password" 
                  value={passNew} 
                  placeholder="Enter secure password"
                  onChange={(e) => setPassNew(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Confirm New Password</label>
                <input 
                  type="password" 
                  value={passConfirm} 
                  placeholder="Confirm secure password"
                  onChange={(e) => setPassConfirm(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={submitPasswordResetEmail}
                className="text-left text-xs font-bold text-indigo-600 hover:text-indigo-700 underline-offset-4 hover:underline"
              >
                Forgot current password? Send reset link
              </button>
              <button 
                type="button"
                onClick={submitPasswordUpdate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>

        {/* Danger parameters */}
        <div className="rounded-xl border border-rose-200 bg-rose-50   p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-rose-800  text-sm uppercase tracking-wide">Danger Zone</h3>
            <p className="text-xs text-rose-600  leading-normal mt-0.5">These actions can't be undone. Please confirm carefully.</p>
          </div>

          <div className="space-y-5 divide-y divide-rose-200/50 ">
            
            {/* Webhook access key change */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-rose-800  uppercase tracking-widest mt-2">Reset API Key</h4>
              <p className="text-xs text-rose-700  leading-relaxed max-w-2xl">
                This will reset your API key. Tracking will pause until you update the new key in your WordPress plugin.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Type REVOKE to confirm"
                  value={confirmRevokeText}
                  onChange={(e) => setConfirmRevokeText(e.target.value)}
                  className="p-2 text-xs bg-white border border-rose-200/50 rounded font-mono text-rose-900 focus:outline-none focus:border-rose-500 w-full sm:w-80   "
                />
                <button 
                  type="button"
                  onClick={handleTokenRevoke}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shadow cursor-pointer whitespace-nowrap"
                >
                  Reset API Key
                </button>
              </div>
            </div>

            {/* Deletion requests */}
            <div className="pt-5 space-y-3">
              <h4 className="font-bold text-xs text-rose-800  uppercase tracking-widest">Delete account request</h4>
              <p className="text-xs text-rose-700  leading-relaxed max-w-2xl">
                Account deletion is not self-service in this portal yet. Contact support to request permanent removal of trace logs, analytical reports, billing data and routing keys.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Type DELETE to confirm"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  className="p-2 text-xs bg-white border border-rose-200/50 rounded font-mono text-rose-900 focus:outline-none focus:border-rose-500 w-full sm:w-80   "
                />
                <button 
                  type="button"
                  onClick={handleDeleteAccountRequest}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shadow cursor-pointer whitespace-nowrap"
                >
                  Contact support for deletion
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Left side subscriptions container */}
      <div className="space-y-6">
        
        {/* Current Active Plan summary card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div>
            <span className="text-[10px] font-bold text-indigo-600  uppercase tracking-wider block">Your Plan</span>
            <h3 className="text-lg font-bold text-slate-800  mt-1">{profile.plan}</h3>
            <p className="text-[11px] text-slate-400  mt-0.5">Billing changes are handled by support</p>
          </div>

          <div className="space-y-2 text-xs text-slate-700  font-medium">
            <div className="flex justify-between border-b border-slate-100  pb-2">
              <span className="text-slate-400 ">Monthly renewal date:</span>
              <span className="font-semibold text-slate-800 ">{profile.renewalDate}</span>
            </div>
            
            <div className="flex justify-between border-b border-slate-100  pb-2">
              <span className="text-slate-400 ">Monthly Usage:</span>
              <span className="font-semibold text-slate-800 ">{(profile.eventsUsed).toLocaleString()} / {profile.eventsQuota.toLocaleString()} counts</span>
            </div>

            <div className="flex justify-between pb-2">
              <span className="text-slate-400 ">Ad Blocker Bypass:</span>
              <span className="font-semibold text-indigo-700 ">Fully Enabled ✓</span>
            </div>
          </div>

          <div className="h-px bg-slate-100 " />

          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Growth features</span>
              {profile.growthFeaturesEnabled ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Included</span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Upgrade required</span>
              )}
            </div>
            <div className="space-y-2">
              {planFeatures.map((feature) => (
                <div key={feature.key} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 flex h-4 min-w-7 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-black ${feature.included ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {feature.included ? 'Yes' : 'No'}
                  </span>
                  <div>
                    <div className="font-bold text-slate-800 ">{feature.label}</div>
                    <p className="text-[11px] leading-snug text-slate-500 ">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-100 " />

          <div>
            <span className="block text-[10px] font-bold text-slate-400  uppercase tracking-wide mb-2">Upgrade Plan</span>
            {isScale ? (
              <div className="p-4 border border-indigo-200  rounded bg-indigo-50/20  text-center space-y-2">
                <span className="font-bold text-slate-800  block text-xs uppercase tracking-wide">You are on our highest standard plan</span>
                <p className="text-[11px] text-slate-500  leading-relaxed">For custom event volume, extra tracking routes, or higher usage limits, please contact support.</p>
                <button 
                  onClick={() => showToast("Custom billing requests are not automated here. Contact support@buykori.app.", true)}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-[10px] cursor-pointer shadow-sm transition-colors"
                  type="button"
                >
                  Contact Enterprise Support
                </button>
              </div>
            ) : isAgency ? (
              <div className="p-4 border border-slate-200  rounded bg-slate-50/50  text-center space-y-2">
                <span className="font-bold text-slate-800  block text-xs uppercase tracking-wide">Active Premium Agency Plan</span>
                <p className="text-[11px] text-slate-500  leading-relaxed">Your account is configured with a customized event volume capacity.</p>
                <button 
                  onClick={() => showToast("Contact support@buykori.app for any plan modifications.", true)}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold text-[10px] cursor-pointer shadow-sm transition-colors"
                  type="button"
                >
                  Contact Support
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-center text-xs">
                {isFreeOrTrial && (
                  <div className="p-3 border border-indigo-200  rounded bg-indigo-50/50  flex flex-col justify-between">
                    <span className="font-bold text-slate-800  leading-none">Growth Plan</span>
                    <span className="text-[10px] text-indigo-600  mt-1 leading-none">500k Events / mo</span>
                    <span className="text-xs font-mono font-extrabold mt-3 text-indigo-700 ">$49 / mo</span>
                    <button 
                      onClick={() => showToast("Billing checkout is not connected yet. Contact support@buykori.app to upgrade.", true)}
                      className="mt-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-[10px] cursor-pointer"
                      type="button"
                    >
                      Upgrade Plan
                    </button>
                  </div>
                )}
                
                <div className="p-3 border border-slate-200  rounded hover:bg-slate-50  flex flex-col justify-between">
                  <span className="font-bold text-slate-800  leading-none">Scale Plan</span>
                  <span className="text-[10px] text-slate-400  mt-1 leading-none font-medium">1M Events / mo</span>
                  <span className="text-xs font-mono font-extrabold mt-3 text-slate-700 ">$99 / mo</span>
                  <button 
                    onClick={() => showToast("Billing checkout is not connected yet. Contact support@buykori.app to upgrade.", true)}
                    className="mt-3 py-1 bg-slate-800 hover:bg-slate-900   text-white rounded font-semibold text-[10px] cursor-pointer"
                    type="button"
                  >
                    Upgrade Plan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reset demo sandbox context values widget */}
        {isDemo && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3  ">
            <div>
              <h4 className="font-bold text-slate-800  text-xs uppercase tracking-wider">Demo Controls</h4>
              <p className="text-xs text-slate-400 ">Restore test values for demos</p>
            </div>

            <button 
              onClick={handleDemoReset}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200    text-slate-800  rounded text-xs font-semibold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Data
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
