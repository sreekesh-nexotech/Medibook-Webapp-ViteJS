import { displayApi } from '@/core/api/http';
import { AUTH_HEADER, AUTH_SCHEME } from '@/core/config/api';

import {
  displayAuthResponseSchema,
  displayQueueResponseSchema,
} from '@/features/display/infrastructure/data-sources/remote/display.response';

/** `POST /display/auth {device_key}` — unauthenticated, rate-limited per IP. */
export async function postDisplayAuth(deviceKey: string) {
  const response = await displayApi.post('/auth', { device_key: deviceKey });
  return displayAuthResponseSchema.parse(response.data);
}

/** `GET /display/queue` with the display token. */
export async function getDisplayQueue(accessToken: string) {
  const response = await displayApi.get('/queue', {
    headers: { [AUTH_HEADER]: `${AUTH_SCHEME} ${accessToken}` },
  });
  return displayQueueResponseSchema.parse(response.data);
}
