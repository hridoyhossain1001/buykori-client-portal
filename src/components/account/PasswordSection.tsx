import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

interface PasswordSectionProps {
  passCurrent: string;
  setPassCurrent: (v: string) => void;
  passNew: string;
  setPassNew: (v: string) => void;
  passConfirm: string;
  setPassConfirm: (v: string) => void;
  submitPasswordUpdate: () => Promise<void>;
  submitPasswordResetEmail: () => Promise<void>;
}

export function PasswordSection({
  passCurrent,
  setPassCurrent,
  passNew,
  setPassNew,
  passConfirm,
  setPassConfirm,
  submitPasswordUpdate,
  submitPasswordResetEmail,
}: PasswordSectionProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = [
    passNew.length >= 8,
    /[a-z]/.test(passNew) && /[A-Z]/.test(passNew),
    /\d/.test(passNew),
    /[^A-Za-z0-9]/.test(passNew),
  ].filter(Boolean).length;
  const passwordStrengthLabel = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><LockKeyhole className="h-4 w-4" /></span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Password</h3>
          <p className="mt-0.5 text-xs text-slate-500">Use a unique password between 8 and 128 characters.</p>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-3">
        {[
          {
            id: 'account-current-password',
            label: 'Current password',
            value: passCurrent,
            setValue: setPassCurrent,
            shown: showCurrentPassword,
            setShown: setShowCurrentPassword,
            placeholder: 'Enter current password',
            autoComplete: 'current-password',
          },
          {
            id: 'account-new-password',
            label: 'New password',
            value: passNew,
            setValue: setPassNew,
            shown: showNewPassword,
            setShown: setShowNewPassword,
            placeholder: 'At least 8 characters',
            autoComplete: 'new-password',
          },
          {
            id: 'account-confirm-password',
            label: 'Confirm new password',
            value: passConfirm,
            setValue: setPassConfirm,
            shown: showConfirmPassword,
            setShown: setShowConfirmPassword,
            placeholder: 'Repeat new password',
            autoComplete: 'new-password',
          },
        ].map(field => (
          <div key={field.id}>
            <label htmlFor={field.id} className="mb-1 block text-xs font-semibold uppercase text-slate-500">{field.label}</label>
            <div className="relative">
              <input
                id={field.id}
                type={field.shown ? 'text' : 'password'}
                value={field.value}
                placeholder={field.placeholder}
                minLength={field.id === 'account-current-password' ? undefined : 8}
                maxLength={field.id === 'account-current-password' ? undefined : 128}
                autoComplete={field.autoComplete}
                onChange={event => field.setValue(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 pr-10 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button type="button" onClick={() => field.setShown(!field.shown)} aria-label={`${field.shown ? 'Hide' : 'Show'} ${field.label}`} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
                {field.shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {field.id === 'account-new-password' && passNew && (
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4].map(level => <span key={level} className={`h-1 flex-1 rounded-full ${passwordStrength >= level ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}
                <span className="ml-1 text-[10px] font-bold text-emerald-700">{passwordStrengthLabel}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={submitPasswordResetEmail} className="min-h-10 text-left text-xs font-bold text-indigo-600 hover:text-indigo-700">
          Forgot password? Send a reset link
        </button>
        <button type="button" disabled={!passCurrent || passNew.length < 8 || passNew !== passConfirm} onClick={submitPasswordUpdate} className="min-h-10 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          Update password
        </button>
      </div>
    </section>
  );
}

export default PasswordSection;
