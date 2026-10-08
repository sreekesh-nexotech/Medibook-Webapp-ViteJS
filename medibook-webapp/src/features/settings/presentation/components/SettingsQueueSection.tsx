import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { fmtDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import type {
  HospitalRuleSettings,
  TokenPolicy,
  TokenReset,
  TokenScope,
} from '@/features/settings/domain/entities/settings.entities';
import { usePrintTemplatesQuery } from '@/features/settings/application/queries/usePrintTemplatesQuery';
import {
  NO_SHOW_ATTEMPT_OPTIONS,
  type RulesForm,
  type TokenForm,
} from '@/features/settings/application/store/settings.form';
import {
  labelShowsSource,
  labelsCollideAcrossDepartments,
  renderTokenLabel,
} from '@/features/settings/application/store/settings.rules';

import { RuleCard } from './RuleCard';
import { RuleNumberField } from './RuleNumberField';
import { RuleRow } from './RuleRow';
import { SettingsHead } from './SettingsHead';
import { digitsText } from './ruleInputs';
import type { SectionDraft } from './settingsEditor.types';

const SCOPE_LABEL: Readonly<Record<TokenScope, string>> = {
  doctor: 'Each doctor counts separately (default)',
  department: 'Each department counts separately',
  hospital: 'One count for the whole hospital',
};

const RESET_LABEL: Readonly<Record<TokenReset, string>> = {
  session: 'Start again at 1 every session',
  day: 'Start again at 1 every day',
};

const SCOPES: readonly TokenScope[] = ['doctor', 'department', 'hospital'];
const RESETS: readonly TokenReset[] = ['session', 'day'];

/** Placeholders an admin can insert into the label format, with what each prints. */
const FORMAT_CHIPS: readonly { readonly token: string; readonly meaning: string }[] = [
  { token: '{SRC}', meaning: 'online / desk marker' },
  { token: '{PREFIX}', meaning: 'the prefix' },
  { token: '{SEQ:3}', meaning: 'number, 3 digits' },
  { token: '{DOC}', meaning: "doctor's short code" },
  { token: '{DEPT}', meaning: 'department code' },
  { token: '{DATE:DDMM}', meaning: 'date' },
];

/** Shown when the hospital has no doctor or department to sample yet. */
const SAMPLE_DOCTOR_CODE = 'dr-sample';
const SAMPLE_DEPARTMENT_CODE = 'opd';

function scopeOf(label: string): TokenScope {
  return SCOPES.find((s) => SCOPE_LABEL[s] === label) ?? 'doctor';
}

function resetOf(label: string): TokenReset {
  return RESETS.find((r) => RESET_LABEL[r] === label) ?? 'session';
}

interface SettingsQueueSectionProps {
  rulesDraft: SectionDraft<RulesForm>;
  tokenDraft: SectionDraft<TokenForm>;
  rules: HospitalRuleSettings;
  tokenPolicy: TokenPolicy;
  mayEdit: boolean;
}

/**
 * Settings › Queue & Tokens — how the queue behaves (expected consultation
 * time, when No-show is offered, token cancellation, the display screen's
 * names) and the full token policy (D-15, Q18–24): format with `{SRC}`,
 * `{PREFIX}`, `{SEQ:n}`, `{DOC}`, `{DEPT}`, the prefix and markers, separate
 * online/desk ranges, reuse, reset and scope.
 *
 * The preview renders the draft exactly as the backend's allocator would
 * (`render_label`) for a real doctor and department — never an invented
 * per-department prefix (UAT-27) — and says plainly when two queues can
 * show the same label.
 */
export function SettingsQueueSection({
  rulesDraft,
  tokenDraft,
  rules,
  tokenPolicy,
  mayEdit,
}: SettingsQueueSectionProps) {
  const r = rulesDraft.value;
  const t = tokenDraft.value;
  const setRule = rulesDraft.set;
  const setToken = tokenDraft.set;
  const rErr = rulesDraft.errors;
  const tErr = tokenDraft.errors;

  const doctors = useDoctorsQuery();
  const departments = useDepartmentsQuery();
  const templates = usePrintTemplatesQuery();
  // The sample label's {DATE} is the hospital's today, as the backend renders it (D-09).
  const { today } = useHospitalToday();
  const slipTemplates = (templates.data ?? []).filter((p) => p.kind === 'token_slip');
  const templateLabel = (id: string): string =>
    id === '' ? 'Hospital default' : (slipTemplates.find((p) => p.id === id)?.name ?? 'Unknown');

  const sampleDoctor = (doctors.data ?? []).find((d) => d.status === 'active');
  const sampleDepartment =
    (departments.data ?? []).find((d) => d.id === sampleDoctor?.departmentId) ??
    (departments.data ?? [])[0];
  const sample = (source: 'online' | 'desk', seq: number) =>
    renderTokenLabel({
      format: t.format,
      prefix: t.prefix,
      onlineMarker: t.onlineMarker,
      offlineMarker: t.offlineMarker,
      seq,
      source,
      doctorCode: sampleDoctor?.slug ?? SAMPLE_DOCTOR_CODE,
      departmentCode: sampleDepartment?.code ?? SAMPLE_DEPARTMENT_CODE,
      date: today,
    });
  const firstOnline = t.separateRanges ? Number(t.onlineRangeStart) || 1 : 1;
  const firstDesk = t.separateRanges ? Number(t.offlineRangeStart) || 1 : 1;
  const formatOk = tErr.format === undefined;
  const showsSource = labelShowsSource(t.format, t.onlineMarker, t.offlineMarker);
  const collides = t.scope !== 'hospital' && labelsCollideAcrossDepartments(t.format);

  const pendingCopy =
    tokenPolicy.pendingEffectiveDate &&
    [
      tokenPolicy.pendingScope
        ? `count “${SCOPE_LABEL[tokenPolicy.pendingScope].toLowerCase()}”`
        : '',
      tokenPolicy.pendingReset ? `“${RESET_LABEL[tokenPolicy.pendingReset].toLowerCase()}”` : '',
    ]
      .filter(Boolean)
      .join(' and ');

  const insertToken = (token: string): void => setToken('format', `${t.format}${token}`);

  return (
    <>
      <RuleCard title="Queue" hint="How the live queue behaves">
        <RuleRow
          label="Expected consultation time"
          hint={`Used for patients' wait estimates and the long-consultation flag; a doctor's own time overrides it (Q29).${
            rules.derived.slotsPerSessionEstimate
              ? ` Doctors' sessions hold ≈ ${rules.derived.slotsPerSessionEstimate.avg} slots each.`
              : ''
          }`}
        >
          <RuleNumberField
            id="rule-consult-minutes"
            value={r.expectedConsultMinutes}
            unit="min"
            label="Expected consultation time in minutes"
            error={rErr.expectedConsultMinutes}
            disabled={!mayEdit}
            onChange={(v) => setRule('expectedConsultMinutes', digitsText(v))}
          />
        </RuleRow>
        <RuleRow
          label="Offer No-show after"
          hint={`After ${r.noShowCallAttempts} skip${r.noShowCallAttempts === '1' ? '' : 's'} the desk is offered No-show. It is never marked automatically (Q27, Q87).`}
        >
          <div className="w-32">
            <Select
              value={r.noShowCallAttempts}
              options={
                NO_SHOW_ATTEMPT_OPTIONS.includes(r.noShowCallAttempts)
                  ? NO_SHOW_ATTEMPT_OPTIONS
                  : [...NO_SHOW_ATTEMPT_OPTIONS, r.noShowCallAttempts]
              }
              onChange={(v) => setRule('noShowCallAttempts', v)}
              height={40}
              aria-label="Skips before No-show is offered"
              disabled={!mayEdit}
            />
          </div>
        </RuleRow>
        <RuleRow
          label="Token cancellation"
          hint={
            r.tokenCancelLimitMin.trim() === ''
              ? 'Patients can cancel a token until it is called. Enter minutes to stop cancellations that long before the session.'
              : `Tokens can be cancelled until ${r.tokenCancelLimitMin} min before the session starts.`
          }
        >
          <RuleNumberField
            id="rule-token-cancel"
            value={r.tokenCancelLimitMin}
            unit="min"
            placeholder="Until called"
            label="Minutes before the session a token can still be cancelled"
            error={rErr.tokenCancelLimitMin}
            disabled={!mayEdit}
            onChange={(v) => setRule('tokenCancelLimitMin', digitsText(v))}
          />
        </RuleRow>
        <RuleRow
          label="Full names on the display screen"
          hint={
            r.displayShowFullName
              ? 'The token screen shows patients’ full names.'
              : 'The token screen shows first name and last initial (e.g. “Asha R.”).'
          }
          last
        >
          <Toggle
            value={r.displayShowFullName}
            onChange={(v) => setRule('displayShowFullName', v)}
            label="Show full names on the display screen"
            disabled={!mayEdit}
          />
        </RuleRow>
      </RuleCard>

      <Card pad={28}>
        <SettingsHead info="How token numbers are counted and printed. Format, prefix, markers, ranges and reuse apply at once; scope and reset apply from tomorrow so today's queues keep their numbers.">
          Token Policy
        </SettingsHead>

        {pendingCopy && tokenPolicy.pendingEffectiveDate && (
          <div className="text-body bg-y-100 text-y-700 mb-4 flex items-start gap-2 rounded-md px-3.5 py-3">
            <Icon name="calendar-clock" size={16} className="mt-0.5 flex-none" />
            <span>
              Scheduled from {fmtDate(tokenPolicy.pendingEffectiveDate)}: tokens {pendingCopy}.
              Today runs on the current setting ({SCOPE_LABEL[tokenPolicy.scope].toLowerCase()},{' '}
              {RESET_LABEL[tokenPolicy.reset].toLowerCase()}). To cancel the change, choose the
              current value below and save.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field
            label="Counting"
            error={tErr.scope}
            hint="Which queues share one sequence of numbers. Applies from tomorrow."
          >
            <Select
              value={SCOPE_LABEL[t.scope]}
              options={SCOPES.map((s) => SCOPE_LABEL[s])}
              onChange={(v) => setToken('scope', scopeOf(v))}
              disabled={!mayEdit}
            />
          </Field>
          <Field label="Reset" error={tErr.reset} hint="Applies from tomorrow.">
            <Select
              value={RESET_LABEL[t.reset]}
              options={RESETS.map((x) => RESET_LABEL[x])}
              onChange={(v) => setToken('reset', resetOf(v))}
              disabled={!mayEdit}
            />
          </Field>
          <Field
            label="Label format"
            required
            className="md:col-span-2"
            error={tErr.format}
            hint="Exactly one {SEQ} or {SEQ:n}. Click a placeholder to add it."
          >
            <TextInput
              value={t.format}
              onChange={(v) => setToken('format', v)}
              maxLength={64}
              disabled={!mayEdit}
            />
          </Field>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            {FORMAT_CHIPS.map((chip) => (
              <button
                key={chip.token}
                type="button"
                disabled={!mayEdit}
                onClick={() => insertToken(chip.token)}
                title={chip.meaning}
                className={cn(
                  'text-caption border-border text-text-body rounded-full border bg-white px-3 py-1 font-mono',
                  mayEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                )}
              >
                {chip.token} <span className="text-text-muted font-sans">{chip.meaning}</span>
              </button>
            ))}
          </div>
          <Field label="Prefix" error={tErr.prefix} hint="Printed where the format has {PREFIX}.">
            <TextInput
              value={t.prefix}
              onChange={(v) => setToken('prefix', v)}
              maxLength={10}
              disabled={!mayEdit}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Online marker"
              required
              error={tErr.onlineMarker}
              hint="{SRC} for app bookings"
            >
              <TextInput
                value={t.onlineMarker}
                onChange={(v) => setToken('onlineMarker', v)}
                maxLength={8}
                disabled={!mayEdit}
              />
            </Field>
            <Field
              label="Desk marker"
              required
              error={tErr.offlineMarker}
              hint="{SRC} for desk bookings"
            >
              <TextInput
                value={t.offlineMarker}
                onChange={(v) => setToken('offlineMarker', v)}
                maxLength={8}
                disabled={!mayEdit}
              />
            </Field>
          </div>
        </div>

        <div className="border-border-soft mt-5 flex flex-col gap-1 border-t pt-4">
          <RuleRow
            label="Separate online and desk ranges"
            hint="Online and desk tokens draw from their own number ranges (Q21). When a range is used up, the next booking of that kind is refused until the reset."
          >
            <Toggle
              value={t.separateRanges}
              onChange={(v) => setToken('separateRanges', v)}
              label="Separate online and desk number ranges"
              disabled={!mayEdit}
            />
          </RuleRow>
          {t.separateRanges && (
            <div className="grid grid-cols-2 gap-4 py-3 md:grid-cols-4">
              {(
                [
                  ['onlineRangeStart', 'Online from'],
                  ['onlineRangeEnd', 'Online to'],
                  ['offlineRangeStart', 'Desk from'],
                  ['offlineRangeEnd', 'Desk to'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} required error={tErr[key]}>
                  <TextInput
                    value={t[key]}
                    onChange={(v) => setToken(key, digitsText(v))}
                    inputMode="numeric"
                    disabled={!mayEdit}
                  />
                </Field>
              ))}
              {tErr.separateRanges && (
                <span className="text-caption text-d-700 col-span-full flex items-center gap-1.5">
                  <Icon name="triangle-alert" size={13} /> {tErr.separateRanges}
                </span>
              )}
            </div>
          )}
          <RuleRow
            label="Reuse cancelled numbers"
            hint="A cancelled token that was never called is issued again, smallest first (Q23–24)."
          >
            <Toggle
              value={t.reuseCancelled}
              onChange={(v) => setToken('reuseCancelled', v)}
              label="Reuse cancelled token numbers"
              disabled={!mayEdit}
            />
          </RuleRow>
          <RuleRow
            label="Token slip template"
            hint="Manage templates under Receipts & Printing."
            last
          >
            <div className="w-56">
              <Select
                value={templateLabel(t.printTemplateId)}
                options={['Hospital default', ...slipTemplates.map((p) => p.name)]}
                onChange={(name) =>
                  setToken('printTemplateId', slipTemplates.find((p) => p.name === name)?.id ?? '')
                }
                height={40}
                aria-label="Token slip template"
                disabled={!mayEdit || templates.isError}
              />
            </div>
          </RuleRow>
        </div>

        <div
          role="status"
          className="bg-bg-tint text-text-navy mt-4 flex flex-col gap-1.5 rounded-md px-3.5 py-3"
        >
          <span className="text-body font-medium">
            {formatOk
              ? `Online token ${firstOnline}: ${sample('online', firstOnline)} · Desk token ${firstDesk}: ${sample('desk', firstDesk)}`
              : 'Fix the format to see a preview.'}
          </span>
          <span className="text-caption">
            {sampleDoctor
              ? `For ${sampleDoctor.name}${sampleDepartment ? ` (${sampleDepartment.name})` : ''}, today.`
              : 'With a sample doctor and department, today.'}{' '}
            {t.scope === 'hospital'
              ? 'One sequence for the whole hospital.'
              : `${t.scope === 'doctor' ? 'Every doctor' : 'Every department'} starts at ${firstOnline} in each ${t.reset === 'session' ? 'session' : 'day'}.`}
          </span>
          {formatOk && !showsSource && (
            <span className="text-caption text-y-700">
              Online and desk tokens look the same. Add {'{SRC}'} with different markers to tell
              them apart.
            </span>
          )}
          {formatOk && collides && (
            <span className="text-caption text-y-700">
              Two {t.scope === 'doctor' ? 'doctors' : 'departments'} can both be on{' '}
              {sample('online', firstOnline)} at the same time. That is fine for separate rooms; add{' '}
              {t.scope === 'doctor' ? '{DOC}' : '{DEPT}'} if they share a waiting area or display
              screen.
            </span>
          )}
        </div>
      </Card>
    </>
  );
}
