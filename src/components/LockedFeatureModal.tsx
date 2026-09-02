import { LockKeyhole } from 'lucide-react';
import { Button } from './common/Button';
import { Modal } from './common/Modal';

export interface LockedFeature {
  id: string;
  name: string;
  description: string;
  minimumPlan: string;
}

/**
 * The paid-feature gate (`has_growth_access`) unlocks at the Starter tier and
 * above, or during an active trial — see app/services/plan_service.py, where
 * `plan_features` reports `minimumPlan: "Starter"`. The portal must name that
 * same tier, not "Growth", so upsell copy stays truthful.
 */
export const LOCKED_FEATURE_MINIMUM_PLAN = 'Starter';

const LOCKED_FEATURE_DESCRIPTIONS: Record<string, string> = {
  orders:
    'Send confirmed orders to your courier partners and track every delivery without leaving the portal.',
  'incomplete-checkouts':
    "Review abandoned checkouts and win them back by reaching out with the shopper's phone number.",
};

/**
 * Resolve the copy for the feature the shopper actually clicked. Keeping this a
 * pure function (rather than hard-coded modal text) is what stops the dialog
 * from describing "Incomplete Orders" when "Courier Shipping" was tapped.
 */
export function resolveLockedFeature(id: string, name: string): LockedFeature {
  return {
    id,
    name,
    description:
      LOCKED_FEATURE_DESCRIPTIONS[id] ?? `${name} is part of the paid Buykori plans.`,
    minimumPlan: LOCKED_FEATURE_MINIMUM_PLAN,
  };
}

interface LockedFeatureModalProps {
  feature: LockedFeature | null;
  onClose: () => void;
}

export function LockedFeatureModal({ feature, onClose }: LockedFeatureModalProps) {
  if (!feature) return null;

  return (
    <Modal
      onClose={onClose}
      labelledBy="locked-feature-title"
      describedBy="locked-feature-description"
      overlayClassName="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      panelClassName="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
    >
      <LockKeyhole className="h-6 w-6 text-amber-500" />
      <h3 id="locked-feature-title" className="mt-3 text-sm font-bold text-slate-900">
        {feature.name} is locked
      </h3>
      <p id="locked-feature-description" className="mt-1 text-xs leading-relaxed text-slate-500">
        {feature.description}
      </p>
      <p className="mt-2 text-xs font-semibold text-slate-600">
        Available on the {feature.minimumPlan} plan and above, or with an active trial.
      </p>
      <Button variant="primary" size="sm" onClick={onClose} className="mt-5 w-full">
        Got it
      </Button>
    </Modal>
  );
}

export default LockedFeatureModal;
