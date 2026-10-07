import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { dateRange, minLen, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';
import { Toggle } from '@/shared/ui/Toggle';

import type { Department } from '@/features/doctors/domain/entities/doctors.types';
import type {
  CouponInput,
  HospitalCoupon,
} from '@/features/settings/domain/entities/services.entities';
import {
  cheapestConsultationRupees,
  couponDiscount,
  type CouponDoctor,
  dayEndExclusiveIso,
  dayStartIso,
  lastValidDay,
  localDay,
  MAX_PERCENT_COUPON,
} from '@/features/settings/domain/services.pricing';

const COUPON_TYPES = ['Percent', 'Flat'] as const;
type CouponType = (typeof COUPON_TYPES)[number];

/** Coupon codes are stored upper-case with no spaces. */
function normaliseCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** A message under the value field, or `undefined` when acceptable. */
function validateCouponValue(type: CouponType, value: number): string | undefined {
  if (!Number.isFinite(value) || value <= 0) return 'Enter a discount greater than zero.';
  return type === 'Percent' && value > MAX_PERCENT_COUPON
    ? `A percent coupon cannot exceed ${MAX_PERCENT_COUPON}%.`
    : undefined;
}

/** Shortest usable code, e.g. "MB20". */
const MIN_CODE_LENGTH = 4;

/** Consultation fee the discount preview uses when no doctor is in scope. */
const PREVIEW_ORDER_VALUE = 500;

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-12 w-full border bg-white px-3';

interface CouponForm {
  code: string;
  type: CouponType;
  value: string;
  from: string;
  to: string;
  usageCap: string;
  /** Uses per patient; empty or 0 = unlimited. */
  perUserCap: string;
  /** Percent coupons only; empty = no ceiling. */
  maxDiscount: string;
  minOrder: string;
  departmentIds: readonly string[];
  active: boolean;
}

const VALIDATORS: FormValidators<CouponForm> = {
  code: (v) => minLen(normaliseCouponCode(v), MIN_CODE_LENGTH, 'Coupon code'),
  value: (v, values) => validateCouponValue(values.type, Number(v)),
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

/** Server field → form field (UAT-48); `scopes[0].department_id` lands on the picker. */
function serverField(key: string): keyof CouponForm | undefined {
  if (key.startsWith('scopes')) return 'departmentIds';
  const map: Readonly<Record<string, keyof CouponForm>> = {
    code: 'code',
    kind: 'type',
    value: 'value',
    valid_from: 'from',
    valid_to: 'to',
    usage_cap: 'usageCap',
    per_user_cap: 'perUserCap',
    max_discount_paise: 'maxDiscount',
    min_order_paise: 'minOrder',
  };
  return map[key];
}

interface CouponModalProps {
  open: boolean;
  /** The coupon being edited, or null to create one. */
  coupon: HospitalCoupon | null;
  /** Doctors' departments and fees — what an app booking's discount is taken from. */
  doctors: readonly CouponDoctor[];
  /** The hospital's departments (H1). */
  departments: readonly Department[];
  onClose: () => void;
  /** Persist; rejects with the server's failure so its field errors land on the form. */
  onSave: (input: CouponInput) => Promise<void>;
}

/**
 * Create / edit a discount coupon (audit HA-04).
 *
 * Decision 7: coupons are applied by patients booking in the Medibook app —
 * the front desk takes no coupon codes — and can be limited to departments
 * only (service scopes could never match an app booking, BE-25). The discount
 * comes off the consultation fee, so the preview and the flat-value note use
 * the cheapest consultation in scope; a flat coupon above it simply stops at
 * the fee.
 *
 * The validity window is picked as whole local days and saved as instants:
 * from the start of the first day to the start of the day after the last
 * (the backend's `valid_to` is exclusive).
 */
export function CouponModal({
  open,
  coupon,
  doctors,
  departments,
  onClose,
  onSave,
}: CouponModalProps) {
  const form = useForm<CouponForm>({
    initial: {
      code: coupon?.code ?? '',
      type: coupon?.kind === 'flat' ? 'Flat' : 'Percent',
      value: coupon ? String(coupon.value) : '',
      from: coupon ? localDay(coupon.validFrom) : '',
      to: coupon ? lastValidDay(coupon.validTo) : '',
      usageCap: String(coupon?.usageCap ?? 0),
      perUserCap: String(coupon?.perUserCap ?? 0),
      maxDiscount: coupon?.maxDiscountRupees == null ? '' : String(coupon.maxDiscountRupees),
      minOrder: String(coupon?.minOrderRupees ?? 0),
      // Drop departments that no longer exist, so a save is not refused for them (07·S-F7).
      departmentIds: (coupon?.departmentIds ?? []).filter((id) =>
        departments.some((d) => d.id === id),
      ),
      active: coupon?.isActive ?? true,
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      const cap = Number(v.usageCap || 0);
      const perUser = Number(v.perUserCap || 0);
      try {
        await onSave({
          code: normaliseCouponCode(v.code),
          kind: v.type === 'Flat' ? 'flat' : 'percent',
          value: Number(v.value),
          validFrom: dayStartIso(v.from),
          validTo: dayEndExclusiveIso(v.to),
          usageCap: cap > 0 ? cap : null,
          perUserCap: perUser > 0 ? perUser : null,
          maxDiscountRupees:
            v.type === 'Percent' && v.maxDiscount !== '' ? Number(v.maxDiscount) : null,
          minOrderRupees: Number(v.minOrder || 0),
          departmentIds: v.departmentIds,
          isActive: v.active,
        });
        onClose();
      } catch (error) {
        toast(
          form.applyServerErrors(
            error,
            { fields: serverField, labels: { scopes: 'Departments' } },
            'The coupon could not be saved.',
          ),
          'error',
        );
      }
    },
  });

  const departmentIds = form.values.departmentIds;
  const cheapest = cheapestConsultationRupees(doctors, departmentIds);
  const value = Number(form.values.value);
  const valueError = form.errorFor('value');
  const isFlat = form.values.type === 'Flat';

  const sampleOrder = cheapest ?? PREVIEW_ORDER_VALUE;
  const sampleDiscount =
    form.errors.value || !Number.isFinite(value)
      ? 0
      : couponDiscount(
          {
            kind: isFlat ? 'flat' : 'percent',
            value,
            minOrderRupees: Number(form.values.minOrder || 0),
            maxDiscountRupees:
              !isFlat && form.values.maxDiscount !== '' ? Number(form.values.maxDiscount) : null,
          },
          sampleOrder,
        );
  const flatAboveFee = isFlat && cheapest !== null && Number.isFinite(value) && value > cheapest;
  const legacyServices = coupon?.legacyServiceIds.length ?? 0;
  const deptNameOf = (id: string): string =>
    departments.find((d) => d.id === id)?.name ?? 'Removed department';

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
        <p className="text-body bg-bg-tint text-text-navy flex items-start gap-2 rounded-md px-3 py-2.5">
          <Icon name="smartphone" size={16} className="mt-0.5 flex-none" />
          Patients apply coupons when they book in the Medibook app. The front desk does not take
          coupon codes.
        </p>
        {legacyServices > 0 && (
          <p className="text-body bg-y-100 text-y-700 flex items-start gap-2 rounded-md px-3 py-2.5">
            <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
            This coupon was also limited to {legacyServices} service
            {legacyServices === 1 ? '' : 's'}. Coupons can now be limited to departments only, so
            saving keeps just its departments.
          </p>
        )}
        <FormErrorSummary messages={form.serverSummary} />
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
          <Field label="Discount Type" error={form.errorFor('type')}>
            <Select
              value={form.values.type}
              options={COUPON_TYPES}
              onChange={(v) => form.setField('type', v === 'Flat' ? 'Flat' : 'Percent')}
              height={48}
            />
          </Field>
          <Field
            label={isFlat ? 'Discount (₹)' : 'Discount (%)'}
            required
            error={valueError}
            hint={
              !isFlat
                ? 'Up to 100%.'
                : flatAboveFee
                  ? `Above the cheapest consultation in scope (${money(cheapest)}) — there the discount stops at the fee.`
                  : 'Taken off the consultation fee.'
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
          <Field
            label="Uses per Patient"
            error={form.errorFor('perUserCap')}
            hint="How often one patient may use it. 0 = unlimited."
          >
            <TextInput
              value={form.values.perUserCap}
              onChange={(v) => form.setField('perUserCap', v.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              height={48}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Minimum Order Value (₹)"
            error={form.errorFor('minOrder')}
            hint="The code does nothing below this amount."
          >
            <TextInput
              value={form.values.minOrder}
              onChange={(v) => form.setField('minOrder', v.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              height={48}
            />
          </Field>
          {isFlat ? (
            <span />
          ) : (
            <Field
              label="Maximum Discount (₹)"
              error={form.errorFor('maxDiscount')}
              hint="Caps the percent discount. Empty = no cap."
            >
              <TextInput
                value={form.values.maxDiscount}
                onChange={(v) => form.setField('maxDiscount', v.replace(/[^0-9]/g, ''))}
                placeholder="No cap"
                inputMode="numeric"
                height={48}
              />
            </Field>
          )}
        </div>

        <Field
          label="Departments"
          error={form.errorFor('departmentIds')}
          hint="Leave empty for every department. A booking qualifies when its doctor is in one of them."
        >
          <Select
            value=""
            options={departments.filter((d) => !departmentIds.includes(d.id)).map((d) => d.name)}
            onChange={(name) => {
              const id = departments.find((d) => d.name === name)?.id;
              if (id) form.setField('departmentIds', [...departmentIds, id]);
            }}
            placeholder="Add a department…"
            height={48}
          />
        </Field>

        {departmentIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {departmentIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  form.setField(
                    'departmentIds',
                    departmentIds.filter((x) => x !== id),
                  )
                }
                aria-label={`Remove ${deptNameOf(id)}`}
                className="text-caption bg-blue-soft-bg text-blue inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5"
              >
                {deptNameOf(id)} <Icon name="x" size={12} />
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
            ? `On a ${money(sampleOrder)} consultation${cheapest === null ? '' : ' (the cheapest in scope)'} this code takes off ${money(sampleDiscount)} — patient pays ${money(sampleOrder - sampleDiscount)} before the convenience fee.`
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
