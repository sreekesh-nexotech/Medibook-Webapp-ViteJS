import { useMemo, useState } from 'react';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { positiveAmount, required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useCreatePlanMutation } from '@/features/ops-plans/application/queries/useCreatePlanMutation';
import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';
import { useUpdatePlanMutation } from '@/features/ops-plans/application/queries/useUpdatePlanMutation';
import {
  PLAN_LIMIT_META,
  UNLIMITED,
  limitError,
  parseLimitInput,
  yearlyDiscountPct,
  yearlyListPrice,
} from '@/features/ops-plans/application/store/plans.limits';
import {
  CATALOG_LIMIT_KEYS,
  type CatalogLimitKey,
  type CatalogPlan,
  type CatalogPlanDraft,
  type CatalogPlanLimit,
  type CatalogPlanLimits,
} from '@/features/ops-plans/domain/entities/plans.catalog';
import { PlanLimitField } from '@/features/ops-plans/presentation/components/PlanLimitField';

/** `bookingsUnlimited`, `staffUnlimited`, … — one switch per ceiling. */
type LimitFlagKey = `${CatalogLimitKey}Unlimited`;

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
  extra: string;
  custom: boolean;
} & { [K in CatalogLimitKey]: string } & { [K in LimitFlagKey]: boolean };

/** Default ceilings for a brand-new plan — mirrors the Starter tier. */
const BLANK: PlanFormValues = {
  name: '',
  price: '',
  yearlyOn: false,
  yearlyPrice: '',
  extra: '',
  custom: false,
  staff: '25',
  staffUnlimited: false,
  doctors: '10',
  doctorsUnlimited: false,
  storageGb: '20',
  storageGbUnlimited: false,
};

/** A stored ceiling as the two form controls that edit it. */
function limitToForm(limit: CatalogPlanLimit): { text: string; unlimited: boolean } {
  return limit === null ? { text: '', unlimited: true } : { text: String(limit), unlimited: false };
}

/** The form's starting values for an existing plan. */
function planToForm(plan: CatalogPlan): PlanFormValues {
  const l = plan.limits;
  return {
    name: plan.name,
    price: String(plan.priceMonthly),
    yearlyOn: plan.priceYearly !== null,
    yearlyPrice: plan.priceYearly === null ? '' : String(plan.priceYearly),
    extra: plan.description ?? '',
    custom: !plan.isPublic,
    staff: limitToForm(l.staff).text,
    staffUnlimited: limitToForm(l.staff).unlimited,
    doctors: limitToForm(l.doctors).text,
    doctorsUnlimited: limitToForm(l.doctors).unlimited,
    storageGb: limitToForm(l.storageGb).text,
    storageGbUnlimited: limitToForm(l.storageGb).unlimited,
  };
}

/** One ceiling validator: skipped while that ceiling is unlimited. */
function limitValidator(key: CatalogLimitKey) {
  return (value: string, values: PlanFormValues): string | undefined =>
    values[`${key}Unlimited`] ? undefined : limitError(value, PLAN_LIMIT_META[key].label);
}

/** Read one ceiling back out of the form. Validation has already passed. */
function limitFromForm(key: CatalogLimitKey, values: PlanFormValues): CatalogPlanLimit {
  if (values[`${key}Unlimited`]) return UNLIMITED;
  return parseLimitInput(values[key]) ?? 0;
}

interface PlanModalProps {
  open: boolean;
  /** The plan being edited, or `null` to create a new one. */
  plan: CatalogPlan | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Create / edit a subscription plan (design `Ops.jsx` `PlanModal`), rebuilt on
 * `FormModal` so Enter submits (audit 3.4.5): a yearly price beside the
 * monthly one with the discount it implies, and the three ceilings the
 * backend stores, each with its own unlimited switch. Saves through
 * `POST /platform/plans` or `PATCH /platform/plans/{id}` (If-Match).
 *
 * Mounted fresh per plan (the catalog screen keys it), so the starting values
 * come straight from `useState` instead of a reset effect.
 */
export function PlanModal({ open, plan, onClose, onDone }: PlanModalProps) {
  const plans = usePlansQuery().data;
  const createMutation = useCreatePlanMutation();
  const updateMutation = useUpdatePlanMutation();
  const isNew = !plan;
  /** The server's verdict on the name (a taken plan code), shown until the name changes. */
  const [nameServerError, setNameServerError] = useState<string | undefined>(undefined);

  const handleError = (error: unknown) => {
    const message = isFailure(error) ? error.message : 'Could not save the plan.';
    const codeError = isFailure(error) ? error.fieldErrors.code?.[0] : undefined;
    if (codeError) setNameServerError(`${codeError} Choose a different plan name.`);
    toast(message, 'error');
  };

  const validate = useMemo<FormValidators<PlanFormValues>>(
    () => ({
      name: (value) => {
        const missing = required(value, 'Plan name');
        if (missing) return missing;
        const taken = (plans ?? []).some(
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
      staff: limitValidator('staff'),
      doctors: limitValidator('doctors'),
      storageGb: limitValidator('storageGb'),
    }),
    [plans, isNew, plan?.id],
  );

  const form = useForm<PlanFormValues>({
    initial: plan ? planToForm(plan) : BLANK,
    validate,
    onSubmit: (values) => {
      const name = values.name.trim();
      const limits: CatalogPlanLimits = {
        staff: limitFromForm('staff', values),
        doctors: limitFromForm('doctors', values),
        storageGb: limitFromForm('storageGb', values),
      };
      const extra = values.extra.trim();
      const draft: CatalogPlanDraft = {
        name,
        description: extra === '' ? null : extra,
        priceMonthly: Number(values.price),
        priceYearly: values.yearlyOn ? Number(values.yearlyPrice) : null,
        limits,
        isPublic: !values.custom,
      };
      const onSuccess = () => {
        toast(isNew ? `Plan "${name}" created.` : `Plan "${name}" updated.`);
        onDone();
      };
      if (plan) {
        updateMutation.mutate(
          { planId: plan.id, draft, version: plan.version },
          { onSuccess, onError: handleError },
        );
      } else {
        createMutation.mutate(draft, { onSuccess, onError: handleError });
      }
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
      busy={createMutation.isPending || updateMutation.isPending}
    >
      <div className="flex flex-col gap-4.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SegTabs
            tabs={['Standard', 'Hospital-specific']}
            value={values.custom ? 'Hospital-specific' : 'Standard'}
            onChange={(v) => form.setField('custom', v === 'Hospital-specific')}
          />
        </div>
        {values.custom && (
          <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
            <Icon name="info" size={14} className="mt-px flex-none" /> Hospital-specific plans are
            negotiated per tenant — put the hospital in the name (e.g. &quot;Custom — Example
            Hospital&quot;) so it&apos;s recognisable everywhere plans appear.
          </div>
        )}
        <OpsField label="Plan Name" required error={form.errorFor('name') ?? nameServerError}>
          <TextInput
            value={values.name}
            onChange={(v) => {
              setNameServerError(undefined);
              form.setField('name', v);
            }}
            onBlur={() => form.blurField('name')}
            placeholder={values.custom ? 'e.g. Custom — Example Hospital' : 'e.g. Growth'}
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
            {CATALOG_LIMIT_KEYS.map((key) => (
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
