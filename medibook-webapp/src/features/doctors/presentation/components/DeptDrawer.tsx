import type { Department, DoctorProfile } from '@/features/doctors/domain/entities/doctors.types';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Drawer } from '@/shared/ui/Drawer';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';

import { DOCTOR_STATUS_LABEL } from './doctors.view';

interface DeptDrawerProps {
  dept: Department | null;
  /** Card colour (client-side; the backend stores none). */
  color: string;
  docs: readonly DoctorProfile[];
  onClose: () => void;
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  /** Way out of the empty state: start a new doctor in this department. */
  onAddDoctor?: (dept: Department) => void;
}

/** Department detail slide-over with its assigned doctors (design `DeptDrawer`). */
export function DeptDrawer({
  dept,
  color,
  docs,
  onClose,
  onEdit,
  onDelete,
  onAddDoctor,
}: DeptDrawerProps) {
  if (!dept) return null;
  const inDept = docs.filter((d) => d.departmentId === dept.id);
  return (
    <Drawer
      open
      onClose={onClose}
      title={dept.name}
      subtitle={`${inDept.length} doctor${inDept.length === 1 ? '' : 's'}`}
      width={460}
      footer={
        <>
          <Can perm={'Doctors & Departments.del'}>
            <Button
              variant="ghost"
              icon="trash-2"
              style={{ color: 'var(--color-d-600)' }}
              onClick={() => onDelete(dept)}
            >
              Delete
            </Button>
          </Can>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Can perm={'Doctors & Departments.edit'}>
            <Button icon="pencil" onClick={() => onEdit(dept)}>
              Edit
            </Button>
          </Can>
        </>
      }
    >
      <div
        className="mb-4 flex h-25 items-center justify-center rounded-lg text-white"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 70%, #000) 100%)`,
        }}
      >
        <Icon name="stethoscope" size={30} />
      </div>
      <div className="mb-2.5 flex items-center gap-2">
        <Badge status={dept.isActive ? 'Active' : 'Inactive'} />
      </div>
      <p className="text-body text-text-body mb-4.5 leading-[1.6]">
        {dept.description || 'No description yet.'}
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
              <Avatar name={d.name} size={32} />
              <div className="flex-1">
                <div className="text-body text-text-strong font-medium">{d.name}</div>
                <div className="text-caption text-text-muted">{d.specialisation}</div>
              </div>
              <Badge status={DOCTOR_STATUS_LABEL[d.status]} />
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
