import { reportUncaughtErrors } from '@/core/error/monitoring';
import { startSentry } from '@/core/error/sentry';

import { isStaleBuildError } from '@/app/staleBuild';

/**
 * Start Sentry when the build names a DSN, then report errors nothing else
 * caught (OBS-01). A code file removed by a redeploy is expected and handled
 * by a reload (RUN-01), so it is not sent.
 */
export function installErrorReporting(): void {
  startSentry();
  reportUncaughtErrors(isStaleBuildError);
}
