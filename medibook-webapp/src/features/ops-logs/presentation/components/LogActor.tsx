import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { useHospitalQuery } from '@/features/ops-hospitals/application/queries/useHospitalQuery';
import type { AuditLogEntry } from '@/features/ops-logs/domain/entities/logs.types';
import { usePlatformUserQuery } from '@/features/ops-platform-users/application/queries/usePlatformUserQuery';
import { useOpsStaffQuery } from '@/features/ops-users/application/queries/useOpsStaffQuery';

/**
 * Characters of a user id shown when the console can't name them — the last
 * ones: ids are UUIDv7, whose first characters are the creation time and so
 * are the same for every account made around then.
 */
const ID_PREVIEW = 8;

/** Rows with no acting user, by principal. */
const NO_ACTOR_LABELS: Readonly<Record<string, string>> = {
  anonymous: 'Signed-out request',
  system: 'System',
  display: 'Display screen',
};

/** An actor picked from a row, to narrow the trail to their actions. */
export interface PickedActor {
  readonly id: string;
  readonly name: string;
}

type PickHandler = ((actor: PickedActor) => void) | undefined;

function shortId(id: string): string {
  return id.slice(-ID_PREVIEW);
}

/**
 * Who acted, by name where the viewer's role can look them up (PRD-08):
 * Medibook staff from the staff list (roles with staff access), patients from
 * their account, hospital staff by their hospital. The trail stores only a user
 * id (PRD-08-B), so anyone else reads as their kind and the id's last eight
 * characters. With `onPick`, the name is a button that narrows the trail.
 */
export function LogActor({ entry, onPick }: { entry: AuditLogEntry; onPick?: PickHandler }) {
  const id = entry.actorUserId;
  if (!id) return <>{NO_ACTOR_LABELS[entry.principal] ?? entry.principal}</>;
  if (entry.principal === 'platform') return <StaffActor id={id} onPick={onPick} />;
  if (entry.principal === 'patient') return <PatientActor id={id} onPick={onPick} />;
  if (entry.principal === 'hospital') {
    return <HospitalStaffActor id={id} hospitalId={entry.hospitalId} onPick={onPick} />;
  }
  return <ActorName id={id} name={`${entry.principal} · ${shortId(id)}`} onPick={onPick} />;
}

function StaffActor({ id, onPick }: { id: string; onPick: PickHandler }) {
  const staff = useOpsStaffQuery(useOpsPermission().can('staff.view'));
  const member = staff.data?.items.find((m) => m.userId === id);
  const name = member ? `${member.name} · Medibook` : `Medibook staff · ${shortId(id)}`;
  return <ActorName id={id} name={name} onPick={onPick} />;
}

function PatientActor({ id, onPick }: { id: string; onPick: PickHandler }) {
  const user = usePlatformUserQuery(id, useOpsPermission().can('platform_users.view'));
  const full = user.data ? [user.data.firstName, user.data.lastName].filter(Boolean).join(' ') : '';
  const name = full ? `${full} · patient` : `Patient · ${shortId(id)}`;
  return <ActorName id={id} name={name} onPick={onPick} />;
}

function HospitalStaffActor({
  id,
  hospitalId,
  onPick,
}: {
  id: string;
  hospitalId: string | null;
  onPick: PickHandler;
}) {
  const canReadHospitals = useOpsPermission().can('hospitals.view');
  const hospital = useHospitalQuery(hospitalId ?? '', canReadHospitals && hospitalId !== null);
  const where = hospital.data ? `${hospital.data.name} staff` : 'Hospital staff';
  return <ActorName id={id} name={`${where} · ${shortId(id)}`} onPick={onPick} />;
}

function ActorName({ id, name, onPick }: { id: string; name: string; onPick: PickHandler }) {
  if (!onPick) return <>{name}</>;
  return (
    <button
      type="button"
      title="Show only this person's actions"
      onClick={() => onPick({ id, name })}
      className="text-text-body hover:text-blue cursor-pointer text-left underline-offset-2 hover:underline"
    >
      {name}
    </button>
  );
}
