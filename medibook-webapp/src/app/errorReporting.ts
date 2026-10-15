import { reportUncaughtErrors } from '@/core/error/monitoring';

import { isStaleBuildError } from '@/app/staleBuild';

/**
 * Report errors nothing else caught (OBS-01). A code file removed by a
 * redeploy is expected and handled by a reload (RUN-01), so it is not sent.
 */
export function installErrorReporting(): void {
  reportUncaughtErrors(isStaleBuildError);
}
