import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { fetchDoctorPhotoUrl } from '@/features/doctors/application/usecases/fetchDoctorPhotoUrl';

/** Signed photo links live 10 minutes; refresh well before they expire. */
const PHOTO_URL_STALE_TIME_MS = 8 * 60_000;

/** A displayable URL for a doctor's photo. `null` file id stays idle. */
export function useDoctorPhotoQuery(fileId: string | null) {
  return useQuery({
    queryKey: doctorsKeys.photo(fileId ?? ''),
    queryFn: async () => unwrap(await fetchDoctorPhotoUrl(fileId ?? '')),
    enabled: fileId !== null,
    staleTime: PHOTO_URL_STALE_TIME_MS,
    refetchInterval: PHOTO_URL_STALE_TIME_MS,
  });
}
