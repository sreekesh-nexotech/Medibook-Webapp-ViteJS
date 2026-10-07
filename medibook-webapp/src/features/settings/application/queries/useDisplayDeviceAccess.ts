import type { HospitalSession, StaffSession } from '@/features/auth/domain/entities/auth.types';
import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';

/** What the signed-in staff member may do with display screens (`display_devices.*`). */
export interface DisplayDeviceAccess {
  readonly canView: boolean;
  readonly canAdd: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}

function isHospitalSession(session: StaffSession | undefined): session is HospitalSession {
  return session?.surface === 'hospital';
}

/**
 * Display Devices is a backend permission module outside the ten-module role
 * grid `usePermission` models, so it is read from the session's codes here
 * (as `useCashDeskAccess` does for the cash desk).
 */
export function useDisplayDeviceAccess(): DisplayDeviceAccess {
  const { data } = useSessionQuery('hospital');
  const session = isHospitalSession(data) ? data : null;
  const has = (code: string): boolean => session?.permissions.includes(code) ?? false;
  return {
    canView: has('display_devices.view'),
    canAdd: has('display_devices.add'),
    canEdit: has('display_devices.edit'),
    canDelete: has('display_devices.del'),
  };
}
