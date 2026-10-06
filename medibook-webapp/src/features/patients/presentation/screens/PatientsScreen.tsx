import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { SortState } from '@/shared/hooks/useSort';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import {
  HOSPITAL_VIEW_SEGMENT,
  hospitalBookForPatientPath,
  isHospitalRole,
} from '@/app/router/paths';

import { formatUpdatedAt } from '@/features/appointments/application/queries/useListRefresh';
import { usePatientsQuery } from '@/features/patients/application/queries/usePatientsQuery';
import { usePatientVisitCountsQuery } from '@/features/patients/application/queries/usePatientVisitCountsQuery';
import type {
  PatientListParams,
  PatientSortField,
} from '@/features/patients/domain/entities/patients.entities';
import { PatientModal } from '@/features/patients/presentation/components/PatientModal';
import {
  SOURCE_LABELS,
  ageFromDob,
  displayPhone,
  genderLabel,
  patientSourceBadge,
  sourceFromLabel,
} from '@/features/patients/presentation/components/patientsFormat';
import { usePatientsDebouncedValue } from '@/features/patients/presentation/components/usePatientsDebouncedValue';

/**
 * Patients list — the hospital's MRN records (identity + contact only, no
 * clinical data), searched, filtered, sorted and paged on the server.
 */

const PAT_PAGE = 8;

/** Wait this long after the last keystroke before searching. */
const SEARCH_DEBOUNCE_MS = 300;

const ALL_SOURCES = 'All Sources';
const SORT_RECENT = 'Sort: Recent';
const SORT_NAME = 'Sort: Name';

const COLUMNS = [
  'MR Number',
  'Patient Name',
  'Age',
  'Gender',
  'Phone',
  'Visits',
  'Source',
  'Action',
];

/** Header sort key → the backend's sort field (the only columns it can sort). */
const COLUMN_SORT_FIELDS: Readonly<Record<string, PatientSortField>> = {
  mrn: 'mrn',
  name: 'full_name',
};

const NO_COLUMN_SORT: SortState = { key: null, dir: 'asc' };

export function PatientsScreen() {
  const navigate = useNavigate();
  const { role } = useParams();
  const hospitalRole = isHospitalRole(role) ? role : 'receptionist';

  const [q, setQ] = useState('');
  const [sourceF, setSourceF] = useState(ALL_SOURCES);
  const [sortF, setSortF] = useState(SORT_RECENT);
  const [colSort, setColSort] = useState<SortState>(NO_COLUMN_SORT);
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const search = usePatientsDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const columnSortField = colSort.key ? COLUMN_SORT_FIELDS[colSort.key] : undefined;
  const params: PatientListParams = {
    page: page + 1,
    pageSize: PAT_PAGE,
    q: search,
    source: sourceFromLabel(sourceF),
    sortField: columnSortField ?? (sortF === SORT_NAME ? 'full_name' : 'created_at'),
    sortDirection: columnSortField ? colSort.dir : sortF === SORT_NAME ? 'asc' : 'desc',
  };
  const patientsQuery = usePatientsQuery(params);
  const rows = patientsQuery.data?.items ?? [];
  const total = patientsQuery.data?.total ?? 0;
  const visits = usePatientVisitCountsQuery(rows.map((p) => p.id));

  const open = (mrn: string) =>
    navigate(`/${hospitalRole}/${HOSPITAL_VIEW_SEGMENT['patient-detail'].replace(':mrn', mrn)}`);
  const book = (mrn: string) => {
    navigate(hospitalBookForPatientPath(hospitalRole, mrn));
  };

  const reset = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(0);
  };
  const onSort = (key: string): void => {
    setColSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
    setPage(0);
  };
  const pickSort = (v: string): void => {
    setSortF(v);
    setColSort(NO_COLUMN_SORT);
    setPage(0);
  };

  const hasFilters = q !== '' || sourceF !== ALL_SOURCES;
  const filtersActive = hasFilters || sortF !== SORT_RECENT || colSort.key !== null;
  const clearAll = () => {
    setQ('');
    setSourceF(ALL_SOURCES);
    setSortF(SORT_RECENT);
    setColSort(NO_COLUMN_SORT);
    setPage(0);
  };

  /** Loading / empty / error live inside the table body so the header stays put. */
  const tableState: TableStateSpec | undefined = patientsQuery.isPending
    ? { kind: 'loading', rows: PAT_PAGE }
    : patientsQuery.isError
      ? {
          kind: 'error',
          message: patientsQuery.error.message,
          onRetry: () => void patientsQuery.refetch(),
        }
      : rows.length === 0
        ? hasFilters
          ? {
              kind: 'empty',
              title: 'No patients match your filters.',
              message: 'No record matches this search or source.',
              actionLabel: 'Clear filters',
              onAction: clearAll,
            }
          : {
              kind: 'empty',
              icon: 'user-plus',
              title: 'No patients yet.',
              message: 'Add the first record — identity and contact only, no clinical data.',
              actionLabel: 'Add patient',
              onAction: () => setAddOpen(true),
            }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card pad={20}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-60 flex-1">
            <SearchField
              value={q}
              onChange={reset(setQ)}
              placeholder="Search by patient name, MR number or phone"
            />
          </div>
          <Can perm="Patients.add">
            <Button icon="user-plus" onClick={() => setAddOpen(true)}>
              Add Patient
            </Button>
          </Can>
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn
            onRefresh={async () => {
              await patientsQuery.refetch();
            }}
            title="Refresh patients"
          />
          <FilterSelect
            value={sourceF}
            options={[ALL_SOURCES, SOURCE_LABELS.desk, SOURCE_LABELS.online]}
            onChange={reset(setSourceF)}
            aria-label="Filter by source"
          />
          <FilterSelect
            value={sortF}
            options={[SORT_RECENT, SORT_NAME]}
            onChange={pickSort}
            aria-label="Sort patients"
          />
          {filtersActive && (
            <button
              type="button"
              onClick={clearAll}
              className="text-body text-blue cursor-pointer whitespace-nowrap"
            >
              Clear all
            </button>
          )}
          <span className="flex-1"></span>
          {patientsQuery.dataUpdatedAt > 0 && (
            <span className="text-caption text-text-muted whitespace-nowrap">
              Updated {formatUpdatedAt(patientsQuery.dataUpdatedAt)}
            </span>
          )}
        </div>
        <TableShell
          columns={COLUMNS}
          sortKeys={{ 'MR Number': 'mrn', 'Patient Name': 'name' }}
          sort={colSort}
          onSort={onSort}
          state={tableState}
          scrollLabel="Patients"
        >
          {rows.map((p) => {
            const source = patientSourceBadge(p.source);
            return (
              <tr
                key={p.id}
                onClick={() => open(p.mrn)}
                className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
              >
                <td className={tdClass}>{p.mrn}</td>
                <td className={tdClass}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.fullName} size={30} />
                    <span className="text-text-strong font-medium">{p.fullName}</span>
                  </div>
                </td>
                <td className={tdClass}>{ageFromDob(p.dateOfBirth) ?? '—'}</td>
                <td className={tdClass}>{genderLabel(p.gender) || '—'}</td>
                <td className={tdClass}>{displayPhone(p.phone) || '—'}</td>
                <td className={tdClass}>{visits.get(p.id) ?? '—'}</td>
                <td className={tdClass}>
                  <Badge status={source.status}>{source.label}</Badge>
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <IconBtn
                      name="eye"
                      label="View patient"
                      box={36}
                      size={16}
                      onClick={() => open(p.mrn)}
                    />
                    <IconBtn
                      name="calendar-plus"
                      label="Book appointment"
                      box={36}
                      size={16}
                      onClick={() => book(p.mrn)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </TableShell>
        <Pager total={total} page={page} pageSize={PAT_PAGE} onPage={setPage} noun="patients" />
      </Card>
      <PatientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(mrn) => {
          setAddOpen(false);
          open(mrn);
        }}
      />
    </div>
  );
}
