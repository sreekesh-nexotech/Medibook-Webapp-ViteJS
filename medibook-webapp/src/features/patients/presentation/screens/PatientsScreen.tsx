import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useSort, type SortAccessors } from '@/shared/hooks/useSort';
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

import { HOSPITAL_VIEW_SEGMENT, hospitalPath, isHospitalRole } from '@/app/router/paths';

import {
  formatUpdatedAt,
  useListRefresh,
} from '@/features/appointments/application/queries/useListRefresh';
import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import {
  DEPARTMENTS,
  type Appointment,
} from '@/features/appointments/application/store/appointments.types';
import { usePatientsStore } from '@/features/patients/application/store/patients.store';
import type { Patient } from '@/features/patients/application/store/patients.types';
import { PatientModal } from '@/features/patients/presentation/components/PatientModal';

/**
 * Patients list. Patients are real records in the store (identity + contact
 * only — no clinical data); the list merges those records with visit stats
 * derived from appointments. Ported 1:1 from the design prototype's `Patients`.
 */

interface VisitStat {
  visits: number;
  last: string;
  depts: Set<string>;
}

function patientStats(appts: readonly Appointment[]): Record<string, VisitStat> {
  const stat: Record<string, VisitStat> = {};
  appts.forEach((a) => {
    const s = (stat[a.mrn] = stat[a.mrn] || { visits: 0, last: a.date, depts: new Set<string>() });
    s.visits++;
    s.depts.add(a.dept);
  });
  return stat;
}

interface PatientRow extends Patient {
  visits: number;
  depts: ReadonlySet<string>;
}

const PAT_PAGE = 8;

const COLUMNS = [
  'MR Number',
  'Patient Name',
  'Age',
  'Gender',
  'Phone',
  'Visits',
  'Status',
  'Action',
];

export function PatientsScreen() {
  const navigate = useNavigate();
  const { role } = useParams();
  const hospitalRole = isHospitalRole(role) ? role : 'receptionist';

  const patients = usePatientsStore((s) => s.patients);
  const appts = useAppointmentsStore((s) => s.appts);
  const startBooking = useAppointmentsStore((s) => s.startBooking);

  const [q, setQ] = useState('');
  const [deptF, setDeptF] = useState('All Departments');
  const [statusF, setStatusF] = useState('All Status');
  const [sortF, setSortF] = useState('Sort: Recent');
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const { sort, onSort, sorted } = useSort<PatientRow>();

  /**
   * Audit 3.1.1 — Refresh re-reads both stores this list is derived from
   * (patient records + their visit history) and the table re-derives from
   * them, with the shared loading state while it runs. No toast.
   */
  const reload = useCallback((): void => {
    const freshPatients = usePatientsStore.getState().patients;
    const freshAppts = useAppointmentsStore.getState().appts;
    if (!Array.isArray(freshPatients) || !Array.isArray(freshAppts)) {
      throw new Error('The patient list is unavailable.');
    }
  }, []);
  const { loading, error, updatedAt, refresh } = useListRefresh(reload);

  const open = (mrn: string) =>
    navigate(`/${hospitalRole}/${HOSPITAL_VIEW_SEGMENT['patient-detail'].replace(':mrn', mrn)}`);
  const book = (mrn: string) => {
    startBooking(mrn);
    navigate(hospitalPath(hospitalRole, 'create'));
  };

  const stat = patientStats(appts);
  const seen = new Set(patients.map((p) => p.mrn));
  const extra: Patient[] = [];
  appts.forEach((a) => {
    if (!seen.has(a.mrn)) {
      seen.add(a.mrn);
      extra.push({
        mrn: a.mrn,
        name: a.name,
        age: a.age,
        gender: a.gender,
        phone: a.phone,
        email: '',
        address: '',
        status: 'Active',
      });
    }
  });
  const all: PatientRow[] = [...patients, ...extra].map((p) => {
    const st = stat[p.mrn];
    return { ...p, visits: st ? st.visits : 0, depts: st ? st.depts : new Set<string>() };
  });

  const ql = q.trim().toLowerCase();
  let list = all.filter((p) => {
    if (ql && !((p.name || '') + ' ' + p.mrn + ' ' + (p.phone || '')).toLowerCase().includes(ql))
      return false;
    if (deptF !== 'All Departments' && !p.depts.has(deptF)) return false;
    if (statusF !== 'All Status' && (p.status || 'Active') !== statusF) return false;
    return true;
  });
  if (sortF === 'Sort: Name')
    list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const ACC: SortAccessors<PatientRow> = {
    mrn: (p) => p.mrn,
    name: (p) => p.name,
    age: (p) => Number(p.age) || 0,
    gender: (p) => p.gender,
    phone: (p) => p.phone,
    visits: (p) => p.visits,
    status: (p) => p.status || 'Active',
  };
  const ordered = sorted(list, ACC);
  const pages = Math.max(1, Math.ceil(ordered.length / PAT_PAGE));
  const pg = Math.min(page, pages - 1);
  const rows = ordered.slice(pg * PAT_PAGE, pg * PAT_PAGE + PAT_PAGE);
  const reset = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(0);
  };

  const filtersActive =
    q !== '' || deptF !== 'All Departments' || statusF !== 'All Status' || sortF !== 'Sort: Recent';
  const clearAll = () => {
    setQ('');
    setDeptF('All Departments');
    setStatusF('All Status');
    setSortF('Sort: Recent');
    setPage(0);
  };

  /** Loading / empty / error live inside the table body so the header stays put. */
  const tableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: PAT_PAGE }
    : error
      ? { kind: 'error', message: error, onRetry: () => void refresh() }
      : rows.length === 0
        ? filtersActive
          ? {
              kind: 'empty',
              title: 'No patients match your filters.',
              message: 'No record matches this search, department or status.',
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
          <RefreshBtn onRefresh={refresh} title="Refresh patients" />
          <FilterSelect
            value={deptF}
            options={['All Departments', ...DEPARTMENTS]}
            onChange={reset(setDeptF)}
            aria-label="Filter by department"
          />
          <FilterSelect
            value={statusF}
            options={['All Status', 'Active', 'Inactive']}
            onChange={reset(setStatusF)}
            aria-label="Filter by status"
          />
          <FilterSelect
            value={sortF}
            options={['Sort: Recent', 'Sort: Name']}
            onChange={reset(setSortF)}
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
          <span className="text-caption text-text-muted whitespace-nowrap">
            Updated {formatUpdatedAt(updatedAt)}
          </span>
        </div>
        <TableShell
          columns={COLUMNS}
          sortKeys={{
            'MR Number': 'mrn',
            'Patient Name': 'name',
            Age: 'age',
            Gender: 'gender',
            Phone: 'phone',
            Visits: 'visits',
            Status: 'status',
          }}
          sort={sort}
          onSort={onSort}
          state={tableState}
          scrollLabel="Patients"
        >
          {rows.map((p) => (
            <tr
              key={p.mrn}
              onClick={() => open(p.mrn)}
              className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
            >
              <td className={tdClass}>{p.mrn}</td>
              <td className={tdClass}>
                <div className="flex items-center gap-2.5">
                  <Avatar name={p.name} size={30} />
                  <span className="text-text-strong font-medium">{p.name}</span>
                </div>
              </td>
              <td className={tdClass}>{p.age || '—'}</td>
              <td className={tdClass}>{p.gender || '—'}</td>
              <td className={tdClass}>{p.phone || '—'}</td>
              <td className={tdClass}>{p.visits}</td>
              <td className={tdClass}>
                <Badge status={p.status || 'Active'} />
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
          ))}
        </TableShell>
        <Pager total={list.length} page={pg} pageSize={PAT_PAGE} onPage={setPage} noun="patients" />
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
