import type {
  HospitalSession,
  StaffCounter,
  StaffSession,
} from '@/features/auth/domain/entities/auth.types';
import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';

/** What the signed-in staff member may do with cash drawers (`cash_desk.*`). */
export interface CashDeskAccess {
  readonly canView: boolean;
  /** Open a drawer (`cash_desk.add`). */
  readonly canOpen: boolean;
  /** Close a drawer (`cash_desk.edit`). */
  readonly canClose: boolean;
  /** Reconcile closed drawers — admins (`cash_desk.del`). */
  readonly canReconcile: boolean;
  readonly staffId: string | null;
  readonly defaultCounter: StaffCounter | null;
}

/**
 * Cash-desk permissions straight from the hospital session's permission
 * codes. Cash Desk is a backend module outside the ten-module role grid that
 * `usePermission` models, so it is read here instead.
 */
function isHospitalSession(session: StaffSession | undefined): session is HospitalSession {
  return session?.surface === 'hospital';
}

export function useCashDeskAccess(): CashDeskAccess {
  const { data } = useSessionQuery('hospital');
  const session = isHospitalSession(data) ? data : null;
  const has = (code: string): boolean => session?.permissions.includes(code) ?? false;
  return {
    canView: has('cash_desk.view'),
    canOpen: has('cash_desk.add'),
    canClose: has('cash_desk.edit'),
    canReconcile: has('cash_desk.del'),
    staffId: session?.staffId ?? null,
    defaultCounter: session?.defaultCounter ?? null,
  };
}
