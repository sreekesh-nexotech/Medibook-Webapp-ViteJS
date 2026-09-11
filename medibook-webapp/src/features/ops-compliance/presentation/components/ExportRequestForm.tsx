import { useState } from 'react';

import { DEMO_TODAY_ISO } from '@/core/config/demo';
import { dateRange, required } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Form } from '@/shared/ui/Form';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';

import type { ExportSubjectKind } from '@/features/ops-compliance/application/store/compliance.types';
import { ComplianceDateInput } from '@/features/ops-compliance/presentation/components/ComplianceDateInput';

/** One selectable export subject. */
export interface ExportSubjectOption {
  readonly kind: ExportSubjectKind;
  /** Stable key the rows are gathered by, e.g. `hospital:13`. */
  readonly key: string;
  readonly label: string;
}

/** What the form hands back on submit. */
export interface ExportFormValue {
  readonly kind: ExportSubjectKind;
  readonly subjectKey: string;
  readonly subject: string;
  readonly from: string;
  readonly to: string;
}

const KINDS: readonly ExportSubjectKind[] = ['Hospital', 'Staff user', 'Patient reference'];

/** What each kind's export actually contains — stated before it is requested. */
const KIND_HINT: Readonly<Record<ExportSubjectKind, string>> = {
  Hospital: 'Sign-in attempts against that instance and every configuration change scoped to it.',
  'Staff user': 'That account’s sign-in attempts and the configuration changes it made.',
  'Patient reference':
    'The account record, its linked family members and its booking history — no clinical data.',
};

interface ExportRequestFormProps {
  subjects: readonly ExportSubjectOption[];
  busy: boolean;
  onSubmit: (value: ExportFormValue) => void;
}

interface ExportErrors {
  subject?: string | null;
  range?: string | null;
}

/**
 * Export on request (audit 2.5 / SA-06) — pick a data subject and a date
 * range, and get the records held about it.
 *
 * A real `<form>`, so Enter submits (audit 3.4.5), with inline field errors in
 * the console's own treatment. The request is recorded with a status by the
 * store before anything is written, and only a file that actually lands is
 * reported as an export.
 */
export function ExportRequestForm({ subjects, busy, onSubmit }: ExportRequestFormProps) {
  const [kind, setKind] = useState<ExportSubjectKind>('Hospital');
  const [subjectKey, setSubjectKey] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(DEMO_TODAY_ISO);
  const [err, setErr] = useState<ExportErrors>({});

  // Derived during render: the subject list follows the kind, and a key that
  // no longer belongs to the kind simply reads as "not chosen yet".
  const options = subjects.filter((s) => s.kind === kind);
  const selected = options.find((o) => o.key === subjectKey) ?? null;

  const submit = (): void => {
    const e: ExportErrors = {
      subject: selected ? null : required('', 'A subject'),
      range: required(from, 'A start date') ?? required(to, 'An end date') ?? dateRange(from, to),
    };
    setErr(e);
    if (e.subject || e.range || !selected) return;
    onSubmit({ kind, subjectKey: selected.key, subject: selected.label, from, to });
  };

  return (
    <Card>
      <SectionTitle className="mb-1.5">Export on Request</SectionTitle>
      <div className="text-caption text-text-muted mb-4.5">
        For a data-subject or regulatory request: choose who the records are about and the period
        they cover. The export is recorded below with its status, and every export is written to
        Compliance Logs.
      </div>
      <Form onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <OpsField label="Subject type">
            <Select
              value={kind}
              options={KINDS}
              height={48}
              onChange={(v) => {
                const next = KINDS.find((k) => k === v);
                if (!next) return;
                setKind(next);
                setSubjectKey('');
                setErr({ ...err, subject: null });
              }}
            />
          </OpsField>
          <OpsField label="Subject" required error={err.subject} hint={KIND_HINT[kind]}>
            <Select
              value={selected?.label ?? ''}
              options={options.map((o) => o.label)}
              placeholder="Choose a subject"
              height={48}
              onChange={(v) => {
                const hit = options.find((o) => o.label === v);
                setSubjectKey(hit ? hit.key : '');
                setErr({ ...err, subject: null });
              }}
            />
          </OpsField>
          <OpsField label="From" required error={err.range}>
            {(field) => (
              <ComplianceDateInput
                block
                id={field.id}
                invalid={field.invalid}
                aria-describedby={field.describedById}
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  setErr({ ...err, range: null });
                }}
                title="Export from date"
              />
            )}
          </OpsField>
          <OpsField label="To" required>
            {(field) => (
              <ComplianceDateInput
                block
                id={field.id}
                value={to}
                onChange={(v) => {
                  setTo(v);
                  setErr({ ...err, range: null });
                }}
                title="Export to date"
              />
            )}
          </OpsField>
        </div>
        <div className="mt-4.5 flex flex-wrap items-center gap-3">
          <div className="text-caption text-text-muted bg-blue-soft-bg flex min-w-0 flex-1 items-start gap-2 rounded-sm px-3 py-2.5">
            <Icon name="info" size={14} className="mt-px flex-none" />
            {selected
              ? `${selected.label} — ${KIND_HINT[kind]}`
              : 'Nothing is exported until a subject is chosen.'}
          </div>
          <Button type="submit" icon="file-down" busy={busy}>
            {busy ? 'Preparing…' : 'Prepare Export'}
          </Button>
        </div>
      </Form>
    </Card>
  );
}
