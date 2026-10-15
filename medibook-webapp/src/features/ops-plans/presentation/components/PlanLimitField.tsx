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
  /**
   * Whether reaching the cap refuses further adds (`hard_limits`) or only
   * warns. Leave out for a ceiling the backend always enforces (storage).
   */
  hard?: boolean;
  onHard?: (hard: boolean) => void;
}

/** What the hint says about enforcement, once there is a cap. */
function enforcementHint(limitKey: PlanLimitKey, hard: boolean | undefined): string {
  if (hard === undefined) {
    return limitKey === 'storageGb'
      ? 'Admins are warned at 80%; uploads past the cap are refused.'
      : '';
  }
  return hard
    ? 'Adding past the cap is refused.'
    : 'Admins are warned at the cap; nothing is refused.';
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
  hard,
  onHard,
}: PlanLimitFieldProps) {
  const meta = PLAN_LIMIT_META[limitKey];
  const enforcement = enforcementHint(limitKey, hard);
  return (
    <OpsField
      label={meta.label}
      required={!unlimited}
      error={error}
      hint={
        unlimited
          ? 'No ceiling — unlimited.'
          : `In ${meta.unit}. 0 turns the feature off.${enforcement ? ` ${enforcement}` : ''}`
      }
    >
      <div className="flex flex-col gap-2.5">
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
        {hard !== undefined && onHard && !unlimited && (
          <span className="flex items-center gap-2">
            <Toggle
              value={hard}
              onChange={onHard}
              label={`Refuse ${meta.label.toLowerCase()} past the cap`}
            />
            <span className="text-caption text-text-muted">Refuse past the cap</span>
          </span>
        )}
      </div>
    </OpsField>
  );
}
