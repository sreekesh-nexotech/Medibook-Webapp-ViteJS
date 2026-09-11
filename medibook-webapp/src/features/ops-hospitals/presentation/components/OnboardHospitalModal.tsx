import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { email, required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { usePlansStore } from '@/features/ops-plans/application/store/plans.store';
import { useHospitalsStore } from '@/features/ops-hospitals/application/store/hospitals.store';

/**
 * Onboard Hospital modal (design `OnboardHospitalModal`, Ops.jsx). Creates a
 * Pending-verification instance with all-Missing KYC via the hospitals store;
 * the success toast + fake latency come from `useOpsAct`, as in the prototype.
 *
 * Rebuilt on `FormModal` + `useForm`, which buys three audit fixes at once:
 * Enter submits (3.4.5), an error re-checks while typing instead of vanishing
 * on the first keystroke (3.5.4), and the reset effect that used to fire on
 * every open is gone — the catalog screens mount this fresh, so the starting
 * values come straight from `useState`.
 *
 * What happens *after* onboarding — the first administrator, the document
 * checklist and the per-document review — lives on the onboarding pipeline
 * (`OpsOnboardingScreen`), which this hands the new tenant id to.
 */

interface OnboardForm {
  name: string;
  email: string;
  city: string;
  plan: string;
}

const VALIDATORS: FormValidators<OnboardForm> = {
  name: (value) => required(value, 'Hospital name'),
  email: (value) => email(value),
  city: (value) => required(value, 'City'),
};

interface OnboardHospitalModalProps {
  open: boolean;
  onClose: () => void;
  /** Receives the new tenant id, so the caller can jump straight to its case. */
  onDone: (hid: number) => void;
  /** Plan preselected in the dropdown (defaults to the first standard tier). */
  defaultPlan?: string;
}

export function OnboardHospitalModal({
  open,
  onClose,
  onDone,
  defaultPlan = 'Starter',
}: OnboardHospitalModalProps) {
  const [busy, run] = useOpsAct();
  const plans = usePlansStore((s) => s.plans);
  const onboardHospital = useHospitalsStore((s) => s.onboardHospital);

  const form = useForm<OnboardForm>({
    initial: { name: '', email: '', city: '', plan: defaultPlan },
    validate: VALIDATORS,
    onSubmit: (values) => {
      run('ob', `${values.name} onboarded. KYC verification pending.`, () => {
        const hid = onboardHospital(values);
        onDone(hid);
      });
    },
  });

  const { values } = form;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Onboard Hospital"
      width={480}
      onSubmit={form.handleSubmit}
      submitLabel="Onboard Hospital"
      busy={busy.ob}
    >
      <div className="flex flex-col gap-4.5">
        <OpsField label="Hospital Name" required error={form.errorFor('name')}>
          <TextInput
            value={values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            placeholder="e.g. Sunrise Multispeciality"
            height={48}
          />
        </OpsField>
        <OpsField
          label="Admin Email"
          required
          error={form.errorFor('email')}
          hint="The first administrator is invited at this address on the onboarding pipeline."
        >
          <TextInput
            value={values.email}
            onChange={(v) => form.setField('email', v)}
            onBlur={() => form.blurField('email')}
            placeholder="admin@hospital.in"
            type="email"
            inputMode="email"
            autoComplete="email"
            height={48}
          />
        </OpsField>
        <div className="grid grid-cols-2 gap-4">
          <OpsField label="City" required error={form.errorFor('city')}>
            <TextInput
              value={values.city}
              onChange={(v) => form.setField('city', v)}
              onBlur={() => form.blurField('city')}
              placeholder="e.g. Pune"
              height={48}
            />
          </OpsField>
          <OpsField label="Subscription Plan">
            <Select
              value={values.plan}
              options={plans.map((p) => p.name)}
              onChange={(v) => form.setField('plan', v)}
              height={48}
            />
          </OpsField>
        </div>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" /> The hospital lands in Pending
          verification at the start of the onboarding pipeline. Nothing is requested from it yet —
          choose its document checklist and invite its first administrator on Network › Onboarding.
        </div>
      </div>
    </FormModal>
  );
}
