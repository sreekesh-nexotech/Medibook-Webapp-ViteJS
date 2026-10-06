import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { hospitalPath, hospitalSlotsPath, isHospitalRole } from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import type { Department, DoctorProfile } from '@/features/doctors/domain/entities/doctors.types';
import { useDeleteDepartmentMutation } from '@/features/doctors/application/queries/useDepartmentMutations';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDeleteDoctorMutation } from '@/features/doctors/application/queries/useDoctorMutations';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { DeptDrawer } from '../components/DeptDrawer';
import { DeptModal } from '../components/DeptModal';
import { departmentColor, DOCTOR_STATUS_LABEL } from '../components/doctors.view';
import { ScheduleChangeModal } from '../components/ScheduleChangeModal';
import { useScheduleConfirm } from '../components/useScheduleConfirm';

type ConfirmTarget =
  | { readonly kind: 'doc'; readonly item: DoctorProfile }
  | { readonly kind: 'dept'; readonly item: Department };

/** The backend refuses deleting a department that still has doctors. */
const DEPARTMENT_IN_USE = 'DEPARTMENT_IN_USE';

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

const DOC_COLUMNS = [
  'Doctor',
  'Department',
  'Fee',
  'Specialization',
  'Rating',
  'Status',
  'Action',
] as const;

const DOC_SORT_KEYS = {
  Doctor: 'name',
  Department: 'dept',
  Fee: 'fee',
  Rating: 'rating',
  Status: 'status',
} as const;

const ALL_DEPTS = 'All Departments';
const ALL_STATUS = 'All Status';

/** Doctors & Departments catalogue list (design `DoctorsDepartments`), from the hospital API. */
export function DoctorsDepartmentsScreen() {
  const { role: roleParam } = useParams();
  const navigate = useNavigate();
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';
  const doctorsQuery = useDoctorsQuery();
  const departmentsQuery = useDepartmentsQuery();
  const deleteDoctor = useDeleteDoctorMutation();
  const deleteDepartment = useDeleteDepartmentMutation();
  const scheduleConfirm = useScheduleConfirm();
  const docs = useMemo(() => doctorsQuery.data ?? [], [doctorsQuery.data]);
  const depts = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const [tab, setTab] = useState('Doctors');
  const [deptModal, setDeptModal] = useState<{ open: boolean; dept: Department | null }>({
    open: false,
    dept: null,
  });
  const [deptView, setDeptView] = useState<Department | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [q, setQ] = useState('');
  const [deptF, setDeptF] = useState(ALL_DEPTS);
  const [statusF, setStatusF] = useState(ALL_STATUS);
  const { sort, onSort, sorted } = useSort<DoctorProfile>();

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);
  const nameOf = (d: DoctorProfile): string => deptName.get(d.departmentId) ?? '';
  const colorOf = (dept: Department): string =>
    departmentColor(
      Math.max(
        0,
        depts.findIndex((d) => d.id === dept.id),
      ),
    );

  /** `RefreshBtn` re-reads both lists from the server. */
  const refresh = async (): Promise<void> => {
    await Promise.all([doctorsQuery.refetch(), departmentsQuery.refetch()]);
  };

  const openDoctor = (id: string): void => {
    void navigate(`${hospitalPath(role, 'doctors')}/${id}`);
  };
  const hasFilters = q !== '' || deptF !== ALL_DEPTS || statusF !== ALL_STATUS;
  const clearFilters = (): void => {
    setQ('');
    setDeptF(ALL_DEPTS);
    setStatusF(ALL_STATUS);
  };

  const shownDocs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs.filter((d) => {
      const dept = deptName.get(d.departmentId) ?? '';
      if (needle && !(d.name + d.specialisation + dept).toLowerCase().includes(needle))
        return false;
      if (deptF !== ALL_DEPTS && dept !== deptF) return false;
      if (statusF !== ALL_STATUS && DOCTOR_STATUS_LABEL[d.status] !== statusF) return false;
      return true;
    });
  }, [docs, deptName, q, deptF, statusF]);

  const orderedDocs = sorted(shownDocs, {
    name: (d) => d.name,
    dept: nameOf,
    fee: (d) => d.feeRupees,
    rating: (d) => d.ratingAvg ?? 0,
    status: (d) => DOCTOR_STATUS_LABEL[d.status],
  });

  const docTableState: TableStateSpec | undefined = doctorsQuery.isPending
    ? { kind: 'loading', rows: 6 }
    : doctorsQuery.isLoadingError
      ? {
          kind: 'error',
          title: 'Could not load doctors',
          message: failureText(doctorsQuery.error, 'Please try again.'),
          onRetry: () => void doctorsQuery.refetch(),
        }
      : orderedDocs.length === 0
        ? hasFilters
          ? {
              kind: 'empty',
              title: 'No doctors match your filters.',
              message: 'Clear the search and filters to see the whole roster.',
              actionLabel: 'Clear filters',
              onAction: clearFilters,
            }
          : {
              kind: 'empty',
              icon: 'stethoscope',
              title: 'No doctors in the catalogue yet',
              message:
                'Add your first doctor — they become searchable and bookable in the Medibook app.',
              actionLabel: 'Add Doctor',
              onAction: () => openDoctor('new'),
            }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <SegTabs tabs={['Doctors', 'Departments']} value={tab} onChange={setTab} />
          <InfoDot text="Doctors and departments you add here become searchable and bookable in the Medibook patient app." />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            icon="calendar-clock"
            onClick={() => navigate(hospitalSlotsPath(role))}
          >
            Slots & Availability
          </Button>
          <RefreshBtn onRefresh={refresh} title="Refresh catalogue" />
          {tab === 'Doctors' ? (
            <Can perm={'Doctors & Departments.add'}>
              <Button icon="plus" onClick={() => openDoctor('new')}>
                Add Doctor
              </Button>
            </Can>
          ) : (
            <Can perm={'Doctors & Departments.add'}>
              <Button icon="plus" onClick={() => setDeptModal({ open: true, dept: null })}>
                Add Department
              </Button>
            </Can>
          )}
        </div>
      </Card>

      {tab === 'Doctors' ? (
        <Card pad={20}>
          <div className="mb-4">
            <SearchField
              value={q}
              onChange={setQ}
              placeholder="Search doctors by name or specialization"
              aria-label="Search doctors"
            />
          </div>
          <div className="mb-4.5 flex flex-wrap items-center gap-3">
            <FilterSelect
              value={deptF}
              options={[ALL_DEPTS, ...depts.map((x) => x.name)]}
              onChange={setDeptF}
              aria-label="Filter by department"
            />
            <FilterSelect
              value={statusF}
              options={[ALL_STATUS, 'Active', 'On Leave', 'Inactive']}
              onChange={setStatusF}
              aria-label="Filter by doctor status"
            />
            {hasFilters && <ClearChip onClick={clearFilters} />}
          </div>
          <TableShell
            columns={DOC_COLUMNS}
            sortKeys={DOC_SORT_KEYS}
            sort={sort}
            onSort={onSort}
            state={docTableState}
            scrollLabel="Doctors"
          >
            {orderedDocs.map((d) => (
              <tr
                key={d.id}
                onClick={() => openDoctor(d.id)}
                className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
              >
                <td className={tdClass}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={d.name} size={34} />
                    <span className="text-body text-text-strong font-medium">{d.name}</span>
                  </div>
                </td>
                <td className={tdClass}>{nameOf(d) || '—'}</td>
                <td className={cn(tdClass, 'font-semibold tabular-nums')}>{money(d.feeRupees)}</td>
                <td className={cn(tdClass, 'text-text-muted')}>{d.specialisation || '—'}</td>
                <td className={tdClass}>
                  <span className="inline-flex items-center gap-1.25">
                    <Icon
                      name="star"
                      size={14}
                      className="text-y-500"
                      style={{ fill: 'var(--color-y-500)' }}
                    />{' '}
                    {d.ratingAvg === null ? '—' : d.ratingAvg.toFixed(1)}{' '}
                    <span className="text-text-muted text-caption">({d.ratingCount})</span>
                  </span>
                </td>
                <td className={tdClass}>
                  <Badge status={DOCTOR_STATUS_LABEL[d.status]} />
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <Can perm={'Doctors & Departments.edit'}>
                      <IconBtn
                        name="pencil"
                        label="Edit doctor profile"
                        title={`Edit ${d.name}`}
                        box={34}
                        size={15}
                        onClick={() => openDoctor(d.id)}
                      />
                    </Can>
                    <Can perm={'Doctors & Departments.del'}>
                      <IconBtn
                        name="trash-2"
                        label="Remove doctor"
                        title={`Remove ${d.name}`}
                        box={34}
                        size={15}
                        color="var(--color-d-500)"
                        onClick={() => setConfirm({ kind: 'doc', item: d })}
                      />
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      ) : departmentsQuery.isPending ? (
        <SkeletonCards count={6} lines={4} />
      ) : departmentsQuery.isLoadingError ? (
        <Card>
          <ErrorState
            inline
            title="Could not load departments"
            message={failureText(departmentsQuery.error, 'Please try again.')}
            onRetry={() => void departmentsQuery.refetch()}
          />
        </Card>
      ) : depts.length === 0 ? (
        <Card>
          <EmptyState
            icon="layers"
            title="No departments yet"
            message="Departments group your doctors in the Medibook app."
            actionLabel="Add Department"
            actionIcon="plus"
            actionVariant="button"
            onAction={() => setDeptModal({ open: true, dept: null })}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {depts.map((d, index) => {
            const count = docs.filter((x) => x.departmentId === d.id).length;
            const color = departmentColor(index);
            return (
              <Card
                key={d.id}
                pad={0}
                hover
                onClick={() => setDeptView(d)}
                className="overflow-hidden"
              >
                <div
                  className="relative flex h-21 items-center justify-center text-white"
                  style={{
                    background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 70%, #000) 100%)`,
                  }}
                >
                  <Icon name="stethoscope" size={28} />
                  <span className="absolute top-2.5 right-2.5">
                    <Badge status={d.isActive ? 'Active' : 'Inactive'} />
                  </span>
                </div>
                <div className="p-4">
                  <div className="text-h3 text-text-strong">{d.name}</div>
                  <div className="text-caption text-text-muted mt-1 mb-3 min-h-9">
                    {d.description}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body text-text-body inline-flex items-center gap-1.25">
                      <Icon name="users" size={15} className="text-text-muted" /> {count} doctor
                      {count === 1 ? '' : 's'}
                    </span>
                    <span className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Can perm={'Doctors & Departments.edit'}>
                        <IconBtn
                          name="pencil"
                          label="Edit department"
                          title={`Edit ${d.name}`}
                          box={32}
                          size={15}
                          onClick={() => setDeptModal({ open: true, dept: d })}
                        />
                      </Can>
                      <Can perm={'Doctors & Departments.del'}>
                        <IconBtn
                          name="trash-2"
                          label="Remove department"
                          title={`Remove ${d.name}`}
                          box={32}
                          size={15}
                          color="var(--color-d-500)"
                          onClick={() => setConfirm({ kind: 'dept', item: d })}
                        />
                      </Can>
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {deptModal.open && (
        <DeptModal
          key={deptModal.dept?.id ?? 'new-dept'}
          open
          dept={deptModal.dept}
          onClose={() => setDeptModal({ open: false, dept: null })}
        />
      )}
      <DeptDrawer
        dept={deptView}
        color={deptView ? colorOf(deptView) : departmentColor(0)}
        docs={docs}
        onClose={() => setDeptView(null)}
        onEdit={(dp) => {
          setDeptView(null);
          setDeptModal({ open: true, dept: dp });
        }}
        onDelete={(dp) => {
          setDeptView(null);
          setConfirm({ kind: 'dept', item: dp });
        }}
        onAddDoctor={() => {
          setDeptView(null);
          openDoctor('new');
        }}
      />
      <ConfirmModal
        open={Boolean(confirm)}
        danger
        confirmLabel="Delete"
        title={confirm ? (confirm.kind === 'doc' ? 'Remove Doctor' : 'Delete Department') : ''}
        body={confirm ? confirmBody(confirm, docs) : ''}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          setConfirm(null);
          if (confirm.kind === 'doc') {
            const id = confirm.item.id;
            void scheduleConfirm.run({
              attempt: (isConfirmed) => deleteDoctor.mutateAsync({ id, confirm: isConfirmed }),
              onApplied: () => toast('Doctor removed', 'info'),
              onError: (error) =>
                toast(failureText(error, 'Could not remove the doctor.'), 'error'),
            });
            return;
          }
          deleteDepartment.mutate(confirm.item.id, {
            onSuccess: () => toast('Department deleted', 'info'),
            onError: (error) =>
              toast(
                isFailure(error) && error.code === DEPARTMENT_IN_USE
                  ? 'Move or remove its doctors first — a department with doctors cannot be deleted.'
                  : failureText(error, 'Could not delete the department.'),
                'error',
              ),
          });
        }}
      />
      <ScheduleChangeModal {...scheduleConfirm.modal} />
    </div>
  );
}

/** Confirm copy that says what else the delete touches, not just "can't be undone". */
function confirmBody(target: ConfirmTarget, docs: readonly DoctorProfile[]): string {
  if (target.kind === 'doc') {
    return `Remove ${target.item.name} from the catalogue? They disappear from the patient app and from the slot grid. This can't be undone.`;
  }
  const id = target.item.id;
  const assigned = docs.filter((d) => d.departmentId === id).length;
  if (assigned > 0) {
    return `${target.item.name} still has ${assigned} doctor${assigned === 1 ? '' : 's'}. Move them to another department first — a department with doctors cannot be deleted.`;
  }
  return `Delete the ${target.item.name} department? No doctors are assigned to it. This can't be undone.`;
}
