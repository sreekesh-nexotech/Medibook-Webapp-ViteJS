import { useMemo } from 'react';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { dateRange, minLen, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import {
  couponDiscount,
  flatCouponCeiling,
  normaliseCouponCode,
  validateCouponValue,
} from '@/features/settings/application/store/services.logic';
import type { CouponDraft } from '@/features/settings/application/store/services.store';
import {
  COUPON_TYPES,
  type Coupon,
  type CouponType,
  type HospitalService,
} from '@/features/settings/application/store/services.types';

/** Shortest usable code, e.g. "MB20". */
const MIN_CODE_LENGTH = 4;

/** Order value the discount preview uses when no service is in scope. */
const PREVIEW_ORDER_VALUE = 1000;

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-12 w-full border bg-white px-3';

interface CouponForm {
  code: string;
  type: CouponType;
  value: string;
  from: string;
  to: string;
  usageCap: string;
  minOrder: string;
  departments: string;
  serviceIds: string;
  active: boolean;
}

const BASE_VALIDATORS: FormValidators<CouponForm> = {
  code: (v) => minLen(normaliseCouponCode(v), MIN_CODE_LENGTH, 'Coupon code'),
  from: (v) => required(v, 'Start date'),
  to: (v, values) => dateRange(values.from, v),
  usageCap: (v) => {
    const raw = v.trim();
    if (raw === '') return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 'Usage cap must be zero or more (0 = unlimited).';
    return undefined;
  },
};

interface CouponModalProps {
  open: boolean;
  /** The coupon being edited, or null to create one. */
  coupon: Coupon | null;
  /** The whole catalogue, for the scope pickers and the flat-value ceiling. */
  services: readonly HospitalService[];
  /** Department names from the hospital's master data. */
  departments: readonly string[];
  onClose: () => void;
  onSave: (draft: CouponDraft) => void;
}

/** Comma-joined ids/names <-> the arrays the store holds. */
function splitList(value: string): readonly string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');
}

/**
 * Create / edit a discount coupon (audit HA-04), including the two guards the
 * audit asks for: a percent coupon may not exceed 100%, and a flat coupon may
 * not exceed the cheapest service it applies to. Both are inline `Field`
 * errors — never a toast.
 */
export function CouponModal({
  open,
  coupon,
  services,
  departments,
  onClose,
  onSave,
}: CouponModalProps) {
  // The value rule depends on the *scope* fields as well as the value, so the
  // validator is built from the catalogue rather than declared at module level.
  const validators = useMemo<FormValidators<CouponForm>>(
    () => ({
      ...BASE_VALIDATORS,
      value: (v, values) =>
        validateCouponValue(
          values.type,
          Number(v),
          flatCouponCeiling(
            {
              serviceIds: splitList(values.serviceIds),
              departments: splitList(values.departments),
            },
            services,
          ),
        ),
    }),
    [services],
  );

  const form = useForm<CouponForm>({
    initial: {
      code: coupon?.code ?? '',
      type: coupon?.type ?? 'Percent',
      value: String(coupon?.value ?? ''),
      from: coupon?.from ?? '',
      to: coupon?.to ?? '',
      usageCap: String(coupon?.usageCap ?? 0),
      minOrder: String(coupon?.minOrder ?? 0),
      departments: (coupon?.departments ?? []).join(', '),
      serviceIds: (coupon?.serviceIds ?? []).join(', '),
      active: coupon?.active ?? true,
    },
    validate: validators,
    onSubmit: (v) => {
      onSave({
        ...(coupon ? { id: coupon.id } : {}),
        code: normaliseCouponCode(v.code),
        type: v.type,
        value: Number(v.value),
        from: v.from,
        to: v.to,
        usageCap: Number(v.usageCap || 0),
        minOrder: Number(v.minOrder || 0),
        departments: splitList(v.departments),
        serviceIds: splitList(v.serviceIds),
        active: v.active,
      });
      onClose();
    },
  });

  const scope = {
    serviceIds: splitList(form.values.serviceIds),
    departments: splitList(form.values.departments),
  };
  const ceiling = flatCouponCeiling(scope, services);
  const value = Number(form.values.value);
  const valueError = form.errorFor('value');

  const sampleOrder = ceiling ?? PREVIEW_ORDER_VALUE;
  const sampleDiscount =
    form.errors.value || !Number.isFinite(value)
      ? 0
      : couponDiscount(
          {
            id: 'preview',
            code: 'PREVIEW',
            type: form.values.type,
            value,
            from: form.values.from,
            to: form.values.to,
            usageCap: 0,
            used: 0,
            minOrder: Number(form.values.minOrder || 0),
            serviceIds: scope.serviceIds,
            departments: scope.departments,
            active: true,
          },
          sampleOrder,
        );

  const serviceOptions = services.map((s) => `${s.id} — ${s.name} (${money(s.price)})`);

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={coupon ? `Edit Coupon — ${coupon.code}` : 'Create Coupon'}
      width={640}
      onSubmit={form.handleSubmit}
      submitLabel={coupon ? 'Save Coupon' : 'Create Coupon'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Code" required error={form.errorFor('code')}>
            <TextInput
              value={form.values.code}
              onChange={(v) => form.setField('code', v.toUpperCase())}
              onBlur={() => form.blurField('code')}
              placeholder="MONSOON20"
              height={48}
              autoFocus
            />
          </Field>
          <Field label="Discount Type">
            <Select
              value={form.values.type}
              options={COUPON_TYPES}
              onChange={(v) => form.setField('type', v as CouponType)}
              height={48}
            />
          </Field>
          <Field
            label={form.values.type === 'Percent' ? 'Discount (%)' : 'Discount (₹)'}
            required
            error={valueError}
            hint={
              form.values.type === 'Percent'
                ? 'Up to 100%.'
                : ceiling != null
                  ? `Up to ${money(ceiling)} — the cheapest applicable service.`
                  : 'No service in scope yet.'
            }
          >
            <TextInput
              value={form.values.value}
              onChange={(v) => form.setField('value', v.replace(/[^0-9]/g, ''))}
              onBlur={() => form.blurField('value')}
              inputMode="numeric"
              height={48}
              invalid={Boolean(valueError)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Valid From" required error={form.errorFor('from')}>
            <input
              type="date"
              value={form.values.from}
              onChange={(e) => form.setField('from', e.target.value)}
              onBlur={() => form.blurField('from')}
              aria-label="Valid from"
              className={DATE_INPUT_CLASS}
            />
          </Field>
          <Field label="Valid Until" required error={form.errorFor('to')}>
            <input
              type="date"
              value={form.values.to}
              onChange={(e) => form.setField('to', e.target.value)}
              onBlur={() => form.blurField('to')}
              aria-label="Valid until"
              className={DATE_INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Usage Cap"
            error={form.errorFor('usageCap')}
            hint="Total redemptions allowed. 0 = unlimited."
          >
            <TextInput
              value={form.values.usageCap}
              onChange={(v) => form.setField('usageCap', v.replace(/[^0-9]/g, ''))}
              onBlur={() => form.blurField('usageCap')}
              inputMode="numeric"
              height={48}
            />
          </Field>
          <Field label="Minimum Order Value (₹)" hint="The code does nothing below this amount.">
            <TextInput
              value={form.values.minOrder}
              onChange={(v) => form.setField('minOrder', v.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              height={48}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Departments"
            hint="Leave empty for every department. Pick to add one at a time."
          >
            <Select
              value=""
              options={departments.filter((d) => !scope.departments.includes(d))}
              onChange={(v) => form.setField('departments', [...scope.departments, v].join(', '))}
              placeholder="Add a department…"
              height={48}
            />
          </Field>
          <Field label="Services" hint="Leave empty for every service.">
            <Select
              value=""
              options={serviceOptions.filter((o) => !scope.serviceIds.includes(o.split(' — ')[0]))}
              onChange={(v) =>
                form.setField('serviceIds', [...scope.serviceIds, v.split(' — ')[0]].join(', '))
              }
              placeholder="Add a service…"
              height={48}
            />
          </Field>
        </div>

        {(scope.departments.length > 0 || scope.serviceIds.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {scope.departments.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  form.setField('departments', scope.departments.filter((x) => x !== d).join(', '))
                }
                className="text-caption bg-blue-soft-bg text-blue inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5"
              >
                {d} <Icon name="x" size={12} />
              </button>
            ))}
            {scope.serviceIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  form.setField('serviceIds', scope.serviceIds.filter((x) => x !== id).join(', '))
                }
                className="text-caption bg-p-100 text-text-navy inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5"
              >
                {services.find((s) => s.id === id)?.name ?? id} <Icon name="x" size={12} />
              </button>
            ))}
          </div>
        )}

        <div
          className={cn(
            'text-body flex items-center gap-2 rounded-md px-3.5 py-3',
            sampleDiscount > 0 ? 'bg-g-100 text-g-700' : 'bg-grey-300 text-text-muted',
          )}
        >
          <Icon name="percent" size={16} className="flex-none" />
          {sampleDiscount > 0
            ? `On a ${money(sampleOrder)} order this code takes off ${money(sampleDiscount)} — patient pays ${money(sampleOrder - sampleDiscount)}.`
            : 'Enter a valid discount to preview what a patient would save.'}
        </div>

        <div className="border-border-soft flex items-center gap-3 rounded-md border px-3.5 py-3">
          <Toggle
            value={form.values.active}
            onChange={(v) => form.setField('active', v)}
            label="Coupon is redeemable"
          />
          <div className="flex flex-col">
            <span className="text-body text-text-strong font-medium">Redeemable</span>
            <span className="text-caption text-text-muted">
              Paused coupons keep their window and usage count but cannot be applied.
            </span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
