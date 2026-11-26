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

import {
  dayEndExclusive,
  dayOf,
  dayStart,
  discountOn,
  lastDayOf,
  MAX_PERCENT,
  MIN_CODE_LENGTH,
  normaliseCode,
} from '@/features/ops-coupons/domain/couponRules';
import type {
  PlatformCoupon,
  PlatformCouponInput,
} from '@/features/ops-coupons/domain/entities/coupons.entities';

const TYPES = ['Flat', 'Percent'] as const;
type CouponType = (typeof TYPES)[number];

/** A typical consultation fee for the "what the patient saves" preview. */
const PREVIEW_CONSULTATION = 500;
const FIELD_HEIGHT = 44;
const DATE_INPUT_CLASS =
  'rounded-input border-border-control text-body text-text-body h-11 w-full border bg-white px-3';

interface CouponForm {
  code: string;
  type: CouponType;
  value: string;
  from: string;
  to: string;
  /** Total uses; empty or 0 = unlimited. */
  usageCap: string;
  /** Uses per patient; empty or 0 = unlimited. */
  perUserCap: string;
  minOrder: string;
  /** Percent coupons only; empty = no ceiling. */
  maxDiscount: string;
  active: boolean;
}

const digits = (v: string) => v.replace(/[^0-9]/g, '');

const VALIDATORS: FormValidators<CouponForm> = {
  code: (v) => minLen(normaliseCode(v), MIN_CODE_LENGTH, 'Coupon code'),
  value: (v, values) => {
    const n = Number(v);
    if (v.trim() === '' || !Number.isFinite(n) || n <= 0) return 'Enter a discount above zero.';
    return values.type === 'Percent' && n > MAX_PERCENT
      ? `A percent discount is at most ${MAX_PERCENT}%.`
      : undefined;
  },
  from: (v) => required(v, 'Start date'),
  to: (v, values) => dateRange(values.from, v),
};

/** Server field → form field, so a 400's messages land under the right box. */
function serverField(key: string): keyof CouponForm | undefined {
  const map: Readonly<Record<string, keyof CouponForm>> = {
    code: 'code',
    kind: 'type',
    value: 'value',
    valid_from: 'from',
    valid_to: 'to',
    usage_cap: 'usageCap',
    per_user_cap: 'perUserCap',
    min_order_paise: 'minOrder',
    max_discount_paise: 'maxDiscount',
  };
  return map[key];
}

function toInput(v: CouponForm): PlatformCouponInput {
  const cap = Number(v.usageCap || 0);
  const perUser = Number(v.perUserCap || 0);
  return {
    code: normaliseCode(v.code),
    kind: v.type === 'Flat' ? 'flat' : 'percent',
    value: Number(v.value),
    maxDiscountRupees: v.type === 'Percent' && v.maxDiscount !== '' ? Number(v.maxDiscount) : null,
    minOrderRupees: Number(v.minOrder || 0),
    validFrom: dayStart(v.from),
    validTo: dayEndExclusive(v.to),
    usageCap: cap > 0 ? cap : null,
    perUserCap: perUser > 0 ? perUser : null,
    isActive: v.active,
  };
}

interface OpsCouponModalProps {
  open: boolean;
  /** The coupon being edited, or null to create one. */
  coupon: PlatformCoupon | null;
  onClose: () => void;
  /** Persist; rejects with the server's failure so its field errors land on the form. */
  onSave: (input: PlatformCouponInput) => Promise<void>;
}

/**
 * Create / edit a Medibook coupon (client feedback point 9). Medibook pays the discount, it works
 * on online bookings at every hospital, and one booking takes one coupon — the form says so rather
 * than offering choices the server refuses. The validity window is whole days: from the start of
 * the first to the start of the day after the last (`valid_to` is exclusive).
 */
export function OpsCouponModal({ open, coupon, onClose, onSave }: OpsCouponModalProps) {
  const form = useForm<CouponForm>({
    initial: {
      code: coupon?.code ?? '',
      type: coupon?.kind === 'percent' ? 'Percent' : 'Flat',
      value: coupon ? String(coupon.value) : '',
      from: coupon ? dayOf(coupon.validFrom) : '',
      to: coupon ? lastDayOf(coupon.validTo) : '',
      usageCap: String(coupon?.usageCap ?? 0),
      perUserCap: String(coupon?.perUserCap ?? 1),
      minOrder: String(coupon?.minOrderRupees ?? 0),
      maxDiscount: coupon?.maxDiscountRupees == null ? '' : String(coupon.maxDiscountRupees),
      active: coupon?.isActive ?? true,
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      try {
        await onSave(toInput(v));
        onClose();
      } catch (error) {
        toast(
          form.applyServerErrors(error, { fields: serverField }, 'The coupon could not be saved.'),
          'error',
        );
      }
    },
  });

  const v = form.values;
  const isFlat = v.type === 'Flat';
  const value = Number(v.value);
  const saving =
    form.errors.value || !Number.isFinite(value) || v.value === ''
      ? 0
      : discountOn(
          {
            kind: isFlat ? 'flat' : 'percent',
            value,
            minOrderRupees: Number(v.minOrder || 0),
            maxDiscountRupees: !isFlat && v.maxDiscount !== '' ? Number(v.maxDiscount) : null,
          },
          PREVIEW_CONSULTATION,
        );

  const numberField = (
    key: 'usageCap' | 'perUserCap' | 'minOrder' | 'maxDiscount',
    placeholder?: string,
  ) => (
    <TextInput
      value={v[key]}
      onChange={(x) => form.setField(key, digits(x))}
      onBlur={() => form.blurField(key)}
      inputMode="numeric"
      placeholder={placeholder}
      height={FIELD_HEIGHT}
    />
  );

  return (
    <FormModal
      dirty={form.isDirty}
      open={open}
      onClose={onClose}
      title={coupon ? `Edit Coupon — ${coupon.code}` : 'Create Coupon'}
      width={640}
      onSubmit={form.handleSubmit}
      submitLabel={coupon ? 'Save Coupon' : 'Create Coupon'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <div className="text-body bg-bg-tint text-text-navy flex items-start gap-2 rounded-md px-3 py-2.5">
          <Icon name="wallet" size={16} className="mt-0.5 flex-none" />
          <span>
            <strong>Medibook pays this discount.</strong> The hospital is credited it on its
            settlement, so it still receives its full fee. The code works on online bookings at
            every hospital, one coupon per booking.
          </span>
        </div>
        <FormErrorSummary messages={form.serverSummary} />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Code" required error={form.errorFor('code')}>
            <TextInput
              value={v.code}
              onChange={(x) => form.setField('code', x.toUpperCase())}
              onBlur={() => form.blurField('code')}
              placeholder="FIRST100"
              height={FIELD_HEIGHT}
              autoFocus
            />
          </Field>
          <Field label="Discount Type">
            <Select
              value={v.type}
              options={TYPES}
              onChange={(x) => form.setField('type', x === 'Percent' ? 'Percent' : 'Flat')}
              height={FIELD_HEIGHT}
            />
          </Field>
          <Field
            label={isFlat ? 'Discount (₹)' : 'Discount (%)'}
            required
            error={form.errorFor('value')}
            hint={isFlat ? 'Taken off the consultation fee.' : 'Up to 100%.'}
          >
            <TextInput
              value={v.value}
              onChange={(x) => form.setField('value', digits(x))}
              onBlur={() => form.blurField('value')}
              inputMode="numeric"
              height={FIELD_HEIGHT}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Valid From" required error={form.errorFor('from')}>
            <input
              type="date"
              value={v.from}
              onChange={(e) => form.setField('from', e.target.value)}
              onBlur={() => form.blurField('from')}
              aria-label="Valid from"
              className={DATE_INPUT_CLASS}
            />
          </Field>
          <Field label="Valid Until" required error={form.errorFor('to')}>
            <input
              type="date"
              value={v.to}
              onChange={(e) => form.setField('to', e.target.value)}
              onBlur={() => form.blurField('to')}
              aria-label="Valid until"
              className={DATE_INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Total Uses"
            error={form.errorFor('usageCap')}
            hint="Across all patients and hospitals. 0 = unlimited."
          >
            {numberField('usageCap')}
          </Field>
          <Field
            label="Uses per Patient"
            error={form.errorFor('perUserCap')}
            hint="Counted at every hospital. 0 = unlimited."
          >
            {numberField('perUserCap')}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Minimum Consultation Fee (₹)"
            error={form.errorFor('minOrder')}
            hint="The code does nothing below this fee."
          >
            {numberField('minOrder')}
          </Field>
          {isFlat ? (
            <span />
          ) : (
            <Field
              label="Maximum Discount (₹)"
              error={form.errorFor('maxDiscount')}
              hint="Caps the percent discount. Empty = no cap."
            >
              {numberField('maxDiscount', 'No cap')}
            </Field>
          )}
        </div>

        <div
          className={cn(
            'text-body flex items-center gap-2 rounded-md px-3.5 py-3',
            saving > 0 ? 'bg-g-100 text-g-800' : 'bg-grey-300 text-text-muted',
          )}
        >
          <Icon name="percent" size={16} className="flex-none" />
          {saving > 0
            ? `On a ${money(PREVIEW_CONSULTATION)} consultation the patient saves ${money(saving)}, paid by Medibook.`
            : 'Enter a discount to preview what a patient saves.'}
        </div>

        <div className="border-border-soft flex items-center gap-3 rounded-md border px-3.5 py-3">
          <Toggle
            value={v.active}
            onChange={(x) => form.setField('active', x)}
            label="Coupon can be used"
          />
          <div className="flex flex-col">
            <span className="text-body text-text-strong font-medium">Can be used</span>
            <span className="text-caption text-text-muted">
              A paused coupon keeps its dates and uses but cannot be applied.
            </span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
