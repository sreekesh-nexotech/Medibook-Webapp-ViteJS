import { useMemo } from 'react';

import { isFailure } from '@/core/error/failure';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  NumberingChanges,
  NumberingReset,
  NumberingSeries,
} from '@/features/settings/domain/entities/settings.entities';
import { useNumberingPreviewQuery } from '@/features/settings/application/queries/useNumberingPreviewQuery';
import { useUpdateNumberingMutation } from '@/features/settings/application/queries/useUpdateNumberingMutation';
import {
  NUMBERING_TOKENS,
  bookingSeriesErrors,
  formatError,
  numberingLiteralText,
  numberingPeriodError,
  renderNumberingSample,
} from '@/features/settings/application/store/settings.rules';

import { NUMBERING_KIND_LABEL, NUMBERING_RESET_LABEL, isNumberingReset } from './numbering.labels';
import { digitsText } from './ruleInputs';

const RESETS: readonly NumberingReset[] = ['never', 'fiscal_year', 'calendar_year', 'monthly'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MAX_PAD = 12;
const MAX_PREFIX = 20;
/** The backend's own code for a series that has issued numbers (MRN). */
const NUMBERING_LOCKED = 'NUMBERING_LOCKED';

interface NumberingForm {
  format: string;
  prefix: string;
  padWidth: string;
  reset: NumberingReset;
  fyStartMonth: string;
}

const ISSUED_NEEDS_NEW_TEXT =
  'This series has issued numbers: change the fixed text of the format too (e.g. add a letter) so new numbers cannot repeat old ones.';

/**
 * The backend's checks for one series (B4: M-21, H-02), so the admin hears
 * about them before saving. Like the server, a legacy series is only
 * re-checked on the fields this edit touches.
 */
function validatorsFor(series: NumberingSeries): FormValidators<NumberingForm> {
  const periodTouched = (f: NumberingForm): boolean =>
    f.format !== series.format ||
    f.reset !== series.reset ||
    f.fyStartMonth !== String(series.fyStartMonth);
  const shapeTouched = (f: NumberingForm): boolean =>
    f.format !== series.format || f.prefix !== (series.prefix ?? '');
  const isBooking = series.kind === 'booking';
  const periodMoved = (f: NumberingForm): boolean =>
    f.reset !== series.reset || f.fyStartMonth !== String(series.fyStartMonth);
  return {
    format: (v, f) =>
      formatError(v, NUMBERING_TOKENS) ??
      (periodTouched(f) ? numberingPeriodError(v, f.reset, Number(f.fyStartMonth)) : undefined) ??
      (isBooking && shapeTouched(f) ? bookingSeriesErrors(v, f.prefix).format : undefined),
    prefix: (v, f) =>
      v.length > MAX_PREFIX
        ? `Use at most ${MAX_PREFIX} characters.`
        : isBooking && shapeTouched(f)
          ? bookingSeriesErrors(f.format, v).prefix
          : undefined,
    padWidth: (v) => {
      const n = Number(v);
      return /^\d+$/.test(v) && n >= 1 && n <= MAX_PAD
        ? undefined
        : `Digits must be between 1 and ${MAX_PAD}.`;
    },
    reset: (_, f) =>
      series.hasAllocated &&
      periodMoved(f) &&
      numberingLiteralText(f.format) === numberingLiteralText(series.format)
        ? ISSUED_NEEDS_NEW_TEXT
        : undefined,
  };
}

const SERVER_FIELDS = {
  format: 'format',
  prefix: 'prefix',
  pad_width: 'padWidth',
  reset: 'reset',
  fy_start_month: 'fyStartMonth',
} as const;

function resetOf(label: string): NumberingReset {
  return RESETS.find((r) => NUMBERING_RESET_LABEL[r] === label) ?? 'never';
}

interface NumberingModalProps {
  series: NumberingSeries;
  onClose: () => void;
}

/**
 * Edit one numbering series (D-26, O-02 default). States the server's own
 * warning — a new format never rewrites issued numbers — and previews the
 * next number with the edited format next to the server's preview of the
 * saved one. MRN never resets (Q36) and is refused once it has issued a
 * number (409 `NUMBERING_LOCKED`).
 */
export function NumberingModal({ series, onClose }: NumberingModalProps) {
  const update = useUpdateNumberingMutation();
  const savedPreview = useNumberingPreviewQuery(series.kind, series.version, true);
  const isMrn = series.kind === 'mrn';
  // The draft sample's {YY}/{MM}/{FY} follow the hospital's today (D-09, UAT-47).
  const { today } = useHospitalToday();
  const validate = useMemo(() => validatorsFor(series), [series]);
  const form = useForm<NumberingForm>({
    initial: {
      format: series.format,
      prefix: series.prefix ?? '',
      padWidth: String(series.padWidth),
      reset: isNumberingReset(series.reset) ? series.reset : 'never',
      fyStartMonth: String(series.fyStartMonth),
    },
    validate,
    onSubmit: async (v) => {
      const changes: NumberingChanges = {
        ...(v.format !== series.format && { format: v.format.trim() }),
        ...(v.prefix !== (series.prefix ?? '') && { prefix: v.prefix.trim() || null }),
        ...(v.padWidth !== String(series.padWidth) && { padWidth: Number(v.padWidth) }),
        ...(v.reset !== series.reset && { reset: v.reset }),
        ...(v.fyStartMonth !== String(series.fyStartMonth) && {
          fyStartMonth: Number(v.fyStartMonth),
        }),
      };
      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      try {
        await update.mutateAsync({ kind: series.kind, changes, version: series.version });
        toast(`${NUMBERING_KIND_LABEL[series.kind] ?? series.kind} format saved`, 'success');
        onClose();
      } catch (error) {
        const message = form.applyServerErrors(
          error,
          { fields: SERVER_FIELDS },
          'The format could not be saved.',
        );
        toast(
          isFailure(error) && error.code === NUMBERING_LOCKED
            ? 'This series has already issued numbers, so its format is locked.'
            : message,
          'error',
        );
      }
    },
  });

  const v = form.values;
  const draftSample =
    formatError(v.format, NUMBERING_TOKENS) === undefined && /^\d+$/.test(v.padWidth)
      ? renderNumberingSample({
          format: v.format,
          prefix: v.prefix || null,
          padWidth: Number(v.padWidth),
          fyStartMonth: Number(v.fyStartMonth),
          seq: 1,
          date: today,
        })
      : null;
  const usesFiscalYear = v.format.includes('{FY}') || v.reset === 'fiscal_year';

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Edit ${NUMBERING_KIND_LABEL[series.kind] ?? series.kind} format`}
      width={620}
      onSubmit={form.handleSubmit}
      submitLabel="Save Format"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <div className="text-body bg-y-100 text-y-800 flex items-start gap-2 rounded-md px-3.5 py-3">
          <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
          <span>{series.warning}</span>
        </div>
        <FormErrorSummary messages={form.serverSummary} />
        <Field
          label="Format"
          required
          error={form.errorFor('format')}
          hint="Placeholders: {PREFIX} {SEQ:n} {FY} {YY} {YYYY} {MM} — exactly one {SEQ}."
        >
          <TextInput
            value={v.format}
            onChange={(x) => form.setField('format', x)}
            onBlur={() => form.blurField('format')}
            maxLength={64}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prefix" error={form.errorFor('prefix')} hint="Printed for {PREFIX}.">
            <TextInput
              value={v.prefix}
              onChange={(x) => form.setField('prefix', x)}
              maxLength={MAX_PREFIX}
            />
          </Field>
          <Field
            label="Digits"
            error={form.errorFor('padWidth')}
            hint="Zero-padding for a plain {SEQ}."
          >
            <TextInput
              value={v.padWidth}
              onChange={(x) => form.setField('padWidth', digitsText(x))}
              inputMode="numeric"
            />
          </Field>
          <Field
            label="Start again at 1"
            error={form.errorFor('reset')}
            hint={isMrn ? 'MRNs never reset (Q36).' : undefined}
          >
            <Select
              value={NUMBERING_RESET_LABEL[v.reset]}
              options={(isMrn ? (['never'] as const) : RESETS).map((r) => NUMBERING_RESET_LABEL[r])}
              onChange={(x) => form.setField('reset', resetOf(x))}
              disabled={isMrn}
            />
          </Field>
          <Field
            label="Fiscal year starts"
            error={form.errorFor('fyStartMonth')}
            hint={usesFiscalYear ? 'Used by {FY} and the fiscal-year reset.' : 'Only used by {FY}.'}
          >
            <Select
              value={MONTHS[Number(v.fyStartMonth) - 1] ?? MONTHS[3] ?? ''}
              options={MONTHS}
              onChange={(x) => form.setField('fyStartMonth', String(MONTHS.indexOf(x) + 1))}
            />
          </Field>
        </div>
        <div
          role="status"
          className="bg-bg-tint text-text-navy flex flex-col gap-1 rounded-md px-3.5 py-3"
        >
          <span className="text-body">
            Next number now:{' '}
            <span className="font-semibold">
              {savedPreview.data ?? (savedPreview.isError ? 'unavailable' : '…')}
            </span>{' '}
            <span className="text-caption">(saved format)</span>
          </span>
          <span className="text-body">
            With your changes, a number would read:{' '}
            <span className="font-semibold">{draftSample ?? '—'}</span>{' '}
            <span className="text-caption">(sequence 1, today)</span>
          </span>
        </div>
      </div>
    </FormModal>
  );
}
