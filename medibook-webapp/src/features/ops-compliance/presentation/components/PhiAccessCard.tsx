import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useSort } from '@/shared/hooks/useSort';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { TextInput } from '@/shared/ui/TextInput';
import { ToggleChip } from '@/shared/ui/ToggleChip';

import { useCompliancePhiAccessQuery } from '@/features/ops-compliance/application/queries/useCompliancePhiAccessQuery';
import {
  PHI_PRINCIPALS,
  PHI_SUBJECT_KINDS,
  type PhiPrincipal,
  type PhiSubjectKind,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { ComplianceDateInput } from '@/features/ops-compliance/presentation/components/ComplianceDateInput';
import {
  fmtComplianceWhen,
  isFullUuid,
  PHI_SUBJECT_LABEL,
  phiReadLabel,
  phiResultLabel,
  principalLabel,
} from '@/features/ops-compliance/presentation/components/compliance.labels';
import { useComplianceDebouncedValue } from '@/features/ops-compliance/presentation/hooks/useComplianceDebouncedValue';
import { useHospitalOptionsQuery } from '@/features/ops-hospitals/application/queries/useHospitalOptionsQuery';

const PAGE_SIZE = 15;
const TYPING_DEBOUNCE_MS = 400;

const COLUMNS = ['Read', 'By', 'Hospital', 'Returned', 'When', 'IP address'] as const;
const SORT_KEYS: Readonly<Record<string, string>> = { When: 'when' };

const ALL_SUBJECTS = 'Records: All';
const ALL_HOSPITALS = 'Hospital: All';
const NONE = '—';

const SEARCH_HINT =
  'Finds reads that searched for exactly this term — a name, phone or MRN as typed. Terms are never stored; the server compares a keyed hash.';

/**
 * Who read patient records (B6, H-07): every successful read or search of a
 * hospital's patient records, appointments and visits, and of patient
 * accounts by ops staff — reader, hospital, route, how many records came
 * back. `compliance.view`.
 */
export function PhiAccessCard() {
  const [principals, setPrincipals] = useState<readonly PhiPrincipal[]>([]);
  const [subjectKind, setSubjectKind] = useState<PhiSubjectKind | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [actor, setActor] = useState('');
  const [subject, setSubject] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const { sort, onSort } = useSort({ key: 'when', dir: 'desc' });
  const hospitals = useHospitalOptionsQuery();
  const actorText = useComplianceDebouncedValue(actor.trim(), TYPING_DEBOUNCE_MS);
  const subjectText = useComplianceDebouncedValue(subject.trim(), TYPING_DEBOUNCE_MS);
  const searchText = useComplianceDebouncedValue(search.trim(), TYPING_DEBOUNCE_MS);
  const actorInvalid = actorText !== '' && !isFullUuid(actorText);
  const subjectInvalid = subjectText !== '' && !isFullUuid(subjectText);

  const query = useCompliancePhiAccessQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    sortDirection: sort.dir,
    dateFrom: from,
    dateTo: to,
    principals,
    subjectKind,
    hospitalId,
    actorUserId: actorText && !actorInvalid ? actorText : null,
    subjectId: subjectText && !subjectInvalid ? subjectText : null,
    search: searchText || null,
  });
  const rows = query.data?.items ?? [];
  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = Boolean(
    principals.length > 0 ||
    subjectKind ||
    hospitalId ||
    actor.trim() ||
    subject.trim() ||
    search.trim() ||
    from ||
    to,
  );
  const clearAll = (): void => {
    setPrincipals([]);
    setSubjectKind(null);
    setHospitalId(null);
    setActor('');
    setSubject('');
    setSearch('');
    setFrom('');
    setTo('');
    setPage(0);
  };
  const hospitalName = (id: string | null, fromRow: string | null): string =>
    fromRow ?? (id ? (hospitals.options.find((h) => h.id === id)?.name ?? NONE) : 'Ops console');

  const state: TableStateSpec | undefined = query.isPending
    ? { kind: 'loading', rows: 8 }
    : query.isError
      ? isFailure(query.error) && query.error.kind === 'notFound'
        ? {
            kind: 'empty',
            icon: 'shield-check',
            title: 'Not available on this server yet.',
            message: 'The patient-record access log arrives with the PHI read audit update.',
          }
        : {
            kind: 'error',
            message: isFailure(query.error) ? query.error.message : undefined,
            onRetry: () => void query.refetch(),
          }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'shield-check',
            title: filtersActive ? 'No reads match your filters.' : 'No patient records read yet.',
            message: filtersActive
              ? 'Ids and search terms must match exactly. Widen the dates or clear the filters.'
              : 'Every read of patient records, appointments and patient accounts is listed here.',
            ...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
          }
        : undefined;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SectionTitle>Patient Record Access</SectionTitle>
        <div className="flex-1"></div>
        <FilterSelect
          value={subjectKind ? PHI_SUBJECT_LABEL[subjectKind] : ALL_SUBJECTS}
          options={[ALL_SUBJECTS, ...PHI_SUBJECT_KINDS.map((k) => PHI_SUBJECT_LABEL[k])]}
          onChange={(v) =>
            reset(setSubjectKind)(PHI_SUBJECT_KINDS.find((k) => PHI_SUBJECT_LABEL[k] === v) ?? null)
          }
          aria-label="Filter by kind of record"
        />
        {hospitals.canView && (
          <FilterSelect
            value={hospitals.options.find((h) => h.id === hospitalId)?.name ?? ALL_HOSPITALS}
            options={[ALL_HOSPITALS, ...hospitals.options.map((h) => h.name)]}
            onChange={(v) =>
              reset(setHospitalId)(hospitals.options.find((h) => h.name === v)?.id ?? null)
            }
            aria-label="Filter by hospital"
          />
        )}
        <ComplianceDateInput
          value={from}
          onChange={reset(setFrom)}
          title="Read on or after (IST)"
        />
        <ComplianceDateInput value={to} onChange={reset(setTo)} title="Read on or before (IST)" />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-caption text-text-muted mr-1">Read by</span>
        {PHI_PRINCIPALS.map((p) => (
          <ToggleChip
            key={p}
            pressed={principals.includes(p)}
            onChange={(on) =>
              reset(setPrincipals)(on ? [...principals, p] : principals.filter((x) => x !== p))
            }
          >
            {principalLabel(p)}
          </ToggleChip>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="w-72">
          <TextInput
            value={search}
            onChange={reset(setSearch)}
            placeholder="Searched for (exact term)"
            aria-label="Find reads that searched for this exact term"
          />
        </div>
        <InfoDot text={SEARCH_HINT} />
        <div className="w-80">
          <TextInput
            value={actor}
            onChange={reset(setActor)}
            placeholder="Reader’s user id (UUID)"
            aria-label="Filter by the reader's user id"
            invalid={actorInvalid}
          />
          {actorInvalid && (
            <span className="text-caption text-d-500">Paste the full user id (a UUID).</span>
          )}
        </div>
        <div className="w-80">
          <TextInput
            value={subject}
            onChange={reset(setSubject)}
            placeholder="Record id in the results (UUID)"
            aria-label="Filter by a record id that appears in the results"
            invalid={subjectInvalid}
          />
          {subjectInvalid && (
            <span className="text-caption text-d-500">Paste the full record id (a UUID).</span>
          )}
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={clearAll}
            className="text-body text-blue mt-3 cursor-pointer border-none bg-transparent p-0"
          >
            Clear all
          </button>
        )}
      </div>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Patient record reads"
        sortKeys={SORT_KEYS}
        sort={sort}
        onSort={(key) => {
          onSort(key);
          setPage(0);
        }}
        state={state}
      >
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={`${tdClass} max-w-90`}>
              <OpsEntity
                icon="eye"
                tint="info"
                title={phiReadLabel(r)}
                sub={`${PHI_SUBJECT_LABEL[r.subjectKind]} · ${r.method} ${r.endpoint}`}
              />
            </td>
            <td className={tdClass}>
              {r.actorName ?? r.actorUserId ?? NONE}
              <span className="text-caption text-text-muted block">
                {principalLabel(r.principal)}
              </span>
            </td>
            <td className={tdClass}>{hospitalName(r.hospitalId, r.hospitalName)}</td>
            <td className={`${tdClass} tabular-nums`}>{phiResultLabel(r.resultCount)}</td>
            <td className={tdClass}>{fmtComplianceWhen(r.occurredAt)}</td>
            <td className={`${tdClass} tabular-nums`}>{r.ip ?? NONE}</td>
          </tr>
        ))}
      </TableShell>
      <Pager
        total={query.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="reads"
      />
    </Card>
  );
}
