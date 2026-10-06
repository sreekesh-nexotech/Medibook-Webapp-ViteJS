import { useState } from 'react';

import { MAX_PAGE_SIZE } from '@/core/api/pagination';
import { required } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Form } from '@/shared/ui/Form';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { useComplianceLoginsQuery } from '@/features/ops-compliance/application/queries/useComplianceLoginsQuery';
import type {
  DataExportDraft,
  LoginHistoryParams,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { usePlatformUsersQuery } from '@/features/ops-platform-users/application/queries/usePlatformUsersQuery';
import type { PlatformUserListParams } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';

type SubjectType = 'Patient account' | 'Hospital staff account';

const SUBJECT_TYPES: readonly SubjectType[] = ['Patient account', 'Hospital staff account'];

/** What each subject type's export contains — stated before it is requested. */
const TYPE_HINT: Readonly<Record<SubjectType, string>> = {
  'Patient account':
    'The account, its family members, bookings and payments — never medical documents or insurance.',
  'Hospital staff account': 'The staff account and what it did across the hospitals it works at.',
};

/** Patients offered per search. */
const PATIENT_PICK_LIMIT = 20;

/** Searches shorter than this list the newest accounts instead. */
const MIN_SEARCH_CHARS = 2;

/**
 * Hospital staff who have signed in recently — the only staff accounts the
 * console can name (the backend has no platform-side staff directory).
 */
const STAFF_SOURCE: LoginHistoryParams = {
  dateFrom: '',
  dateTo: '',
  result: 'success',
  hospitalId: null,
  principal: 'hospital',
  page: 1,
  pageSize: MAX_PAGE_SIZE,
  sortDirection: 'desc',
};

/** A pickable subject account. */
interface SubjectOption {
  readonly userId: string;
  readonly label: string;
}

/** What the form hands back: the draft minus its replay key, plus a label. */
export interface ExportFormValue {
  readonly subjectUserId: string;
  readonly subjectKind: DataExportDraft['subjectKind'];
  readonly subjectLabel: string;
}

interface ExportRequestFormProps {
  busy: boolean;
  onSubmit: (value: ExportFormValue) => void;
}

/**
 * Export on request (audit 2.5 / SA-06) — a data-subject request for one
 * account, filed with `POST /platform/compliance/data-requests` and then
 * prepared. The backend's export covers everything held about the account,
 * so there is no date range; a hospital is not a data subject on its own.
 *
 * A real `<form>`, so Enter submits (audit 3.4.5).
 */
export function ExportRequestForm({ busy, onSubmit }: ExportRequestFormProps) {
  const [type, setType] = useState<SubjectType>('Patient account');
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const term = search.trim();
  const patientParams: PlatformUserListParams = {
    q: term.length >= MIN_SEARCH_CHARS ? term : '',
    statuses: [],
    sort: '-created_at',
    page: 1,
    pageSize: PATIENT_PICK_LIMIT,
  };
  const patientsQuery = usePlatformUsersQuery(patientParams);
  const staffQuery = useComplianceLoginsQuery(STAFF_SOURCE);

  const patientOptions: readonly SubjectOption[] = (patientsQuery.data?.items ?? []).map((u) => ({
    userId: u.id,
    label: [`${u.firstName} ${u.lastName ?? ''}`.trim(), u.email ?? u.phone]
      .filter(Boolean)
      .join(' · '),
  }));
  const staffOptions: readonly SubjectOption[] = [
    ...new Map(
      (staffQuery.data?.items ?? [])
        .filter((l) => l.userId != null)
        .map((l) => [l.userId ?? '', { userId: l.userId ?? '', label: l.identifier }]),
    ).values(),
  ];

  const isPatient = type === 'Patient account';
  const query = isPatient ? patientsQuery : staffQuery;
  const options = isPatient ? patientOptions : staffOptions;
  const selected = options.find((o) => o.userId === userId) ?? null;

  const placeholder = query.isLoading
    ? 'Loading accounts…'
    : query.isLoadingError
      ? 'Accounts could not be loaded — switch type to retry'
      : options.length === 0
        ? isPatient
          ? 'No patient accounts match this search'
          : 'No hospital staff have signed in recently'
        : 'Choose an account';

  const submit = (): void => {
    const missing = selected ? undefined : (required('', 'An account') ?? undefined);
    setError(missing);
    if (!selected) return;
    onSubmit({
      subjectUserId: selected.userId,
      subjectKind: isPatient ? 'patient' : 'hospital_staff',
      subjectLabel: selected.label,
    });
  };

  return (
    <Card>
      <SectionTitle className="mb-1.5">Export on Request</SectionTitle>
      <div className="text-caption text-text-muted mb-4.5">
        For a data-subject or regulatory request: choose whose records to export. The request is
        recorded below with its status and due date; its file can be downloaded once it is ready.
      </div>
      <Form onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OpsField label="Subject type">
            <Select
              value={type}
              options={SUBJECT_TYPES}
              height={48}
              onChange={(v) => {
                const next = SUBJECT_TYPES.find((t) => t === v);
                if (!next) return;
                setType(next);
                setUserId('');
                setError(undefined);
              }}
            />
          </OpsField>
          {isPatient ? (
            <OpsField label="Find patient" hint="Email or phone.">
              <TextInput
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setUserId('');
                }}
                placeholder="e.g. ellen@example.com"
                icon="search"
                inputMode="search"
                height={48}
              />
            </OpsField>
          ) : (
            <OpsField label="Source">
              <div className="text-caption text-text-muted flex h-12 items-center">
                Hospital staff who signed in recently
              </div>
            </OpsField>
          )}
          <OpsField label="Account" required error={error} hint={TYPE_HINT[type]}>
            <Select
              value={selected?.label ?? ''}
              options={options.map((o) => o.label)}
              placeholder={placeholder}
              disabled={options.length === 0}
              height={48}
              onChange={(v) => {
                const hit = options.find((o) => o.label === v);
                setUserId(hit ? hit.userId : '');
                setError(undefined);
              }}
            />
          </OpsField>
        </div>
        <div className="mt-4.5 flex flex-wrap items-center gap-3">
          <div className="text-caption text-text-muted bg-blue-soft-bg flex min-w-0 flex-1 items-start gap-2 rounded-sm px-3 py-2.5">
            <Icon name="info" size={14} className="mt-px flex-none" />
            {selected
              ? `${selected.label} — ${TYPE_HINT[type]}`
              : 'Nothing is exported until an account is chosen.'}
          </div>
          <Button type="submit" icon="file-down" busy={busy}>
            {busy ? 'Preparing…' : 'Prepare Export'}
          </Button>
        </div>
      </Form>
    </Card>
  );
}
