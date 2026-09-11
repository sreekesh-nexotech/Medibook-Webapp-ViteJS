import { useMemo, useState, useTransition } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { hospitalPath, hospitalSlotsPath, isHospitalRole } from '@/app/router/paths';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import type { Dept, Doctor } from '@/features/doctors/application/store/catalog.types';
import { summariseWeekHours } from '@/features/doctors/domain/schedule';
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

interface ConfirmTarget {
  kind: 'doc' | 'dept';
  item: Doctor | Dept;
}

const DOC_COLUMNS = [
  'Doctor',
  'Department',
  'Fee',
  'Working Hours',
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

/** Doctors & Departments catalog list (design `DoctorsDepartments`). */
export function DoctorsDepartmentsScreen() {
  const { role: roleParam } = useParams();
  const navigate = useNavigate();
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';
  const depts = useCatalogStore((s) => s.depts);
  const docs = useCatalogStore((s) => s.docs);
  const catDeleteDoctor = useCatalogStore((s) => s.catDeleteDoctor);
  const catDeleteDept = useCatalogStore((s) => s.catDeleteDept);
  const [tab, setTab] = useState('Doctors');
  const [deptModal, setDeptModal] = useState<{ open: boolean; dept: Dept | null }>({
    open: false,
    dept: null,
  });
  const [deptView, setDeptView] = useState<Dept | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [q, setQ] = useState('');
  const [deptF, setDeptF] = useState(ALL_DEPTS);
  const [statusF, setStatusF] = useState(ALL_STATUS);
  const { sort, onSort, sorted } = useSort<Doctor>();

  /**
   * `RefreshBtn` re-derives the list off the catalog store (audit 3.1.1 — the
   * control "does nothing on eight screens"). The recompute runs in a
   * transition, so `isPending` is React's own report that the new list is not
   * on screen yet and the table can shimmer honestly while it lands.
   */
  const [nonce, setNonce] = useState(0);
  const [isPending, startTransition] = useTransition();
  const refresh = (): void => {
    startTransition(() => setNonce((n) => n + 1));
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
    void nonce; // the refresh control's re-derivation trigger
    const needle = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (needle && !(d.name + d.spec + d.depts.join(' ')).toLowerCase().includes(needle))
        return false;
      if (deptF !== ALL_DEPTS && !d.depts.includes(deptF)) return false;
      if (statusF !== ALL_STATUS && d.status !== statusF) return false;
      return true;
    });
  }, [docs, q, deptF, statusF, nonce]);

  const orderedDocs = sorted(shownDocs, {
    name: (d) => d.name,
    dept: (d) => d.depts.join(', '),
    fee: (d) => d.fee,
    rating: (d) => d.rating,
    status: (d) => d.status,
  });

  const docTableState: TableStateSpec | undefined = isPending
    ? { kind: 'loading', rows: 6 }
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
                    <Avatar name={d.name} src={d.photo ?? undefined} size={34} />
                    <span className="text-body text-text-strong font-medium">{d.name}</span>
                  </div>
                </td>
                <td className={tdClass}>{d.depts.join(', ') || '—'}</td>
                <td className={cn(tdClass, 'font-semibold tabular-nums')}>{money(d.fee)}</td>
                <td className={cn(tdClass, 'text-text-muted')}>{summariseWeekHours(d.week)}</td>
                <td className={tdClass}>
                  <span className="inline-flex items-center gap-1.25">
                    <Icon
                      name="star"
                      size={14}
                      className="text-y-500"
                      style={{ fill: 'var(--color-y-500)' }}
                    />{' '}
                    {d.rating} <span className="text-text-muted text-caption">({d.reviews})</span>
                  </span>
                </td>
                <td className={tdClass}>
                  <Badge status={d.status} />
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
      ) : isPending ? (
        <SkeletonCards count={6} lines={4} />
      ) : depts.length === 0 ? (
        <Card>
          <EmptyState
            icon="layers"
            title="No departments yet"
            message="Departments group your doctors and carry the base consultation fee."
            actionLabel="Add Department"
            actionIcon="plus"
            actionVariant="button"
            onAction={() => setDeptModal({ open: true, dept: null })}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {depts.map((d) => {
            const count = docs.filter((x) => x.depts.includes(d.name)).length;
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
                    background: d.image
                      ? 'none'
                      : `linear-gradient(135deg, ${d.color} 0%, color-mix(in srgb, ${d.color} 70%, #000) 100%)`,
                  }}
                >
                  {d.image ? (
                    <img
                      src={d.image}
                      alt={d.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <Icon name="stethoscope" size={28} />
                  )}
                  <span className="absolute top-2.5 right-2.5">
                    <Badge status={d.status} />
                  </span>
                </div>
                <div className="p-4">
                  <div className="text-h3 text-text-strong">{d.name}</div>
                  <div className="text-caption text-text-muted mt-1 mb-3 min-h-9">{d.about}</div>
                  <div className="text-body text-text-body flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.25">
                      <Icon name="users" size={15} className="text-text-muted" /> {count} doctor
                      {count === 1 ? '' : 's'}
                    </span>
                    <span className="text-text-strong font-semibold tabular-nums">
                      {money(d.fee)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-caption text-text-muted flex items-center gap-1.25">
                      <Icon name="clock" size={13} /> {d.hours}
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
          if (confirm.kind === 'doc') {
            catDeleteDoctor(confirm.item.id);
            toast('Doctor removed', 'info');
          } else {
            catDeleteDept(confirm.item.id);
            toast('Department deleted', 'info');
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}

/** Confirm copy that says what else the delete touches, not just "can't be undone". */
function confirmBody(target: ConfirmTarget, docs: readonly Doctor[]): string {
  if (target.kind === 'doc') {
    return `Remove ${target.item.name} from the catalogue? They disappear from the patient app and from the slot grid. This can't be undone.`;
  }
  const assigned = docs.filter((d) => d.depts.includes(target.item.name)).length;
  const tail =
    assigned === 0
      ? 'No doctors are assigned to it.'
      : `It is unassigned from ${assigned} doctor${assigned === 1 ? '' : 's'}, who keep their profiles.`;
  return `Delete the ${target.item.name} department? ${tail} This can't be undone.`;
}
