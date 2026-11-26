import type {
  DisplayDevice,
  DisplayDeviceChanges,
  DisplaySelection,
} from '@/features/settings/domain/entities/settings.entities';

/**
 * What a display screen shows (client feedback point 8): ONE department (or all of them) and,
 * optionally, some doctors of it. Pure helpers for the Register / Edit form and the list.
 */

/** Just what these helpers read of a doctor. */
export interface DoctorRef {
  readonly id: string;
  readonly name: string;
  readonly departmentId: string;
}

export interface DepartmentRef {
  readonly id: string;
  readonly name: string;
}

/** The doctors a screen can be narrowed to: the department's, or everyone's with no department. */
export function doctorsForDepartment<T extends DoctorRef>(
  doctors: readonly T[],
  departmentId: string | null,
): T[] {
  return departmentId === null
    ? [...doctors]
    : doctors.filter((d) => d.departmentId === departmentId);
}

/**
 * The selection after choosing another department: chosen doctors outside it are dropped (the
 * server refuses a doctor of another department).
 */
export function withDepartment(
  selection: DisplaySelection,
  departmentId: string | null,
  doctors: readonly DoctorRef[],
): DisplaySelection {
  if (departmentId === null) return { departmentId, doctorIds: selection.doctorIds };
  const inside = new Set(doctorsForDepartment(doctors, departmentId).map((d) => d.id));
  return { departmentId, doctorIds: selection.doctorIds.filter((id) => inside.has(id)) };
}

/** Tick / untick one doctor, keeping the order they were picked in. */
export function toggleDoctor(selection: DisplaySelection, doctorId: string): DisplaySelection {
  const has = selection.doctorIds.includes(doctorId);
  return {
    ...selection,
    doctorIds: has
      ? selection.doctorIds.filter((id) => id !== doctorId)
      : [...selection.doctorIds, doctorId],
  };
}

export function selectionOf(device: DisplayDevice): DisplaySelection {
  return { departmentId: device.selectedDepartmentId, doctorIds: device.selectedDoctorIds };
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/**
 * Only what changed, so a rename never re-sends (and re-validates) an untouched selection. A
 * department change always sends the doctors too: the server checks them against it.
 */
export function selectionChanges(
  device: DisplayDevice,
  next: DisplaySelection,
): Pick<DisplayDeviceChanges, 'selectedDepartmentId' | 'selectedDoctorIds'> {
  const departmentChanged = device.selectedDepartmentId !== next.departmentId;
  const doctorsChanged = !sameIds(device.selectedDoctorIds, next.doctorIds);
  if (!departmentChanged && !doctorsChanged) return {};
  return departmentChanged
    ? { selectedDepartmentId: next.departmentId, selectedDoctorIds: next.doctorIds }
    : { selectedDoctorIds: next.doctorIds };
}

/** Doctor names shown in a list row before "+N more". */
const NAMES_SHOWN = 2;

/**
 * One line for the screens list: "All departments", "Cardiology", "Cardiology · Dr Rao, Dr Iyer
 * +1 more". A department or doctor the lists no longer hold reads as "Removed department" /
 * is left out, rather than showing an id.
 */
export function selectionSummary(
  selection: DisplaySelection,
  departments: readonly DepartmentRef[],
  doctors: readonly DoctorRef[],
): string {
  const department =
    selection.departmentId === null
      ? 'All departments'
      : (departments.find((d) => d.id === selection.departmentId)?.name ?? 'Removed department');
  const names = selection.doctorIds
    .map((id) => doctors.find((d) => d.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return department;
  const shown = names.slice(0, NAMES_SHOWN).join(', ');
  const more = names.length > NAMES_SHOWN ? ` +${names.length - NAMES_SHOWN} more` : '';
  return `${department} · ${shown}${more}`;
}
