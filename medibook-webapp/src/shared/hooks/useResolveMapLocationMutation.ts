import { useMutation } from '@tanstack/react-query';

import { resolveMapLocation } from '@/core/api/mapLocation.api';
import { unwrap } from '@/core/error/failure';

/**
 * Read a hospital's map location from a pasted Google Maps link or typed coordinates (client
 * feedback point 3). Nothing is saved; the error is a typed `Failure` whose
 * `fieldErrors.text` is a sentence to show under the box.
 */
export function useResolveMapLocationMutation() {
  return useMutation({
    mutationFn: async (text: string) => unwrap(await resolveMapLocation(text)),
  });
}
