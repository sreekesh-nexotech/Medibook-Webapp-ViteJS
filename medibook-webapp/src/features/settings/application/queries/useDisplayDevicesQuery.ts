import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchDisplayDevices } from '@/features/settings/application/usecases/fetchDisplayDevices';

/** The hospital's token display screens (`display_devices.view`). */
export function useDisplayDevicesQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.displayDevices(),
    queryFn: async () => unwrap(await fetchDisplayDevices()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
