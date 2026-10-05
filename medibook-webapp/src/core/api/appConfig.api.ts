import { publicApi } from '@/core/api/http';
import type { AppConfig } from '@/core/api/appConfig.response';
import { appConfigResponseSchema, toAppConfig } from '@/core/api/appConfig.response';
import { attempt } from '@/core/error/attempt';
import type { Result } from '@/core/error/failure';

/** `GET /shared/app-config` — public, no token. */
export function fetchAppConfig(): Promise<Result<AppConfig>> {
  return attempt(async () => {
    const response = await publicApi.get('/app-config');
    return toAppConfig(appConfigResponseSchema.parse(response.data));
  });
}
