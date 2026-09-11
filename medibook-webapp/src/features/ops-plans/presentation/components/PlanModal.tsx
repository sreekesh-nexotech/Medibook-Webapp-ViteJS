import { useMemo } from 'react';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { money } from '@/shared/lib/format';
import { positiveAmount, required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import {
  PLAN_LIMIT_META,
  UNLIMITED,
  limitError,
  parseLimitInput,
  yearlyDiscountPct,
  yearlyListPrice,
} from '@/features/ops-plans/application/store/plans.limits';
import { usePlansStore } from '@/features/ops-plans/application/store/plans.store';
import {
  PLAN_LIMIT_KEYS,
  type Plan,
  type PlanLimit,
  type PlanLimitKey,
  type PlanLimits,
} from '@/features/ops-plans/application/store/plans.types';
import { PlanLimitField } from '@/features/ops-plans/presentation/components/PlanLimitField';

/** `bookingsUnlimited`, `staffUnlimited`, … — one switch per ceiling. */
type LimitFlagKey = `${PlanLimitKey}Unlimited`;

/**
 * Editable form shape. Money and ceilings stay strings until submit parses
 * them; each ceiling carries its own unlimited switch so the typed cap is
 * never destroyed by toggling it.
 */
type PlanFormValues = {
  name: string;
  price: string;
  yearlyOn: boolean;
  yearlyPrice: string;
  support: string;
  extra: string;
  custom: boolean;
  popular: boolean;
} & { [K in PlanLimitKey]: string } & { [K in LimitFlagKey]: boolean };

const SUPPORT_OPTIONS = ['Email support', 'Priority support', 'Dedicated success manager'] as const;

/** Default ceilings for a brand-new plan — mirrors the Starter tier. */
const BLANK: PlanFormValues = {
  name: '',
  price: '',
  yearlyOn: false,
  yearlyPrice: '',
  support: 'Email support',
  extra: '',
  custom: false,
  popular: false,
  bookings: '',
  bookingsUnlimited: false,
  staff: '25',
  staffUnlimited: false,
  doctors: '10',
  doctorsUnlimited: false,
  branches: '1',
  branchesUnlimited: false,
  storageGb: '20',
  storageGbUnlimited: false,
  messageCredits: '2000',
  messageCreditsUnlimited: false,
};

/** A stored ceiling as the two form controls that edit it. */
function limitToForm(limit: PlanLimit): { text: string; unlimited: boolean } {
  return limit === null ? { text: '', unlimited: true } : { text: String(limit), unlimited: false };
}

/** The form's starting values for an existing plan. */
function planToForm(plan: Plan): PlanFormValues {
  const l = plan.limits;
  return {
    name: plan.name,
    price: String(plan.price),
    yearlyOn: plan.yearlyPrice !== null,
    yearlyPrice: plan.yearlyPrice === null ? '' : String(plan.yearlyPrice),
    support: plan.support,
    extra: plan.extra,
    custom: plan.custom,
    popular: plan.popular,
    bookings: limitToForm(l.bookings).text,
    bookingsUnlimited: limitToForm(l.bookings).unlimited,
    staff: limitToForm(l.staff).text,
    staffUnlimited: limitToForm(l.staff).unlimited,
    doctors: limitToForm(l.doctors).text,
    doctorsUnlimited: limitToForm(l.doctors).unlimited,
    branches: limitToForm(l.branches).text,
    branchesUnlimited: limitToForm(l.branches).unlimited,
    storageGb: limitToForm(l.storageGb).text,
    storageGbUnlimited: limitToForm(l.storageGb).unlimited,
    messageCredits: limitToForm(l.messageCredits).text,
    messageCreditsUnlimited: limitToForm(l.messageCredits).unlimited,
  };
}

/** One ceiling validator: skipped while that ceiling is unlimited. */
function limitValidator(key: PlanLimitKey) {
  return (value: string, values: PlanFormValues): string | undefined =>
    values[`${key}Unlimited`] ? undefined : limitError(value, PLAN_LIMIT_META[key].label);
}

/** Read one ceiling back out of the form. Validation has already passed. */
function limitFromForm(key: PlanLimitKey, values: PlanFormValues): PlanLimit {
  if (values[`${key}Unlimited`]) return UNLIMITED;
  return parseLimitInput(values[key]) ?? 0;
}

interface PlanModalProps {
  open: boolean;
  /** The plan being edited, or `null` to create a new one. */
  plan: Plan | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Create / edit a subscription plan (design `Ops.jsx` `PlanModal`), rebuilt on
 * `FormModal` so Enter submits (audit 3.4.5) and extended for SA-02: a yearly
 * price beside the monthly one with the discount it implies, and all six
 * ceilings with their own unlimited switch.
 *
 * Mounted fresh per plan (the catalog screen keys it), so the starting values
 * come straight from `useState` instead of a reset effect.
 */
export function PlanModal({ open, plan, onClose, onDone }: PlanModalProps) {
  const plans = usePlansStore((s) => s.plans);
  const savePlan = usePlansStore((s) => s.savePlan);
  const [busy, run] = useOpsAct();
  const isNew = !plan;

  const validate = useMemo<FormValidators<PlanFormValues>>(
    () => ({
      name: (value) => {
        const missing = required(value, 'Plan name');
        if (missing) return missing;
        const taken = plans.some(
          (p) =>
            p.name.trim().toLowerCase() === value.trim().toLowerCase() &&
            (isNew || p.id !== plan?.id),
        );
        return taken ? 'A plan with this name already exists.' : undefined;
      },
      price: (value) => positiveAmount(value, 'Monthly price'),
      yearlyPrice: (value, values) => {
        if (!values.yearlyOn) return undefined;
        const invalid = positiveAmount(value, 'Yearly price');
        if (invalid) return invalid;
        const monthly = Number(values.price);
        if (!Number.isFinite(monthly) || monthly <= 0) return undefined;
        const full = yearlyListPrice(monthly);
        return Number(value) > full
          ? `A yearly price above ${money(full)} costs more than paying monthly.`
          : undefined;
      },
      bookings: limitValidator('bookings'),
      staff: limitValidator('staff'),
      doctors: limitValidator('doctors'),
      branches: limitValidator('branches'),
      storageGb: limitValidator('storageGb'),
      messageCredits: limitValidator('messageCredits'),
    }),
    [plans, isNew, plan?.id],
  );

  const form = useForm<PlanFormValues>({
    initial: plan ? planToForm(plan) : BLANK,
    validate,
    onSubmit: (values) => {
      const name = values.name.trim();
      const limits: PlanLimits = {
        bookings: limitFromForm('bookings', values),
        staff: limitFromForm('staff', values),
        doctors: limitFromForm('doctors', values),
        branches: limitFromForm('branches', values),
        storageGb: limitFromForm('storageGb', values),
        messageCredits: limitFromForm('messageCredits', values),
      };
      run('plan', isNew ? `Plan "${name}" created.` : `Plan "${name}" updated.`, () => {
        const base = {
          name,
          price: Number(values.price),
          yearlyPrice: values.yearlyOn ? Number(values.yearlyPrice) : null,
          limits,
          support: values.support,
          extra: values.extra,
          popular: values.popular,
          custom: values.custom,
        };
        savePlan(plan ? { id: plan.id, ...base } : base);
        onDone();
      });
    },
  });

  const { values } = form;
  const monthly = Number(values.price);
  const yearly = Number(values.yearlyPrice);
  const discount =
    values.yearlyOn && monthly > 0 && yearly > 0 ? yearlyDiscountPct(monthly, yearly) : null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={plan ? `Edit ${plan.name}` : 'Create Plan'}
      width={620}
      onSubmit={form.handleSubmit}
      submitLabel={isNew ? 'Create Plan' : 'Save Plan'}
      busy={busy.plan}
    >
      <div className="flex flex-col gap-4.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SegTabs
            tabs={['Standard', 'Hospital-specific']}
            value={values.custom ? 'Hospital-specific' : 'Standard'}
            onChange={(v) => form.setField('custom', v === 'Hospital-specific')}
          />
          <span className="flex items-center gap-2.5">
            <Toggle
              value={values.popular}
              onChange={(v) => form.setField('popular', v)}
              label="Mark as Most Popular"
            />
            <span className="text-body text-text-body">Mark as Most Popular</span>
          </span>
        </div>
        {values.custom && (
          <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
            <Icon name="info" size={14} className="mt-px flex-none" /> Hospital-specific plans are
            negotiated per tenant — put the hospital in the name (e.g. &quot;Custom — Apollo
            Hospital&quot;) so it&apos;s recognisable everywhere plans appear.
          </div>
        )}
        <OpsField label="Plan Name" required error={form.errorFor('name')}>
          <TextInput
            value={values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            placeholder={values.custom ? 'e.g. Custom — Apollo Hospital' : 'e.g. Growth'}
            height={48}
          />
        </OpsField>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle size={16}>Billing periods</SectionTitle>
            <span className="flex items-center gap-2.5">
              <Toggle
                value={values.yearlyOn}
                onChange={(v) => form.setField('yearlyOn', v)}
                label="Offer yearly billing"
              />
              <span className="text-body text-text-body">Offer yearly billing</span>
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <OpsField
              label="Monthly Price (₹)"
              required
              error={form.errorFor('price')}
              hint="Excluding 18% GST, which is added as a separate invoice line."
            >
              <TextInput
                value={values.price}
                onChange={(v) => form.setField('price', v)}
                onBlur={() => form.blurField('price')}
                placeholder="e.g. 24999"
                inputMode="numeric"
                height={48}
              />
            </OpsField>
            <OpsField
              label="Yearly Price (₹)"
              required={values.yearlyOn}
              error={form.errorFor('yearlyPrice')}
              hint={
                values.yearlyOn
                  ? discount !== null
                    ? `${discount}% off ${money(yearlyListPrice(monthly))} billed monthly.`
                    : 'Charged once per year, in advance.'
                  : 'Turn on yearly billing to price a yearly term.'
              }
            >
              <TextInput
                value={values.yearlyPrice}
                onChange={(v) => form.setField('yearlyPrice', v)}
                onBlur={() => form.blurField('yearlyPrice')}
                placeholder={values.yearlyOn ? 'e.g. 249990' : 'Monthly only'}
                inputMode="numeric"
                disabled={!values.yearlyOn}
                height={48}
              />
            </OpsField>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <SectionTitle size={16}>Plan limits</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {PLAN_LIMIT_KEYS.map((key) => (
              <PlanLimitField
                key={key}
                limitKey={key}
                value={values[key]}
                unlimited={values[`${key}Unlimited`]}
                error={form.errorFor(key)}
                onValue={(v) => form.setField(key, v)}
                onUnlimited={(v) => form.setField(`${key}Unlimited`, v)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <OpsField label="Support Level">
            <Select
              value={values.support}
              options={SUPPORT_OPTIONS}
              onChange={(v) => form.setField('support', v)}
              height={48}
            />
          </OpsField>
          <OpsField label="Extra Feature Line (optional)">
            <TextInput
              value={values.extra}
              onChange={(v) => form.setField('extra', v)}
              placeholder="e.g. Advanced analytics"
              height={48}
            />
          </OpsField>
        </div>
      </div>
    </FormModal>
  );
}
