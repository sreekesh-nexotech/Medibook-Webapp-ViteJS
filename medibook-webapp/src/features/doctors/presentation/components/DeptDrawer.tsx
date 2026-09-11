import type { Dept, Doctor } from '@/features/doctors/application/store/catalog.types';
import { money } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';

interface DeptDrawerProps {
  dept: Dept | null;
  docs: readonly Doctor[];
  onClose: () => void;
  onEdit: (dept: Dept) => void;
  onDelete: (dept: Dept) => void;
  /** Way out of the empty state: start a new doctor in this department. */
  onAddDoctor?: (dept: Dept) => void;
}

/** Department detail slide-over with its assigned doctors (design `DeptDrawer`). */
export function DeptDrawer({
  dept,
  docs,
  onClose,
  onEdit,
  onDelete,
  onAddDoctor,
}: DeptDrawerProps) {
  if (!dept) return null;
  const inDept = docs.filter((d) => d.depts.includes(dept.name));
  return (
    <Drawer
      open={!!dept}
      onClose={onClose}
      title={dept.name}
      subtitle={`${inDept.length} doctor${inDept.length === 1 ? '' : 's'} · base fee ${money(dept.fee)}`}
      width={460}
      footer={
        <>
          <Button
            variant="ghost"
            icon="trash-2"
            style={{ color: 'var(--color-d-500)' }}
            onClick={() => onDelete(dept)}
          >
            Delete
          </Button>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button icon="pencil" onClick={() => onEdit(dept)}>
            Edit
          </Button>
        </>
      }
    >
      {dept.image ? (
        <img
          src={dept.image}
          alt={dept.name}
          className="mb-4 h-30 w-full rounded-lg object-cover"
        />
      ) : (
        <div
          className="mb-4 flex h-25 items-center justify-center rounded-lg text-white"
          style={{
            background: `linear-gradient(135deg, ${dept.color} 0%, color-mix(in srgb, ${dept.color} 70%, #000) 100%)`,
          }}
        >
          <Icon name="stethoscope" size={30} />
        </div>
      )}
      <div className="mb-2.5 flex items-center gap-2">
        <Badge status={dept.status} />
        <span className="text-caption text-text-muted">{dept.hours}</span>
      </div>
      <p className="text-body text-text-body mb-4.5 leading-[1.6]">
        {dept.about || 'No description yet.'}
      </p>
      <div className="text-body text-text-strong mb-2.5 font-medium">
        Doctors in this department
      </div>
      {inDept.length === 0 ? (
        <EmptyState
          compact
          icon="stethoscope"
          title="No doctors assigned yet"
          message={`Patients cannot book ${dept.name} until at least one doctor is assigned to it.`}
          actionLabel={onAddDoctor ? 'Add a doctor' : undefined}
          actionIcon="plus"
          onAction={onAddDoctor ? () => onAddDoctor(dept) : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {inDept.map((d) => (
            <div
              key={d.id}
              className="border-border-soft flex items-center gap-3 rounded-md border px-3 py-2.5"
            >
              <Avatar name={d.name} src={d.photo ?? undefined} size={32} />
              <div className="flex-1">
                <div className="text-body text-text-strong font-medium">{d.name}</div>
                <div className="text-caption text-text-muted">{d.spec}</div>
              </div>
              <Badge status={d.status} />
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
