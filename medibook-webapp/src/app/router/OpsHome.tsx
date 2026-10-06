import { Navigate } from 'react-router-dom';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { opsHomePath } from '@/app/router/opsAccess';

/** `/ops`: each platform role starts on the first screen it can open (finance has no dashboard). */
export function OpsHome() {
  return <Navigate to={opsHomePath(useOpsPermission())} replace />;
}
