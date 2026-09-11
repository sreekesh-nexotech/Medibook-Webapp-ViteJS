import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import { PLAN_LIMIT_META } from '@/features/ops-plans/application/store/plans.limits';
import type { PlanLimitKey } from '@/features/ops-plans/application/store/plans.types';

interface PlanLimitFieldProps {
  /** Which ceiling this row edits — drives the label, unit and placeholder. */
  limitKey: PlanLimitKey;
  /** The typed cap. Ignored while `unlimited` is on, never overwritten by it. */
  value: string;
  unlimited: boolean;
  error?: string;
  onValue: (value: string) => void;
  onUnlimited: (unlimited: boolean) => void;
}

/**
 * One ceiling row in the plan modal: a whole-number cap plus its own
 * "Unlimited" switch (audit SA-02). The two are separate controls on purpose —
 * typing `0` means a real cap of zero (the feature is off), which is not the
 * same plan as one with no ceiling, and the switch keeps the typed cap intact
 * so turning it back off restores what ops had entered.
 */
export function PlanLimitField({
  limitKey,
  value,
  unlimited,
  error,
  onValue,
  onUnlimited,
}: PlanLimitFieldProps) {
  const meta = PLAN_LIMIT_META[limitKey];
  return (
    <OpsField
      label={meta.label}
      required={!unlimited}
      error={error}
      hint={unlimited ? 'No ceiling — unlimited.' : `In ${meta.unit}. 0 turns the feature off.`}
    >
      <div className="flex items-center gap-3">
        <TextInput
          value={unlimited ? '' : value}
          onChange={onValue}
          placeholder={unlimited ? 'Unlimited' : meta.placeholder}
          inputMode="numeric"
          disabled={unlimited}
          height={48}
        />
        <span className="flex flex-none items-center gap-2">
          <Toggle
            value={unlimited}
            onChange={onUnlimited}
            label={`Unlimited ${meta.label.toLowerCase()}`}
          />
          <span className="text-caption text-text-muted">Unlimited</span>
        </span>
      </div>
    </OpsField>
  );
}
