import { APP_COMMIT, APP_VERSION } from '@/core/config/build';
import { useServerVersionQuery } from '@/shared/hooks/useServerVersionQuery';

import { apiBuildLabel } from '@/features/profile/presentation/components/profileFormat';

/**
 * Which build is running, for support calls: the web app's version and the
 * commit it was built from, then the API's (UB-07) once `GET /shared/version`
 * answers — left out, without an error, when it does not. Selectable, so it
 * can be copied into a ticket.
 */
export function ProfileBuildInfo() {
  const server = useServerVersionQuery();
  return (
    <p className="text-caption text-text-muted text-center select-text">
      Medibook web app · version <span className="tabular-nums">{APP_VERSION}</span> · build{' '}
      <span className="tabular-nums">{APP_COMMIT}</span>
      {server.data && <span className="tabular-nums"> — {apiBuildLabel(server.data)}</span>}
    </p>
  );
}
