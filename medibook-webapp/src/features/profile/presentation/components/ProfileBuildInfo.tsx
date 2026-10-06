import { APP_COMMIT, APP_VERSION } from '@/core/config/build';

/**
 * Which build is running, for support calls: the version and the commit it
 * was built from. Selectable, so it can be copied into a ticket.
 */
export function ProfileBuildInfo() {
  return (
    <p className="text-caption text-text-muted text-center select-text">
      Medibook web app · version <span className="tabular-nums">{APP_VERSION}</span> · build{' '}
      <span className="tabular-nums">{APP_COMMIT}</span>
    </p>
  );
}
