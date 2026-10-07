import { cn } from '@/shared/lib/cn';
import { todayISO } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import type {
  NumberingKind,
  NumberingSeries,
} from '@/features/settings/domain/entities/settings.entities';
import {
  MONTH_OPTIONS,
  MRN_RESET_OPTIONS,
  NUMBERING_KINDS,
  NUMBERING_RESET_OPTIONS,
  type NumberingForm,
  isFiscalReset,
  withCurrent,
} from '@/features/settings/application/store/settings.form';
import {
  calendarDay,
  renderSeriesNumber,
  seqOfNumber,
  seriesFormatProblem,
} from '@/features/settings/application/store/settings.rules';

import { SettingsHead } from './SettingsHead';

/** The inline-error slots of one series. */
export type NumberingErrorField = 'format' | 'prefix' | 'padWidth';

const SERIES_COPY: Readonly<Record<NumberingKind, { title: string; about: string }>> = {
  mrn: {
    title: 'Patient MRN',
    about: 'Given to each new patient record. It can’t change once the first MRN is issued.',
  },
  booking: {
    title: 'Booking reference',
    about:
      'Shown on every appointment and in the patient app. It must include {PREFIX}, and the prefix must be unique across Medibook.',
  },
  receipt: {
    title: 'Receipt number',
    about: 'Printed on every receipt. Receipt numbers never skip.',
  },
};

interface NumberingSettingsProps {
  readonly series: readonly NumberingSeries[];
  readonly bases: Readonly<Record<NumberingKind, NumberingForm>>;
  readonly drafts: Readonly<Record<NumberingKind, NumberingForm>>;
  readonly onChange: (kind: NumberingKind, field: keyof NumberingForm, value: string) => void;
  readonly errorFor: (kind: NumberingKind, field: NumberingErrorField) => string | undefined;
  readonly mayEdit: boolean;
}

/**
 * The hospital's MRN, booking and receipt number series (PRD-06) — each its
 * own resource, saved with its own version. The next number comes from the
 * server; with unsaved changes, an example of the next number under the new
 * format is worked out here the way the server renders it.
 */
export function NumberingSettings({
  series,
  bases,
  drafts,
  onChange,
  errorFor,
  mayEdit,
}: NumberingSettingsProps) {
  const today = calendarDay(todayISO());
  return (
    <Card pad={28}>
      <SettingsHead info="A new format applies to numbers issued from now on. Numbers already issued never change.">
        Numbering
      </SettingsHead>
      <p className="text-caption text-text-muted m-0 mb-2">
        Placeholders: {'{SEQ}'} or {'{SEQ:5}'} the running number (once), {'{PREFIX}'}, {'{FY}'} the
        financial year (26-27), {'{YYYY}'} or {'{YY}'} the year, {'{MM}'} the month.
      </p>
      {NUMBERING_KINDS.map((kind, i) => {
        const s = series.find((x) => x.kind === kind);
        if (!s) return null;
        const draft = drafts[kind];
        const changed = JSON.stringify(draft) !== JSON.stringify(bases[kind]);
        const editable = mayEdit && s.hospitalEditable && !s.locked;
        const fyMonth = MONTH_OPTIONS.indexOf(draft.fyStartMonth) + 1;
        const showFy = isFiscalReset(draft.reset) || draft.format.includes('{FY}');
        const example =
          changed && !seriesFormatProblem(draft.format.trim()) && fyMonth > 0
            ? renderSeriesNumber(draft.format.trim(), {
                prefix: draft.prefix.trim(),
                seq: seqOfNumber(s.format, s.prefix ?? '', s.nextPreview) ?? 1,
                padWidth: Number(draft.padWidth) || 1,
                fyStartMonth: fyMonth,
                date: today,
              })
            : null;
        const copy = SERIES_COPY[kind];
        const inputId = (field: string): string => `numbering-${kind}-${field}`;
        return (
          <section
            key={kind}
            aria-labelledby={inputId('title')}
            className={cn('py-5', i > 0 && 'border-border-soft border-t')}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id={inputId('title')} className="text-h3 text-text-navy m-0">
                  {copy.title}
                </h3>
                <p className="text-caption text-text-muted m-0 mt-0.5">{copy.about}</p>
              </div>
              <div className="text-right">
                <div className="text-caption text-text-muted">Next number</div>
                <div className="text-body-lg text-text-strong font-mono font-semibold">
                  {s.nextPreview}
                </div>
              </div>
            </div>
            {!s.hospitalEditable && (
              <Notice icon="lock">Managed by Medibook — contact support to change it.</Notice>
            )}
            {s.hospitalEditable && s.locked && (
              <Notice icon="lock">
                Locked — MRNs have been issued, so this series can no longer change.
              </Notice>
            )}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Field label="Format" htmlFor={inputId('format')} error={errorFor(kind, 'format')}>
                <TextInput
                  id={inputId('format')}
                  value={draft.format}
                  onChange={(v) => onChange(kind, 'format', v)}
                  disabled={!editable}
                />
              </Field>
              <Field label="Prefix" htmlFor={inputId('prefix')} error={errorFor(kind, 'prefix')}>
                <TextInput
                  id={inputId('prefix')}
                  value={draft.prefix}
                  onChange={(v) => onChange(kind, 'prefix', v)}
                  disabled={!editable}
                />
              </Field>
              <Field
                label="Digits"
                htmlFor={inputId('digits')}
                error={errorFor(kind, 'padWidth')}
                hint="Used by {SEQ}; {SEQ:5} sets its own"
              >
                <TextInput
                  id={inputId('digits')}
                  value={draft.padWidth}
                  onChange={(v) => onChange(kind, 'padWidth', v.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  disabled={!editable}
                />
              </Field>
              <Field label="Starts again" htmlFor={inputId('reset')}>
                <Select
                  id={inputId('reset')}
                  value={draft.reset}
                  options={withCurrent(
                    kind === 'mrn' ? MRN_RESET_OPTIONS : NUMBERING_RESET_OPTIONS,
                    draft.reset,
                  )}
                  onChange={(v) => onChange(kind, 'reset', v)}
                  disabled={!editable}
                />
              </Field>
              {showFy && (
                <Field label="Financial year starts" htmlFor={inputId('fy')}>
                  <Select
                    id={inputId('fy')}
                    value={draft.fyStartMonth}
                    options={MONTH_OPTIONS}
                    onChange={(v) => onChange(kind, 'fyStartMonth', v)}
                    disabled={!editable}
                  />
                </Field>
              )}
            </div>
            {example && (
              <p className="text-caption text-text-body m-0 mt-3">
                After saving, the next number will look like{' '}
                <span className="text-text-strong font-mono font-semibold">{example}</span>.
              </p>
            )}
          </section>
        );
      })}
    </Card>
  );
}

function Notice({ icon, children }: { icon: 'lock'; children: string }) {
  return (
    <p className="text-caption text-text-muted m-0 mb-3 flex items-center gap-1.5">
      <Icon name={icon} size={13} /> {children}
    </p>
  );
}
