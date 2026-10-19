import { publicApi } from '@/core/api/http';
import type { ServerVersion } from '@/core/api/serverVersion.response';
import { serverVersionResponseSchema, toServerVersion } from '@/core/api/serverVersion.response';
import { attempt } from '@/core/error/attempt';
import type { Result } from '@/core/error/failure';

/** `GET /shared/version` — public, no token. */
export function fetchServerVersion(): Promise<Result<ServerVersion>> {
  return attempt(async () => {
    const response = await publicApi.get('/version');
    return toServerVersion(serverVersionResponseSchema.parse(response.data));
  });
}
